import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioEngine } from '../js/audio.js';

function setup(t, { muted = false, missing = false } = {}) {
  const originalAudio = globalThis.Audio;
  const originalDocument = globalThis.document;
  class FakeAudio {
    static instances = [];
    static nextPlay = null;
    constructor(src = '') { this.src = src; this.paused = true; this.volume = 1; FakeAudio.instances.push(this); }
    play() { this.paused = false; const result = FakeAudio.nextPlay; FakeAudio.nextPlay = null; return result ?? Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    load() {}
  }
  const document = new EventTarget();
  document.hidden = false;
  globalThis.Audio = FakeAudio;
  globalThis.document = document;
  const state = {audioOn:false, muted};
  const results = new Map([['secret.mp3', missing ? {status:'placeholder'} : {status:'loaded', value:'blob:secret'}]]);
  const engine = createAudioEngine({config:{audio:{tune:'tune.mp3'}}, state, preloader:{results}});
  t.after(() => { engine.destroy(); globalThis.Audio = originalAudio; globalThis.document = originalDocument; });
  return {engine, state, document, FakeAudio};
}

test('voice uses the cached asset, follows mute, and stops on hidden tabs', async (t) => {
  const {engine, FakeAudio, document} = setup(t, {muted:true});
  const ended = [];
  engine.onVoiceEnd(reason => ended.push(reason));
  assert.equal(await engine.playVoice('secret.mp3'), true);
  const voice = FakeAudio.instances.at(-1);
  assert.equal(voice.src, 'blob:secret');
  assert.equal(voice.muted, true);
  engine.toggleMute();
  assert.equal(voice.muted, false);
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(voice.paused, true);
  assert.equal(voice.src, '');
  assert.deepEqual(ended, ['stopped']);
});

test('missing voice declines without starting or ducking a silent fake recording', async (t) => {
  const {engine, FakeAudio} = setup(t, {missing:true});
  assert.equal(await engine.playVoice('secret.mp3'), false);
  assert.equal(FakeAudio.instances.length, 1);
});

test('replacing pending voice cancels the old session even if its play resolves late', async (t) => {
  const {engine, FakeAudio} = setup(t);
  let release;
  FakeAudio.nextPlay = new Promise((resolve) => { release = resolve; });
  const pending = engine.playVoice('secret.mp3');
  const oldVoice = FakeAudio.instances.at(-1);
  assert.equal(await engine.playVoice('secret.mp3'), true);
  const replacement = FakeAudio.instances.at(-1);
  assert.equal(await pending, false);
  release();
  await Promise.resolve();
  assert.equal(oldVoice.paused, true);
  assert.equal(replacement.paused, false);
  engine.destroy();
  assert.equal(replacement.paused, true);
});

test('ending voice preserves microphone ducking until its own session ends', async (t) => {
  const {engine, FakeAudio} = setup(t);
  engine.duck();
  await engine.playVoice('secret.mp3');
  FakeAudio.instances.at(-1).onended();
  await new Promise((resolve) => setTimeout(resolve, 440));
  assert.ok(Math.abs(FakeAudio.instances[0].volume - .15) < 1e-9);
  engine.unduck();
  await new Promise((resolve) => setTimeout(resolve, 440));
  assert.ok(Math.abs(FakeAudio.instances[0].volume - .55) < 1e-9);
});
