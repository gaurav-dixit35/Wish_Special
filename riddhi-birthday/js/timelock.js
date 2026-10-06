import { config } from './config.js';

export const TARGET = Date.parse(config.targetISO);

export function createTimeLock({ target = TARGET, preview = false, onTick, onUnlock, now = Date.now } = {}) {
  if (!Number.isFinite(target)) throw new TypeError('The birthday target must be a valid timestamp.');
  let timer = null;
  let unlocked = false;

  function stop() {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }

  function tick() {
    const totalMs = preview ? 0 : Math.max(0, target - now());
    const totalSeconds = Math.ceil(totalMs / 1000);
    onTick?.({
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor(totalSeconds / 3600) % 24,
      minutes: Math.floor(totalSeconds / 60) % 60,
      seconds: totalSeconds % 60,
      totalMs,
    });
    if (totalMs <= 0 && !unlocked) {
      unlocked = true;
      stop();
      onUnlock?.();
    }
  }

  function start() {
    if (timer !== null || unlocked) return;
    tick();
    if (!unlocked) timer = setInterval(tick, 250);
  }

  return { start, stop };
}
