import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioEngine } from '../js/audio.js';

function setup(t, options = {}) {
  const originals = { Audio: globalThis.Audio, AudioContext: globalThis.AudioContext,
    webkitAudioContext: globalThis.webkitAudioContext, document: globalThis.document };
  class FakeAudio {
    static instances = [];
    static nextPlay = null;
    constructor(src = '') {
      this.src = src;
      this.currentTime = 0;
      this.duration = 120;
      this.paused = true;
      this.volume = 1;
      FakeAudio.instances.push(this);
    }
    play() { this.paused = false; const pending = FakeAudio.nextPlay; FakeAudio.nextPlay = null; return pending ?? Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    load() {}
  }
  class FakeContext {
    static instance;
    constructor() { FakeContext.instance = this; this.state = options.suspended ? 'suspended' : 'running'; this.destination = { kind: 'destination' }; this.currentTime = 0; this.sources = []; this.analysers = []; this.rejectResume = !!options.suspended; }
    createGain() { return { gain: { value: 1, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }; }
    createAnalyser() {
      const node = { kind: 'analyser', frequencyBinCount: 64, disconnected: false, connect() {}, disconnect() { this.disconnected = true; }, getByteFrequencyData(data) { data.fill(128); } };
      this.analysers.push(node);
      return node;
    }
    createMediaElementSource(sound) {
      const node = { sound, target: null, connect(target) {
        if (options.failAllConnections || (options.failAnalyserConnection && target.kind === 'analyser')) throw new Error('Connection unavailable');
        this.target = target;
      }, disconnect() { this.target = null; } };
      this.sources.push(node);
      return node;
    }
    resume() { if (this.rejectResume) return Promise.reject(new Error('Context unavailable')); this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  const document = new EventTarget();
  document.hidden = false;
  globalThis.Audio = FakeAudio;
  globalThis.document = document;
  globalThis.AudioContext = options.context ? FakeContext : undefined;
  globalThis.webkitAudioContext = undefined;
  const state = { audioOn: false, muted: !!options.muted };
  const results = new Map([
    ['voice.mp3', options.missing ? { status: 'placeholder' } : { status: 'loaded', value: 'blob:voice' }],
    ['secret.mp3', { status: 'loaded', value: 'blob:secret' }],
  ]);
  const engine = createAudioEngine({ config: { audio: { tune: 'music.mp3' } }, state, preloader: { results } });
  const player = engine.createVoicePlayer();
  player.select('voice.mp3');
  t.after(() => {
    engine.destroy();
    for (const [key, value] of Object.entries(originals)) globalThis[key] = value;
  });
  return { engine, player, FakeAudio, FakeContext, document, state };
}

test('recording starts cached media in the tap, follows global mute and publishes activity without requiring music', async (t) => {
  const { engine, player, FakeAudio } = setup(t, { muted: true });
  const activity = [];
  const unsubscribe = engine.onVoiceActivity((active) => activity.push(active));
  const started = player.play();
  const sound = FakeAudio.instances.at(-1);
  assert.equal(sound.paused, false);
  assert.equal(sound.src, 'blob:voice');
  assert.equal(engine.playing, false);
  assert.equal(engine.voicePlaying, true);
  assert.equal(await started, true);
  assert.equal(sound.muted, true);
  engine.toggleMute();
  assert.equal(sound.muted, false);
  player.pause();
  assert.equal(engine.voicePlaying, false);
  assert.deepEqual(activity, [false, true, false]);
  unsubscribe();
});

test('pause resumes at the same position; replay starts at the beginning only after the recording ends', async (t) => {
  const { player, FakeAudio } = setup(t);
  await player.play();
  const sound = FakeAudio.instances.at(-1);
  sound.currentTime = 37;
  player.pause();
  assert.equal(player.state.currentTime, 37);
  await player.play();
  assert.equal(FakeAudio.instances.at(-1), sound);
  assert.equal(sound.currentTime, 37);
  sound.currentTime = 120;
  sound.onended();
  assert.equal(player.state.status, 'ended');
  await player.play();
  assert.equal(sound.currentTime, 0);
});

test('unavailable and corrupt recordings fail honestly and release activity', async (t) => {
  const { engine, player, FakeAudio } = setup(t, { missing: true });
  assert.equal(await player.play(), false);
  assert.equal(FakeAudio.instances.length, 1);
  assert.equal(player.state.status, 'unavailable');
  assert.equal(engine.voicePlaying, false);
  player.select('corrupt.mp3');
  FakeAudio.nextPlay = Promise.reject(new Error('Cannot decode'));
  assert.equal(await player.play(), false);
  assert.equal(player.state.status, 'unavailable');
  assert.equal(FakeAudio.instances.at(-1).paused, true);
  assert.equal(engine.voicePlaying, false);
});

test('hidden tabs pause the message without discarding its position or automatically resuming it', async (t) => {
  const { engine, player, FakeAudio, document } = setup(t);
  await player.play();
  const sound = FakeAudio.instances.at(-1);
  sound.currentTime = 23;
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(player.state.status, 'paused');
  assert.equal(player.state.reason, 'hidden');
  assert.equal(engine.voicePlaying, false);
  assert.equal(await player.play(), false);
  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(sound.paused, true);
  assert.equal(sound.currentTime, 23);
  assert.equal(await player.play(), true);
});

test('secret and main recording interrupt each other while retaining main recording position', async (t) => {
  const { engine, player, FakeAudio } = setup(t);
  const endings = [];
  engine.onVoiceEnd((reason) => endings.push(reason));
  await player.play();
  const main = FakeAudio.instances.at(-1);
  main.currentTime = 18;
  await engine.playVoice('secret.mp3');
  const secret = FakeAudio.instances.at(-1);
  assert.equal(main.paused, true);
  assert.equal(player.state.reason, 'interrupted');
  assert.equal(secret.paused, false);
  await player.play();
  assert.equal(secret.paused, true);
  assert.equal(secret.src, '');
  assert.equal(main.paused, false);
  assert.equal(main.currentTime, 18);
  assert.deepEqual(endings, ['replaced']);
});

test('destroy cancels pending playback immediately and ignores its late resolution', async (t) => {
  const { engine, player, FakeAudio } = setup(t);
  let resolvePlay;
  FakeAudio.nextPlay = new Promise((resolve) => { resolvePlay = resolve; });
  const pending = player.play();
  const sound = FakeAudio.instances.at(-1);
  player.destroy();
  assert.equal(await pending, false);
  assert.equal(engine.voicePlaying, false);
  assert.equal(sound.paused, true);
  assert.equal(sound.src, '');
  resolvePlay();
  await Promise.resolve();
  assert.equal(sound.paused, true);
});

test('no Web Audio API preserves native playback with 32 decorative bars', async (t) => {
  const { player, FakeAudio } = setup(t);
  assert.equal(await player.play(), true);
  assert.equal(FakeAudio.instances.at(-1).paused, false);
  const bars = player.levels(100);
  assert.equal(bars.length, 32);
  assert.ok(bars.every((value) => value >= .12 && value <= 1));
  player.pause();
  assert.deepEqual(player.levels(200), Array(32).fill(.12));
});

test('available analyser reads frequencies from the actual media output', async (t) => {
  const { player, FakeAudio, FakeContext } = setup(t, { context: true });
  assert.equal(await player.play(), true);
  assert.equal(FakeContext.instance.sources[0].sound, FakeAudio.instances.at(-1));
  assert.equal(FakeContext.instance.sources[0].target.kind, 'analyser');
  assert.deepEqual(player.levels(100), Array(32).fill(128 / 255));
});

test('suspended context never takes over native audio', async (t) => {
  const { player, FakeAudio, FakeContext } = setup(t, { context: true, suspended: true });
  assert.equal(await player.play(), true);
  assert.equal(FakeContext.instance.sources.length, 0);
  assert.equal(FakeAudio.instances.at(-1).paused, false);
});

test('partial analyser connection failure disconnects analyser and retains a direct audible output', async (t) => {
  const { player, FakeContext } = setup(t, { context: true, failAnalyserConnection: true });
  assert.equal(await player.play(), true);
  assert.equal(FakeContext.instance.analysers[0].disconnected, true);
  assert.equal(FakeContext.instance.sources[0].target.kind, 'destination');
  assert.equal(player.levels(100).length, 32);
});

test('failed audio graph replaces the redirected element with a native playback fallback', async (t) => {
  const { player, FakeAudio, FakeContext } = setup(t, { context: true, failAllConnections: true });
  assert.equal(await player.play(), true);
  const redirected = FakeContext.instance.sources[0].sound;
  const native = FakeAudio.instances.at(-1);
  assert.notEqual(redirected, native);
  assert.equal(redirected.paused, true);
  assert.equal(redirected.src, '');
  assert.equal(native.paused, false);
  assert.equal(native.src, 'blob:voice');
});

test('a previously routed recording can resume audibly when its context can no longer resume', async (t) => {
  const { player, FakeAudio, FakeContext } = setup(t, { context: true });
  await player.play();
  const original = FakeAudio.instances.at(-1);
  original.currentTime = 44;
  player.pause();
  FakeContext.instance.state = 'suspended';
  FakeContext.instance.rejectResume = true;
  assert.equal(await player.play(), true);
  const replacement = FakeAudio.instances.at(-1);
  assert.notEqual(replacement, original);
  assert.equal(replacement.currentTime, 44);
  assert.equal(replacement.paused, false);
  assert.equal(FakeContext.instance.sources.length, 1);
});

test('pausing chapter voice leaves an independent microphone duck active', async (t) => {
  const { engine, player, FakeAudio } = setup(t);
  engine.duck('microphone');
  await player.play();
  player.pause();
  await new Promise((resolve) => setTimeout(resolve, 450));
  assert.ok(Math.abs(FakeAudio.instances[0].volume - .15) < 1e-9);
  engine.unduck('microphone');
  await new Promise((resolve) => setTimeout(resolve, 450));
  assert.ok(Math.abs(FakeAudio.instances[0].volume - .55) < 1e-9);
});
