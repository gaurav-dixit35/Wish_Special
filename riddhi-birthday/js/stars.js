import { skyLandmarks } from './sky-layout.js';

const TAU = Math.PI * 2;
const randomBetween = (min, max) => min + Math.random() * (max - min);

/** Shared-loop star field. All public hit-test coordinates are CSS pixels. */
export function createStars(canvas, { mobile = false } = {}) {
  const context = canvas.getContext('2d', { alpha: true });
  let width = 1;
  let height = 1;
  let disposed = false;
  let nextShootingStar = null;
  let meteor = null;
  let previousTime = null;
  let restingStar = false;
  const tapCallbacks = new Set();
  const wishStars = new Map();
  const stars = Array.from({ length: mobile ? 80 : 160 }, () => ({
    x: Math.random(),
    y: Math.random(),
    radius: randomBetween(0.5, 1.8),
    alpha: randomBetween(0.3, 0.8),
    speed: randomBetween(0.45, 1.1),
    phase: randomBetween(0, TAU),
    cross: Math.random() < 0.065,
  }));

  // Pre-render the tiny glow once; avoid per-star shadowBlur each frame.
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 48;
  glowCanvas.height = 48;
  const glowContext = glowCanvas.getContext('2d');
  if (glowContext) {
    const gradient = glowContext.createRadialGradient(24, 24, 0, 24, 24, 24);
    gradient.addColorStop(0, 'rgba(226,240,255,0.65)');
    gradient.addColorStop(0.18, 'rgba(165,215,255,0.25)');
    gradient.addColorStop(1, 'rgba(115,175,255,0)');
    glowContext.fillStyle = gradient;
    glowContext.fillRect(0, 0, 48, 48);
  }

  const constellations = [
    [[0.075, 0.285], [0.12, 0.225], [0.185, 0.26], [0.155, 0.345]],
    [[0.82, 0.715], [0.88, 0.68], [0.94, 0.725], [0.89, 0.79]],
  ];
  // Constellation anchors are part of the same 80/160-star allowance.
  constellations.flat().forEach(([x, y], index) => {
    Object.assign(stars[index], { x, y, radius: 1.25, alpha: 0.65 });
  });

  function resize(nextWidth, nextHeight, dpr = 1) {
    if (disposed || !context) return;
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    const scale = Math.max(1, Math.min(2, dpr));
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    meteor = null;
  }

  function drawConstellations() {
    context.lineWidth = 0.65;
    context.strokeStyle = 'rgba(155,203,248,0.12)';
    constellations.forEach((points) => {
      context.beginPath();
      points.forEach(([x, y], index) => {
        if (index === 0) context.moveTo(x * width, y * height);
        else context.lineTo(x * width, y * height);
      });
      context.stroke();
    });
  }

  function moonPosition() {
    return skyLandmarks(width, height, mobile).moon;
  }

  function wishPosition(key = 'birthday') {
    const star = wishStars.get(key);
    const fallback = skyLandmarks(width, height, mobile).wishes[key === 'secret' ? 'secret' : 'birthday'];
    return {x:star?.customX == null ? fallback.x : star.customX * width,
      y:star?.customY == null ? fallback.y : star.customY * height};
  }

  function drawMoon() {
    const { x, y } = moonPosition();
    const radius = mobile ? 13 : 17;
    const glow = context.createRadialGradient(x, y, 0, x, y, radius * 4);
    glow.addColorStop(0, 'rgba(255,221,145,0.1)');
    glow.addColorStop(1, 'rgba(255,221,145,0)');
    context.fillStyle = glow;
    context.fillRect(x - radius * 4, y - radius * 4, radius * 8, radius * 8);
    context.save();
    context.translate(x, y);
    context.rotate(-0.4);
    context.fillStyle = '#f5dfaa';
    context.globalAlpha = 0.85;
    context.beginPath();
    context.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2, true);
    // Bring the inner edge back through the left half, carving a concave
    // crescent instead of adding a second convex half to the moon.
    context.bezierCurveTo(-radius * 0.85, radius * 0.55, -radius * 0.85, -radius * 0.55, 0, -radius);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawStar(star, seconds, wish = false) {
    const x = star.x * width;
    const y = star.y * height;
    const alpha = star.alpha * (0.7 + 0.3 * Math.sin(seconds * star.speed + star.phase));
    context.globalAlpha = alpha;
    context.fillStyle = wish ? '#ffd36b' : '#e8f3ff';
    if (star.cross || wish) {
      const halo = star.radius * (wish ? 16 : 9);
      context.drawImage(glowCanvas, x - halo / 2, y - halo / 2, halo, halo);
      context.fillRect(x - 0.45, y - star.radius * 2.9, 0.9, star.radius * 5.8);
      context.fillRect(x - star.radius * 2.9, y - 0.45, star.radius * 5.8, 0.9);
    }
    context.beginPath();
    context.arc(x, y, star.radius, 0, TAU);
    context.fill();
    context.globalAlpha = 1;
  }

  function drawShootingStar(timeMs) {
    if (restingStar) {
      const {x, y} = moonPosition();
      meteor = { x, y:y + 72, tailX:x - 38, tailY:y + 54, alpha:1, started:timeMs };
      context.strokeStyle = 'rgba(183,220,255,.7)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(meteor.tailX, meteor.tailY);
      context.lineTo(meteor.x, meteor.y);
      context.stroke();
      context.drawImage(glowCanvas, meteor.x - 12, meteor.y - 12, 24, 24);
      context.fillStyle = '#fff5ce';
      context.fillRect(meteor.x - 4, meteor.y - 1, 8, 2);
      context.fillRect(meteor.x - 1, meteor.y - 4, 2, 8);
      return;
    }
    if (nextShootingStar === null) nextShootingStar = timeMs + randomBetween(6000, 12000);
    if (!meteor && timeMs >= nextShootingStar) {
      meteor = {
        started: timeMs,
        originX: randomBetween(width * 0.18, width * 0.62),
        originY: randomBetween(height * 0.06, height * 0.24),
        distance: Math.min(width * 0.42, 340),
        x: 0, y: 0, tailX: 0, tailY: 0, alpha: 0,
      };
      nextShootingStar = timeMs + randomBetween(6000, 12000);
    }
    if (!meteor) return;
    const progress = (timeMs - meteor.started) / 700;
    if (progress >= 1) {
      meteor = null;
      return;
    }
    meteor.x = meteor.originX + progress * meteor.distance;
    meteor.y = meteor.originY + progress * meteor.distance * 0.48;
    const tail = Math.min(progress * meteor.distance, mobile ? 75 : 110);
    meteor.tailX = meteor.x - tail;
    meteor.tailY = meteor.y - tail * 0.48;
    meteor.alpha = Math.sin(progress * Math.PI);
    if (tail < 0.1) return;
    const gradient = context.createLinearGradient(meteor.tailX, meteor.tailY, meteor.x, meteor.y);
    gradient.addColorStop(0, 'rgba(159,208,255,0)');
    gradient.addColorStop(0.75, 'rgba(183,220,255,0.45)');
    gradient.addColorStop(1, 'rgba(245,250,255,1)');
    context.globalAlpha = meteor.alpha;
    context.strokeStyle = gradient;
    context.lineWidth = 1.5;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(meteor.tailX, meteor.tailY);
    context.lineTo(meteor.x, meteor.y);
    context.stroke();
    context.drawImage(glowCanvas, meteor.x - 9, meteor.y - 9, 18, 18);
    context.globalAlpha = 1;
  }

  function hitTest(x, y) {
    if (disposed || !meteor || meteor.alpha < 0.1) return false;
    const dx = meteor.x - meteor.tailX;
    const dy = meteor.y - meteor.tailY;
    const lengthSquared = dx * dx + dy * dy;
    const position = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
      ((x - meteor.tailX) * dx + (y - meteor.tailY) * dy) / lengthSquared));
    return Math.hypot(x - meteor.tailX - position * dx, y - meteor.tailY - position * dy) <= 28;
  }

  function handlePointerDown(event) {
    const control = event.target?.closest?.('button, a, input, textarea, [role="dialog"]');
    if (control && control.dataset.egg !== 'star') return;
    const bounds = canvas.getBoundingClientRect();
    if (!hitTest(event.clientX - bounds.left, event.clientY - bounds.top)) return;
    tapCallbacks.forEach((callback) => {
      try { callback(); } catch (error) { console.warn('Shooting-star tap could not complete.', error); }
    });
  }

  return {
    resize,
    getMoonPosition: moonPosition,
    getWishStarPosition: wishPosition,
    getShootingStarPosition() { return meteor && meteor.alpha >= .1 ? {x:meteor.x, y:meteor.y} : null; },
    setRestingStar(value) {
      if (restingStar === Boolean(value)) return;
      restingStar = Boolean(value);
      meteor = null;
      nextShootingStar = null;
    },
    draw(timeMs) {
      if (disposed || !context) return;
      // The owner pauses RAF in a hidden tab. Preserve the shooting-star wait
      // when that tab returns instead of spawning several missed events.
      if (previousTime !== null && timeMs - previousTime > 1000) {
        if (nextShootingStar !== null) nextShootingStar += timeMs - previousTime;
        meteor = null;
      }
      previousTime = timeMs;
      context.clearRect(0, 0, width, height);
      drawConstellations();
      stars.forEach((star) => drawStar(star, timeMs / 1000));
      wishStars.forEach((star, key) => {
        const point = wishPosition(key);
        drawStar({...star, x:point.x / width, y:point.y / height}, timeMs / 1000, true);
      });
      drawMoon();
      drawShootingStar(timeMs);
    },
    shootingStar: {
      hitTest,
      onTap(callback) {
        if (disposed || typeof callback !== 'function') return () => {};
        if (tapCallbacks.size === 0) window.addEventListener('pointerdown', handlePointerDown, { passive: true });
        tapCallbacks.add(callback);
        return () => {
          tapCallbacks.delete(callback);
          if (tapCallbacks.size === 0) window.removeEventListener('pointerdown', handlePointerDown);
        };
      },
    },
    addWishStar(key = 'birthday', position = {}) {
      if (disposed) return;
      // Two wishes are supported by the story; cap extras for a stable budget.
      if (wishStars.has(key) || wishStars.size >= 2) return;
      wishStars.set(key, {
        customX: Number.isFinite(position.x) ? Math.max(.1,Math.min(.9,position.x)) : null,
        customY: Number.isFinite(position.y) ? Math.max(.05,Math.min(.3,position.y)) : null,
        radius: 1.8, alpha: 0.95, speed: 0.65, phase: randomBetween(0, TAU), cross: true,
      });
    },
    destroy() {
      disposed = true;
      window.removeEventListener('pointerdown', handlePointerDown);
      tapCallbacks.clear();
      context?.clearRect(0, 0, width, height);
    },
  };
}
