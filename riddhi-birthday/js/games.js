// Small deterministic models keep game rules independent of rendering.
export function shufflePairs(random = Math.random) {
  const cards = Array.from({ length: 12 }, (_, index) => ({ id: index, pair: index % 6 }));
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const other = Math.min(index, Math.floor(Math.max(0, random()) * (index + 1)));
    [cards[index], cards[other]] = [cards[other], cards[index]];
  }
  return cards;
}

export function createMatchRound(cards = shufflePairs()) {
  const matched = new Set();
  let selected = [];
  let comparing = false;
  return {
    cards,
    get selected() { return [...selected]; },
    get matched() { return new Set(matched); },
    get comparing() { return comparing; },
    get complete() { return matched.size === cards.length; },
    choose(index) {
      if (comparing || !Number.isInteger(index) || !cards[index] || matched.has(index) || selected.includes(index)) return false;
      selected.push(index);
      comparing = selected.length === 2;
      return true;
    },
    resolve() {
      if (!comparing) return null;
      const indices = [...selected];
      const match = cards[indices[0]].pair === cards[indices[1]].pair;
      if (match) indices.forEach(index => matched.add(index));
      comparing = false;
      selected = [];
      return { indices, match, complete: matched.size === cards.length };
    },
  };
}

const normalize = angle => ((angle % 360) + 360) % 360;

// SVG wedges begin at twelve o'clock and run clockwise beneath a fixed pointer.
export function wheelSegmentAt(rotation, segments = 8) {
  return Math.min(segments - 1, Math.floor(normalize(-rotation) / (360 / segments)));
}

export function wheelRotationFor(index, from = 0, turns = 6, segments = 8) {
  const landing = normalize(-(index + .5) * (360 / segments));
  return from + Math.max(1, turns) * 360 + normalize(landing - normalize(from));
}

export const CATCHER_VALUES = Object.freeze({ bone: 1, heart: 3, broccoli: -2 });

export function createCatcherRound(random = Math.random) {
  const state = { elapsed: 0, remaining: 30, score: 0, combo: 0, dogX: .5, items: [], finished: false };
  let sinceSpawn = 0;
  let sequence = 0;
  function moveDog(x) { state.dogX = Math.max(.085, Math.min(.915, Number.isFinite(x) ? x : .5)); }
  function step(seconds) {
    if (state.finished || !Number.isFinite(seconds) || seconds <= 0) return [];
    // Substeps ensure a dropped frame cannot jump an item past the dog.
    const events = [];
    let remaining = Math.min(seconds, state.remaining);
    while (remaining > .000001) {
      const delta = Math.min(.05, remaining);
      remaining -= delta;
      state.elapsed = Math.min(30, state.elapsed + delta);
      state.remaining = Math.max(0, 30 - state.elapsed);
      sinceSpawn += delta;
      if (sinceSpawn >= .6 - .000001) {
        sinceSpawn -= .6;
        const roll = random();
        state.items.push({ id: sequence++, kind: roll < .62 ? 'bone' : roll < .84 ? 'heart' : 'broccoli', x: .05 + random() * .9, y: -.04, speed: .25 + random() * .11 });
      }
      state.items = state.items.filter(item => {
        item.y += item.speed * delta;
        if (item.y >= .81 && item.y <= .94 && Math.abs(item.x - state.dogX) <= .11) {
          const value = CATCHER_VALUES[item.kind];
          state.score += value;
          state.combo = value > 0 ? state.combo + 1 : 0;
          events.push({ ...item, value, score: state.score, combo: state.combo });
          return false;
        }
        if (item.y > 1.04) {
          if (CATCHER_VALUES[item.kind] > 0) state.combo = 0;
          return false;
        }
        return true;
      });
    }
    if (state.remaining < .000001) { state.elapsed = 30; state.remaining = 0; state.finished = true; }
    return events;
  }
  return { state, moveDog, step };
}
