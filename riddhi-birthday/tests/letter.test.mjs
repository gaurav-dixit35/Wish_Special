import test from 'node:test';
import assert from 'node:assert/strict';
import { createLetterTyper, letterGraphemes } from '../js/letter.js';

function clock() {
  let now = 0;
  let serial = 0;
  const timers = new Map();
  return {
    get now() { return now; },
    get pending() { return timers.size; },
    setTimer(callback, delay) { const id = ++serial; timers.set(id, {callback, time:now + delay}); return id; },
    clearTimer(id) { timers.delete(id); },
    tick(milliseconds) {
      const target = now + milliseconds;
      let iterations = 0;
      while (timers.size) {
        const [id, timer] = [...timers].sort((a,b) => a[1].time - b[1].time)[0];
        if (timer.time > target) break;
        if (++iterations > 10000) throw new Error('Timer did not settle');
        timers.delete(id);
        now = timer.time;
        timer.callback();
      }
      now = target;
    },
  };
}

function fixture(lines, options = {}) {
  const time = clock();
  const updates = [];
  const completed = [];
  const typer = createLetterTyper({
    lines,
    setTimer:time.setTimer,
    clearTimer:time.clearTimer,
    onUpdate:entry => updates.push({...entry, time:time.now}),
    onComplete:() => completed.push(time.now),
    ...options,
  });
  return {time, updates, completed, typer};
}

test('typing emits complete emoji, joined emoji, flags, and accented graphemes', () => {
  const text = '👩🏽‍🚀e\u0301🇮🇳💙';
  assert.deepEqual(letterGraphemes(text), ['👩🏽‍🚀', 'e\u0301', '🇮🇳', '💙']);
  const {time, updates, completed, typer} = fixture([text]);
  typer.start();
  time.tick(39);
  assert.equal(updates.at(-1).text, '');
  time.tick(1);
  assert.equal(updates.at(-1).text, '👩🏽‍🚀');
  time.tick(40);
  assert.equal(updates.at(-1).text, '👩🏽‍🚀e\u0301');
  time.tick(80);
  assert.equal(updates.at(-1).text, text);
  assert.deepEqual(completed, [160]);
  assert.equal(time.pending, 0);
});

test('a comma adds 180ms to the normal 40ms character pause', () => {
  const {time, updates, typer} = fixture(['A,B']);
  typer.start();
  time.tick(80);
  assert.equal(updates.at(-1).text, 'A,');
  time.tick(219);
  assert.equal(updates.at(-1).text, 'A,');
  time.tick(1);
  assert.deepEqual(updates.at(-1), {lineIndex:0, text:'A,B', time:300});
});

test('line pauses retain blank paragraphs and comma pauses at a line boundary', () => {
  const {time, updates, completed, typer} = fixture(['A,', '', 'B']);
  typer.start();
  time.tick(659);
  assert.equal(updates.at(-1).text, 'A,');
  time.tick(1);
  assert.deepEqual(updates.at(-1), {lineIndex:1, text:'', time:660});
  time.tick(400);
  assert.deepEqual(updates.at(-1), {lineIndex:2, text:'', time:1060});
  time.tick(40);
  assert.deepEqual(updates.at(-1), {lineIndex:2, text:'B', time:1100});
  assert.deepEqual(completed, [1100]);
});

test('finish reveals every original line once and cancels pending character work', () => {
  const original = ['Dear Riddhi,', '', 'A little 💙, exactly as written.'];
  const {time, updates, completed, typer} = fixture(original);
  typer.start();
  time.tick(120);
  typer.finish();
  assert.equal(typer.complete, true);
  assert.deepEqual(updates.slice(-3).map(({text}) => text), original);
  const count = updates.length;
  typer.finish();
  typer.start();
  time.tick(100000);
  assert.equal(updates.length, count);
  assert.deepEqual(completed, [120]);
  assert.equal(time.pending, 0);
});

test('destroy during a comma pause stops all updates, completion, and restarts', () => {
  const {time, updates, completed, typer} = fixture(['A, the rest of the letter']);
  typer.start();
  time.tick(80);
  assert.equal(time.pending, 1);
  typer.destroy();
  const count = updates.length;
  typer.finish();
  typer.start();
  time.tick(100000);
  assert.equal(updates.length, count);
  assert.deepEqual(completed, []);
  assert.equal(time.pending, 0);
  assert.equal(typer.complete, false);
});

test('reduced motion and an empty letter complete immediately without timers', () => {
  for (const [lines, options] of [[['Dear Riddhi,', '', '💙'], {reducedMotion:true}], [[], {}]]) {
    const {time, updates, completed, typer} = fixture(lines, options);
    typer.start();
    assert.deepEqual(updates.map(({text}) => text), lines);
    assert.deepEqual(completed, [0]);
    assert.equal(time.pending, 0);
    assert.equal(typer.complete, true);
  }
});

test('fallback segmentation preserves combined emoji when Intl.Segmenter is unavailable', t => {
  const original = Intl.Segmenter;
  Intl.Segmenter = undefined;
  t.after(() => { Intl.Segmenter = original; });
  assert.deepEqual(letterGraphemes('A👩🏽‍🚀e\u0301🇮🇳🇯🇵❤️'), ['A', '👩🏽‍🚀', 'e\u0301', '🇮🇳', '🇯🇵', '❤️']);
});

test('callback errors cancel the active timer and are handed to chapter recovery', () => {
  const errors = [];
  const time = clock();
  const problem = new Error('The letter left the page');
  const typer = createLetterTyper({
    lines:['Hello'], setTimer:time.setTimer, clearTimer:time.clearTimer,
    onUpdate:({text}) => { if (text) throw problem; },
    onError:error => errors.push(error),
  });
  typer.start();
  time.tick(40);
  assert.deepEqual(errors, [problem]);
  assert.equal(time.pending, 0);
  time.tick(100000);
  assert.equal(errors.length, 1);
});
