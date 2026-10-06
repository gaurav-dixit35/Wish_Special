const DEFAULT_COLORS = ['#4da3ff', '#ffd36b', '#ff91c3', '#48e5bf', '#a986ff'];

// A single renderer is shared across the journey. It animates only while a
// celebration is alive, and reset settles callers before a chapter disappears.
export function createConfetti({ mobile = false, reducedMotion = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'celebration-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const fallback = document.createElement('div');
  fallback.className = 'celebration-fallback';
  fallback.setAttribute('aria-hidden', 'true');
  document.body.append(canvas, fallback);
  const jobs = new Set();
  const maxPerBurst = mobile ? 120 : 220;
  const maxLive = mobile ? 240 : 440;
  const maxFallback = mobile ? 120 : 180;
  let native = null;
  let nativeFailed = false;
  let liveNative = 0;
  let destroyed = false;

  function renderer() {
    if (!native && !nativeFailed && typeof globalThis.confetti?.create === 'function') {
      try { native = globalThis.confetti.create(canvas, { resize: true, useWorker: false }); }
      catch (error) {
        nativeFailed = true;
        console.warn('[confetti] Using the CSS celebration fallback.', error);
      }
    }
    return native;
  }

  function ticket(cleanup = () => {}) {
    let resolve;
    let timer;
    let finished = false;
    const promise = new Promise((done) => { resolve = done; });
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      cleanup();
      jobs.delete(finish);
      resolve();
    };
    jobs.add(finish);
    return { promise, finish, after(ms) { timer = setTimeout(finish, ms); } };
  }

  function cssBurst(options, requested) {
    const count = Math.min(requested, Math.max(0, maxFallback - fallback.childElementCount));
    if (!count) return Promise.resolve();
    const origin = options.origin;
    const colors = options.colors;
    const particles = [];
    const duration = reducedMotion ? 650 : Math.max(800, Math.min(2600, Number(options.ticks ?? 120) / 60 * 1000));
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement('i');
      const angle = ((Number(options.angle ?? 90) + (Math.random() - .5) * Number(options.spread ?? 75)) * Math.PI) / 180;
      const distance = (reducedMotion ? 35 : Math.min(innerHeight * .68, 440)) * (.4 + Math.random() * .6);
      const horizontal = Math.cos(angle) * distance;
      const peak = -Math.sin(angle) * distance;
      const fall = reducedMotion ? 55 : Math.min(innerHeight * .65, 460) + Math.random() * 120;
      particle.className = 'celebration-particle';
      particle.style.left = `${origin.x * 100}%`;
      particle.style.top = `${origin.y * 100}%`;
      particle.style.backgroundColor = colors[index % colors.length];
      particle.style.borderRadius = options.shapes?.length === 1 && options.shapes[0] === 'circle' ? '50%' : '2px';
      const size = (5 + Math.random() * 4) * Math.max(.2, Math.min(3, Number(options.scalar ?? 1)));
      particle.style.width = `${size}px`;
      particle.style.height = `${size * (options.shapes?.[0] === 'circle' ? 1 : .6)}px`;
      particle.style.setProperty('--confetti-mid-x', `${horizontal * .65}px`);
      particle.style.setProperty('--confetti-mid-y', `${peak}px`);
      particle.style.setProperty('--confetti-end-x', `${horizontal * 1.5}px`);
      particle.style.setProperty('--confetti-end-y', `${fall}px`);
      particle.style.setProperty('--confetti-turn', `${(Math.random() - .5) * 900}deg`);
      particle.style.animationDuration = `${duration}ms`;
      particles.push(particle);
    }
    const fragment = document.createDocumentFragment();
    particles.forEach((particle) => fragment.append(particle));
    fallback.append(fragment);
    const job = ticket(() => particles.forEach((particle) => particle.remove()));
    job.after(duration + 100);
    return job.promise;
  }

  function burst(options = {}) {
    if (destroyed) return Promise.resolve();
    let count = Number(options.particleCount ?? 42);
    if (!Number.isFinite(count)) count = 42;
    count = Math.max(0, Math.min(maxPerBurst, Math.floor(count)));
    if (reducedMotion) count = Math.min(12, Math.ceil(count * .18));
    if (!count) return Promise.resolve();
    const clampOrigin = (value, fallbackValue) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallbackValue;
    const settings = {
      spread: 75,
      startVelocity: reducedMotion ? 12 : 36,
      ticks: reducedMotion ? 50 : 130,
      gravity: 1,
      ...options,
      origin: {
        x: clampOrigin(options.origin?.x, .5),
        y: clampOrigin(options.origin?.y, .65),
      },
      colors: Array.isArray(options.colors) && options.colors.length ? options.colors : DEFAULT_COLORS,
      disableForReducedMotion: false,
    };
    const engine = renderer();
    if (!engine) return cssBurst(settings, count);
    count = Math.min(count, Math.max(0, maxLive - liveNative));
    if (!count) return Promise.resolve();
    liveNative += count;
    const job = ticket(() => { liveNative = Math.max(0, liveNative - count); });
    try {
      const completion = engine({ ...settings, particleCount: count });
      Promise.resolve(completion).then(job.finish, job.finish);
      // This guard also settles callers if a third-party animation stalls.
      job.after(10000);
      return job.promise;
    } catch (error) {
      job.finish();
      nativeFailed = true;
      try { native?.reset(); } catch { /* CSS fallback remains available. */ }
      native = null;
      console.warn('[confetti] Using the CSS celebration fallback.', error);
      return cssBurst(settings, count);
    }
  }

  function cannons() {
    const count = mobile ? 60 : 90;
    return Promise.all([
      burst({ particleCount: count, angle: 60, spread: 62, origin: { x: 0, y: 1 }, startVelocity: reducedMotion ? 12 : 48 }),
      burst({ particleCount: count, angle: 120, spread: 62, origin: { x: 1, y: 1 }, startVelocity: reducedMotion ? 12 : 48 }),
    ]).then(() => undefined);
  }

  function reset() {
    try { native?.reset(); } catch { /* Still release local nodes and waiters. */ }
    [...jobs].forEach((finish) => finish());
    liveNative = 0;
    fallback.replaceChildren();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    reset();
    canvas.remove();
    fallback.remove();
  }

  return { burst, cannons, reset, destroy };
}
