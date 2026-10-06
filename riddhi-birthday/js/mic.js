const SAMPLE_MS = 33;
const RESET_MS = 150;
const PERMISSION_TIMEOUT_MS = 15000;

/**
 * Local, opt-in microphone level detection. Call start() directly inside the
 * enable-microphone tap, and destroy() when the chapter leaves. No audio is
 * recorded, played back, or sent anywhere. onLevel receives raw RMS in [0, 1].
 * The detector starts disarmed; setArmed(true) enables candle-blow callbacks.
 */
export function createBlowDetector({
  onBlow = () => {},
  onLevel = () => {},
  onStatus = () => {},
  threshold = 0.18,
  holdMs = 250,
} = {}) {
  const triggerLevel = Number.isFinite(threshold) ? Math.max(0.01, Math.min(1, threshold)) : 0.18;
  const triggerMs = Number.isFinite(holdMs) ? Math.max(0, holdMs) : 250;
  const resetLevel = Math.min(0.1, triggerLevel * 0.6);
  let destroyed = false;
  let armed = false;
  let status = 'idle';
  let context = null;
  let stream = null;
  let source = null;
  let analyser = null;
  let samples = null;
  let sampleTimer = null;
  let pending = null;
  let generation = 0;
  let aboveSince = null;
  let belowSince = null;
  let waitingForQuiet = false;

  function supported() {
    return !destroyed && globalThis.isSecureContext !== false
      && typeof globalThis.navigator?.mediaDevices?.getUserMedia === 'function'
      && typeof (globalThis.AudioContext ?? globalThis.webkitAudioContext) === 'function';
  }

  function reportStatus(next) {
    if (status === next) return;
    status = next;
    onStatus(next);
  }

  function resetDetection() {
    aboveSince = null;
    belowSince = null;
    waitingForQuiet = false;
  }

  function stopTracks(mediaStream) {
    mediaStream?.getTracks().forEach((track) => {
      track.onended = null;
      try { track.stop(); } catch { /* Already stopped by the browser. */ }
    });
  }

  function releaseHardware() {
    clearInterval(sampleTimer);
    sampleTimer = null;
    stopTracks(stream);
    stream = null;
    try { source?.disconnect(); } catch { /* Node already disconnected. */ }
    try { analyser?.disconnect(); } catch { /* Node already disconnected. */ }
    source = null;
    analyser = null;
    samples = null;
    const previousContext = context;
    context = null;
    try {
      if (previousContext && previousContext.state !== 'closed') {
        Promise.resolve(previousContext.close()).catch(() => {});
      }
    } catch { /* Context may have closed during permission handling. */ }
    resetDetection();
    onLevel(0);
  }

  function settleRequest(request, success) {
    clearTimeout(request.timer);
    request.timer = null;
    if (pending === request) pending = null;
    request.resolve(success);
  }

  function stop() {
    generation += 1;
    if (pending) settleRequest(pending, false);
    releaseHardware();
    reportStatus('idle');
  }

  function unavailable(request) {
    if (pending !== request || request.generation !== generation) return;
    generation += 1;
    settleRequest(request, false);
    releaseHardware();
    reportStatus('unavailable');
  }

  function sample() {
    if (destroyed || !analyser || !samples) return;
    if (globalThis.document?.hidden) { stop(); return; }
    // Browsers can suspend a context after OS interruptions. A fresh explicit
    // microphone tap is required to resume; never keep hardware open silently.
    if (context?.state !== 'running') { stop(); return; }
    try {
      analyser.getByteTimeDomainData(samples);
    } catch { stop(); return; }
    let energy = 0;
    for (let i = 0; i < samples.length; i += 1) {
      const value = (samples[i] - 128) / 128;
      energy += value * value;
    }
    const rms = Math.min(1, Math.sqrt(energy / samples.length));
    onLevel(rms);
    if (!armed || destroyed || sampleTimer === null) return;
    const now = globalThis.performance?.now() ?? Date.now();
    if (waitingForQuiet) {
      if (rms < resetLevel) {
        belowSince ??= now;
        if (now - belowSince >= RESET_MS) {
          waitingForQuiet = false;
          belowSince = null;
        }
      } else belowSince = null;
      return;
    }
    if (rms >= triggerLevel) {
      aboveSince ??= now;
      if (now - aboveSince >= triggerMs) {
        // Latch before notifying the scene so one sustained breath fires once.
        waitingForQuiet = true;
        aboveSince = null;
        belowSince = null;
        onBlow();
      }
    } else aboveSince = null;
  }

  function start() {
    if (destroyed) return Promise.resolve(false);
    if (globalThis.document?.hidden) { stop(); return Promise.resolve(false); }
    if (!supported()) { reportStatus('unavailable'); return Promise.resolve(false); }
    if (sampleTimer !== null) return Promise.resolve(true);
    if (pending) return pending.promise;

    // Create AND resume synchronously inside the caller's tap. Waiting for the
    // permission prompt first loses the user activation needed by iOS Safari.
    let resumePromise;
    try {
      const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      context = new AudioContextClass();
      resumePromise = context.state === 'running'
        ? Promise.resolve(true)
        : Promise.resolve(context.resume()).then(() => true, () => false);
    } catch {
      releaseHardware();
      reportStatus('unavailable');
      return Promise.resolve(false);
    }

    const request = { generation: ++generation, timer: null, resolve: null, promise: null };
    request.promise = new Promise((resolve) => { request.resolve = resolve; });
    pending = request;
    request.timer = setTimeout(() => unavailable(request), PERMISSION_TIMEOUT_MS);
    reportStatus('requesting');

    let permission;
    try { permission = globalThis.navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { unavailable(request); return request.promise; }
    Promise.resolve(permission).then(async (newStream) => {
      if (destroyed || pending !== request || request.generation !== generation || globalThis.document?.hidden) {
        stopTracks(newStream);
        return;
      }
      stream = newStream;
      const resumed = await resumePromise;
      if (destroyed || pending !== request || request.generation !== generation) {
        stopTracks(newStream);
        return;
      }
      if (!resumed || context?.state !== 'running' || !newStream.getAudioTracks().some((track) => track.readyState === 'live')) {
        unavailable(request);
        return;
      }
      source = context.createMediaStreamSource(newStream);
      analyser = context.createAnalyser();
      analyser.fftSize = 256;
      samples = new Uint8Array(analyser.fftSize);
      source.connect(analyser);
      // Deliberately never connect microphone input to the speakers.
      newStream.getTracks().forEach((track) => { track.onended = stop; });
      resetDetection();
      sampleTimer = setInterval(sample, SAMPLE_MS);
      settleRequest(request, true);
      reportStatus('listening');
    }).catch(() => unavailable(request));
    return request.promise;
  }

  function onVisibilityChange() {
    if (globalThis.document?.hidden) stop();
  }
  globalThis.document?.addEventListener('visibilitychange', onVisibilityChange);
  globalThis.addEventListener?.('pagehide', stop);

  return {
    start,
    setArmed(value) { armed = !destroyed && Boolean(value); resetDetection(); },
    stop,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      armed = false;
      globalThis.document?.removeEventListener('visibilitychange', onVisibilityChange);
      globalThis.removeEventListener?.('pagehide', stop);
      stop();
    },
    get active() { return !destroyed && sampleTimer !== null && status === 'listening'; },
    get available() { return supported(); },
  };
}
