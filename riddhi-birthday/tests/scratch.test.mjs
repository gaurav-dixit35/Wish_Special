import test from 'node:test';
import assert from 'node:assert/strict';
import { createScratchCoverage, createScratchSurface } from '../js/scratch.js';

test('a tap clears a circular brush area and repeated scratching does not inflate it', () => {
  const coverage = createScratchCoverage({ columns: 200, rows: 200 });
  const point = { x: .5, y: .5 };
  const once = coverage.mark(point, point, .1);
  assert.ok(Math.abs(once - Math.PI * .1 ** 2) < .001);
  assert.equal(coverage.mark(point, point, .1), once);
});

test('fast movement covers the segment between pointer samples without bridging separate strokes', () => {
  const coverage = createScratchCoverage({ columns: 200, rows: 200 });
  const swept = coverage.mark({ x: .1, y: .5 }, { x: .9, y: .5 }, .05);
  assert.ok(Math.abs(swept - (.8 * .1 + Math.PI * .05 ** 2)) < .002);
  const taps = createScratchCoverage({ columns: 200, rows: 200 });
  taps.mark({ x: .1, y: .5 }, { x: .1, y: .5 }, .05);
  taps.mark({ x: .9, y: .5 }, { x: .9, y: .5 }, .05);
  assert.ok(taps.fraction < swept / 3);
});

test('normalized elliptical brush tracks the same physical radius on a rectangular card', () => {
  const coverage = createScratchCoverage({ columns: 240, rows: 160 });
  const point = { x: .5, y: .5 };
  const fraction = coverage.mark(point, point, 22 / 360, 22 / 240);
  assert.ok(Math.abs(fraction - Math.PI * 22 ** 2 / (360 * 240)) < .001);
});

test('coverage reaches the 55 percent reveal threshold and remains bounded at the edges', () => {
  const coverage = createScratchCoverage();
  for (let y = 0; y <= .55; y += .08) coverage.mark({ x: -.2, y }, { x: 1.2, y }, .07);
  assert.ok(coverage.fraction >= .55);
  assert.ok(coverage.fraction < .7);
  coverage.mark({ x: 0, y: 0 }, { x: 1, y: 1 }, 2);
  assert.equal(coverage.fraction, 1);
});

test('invalid input and entirely off-card gestures cannot claim progress', () => {
  const coverage = createScratchCoverage();
  coverage.mark({ x: Number.NaN, y: .2 }, { x: .5, y: .5 }, .1);
  coverage.mark({ x: .5, y: .5 }, { x: .5, y: .5 }, 0);
  coverage.mark({ x: 2, y: 2 }, { x: 3, y: 3 }, .1);
  assert.equal(coverage.fraction, 0);
});

function surfaceFixture(t) {
  const previous = new Map(['window', 'document', 'ResizeObserver', 'devicePixelRatio'].map(key => [key, globalThis[key]]));
  globalThis.window = new EventTarget();
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  globalThis.ResizeObserver = undefined;
  globalThis.devicePixelRatio = 2;
  t.after(() => previous.forEach((value, key) => { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }));
  const scales = [];
  const context = {
    save() {}, restore() {}, setTransform() {}, clearRect() {}, fillRect() {}, strokeRect() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {}, fillText() {},
    scale(x, y) { scales.push([x, y]); },
    createLinearGradient: () => ({ addColorStop() {} }),
  };
  const classes = new Set();
  const canvas = Object.assign(new EventTarget(), {
    rect: { left: 0, top: 0, width: 360, height: 240 },
    classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
    getContext: () => context,
    getBoundingClientRect() { return this.rect; },
    setPointerCapture() {}, hasPointerCapture: () => false, releasePointerCapture() {},
  });
  const cleanups = [];
  const scope = {
    alive: true,
    add: cleanup => cleanups.push(cleanup),
    on(target, name, listener, options) {
      target.addEventListener(name, listener, options);
      cleanups.push(() => target.removeEventListener(name, listener, options));
    },
  };
  t.after(() => { scope.alive = false; cleanups.forEach(cleanup => cleanup()); });
  const dispatch = (target, type, x, y) => target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), {
    pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y,
  }));
  return { canvas, scope, scales, dispatch };
}

test('resizing preserves normalized scratches and coverage, and cancels an unfinished pointer', t => {
  const { canvas, scope, scales, dispatch } = surfaceFixture(t);
  const surface = createScratchSurface({ canvas, scope, label: 'Scratch', hint: 'A promise' });
  dispatch(canvas, 'pointerdown', 100, 100);
  dispatch(window, 'pointermove', 200, 100);
  const progress = surface.progress;
  assert.ok(progress > .05 && progress < .15);
  canvas.rect.width = 720;
  canvas.rect.height = 480;
  surface.resize();
  assert.equal(canvas.width, 1440);
  assert.equal(surface.progress, progress);
  assert.deepEqual(scales.at(-1), [44, 44]);
  dispatch(window, 'pointermove', 700, 400);
  assert.equal(surface.progress, progress);
});

test('pointer cancellation stops drawing, and explicit reveal calls the reward only once', t => {
  const { canvas, scope, dispatch } = surfaceFixture(t);
  let rewards = 0;
  const surface = createScratchSurface({ canvas, scope, label: 'Scratch', hint: 'A promise', onReveal: () => { rewards += 1; } });
  dispatch(canvas, 'pointerdown', 100, 100);
  dispatch(window, 'pointercancel', 100, 100);
  const progress = surface.progress;
  dispatch(window, 'pointermove', 320, 220);
  assert.equal(surface.progress, progress);
  assert.equal(surface.reveal(), true);
  assert.equal(surface.reveal(), false);
  assert.equal(surface.progress, 1);
  assert.equal(rewards, 1);
  surface.destroy();
  assert.equal(surface.reveal(), false);
});
