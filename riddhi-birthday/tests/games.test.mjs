import test from 'node:test';
import assert from 'node:assert/strict';
import { shufflePairs, createMatchRound, wheelSegmentAt, wheelRotationFor, createCatcherRound } from '../js/games.js';

test('a shuffled round has twelve unique cards and exactly six pairs', () => {
  const deck = shufflePairs(() => .73);
  assert.equal(new Set(deck.map(card => card.id)).size, 12);
  for (let pair = 0; pair < 6; pair += 1) assert.equal(deck.filter(card => card.pair === pair).length, 2);
});

test('match comparison blocks a third card and duplicate taps until resolved', () => {
  const round = createMatchRound(Array.from({ length: 12 }, (_, id) => ({ id, pair: id % 6 })));
  assert.equal(round.choose(0), true);
  assert.equal(round.choose(0), false);
  assert.equal(round.choose(1), true);
  assert.equal(round.choose(2), false);
  assert.deepEqual(round.resolve(), { indices: [0, 1], match: false, complete: false });
  assert.equal(round.choose(0), true);
  assert.equal(round.choose(6), true);
  assert.equal(round.resolve().match, true);
  assert.equal(round.choose(6), false);
  assert.equal(round.matched.size, 2);
});

test('every pair must be found before the match game completes', () => {
  const round = createMatchRound(Array.from({ length: 12 }, (_, id) => ({ id, pair: id % 6 })));
  for (let index = 0; index < 6; index += 1) {
    round.choose(index);
    round.choose(index + 6);
    assert.equal(round.resolve().complete, index === 5);
  }
  assert.equal(round.complete, true);
});

test('wheel rotations always land on the promised wedge after repeat spins', () => {
  let rotation = 0;
  for (let cycle = 0; cycle < 3; cycle += 1) for (let index = 0; index < 8; index += 1) {
    const target = wheelRotationFor(index, rotation, 5 + cycle);
    assert.ok(target >= rotation + 5 * 360);
    assert.equal(wheelSegmentAt(target), index);
    assert.equal(wheelSegmentAt(target + 10), index);
    assert.equal(wheelSegmentAt(target - 10), index);
    rotation = target;
  }
});

test('catcher clamps the dog and finishes only after thirty active seconds', () => {
  const round = createCatcherRound(() => .5);
  round.moveDog(-4); assert.equal(round.state.dogX, .085);
  round.moveDog(9); assert.equal(round.state.dogX, .915);
  round.step(29);
  assert.equal(round.state.finished, false);
  round.step(9);
  assert.equal(round.state.remaining, 0);
  assert.equal(round.state.finished, true);
  const count = round.state.items.length;
  assert.deepEqual(round.step(100), []);
  assert.equal(round.state.items.length, count);
});

test('catcher collisions award real item values and broccoli resets a combo', () => {
  const round = createCatcherRound(() => .5);
  round.state.items.push({ id: 99, kind: 'bone', x: .5, y: .805, speed: .3 });
  assert.equal(round.step(.05)[0].value, 1);
  round.state.items.push({ id: 100, kind: 'heart', x: .5, y: .805, speed: .3 });
  assert.equal(round.step(.05)[0].combo, 2);
  assert.equal(round.state.score, 4);
  round.state.items.push({ id: 101, kind: 'broccoli', x: .5, y: .805, speed: .3 });
  assert.equal(round.step(.05)[0].value, -2);
  assert.equal(round.state.score, 2);
  assert.equal(round.state.combo, 0);
});

test('catcher spawns every six tenths of an active second and catches across long frames', () => {
  const round = createCatcherRound(() => .5);
  round.step(.59); assert.equal(round.state.items.length, 0);
  round.step(.01); assert.equal(round.state.items.length, 1);
  round.step(.6); assert.equal(round.state.items.length, 2);
  const caught = round.step(4);
  assert.ok(caught.length > 0);
  assert.equal(round.state.score, caught.length);
});
