// One cancellable timer types whole graphemes, so emoji and combined letters
// never appear as broken fragments. Injected timers keep pacing testable.
export function letterGraphemes(value) {
  const text = String(value ?? '');
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), part => part.segment);
  }
  // Older engines still preserve surrogate pairs, combining marks, skin tones,
  // joined emoji, and the paired regional indicators used for flags.
  const clusters = [];
  let regionalCount = 0;
  for (const point of Array.from(text)) {
    const regional = /[\u{1F1E6}-\u{1F1FF}]/u.test(point);
    const previous = clusters[clusters.length - 1];
    const joinsPrevious = previous && (/\p{Mark}|[\uFE0E\uFE0F\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]/u.test(point)
      || point === '\u200D' || previous.endsWith('\u200D') || (regional && regionalCount % 2 === 1));
    if (joinsPrevious) clusters[clusters.length - 1] += point;
    else clusters.push(point);
    regionalCount = regional ? regionalCount + 1 : 0;
  }
  return clusters;
}

export function createLetterTyper({
  lines = [], onUpdate = () => {}, onComplete = () => {}, onError = error => { throw error; },
  reducedMotion = false, characterDelay = 40, lineDelay = 400, commaDelay = 180,
  setTimer = setTimeout, clearTimer = clearTimeout,
} = {}) {
  const original = Array.from(lines, value => String(value ?? ''));
  const characters = original.map(letterGraphemes);
  let timer = null;
  let started = false;
  let destroyed = false;
  let complete = false;
  let lineIndex = 0;
  let characterIndex = 0;

  function cancelTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }
  function safely(callback) {
    if (destroyed || complete) return;
    try { callback(); }
    catch (error) { destroy(); onError(error); }
  }
  function schedule(callback, delay) {
    cancelTimer();
    timer = setTimer(() => { timer = null; safely(callback); }, delay);
  }
  function finishCompletion() {
    if (destroyed || complete) return;
    cancelTimer();
    complete = true;
    onComplete();
  }
  function nextLine(extraDelay = 0) {
    if (lineIndex === characters.length - 1) { finishCompletion(); return; }
    schedule(() => { lineIndex += 1; characterIndex = 0; enterLine(); }, lineDelay + extraDelay);
  }
  function nextCharacter() {
    characterIndex += 1;
    const current = characters[lineIndex];
    onUpdate({ lineIndex, text: current.slice(0, characterIndex).join('') });
    if (destroyed || complete) return;
    const extra = current[characterIndex - 1] === ',' ? commaDelay : 0;
    if (characterIndex === current.length) nextLine(extra);
    else schedule(nextCharacter, characterDelay + extra);
  }
  function enterLine() {
    onUpdate({ lineIndex, text: '' });
    if (destroyed || complete) return;
    if (characters[lineIndex].length) schedule(nextCharacter, characterDelay);
    else nextLine();
  }
  function finish() {
    safely(() => {
      cancelTimer();
      for (let index = 0; index < original.length; index += 1) {
        if (destroyed) return;
        onUpdate({ lineIndex: index, text: original[index] });
      }
      finishCompletion();
    });
  }
  function start() {
    if (started || destroyed || complete) return;
    started = true;
    if (reducedMotion || !characters.length) { finish(); return; }
    safely(enterLine);
  }
  function destroy() { destroyed = true; cancelTimer(); }
  return { start, finish, destroy, get complete() { return complete; } };
}
