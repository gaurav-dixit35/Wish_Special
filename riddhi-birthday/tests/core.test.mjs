import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, saveState, awardStamp, discoverEgg, setWishSent } from '../js/state.js';
import { createTimeLock, TARGET } from '../js/timelock.js';
import { createPreloader } from '../js/preloader.js';
import { createAudioEngine } from '../js/audio.js';

function memoryStorage(initial = null) {
  let value = initial;
  return { getItem: () => value, setItem: (_key, next) => { value = next; } };
}

test('progress survives reload, deduplicates rewards, and excludes transient audio/lock state', () => {
  const storage = memoryStorage();
  const first = createState(storage);
  assert.equal(awardStamp(1, first), true);
  assert.equal(awardStamp(1, first), false);
  assert.equal(discoverEgg('moon', first), true);
  assert.equal(discoverEgg('moon', first), false);
  setWishSent(true, first);
  first.unlocked = true;
  first.audioOn = true;
  first.muted = true;
  first.chapter = 7;
  assert.equal(saveState(first), true);
  const reloaded = createState(storage);
  assert.deepEqual([...reloaded.stamps], [1]);
  assert.deepEqual([...reloaded.eggsFound], ['moon']);
  assert.equal(reloaded.wishSent, true);
  assert.equal(reloaded.unlocked, false);
  assert.equal(reloaded.audioOn, false);
  assert.equal(reloaded.muted, false);
  assert.equal(reloaded.chapter, 0);
});

test('damaged, malformed, or unavailable localStorage is harmless', () => {
  assert.equal(createState(memoryStorage('{broken')).stamps.size, 0);
  const malformed = createState(memoryStorage(JSON.stringify({
    stamps: [1, 1, null, {}, -1, '', 'cake'], eggsFound: 'moon', wishSent: 'yes',
  })));
  assert.deepEqual([...malformed.stamps], [1, 'cake']);
  assert.equal(malformed.eggsFound.size, 0);
  assert.equal(malformed.wishSent, false);
  const unavailable = createState({ getItem() { throw new Error('Disabled'); }, setItem() { throw new Error('Full'); } });
  assert.equal(awardStamp(2, unavailable), true);
  assert.equal(saveState(unavailable), false);
});

test('birthday midnight is 14 October 18:30 UTC', () => {
  assert.equal(new Date(TARGET).toISOString(), '2026-10-14T18:30:00.000Z');
});

test('countdown ticks immediately and unlocks once at the deadline', async () => {
  let now = TARGET - 500;
  let unlocks = 0;
  const ticks = [];
  const lock = createTimeLock({ now: () => now, onTick: (value) => ticks.push(value), onUnlock: () => { unlocks += 1; } });
  try {
    lock.start();
    lock.start();
    assert.equal(ticks.length, 1);
    assert.equal(ticks[0].seconds, 1);
    assert.equal(ticks[0].totalMs, 500);
    now = TARGET;
    await new Promise((resolve) => setTimeout(resolve, 280));
    assert.equal(unlocks, 1);
    assert.equal(ticks.at(-1).totalMs, 0);
    lock.start();
    assert.equal(unlocks, 1);
  } finally { lock.stop(); }
});

test('preview and after-midnight arrivals unlock immediately without a timer', () => {
  for (const options of [{ preview: true, now: () => TARGET - 100000 }, { now: () => TARGET + 100000 }]) {
    let unlocks = 0;
    const lock = createTimeLock({ ...options, onUnlock: () => { unlocks += 1; } });
    lock.start();
    lock.start();
    assert.equal(unlocks, 1);
    lock.stop();
  }
});

test('preloader deduplicates, caches audio blobs, and reaches full progress', async () => {
  const src = 'data:audio/wav;base64,UklGRg==';
  const loader = createPreloader({ audio: [src, src] });
  const progress = [];
  loader.subscribe((value) => progress.push(value));
  const first = loader.start();
  assert.equal(loader.start(), first);
  const summary = await first;
  assert.equal(summary.total, 1);
  assert.equal(summary.loaded, 1);
  assert.equal(loader.loaded, true);
  assert.equal(loader.progress, 1);
  assert.equal(progress[0], 0);
  assert.equal(progress.at(-1), 1);
  assert.equal(loader.results.get(src).status, 'loaded');
  assert.match(loader.results.get(src).value, /^blob:/);
  loader.destroy();
});

test('a stalled image decode becomes a placeholder rather than trapping the loader', async (t) => {
  const originalImage = globalThis.Image;
  const originalWarn = console.warn;
  globalThis.Image = class {
    naturalWidth = 100;
    tagName = 'IMG';
    set src(_value) { queueMicrotask(() => this.onload?.()); }
    decode() { return new Promise(() => {}); }
    removeAttribute() {}
  };
  console.warn = () => {};
  t.after(() => { globalThis.Image = originalImage; console.warn = originalWarn; });
  const loader = createPreloader({ images: ['stalled.png'] }, { timeoutMs: 15 });
  const summary = await loader.start();
  assert.equal(summary.placeholders, 1);
  assert.equal(loader.loaded, true);
  assert.equal(loader.progress, 1);
  assert.equal(loader.getImage('stalled.png'), null);
  loader.destroy();
});

test('destroy cancels pending assets and resolves the in-flight preload', async (t) => {
  const originalImage = globalThis.Image;
  globalThis.Image = class { set src(_value) {} removeAttribute() {} };
  t.after(() => { globalThis.Image = originalImage; });
  const loader = createPreloader({ dogs: ['missing-dog.png'] });
  const pending = loader.start();
  loader.destroy();
  const summary = await pending;
  assert.equal(summary.cancelled, true);
  assert.equal(summary.placeholders, 1);
});

test('fonts wait for their stylesheet before requesting font faces', async (t) => {
  const originalDocument = globalThis.document;
  let releaseStylesheet;
  const fontReady = new Promise((resolve) => { releaseStylesheet = resolve; });
  const requested = [];
  globalThis.document = { fonts: { load: async (font) => { requested.push(font); return [{ family: 'Nunito' }]; } } };
  t.after(() => { globalThis.document = originalDocument; });
  const loader = createPreloader({ fonts: ['400 1em Nunito'] }, { fontReady });
  const pending = loader.start();
  await Promise.resolve();
  assert.deepEqual(requested, []);
  releaseStylesheet();
  const summary = await pending;
  assert.deepEqual(requested, ['400 1em Nunito']);
  assert.equal(summary.loaded, 1);
  loader.destroy();
});

test('audio gracefully declines playback when neither audio API exists', async () => {
  const state = { audioOn: false, muted: false };
  const engine = createAudioEngine({ config: {}, state });
  assert.equal(await engine.start(), false);
  assert.equal(engine.playing, false);
  assert.equal(engine.toggleMute(), true);
  assert.equal(state.muted, true);
  engine.playSfx('snore');
  engine.duck();
  engine.unduck();
  engine.destroy();
  assert.equal(await engine.start(), false);
});
