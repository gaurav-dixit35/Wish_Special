import { createVoicePlayer } from './voice-player.js';

const NORMAL_VOLUME = 0.55;
const DUCKED_VOLUME = 0.15;
const TUNE_NOTES = [261.63, 329.63, 392, 523.25, 440, 392, 329.63, 0, 293.66, 349.23, 440, 523.25, 392, 349.23, 293.66, 0];

export function createAudioEngine({ config, state, preloader } = {}) {
  const settings = config?.audio ?? {};
  const currentState = state ?? { audioOn: false, muted: false };
  const tune = typeof Audio === 'function' ? new Audio() : null;
  const pools = new Map();
  const oscillators = new Set();
  let context = null;
  let tuneGain = null;
  let sfxGain = null;
  let source = null;
  let destroyed = false;
  const duckOwners = new Set();
  const voiceEndListeners = new Set();
  const voiceActivityListeners = new Set();
  const voicePlayers = new Set();
  let activeVoicePlayer = null;
  let voice = null;
  let startPromise = null;
  let synthTimer = null;
  let volumeTimer = null;
  let playTimeout = null;
  let settlePendingPlay = null;
  let nextNoteTime = 0;
  let noteIndex = 0;
  let pausedForVisibility = false;

  function publishVoiceActivity() {
    if (destroyed) return;
    const playing = Boolean(voice || activeVoicePlayer);
    voiceActivityListeners.forEach((callback) => {
      try { callback(playing); } catch (error) { console.warn('[audio] Could not refresh voice activity.', error); }
    });
  }

  if (tune) {
    tune.loop = true;
    tune.preload = 'auto';
    tune.volume = NORMAL_VOLUME;
    tune.muted = currentState.muted;
  }

  function cached(src) {
    const entry = preloader?.results?.get(src);
    return entry?.status === 'loaded' && typeof entry.value === 'string' ? entry.value : src;
  }

  function missing(src) {
    return !src || preloader?.results?.get(src)?.status === 'placeholder';
  }

  // This is called synchronously in start()/playSfx() so mobile browsers see the tap.
  function ensureContext() {
    if (destroyed) return null;
    try {
      if (!context) {
        const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
        if (!AudioContextClass) return null;
        context = new AudioContextClass();
        tuneGain = context.createGain();
        sfxGain = context.createGain();
        tuneGain.gain.value = currentState.muted ? 0 : (duckOwners.size ? DUCKED_VOLUME : NORMAL_VOLUME);
        sfxGain.gain.value = currentState.muted ? 0 : 0.22;
        tuneGain.connect(context.destination);
        sfxGain.connect(context.destination);
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context;
    } catch (error) {
      console.warn('[audio] Sound is unavailable in this browser.', error);
      return null;
    }
  }

  function ramp(param, target, duration = 0.4) {
    if (!context || !param) return;
    param.cancelScheduledValues(context.currentTime);
    param.setValueAtTime(param.value, context.currentTime);
    param.linearRampToValueAtTime(target, context.currentTime + duration);
  }

  function updateVolume() {
    const target = duckOwners.size ? DUCKED_VOLUME : NORMAL_VOLUME;
    if (tune) {
      tune.muted = currentState.muted;
      clearInterval(volumeTimer);
      const initial = tune.volume;
      const started = Date.now();
      volumeTimer = setInterval(() => {
        const ratio = Math.min(1, (Date.now() - started) / 400);
        tune.volume = Math.max(0, Math.min(1, initial + (target - initial) * ratio));
        if (ratio === 1) { clearInterval(volumeTimer); volumeTimer = null; }
      }, 16);
    }
    ramp(tuneGain?.gain, currentState.muted ? 0 : target);
    ramp(sfxGain?.gain, currentState.muted ? 0 : 0.22, 0.03);
    pools.forEach((pool) => pool.items.forEach((sound) => { sound.muted = currentState.muted; }));
    if (voice) voice.sound.muted = currentState.muted;
    voicePlayers.forEach((player) => player.setMuted(currentState.muted));
  }

  function tone(frequency, at, duration, gainNode, type = 'sine', level = 0.15, endFrequency = frequency) {
    if (!context || !gainNode || !frequency || destroyed) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), at + duration);
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(level, at + Math.min(0.035, duration / 4));
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(envelope);
    envelope.connect(gainNode);
    oscillators.add(oscillator);
    oscillator.onended = () => {
      oscillators.delete(oscillator);
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  }

  function scheduleTune() {
    if (destroyed || source !== 'synth' || !context || context.state !== 'running' || globalThis.document?.hidden) return;
    if (nextNoteTime < context.currentTime - 0.3) nextNoteTime = context.currentTime + 0.04;
    while (nextNoteTime < context.currentTime + 0.25) {
      const frequency = TUNE_NOTES[noteIndex % TUNE_NOTES.length];
      if (frequency) {
        tone(frequency, nextNoteTime, 1.2, tuneGain, 'sine', 0.16);
        tone(frequency / 2, nextNoteTime, 1.5, tuneGain, 'sine', 0.055);
      }
      nextNoteTime += 0.65;
      noteIndex += 1;
    }
  }

  async function startSynth() {
    const audioContext = ensureContext();
    if (!audioContext) return false;
    try {
      if (audioContext.state !== 'running') await audioContext.resume();
      if (destroyed || audioContext.state !== 'running') return false;
      tune?.pause();
      source = 'synth';
      currentState.audioOn = true;
      if (!synthTimer) {
        nextNoteTime = audioContext.currentTime + 0.04;
        scheduleTune();
        synthTimer = setInterval(scheduleTune, 120);
      }
      return true;
    } catch { return false; }
  }

  function playFile() {
    return new Promise((resolve) => {
      let finished = false;
      function settle(success) {
        if (finished) return;
        finished = true;
        clearTimeout(playTimeout);
        playTimeout = null;
        settlePendingPlay = null;
        resolve(success);
      }
      settlePendingPlay = settle;
      playTimeout = setTimeout(() => { tune.pause(); settle(false); }, 4500);
      try {
        const result = tune.play();
        if (result?.then) result.then(() => {
          if (finished || destroyed) { tune.pause(); return; }
          settle(true);
        }).catch(() => settle(false));
        else settle(true);
      } catch { settle(false); }
    });
  }

  function start() {
    if (destroyed) return Promise.resolve(false);
    if (source) {
      // A fresh tap also resumes a context suspended by the browser or the OS.
      ensureContext();
      if (source === 'file' && tune?.paused && !globalThis.document?.hidden) {
        return Promise.resolve(tune.play()).then(() => true).catch(() => false);
      }
      return Promise.resolve(true);
    }
    if (startPromise) return startPromise;
    ensureContext();
    startPromise = (async () => {
      if (tune && !missing(settings.tune)) {
        tune.src = cached(settings.tune);
        if (await playFile()) {
          if (destroyed) return false;
          source = 'file';
          currentState.audioOn = true;
          return true;
        }
        console.warn('[audio] Birthday recording unavailable; using the gentle placeholder melody.');
      }
      return startSynth();
    })().catch((error) => {
      console.warn('[audio] Unable to start sound.', error);
      return false;
    }).finally(() => { startPromise = null; });
    return startPromise;
  }

  function synthSfx(name) {
    const audioContext = ensureContext();
    if (!audioContext || currentState.muted) return;
    const at = audioContext.currentTime + 0.005;
    if (name === 'tick') {
      tone(950, at, .035, sfxGain, 'triangle', .12, 700);
    } else if (name === 'snore') {
      tone(115, at, 0.5, sfxGain, 'sine', 0.35, 65);
      tone(80, at + 0.24, 0.45, sfxGain, 'sine', 0.2, 100);
    } else if (name === 'sparkle' || name === 'match') {
      [659.25, 830.61, 987.77].forEach((frequency, index) => tone(frequency, at + index * 0.09, 0.4, sfxGain, 'sine', 0.22));
    } else if (name === 'whistle') {
      tone(660, at, 0.45, sfxGain, 'sine', 0.22, 1320);
    } else if (name === 'thud') {
      tone(145, at, 0.2, sfxGain, 'triangle', 0.34, 55);
      tone(72, at, 0.28, sfxGain, 'sine', 0.3, 40);
    } else if (name === 'whoosh' || name === 'blow') {
      tone(310, at, 0.28, sfxGain, 'triangle', 0.2, 60);
    } else {
      tone(520, at, 0.12, sfxGain, 'sine', 0.28, 180);
    }
  }

  function playSfx(name) {
    if (destroyed || currentState.muted) return;
    ensureContext();
    const src = settings.sfx?.[name];
    if (!src || missing(src) || typeof Audio !== 'function') { synthSfx(name); return; }
    try {
      let pool = pools.get(name);
      if (!pool) {
        pool = { index: 0, items: Array.from({ length: 2 }, () => {
          const sound = new Audio(cached(src));
          sound.preload = 'auto';
          sound.volume = 0.45;
          sound.muted = currentState.muted;
          return sound;
        }) };
        pools.set(name, pool);
      }
      const sound = pool.items[pool.index++ % pool.items.length];
      sound.currentTime = 0;
      Promise.resolve(sound.play()).catch(() => { if (!destroyed) synthSfx(name); });
    } catch { synthSfx(name); }
  }

  function onVisibilityChange() {
    if (destroyed) return;
    if (document.hidden) {
      activeVoicePlayer?.pause('hidden');
      stopVoice();
      pausedForVisibility = source === 'file' && !tune.paused;
      if (pausedForVisibility) tune.pause();
      pools.forEach((pool) => pool.items.forEach((sound) => sound.pause()));
      if (context?.state === 'running') context.suspend().catch(() => {});
    } else {
      if (context?.state === 'suspended' && currentState.audioOn) context.resume().catch(() => {});
      if (pausedForVisibility) tune.play().catch(() => {});
      pausedForVisibility = false;
    }
  }

  function stopVoice(reason = 'stopped') {
    if (!voice) return;
    const previous = voice;
    voice = null;
    previous.settle(false);
    previous.sound.onended = previous.sound.onerror = null;
    previous.sound.pause();
    previous.sound.removeAttribute('src');
    previous.sound.load();
    duckOwners.delete('voice');
    if (!destroyed) updateVolume();
    publishVoiceActivity();
    voiceEndListeners.forEach((callback) => {
      try { callback(reason); } catch (error) { console.warn('[audio] Could not refresh voice status.', error); }
    });
  }

  // Voice playback starts inside the user's tap and has its own duck owner.
  // A microphone session ending cannot raise the music over a playing message.
  function playVoice(path) {
    activeVoicePlayer?.pause('interrupted');
    stopVoice();
    if (destroyed || missing(path) || typeof Audio !== 'function' || globalThis.document?.hidden) return Promise.resolve(false);
    return new Promise((resolve) => {
      let settled = false;
      let timeout;
      const sound = new Audio(cached(path));
      const session = {sound, settle(success) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(success);
      }};
      voice = session;
      publishVoiceActivity();
      sound.preload = 'auto';
      sound.volume = 1;
      sound.muted = currentState.muted;
      duckOwners.add('voice');
      updateVolume();
      const stop = () => { if (voice === session) stopVoice('unavailable'); };
      sound.onended = () => { if (voice === session) stopVoice('ended'); };
      sound.onerror = stop;
      timeout = setTimeout(stop, 5000);
      try {
        Promise.resolve(sound.play()).then(() => {
          if (destroyed || voice !== session) { sound.pause(); return; }
          session.settle(true);
        }).catch(stop);
      } catch { stop(); }
    });
  }

  globalThis.document?.addEventListener('visibilitychange', onVisibilityChange);

  return {
    start,
    playSfx,
    playVoice,
    stopVoice,
    createVoicePlayer() {
      if (destroyed) return null;
      const player = createVoicePlayer({
        cached, missing,
        muted: () => currentState.muted,
        context: ensureContext,
        claim(next) {
          stopVoice('replaced');
          if (activeVoicePlayer && activeVoicePlayer !== next) activeVoicePlayer.pause('interrupted');
          activeVoicePlayer = next;
          duckOwners.add('voice-track');
          updateVolume();
          publishVoiceActivity();
        },
        release(previous) {
          if (activeVoicePlayer !== previous) return;
          activeVoicePlayer = null;
          duckOwners.delete('voice-track');
          if (!destroyed) updateVolume();
          publishVoiceActivity();
        },
        onDestroy(previous) { voicePlayers.delete(previous); },
      });
      voicePlayers.add(player);
      return player;
    },
    onVoiceEnd(callback) {
      if (destroyed || typeof callback !== 'function') return () => {};
      voiceEndListeners.add(callback);
      return () => voiceEndListeners.delete(callback);
    },
    onVoiceActivity(callback) {
      if (destroyed || typeof callback !== 'function') return () => {};
      voiceActivityListeners.add(callback);
      callback(Boolean(voice || activeVoicePlayer));
      return () => voiceActivityListeners.delete(callback);
    },
    toggleMute() {
      currentState.muted = !currentState.muted;
      updateVolume();
      return currentState.muted;
    },
    duck(owner = 'default') { duckOwners.add(owner); updateVolume(); },
    unduck(owner = 'default') { duckOwners.delete(owner); updateVolume(); },
    get playing() { return !destroyed && !!source; },
    get voicePlaying() { return !destroyed && Boolean(voice || activeVoicePlayer); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopVoice();
      [...voicePlayers].forEach((player) => player.destroy());
      voicePlayers.clear();
      voiceEndListeners.clear();
      voiceActivityListeners.clear();
      duckOwners.clear();
      currentState.audioOn = false;
      globalThis.document?.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(synthTimer);
      clearInterval(volumeTimer);
      clearTimeout(playTimeout);
      settlePendingPlay?.(false);
      if (tune) { tune.pause(); tune.removeAttribute('src'); tune.load(); }
      pools.forEach((pool) => pool.items.forEach((sound) => { sound.pause(); sound.removeAttribute('src'); sound.load(); }));
      pools.clear();
      oscillators.forEach((oscillator) => { try { oscillator.stop(); } catch { /* Already ended. */ } });
      oscillators.clear();
      context?.close().catch(() => {});
      source = null;
    },
  };
}
