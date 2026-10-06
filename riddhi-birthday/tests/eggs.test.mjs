import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, awardStamp } from '../js/state.js';
import { createEggCollection, createEggs, clueGuidePosition } from '../js/eggs.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('only five valid secrets count and each discovery persists once', () => {
  const storage = memoryStorage();
  const state = createState(storage);
  let completions = 0;
  const collection = createEggCollection(state, () => completions++);
  for (const invalid of [0, 6, 'moon', '1', null, undefined, NaN]) assert.equal(collection.discover(invalid), false);
  assert.equal(collection.count, 0);
  assert.equal(collection.discover(2), true);
  assert.equal(collection.discover(2), false);
  assert.equal(collection.count, 1);
  assert.equal(completions, 0);
  assert.deepEqual([...createState(storage).eggsFound], [2]);
});

test('the fifth different secret earns the final stamp exactly once', () => {
  const state = createState(memoryStorage());
  const events = [];
  const collection = createEggCollection(state, (event) => {
    events.push(event);
    awardStamp(8, state);
  });
  for (const id of [5, 3, 2, 1]) assert.equal(collection.discover(id), true);
  assert.equal(state.stamps.has(8), false);
  assert.equal(collection.discover(4), true);
  assert.equal(collection.count, 5);
  assert.equal(state.stamps.has(8), true);
  for (const id of [1, 2, 3, 4, 5]) assert.equal(collection.discover(id), false);
  assert.deepEqual(events, [{ restored: false }]);
});

test('a restored complete collection repairs an interrupted stamp save without rediscovery', () => {
  const storage = memoryStorage();
  const original = createState(storage);
  const first = createEggCollection(original);
  for (const id of [1, 2, 3, 4, 5]) first.discover(id);
  const restored = createState(storage);
  assert.equal(restored.stamps.has(8), false);
  const events = [];
  const collection = createEggCollection(restored, (event) => {
    events.push(event);
    awardStamp(8, restored);
  });
  assert.equal(collection.count, 5);
  assert.deepEqual(events, [{ restored: true }]);
  assert.equal(createState(storage).stamps.has(8), true);
  assert.equal(collection.discover(5), false);
  assert.equal(events.length, 1);
});

test('unknown saved keepsakes cannot finish the five-secret collection', () => {
  const state = createState(memoryStorage());
  state.eggsFound = new Set([1, 2, 3, 4, 99, 'unrelated']);
  let completions = 0;
  const collection = createEggCollection(state, () => completions++);
  assert.equal(collection.count, 4);
  assert.equal(completions, 0);
  collection.discover(5);
  assert.equal(completions, 1);
});

test('a sky clue prompt stays inside a narrow phone and points at the real target', () => {
  const target = { left: 262, top: 80, bottom: 136, width: 56 };
  const panel = { width: 248, height: 128 };
  const position = clueGuidePosition(target, panel, { width: 320, height: 640 });
  assert.ok(position.left >= 12);
  assert.ok(position.left + panel.width <= 308);
  assert.equal(position.top, 152);
  assert.equal(position.below, true);
  assert.ok(Math.abs(position.left + position.arrow - (target.left + target.width / 2)) <= 2);
});

test('a footer-heart clue prompt goes above its target without covering the heart', () => {
  const target = { left: 157, top: 670, bottom: 726, width: 56 };
  const panel = { width: 248, height: 128 };
  const position = clueGuidePosition(target, panel, { width: 390, height: 780 });
  assert.equal(position.below, false);
  assert.equal(position.top + panel.height, target.top - 16);
  assert.equal(position.left + position.arrow, target.left + target.width / 2);
});

test('name clues publish every remaining tap, discover on the fifth tap, and replay without duplicate credit', () => {
  const originalDocument = globalThis.document;
  const listeners = new Map();
  globalThis.document = { hidden: false, querySelectorAll: () => [] };
  const state = createState(memoryStorage());
  const toasts = [];
  const ctx = {
    config: { eggs: ['Moon', 'Wish', 'Dog', 'Name', 'Heart'], eggsUi: { nameProgress: '{count} taps' } },
    state,
    scope: { on: (target, type, fn) => listeners.set(type, fn), add: () => {} },
    sky: {}, audio: { playSfx: () => {}, stopVoice: () => {} },
    awardStamp: () => {}, confetti: { burst: async () => true }, toast: (message) => toasts.push(message),
  };
  let eggs;
  try {
    eggs = createEggs(ctx);
    eggs.setChapter(11);
    const snapshots = [];
    eggs.subscribe(() => snapshots.push({ taps: eggs.nameTaps, count: eggs.count }));
    const name = { dataset: { egg: 'name' } };
    const event = { target: { closest: () => name } };
    for (let index = 0; index < 4; index++) listeners.get('click')(event);
    assert.equal(state.eggsFound.has(4), false);
    assert.equal(eggs.nameTaps, 4);
    assert.deepEqual(snapshots.map(({ taps }) => taps), [0, 1, 2, 3, 4]);
    listeners.get('click')(event);
    assert.equal(eggs.count, 1);
    assert.equal(state.eggsFound.has(4), true);
    assert.equal(toasts.at(-1), 'Name');
    listeners.get('click')(event);
    assert.equal(eggs.count, 1);
    assert.equal(eggs.nameTaps, 5);
    assert.equal(toasts.at(-1), 'Name');
  } finally {
    eggs?.destroy();
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
