// A chapter-owned recording, coordinated by the persistent audio engine.
// No synthetic speech substitutes for a missing personal message.
export function createVoicePlayer({ cached = (path) => path, missing = () => false,
  muted = () => false, context = () => null, claim = () => {}, release = () => {},
  onDestroy = () => {} } = {}) {
  const listeners = new Set();
  let sound = null;
  let mediaSource = null;
  let analyser = null;
  let analyserContext = null;
  let frequencies = null;
  let path = '';
  let status = 'idle';
  let reason = '';
  let position = 0;
  let duration = 0;
  let generation = 0;
  let destroyed = false;
  let settlePlay = null;
  let timeout = null;
  let api;

  function snapshot() {
    return { path, status, reason, currentTime: sound?.currentTime || position,
      duration: Number.isFinite(sound?.duration) ? sound.duration : duration };
  }

  function publish() {
    const current = snapshot();
    listeners.forEach((callback) => {
      try { callback(current); } catch (error) { console.warn('[voice] Could not refresh recording.', error); }
    });
  }

  function cancelPending() {
    clearTimeout(timeout);
    timeout = null;
    const settle = settlePlay;
    settlePlay = null;
    settle?.(false);
  }

  function disconnect() {
    try { mediaSource?.disconnect(); } catch { /* Already released. */ }
    try { analyser?.disconnect(); } catch { /* Already released. */ }
    mediaSource = analyser = analyserContext = frequencies = null;
  }

  function disposeSound() {
    disconnect();
    if (!sound) return;
    sound.onended = sound.onerror = sound.ontimeupdate = sound.onloadedmetadata = null;
    sound.pause();
    sound.removeAttribute('src');
    sound.load();
    sound = null;
  }

  function attachAnalyser(audioContext) {
    if (mediaSource || !sound || audioContext?.state !== 'running'
      || typeof audioContext.createAnalyser !== 'function'
      || typeof audioContext.createMediaElementSource !== 'function') return true;
    let nextAnalyser = null;
    let nextSource = null;
    try {
      nextAnalyser = audioContext.createAnalyser();
      nextAnalyser.fftSize = 128;
      nextAnalyser.smoothingTimeConstant = .78;
      nextAnalyser.connect(audioContext.destination);
      nextSource = audioContext.createMediaElementSource(sound);
      nextSource.connect(nextAnalyser);
      mediaSource = nextSource;
      analyser = nextAnalyser;
      analyserContext = audioContext;
      frequencies = new Uint8Array(analyser.frequencyBinCount);
      return true;
    } catch {
      try { nextAnalyser?.disconnect(); } catch { /* Partial graph. */ }
      try { nextSource?.disconnect(); } catch { /* Partial graph. */ }
      if (!nextSource) return true;
      // Creating a media source redirects native output immediately. If its
      // analyser connection failed, keep an audible direct path to the output.
      try {
        nextSource.connect(audioContext.destination);
        mediaSource = nextSource;
        analyserContext = audioContext;
        return true;
      } catch {
        // The caller will replace the rerouted element with plain native audio.
        return false;
      }
    }
  }

  function makeSound() {
    const next = new Audio(cached(path));
    sound = next;
    next.preload = 'metadata';
    next.volume = 1;
    next.muted = muted();
    function restorePosition() {
      if (sound !== next) return;
      if (Number.isFinite(next.duration)) duration = next.duration;
      if (position > 0) {
        try { next.currentTime = Math.min(position, duration || position); } catch { /* Metadata can arrive later. */ }
      }
      publish();
    }
    next.onloadedmetadata = restorePosition;
    next.ontimeupdate = () => {
      if (sound !== next) return;
      position = next.currentTime || 0;
      publish();
    };
    next.onended = () => {
      if (sound !== next || destroyed) return;
      ++generation;
      cancelPending();
      status = 'ended';
      reason = 'ended';
      position = Number.isFinite(next.duration) ? next.duration : next.currentTime;
      release(api);
      publish();
    };
    next.onerror = () => {
      if (sound !== next || destroyed) return;
      ++generation;
      cancelPending();
      status = 'unavailable';
      reason = 'unavailable';
      release(api);
      disposeSound();
      publish();
    };
    restorePosition();
  }

  function pause(nextReason = 'paused') {
    if (destroyed || !['loading', 'playing'].includes(status)) return;
    ++generation;
    cancelPending();
    position = sound?.currentTime || position;
    sound?.pause();
    status = 'paused';
    reason = nextReason;
    release(api);
    publish();
  }

  function select(nextPath) {
    if (destroyed || nextPath === path) return;
    ++generation;
    cancelPending();
    release(api);
    disposeSound();
    path = typeof nextPath === 'string' ? nextPath : '';
    position = duration = 0;
    status = missing(path) || !path ? 'unavailable' : 'idle';
    reason = '';
    publish();
  }

  function play(nextPath = path) {
    if (destroyed || globalThis.document?.hidden) return Promise.resolve(false);
    if (nextPath !== path) select(nextPath);
    if (status === 'playing') return Promise.resolve(true);
    if (!path || missing(path) || typeof Audio !== 'function') {
      status = 'unavailable';
      publish();
      return Promise.resolve(false);
    }
    ++generation;
    cancelPending();
    const operation = generation;
    // Resume the context and call native play in the original click, never after
    // an awaited decode/fetch. Suspended Web Audio must not swallow the sound.
    const audioContext = context();
    if (mediaSource && analyserContext?.state !== 'running') {
      position = sound?.currentTime || position;
      disposeSound();
    }
    if (status === 'ended') { position = 0; if (sound) sound.currentTime = 0; }
    try { if (!sound) makeSound(); }
    catch { status = 'unavailable'; publish(); return Promise.resolve(false); }
    const playingSound = sound;
    claim(api);
    status = 'loading';
    reason = '';
    publish();
    return new Promise((resolve) => {
      settlePlay = resolve;
      const fail = () => {
        if (destroyed || operation !== generation) return;
        ++generation;
        cancelPending();
        status = 'unavailable';
        reason = 'unavailable';
        release(api);
        disposeSound();
        publish();
      };
      timeout = setTimeout(fail, 5000);
      try {
        Promise.resolve(playingSound.play()).then(async () => {
          if (destroyed || operation !== generation || sound !== playingSound) {
            // A cancelled request must not stop a newer play of the same audio.
            if (sound !== playingSound || !['loading', 'playing'].includes(status)) playingSound.pause();
            return;
          }
          if (!attachAnalyser(audioContext)) {
            position = playingSound.currentTime || position;
            disposeSound();
            makeSound();
            const replacement = sound;
            await replacement.play();
            if (destroyed || operation !== generation || sound !== replacement) {
              if (sound !== replacement || !['loading', 'playing'].includes(status)) replacement.pause();
              return;
            }
          }
          clearTimeout(timeout);
          timeout = null;
          settlePlay = null;
          status = 'playing';
          publish();
          resolve(true);
        }).catch(fail);
      } catch { fail(); }
    });
  }

  api = {
    play, pause, select,
    get state() { return snapshot(); },
    setMuted(value) { if (sound) sound.muted = Boolean(value); },
    levels(time = 0) {
      if (status !== 'playing' || muted()) return Array(32).fill(.12);
      if (analyser && analyserContext?.state === 'running') {
        try {
          analyser.getByteFrequencyData(frequencies);
          return Array.from({ length: 32 }, (_, index) => Math.max(.12, frequencies[index * 2] / 255));
        } catch { /* A lost analyser keeps playback and the sine fallback. */ }
      }
      return Array.from({ length: 32 }, (_, index) => .15 + Math.abs(Math.sin(time / 230 + index * .64)) * (.25 + .35 * Math.sin(index / 31 * Math.PI)));
    },
    subscribe(callback) {
      if (destroyed || typeof callback !== 'function') return () => {};
      listeners.add(callback);
      callback(snapshot());
      return () => listeners.delete(callback);
    },
    destroy() {
      if (destroyed) return;
      ++generation;
      cancelPending();
      release(api);
      destroyed = true;
      status = 'destroyed';
      disposeSound();
      listeners.clear();
      onDestroy(api);
    },
  };
  return api;
}
