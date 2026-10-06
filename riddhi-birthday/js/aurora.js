/** A deliberately low-resolution sky; its canvas is softened by CSS. */
export function createAurora(canvas, { mobile = false } = {}) {
  const context = canvas.getContext('2d', { alpha: true });
  let width = 1;
  let height = 1;
  let scale = 0.5;
  let intensity = 1;
  let wishMode = false;
  let disposed = false;

  const ribbons = [
    { rgb: '61,255,176', level: 0.14, wave: 0.105, thickness: 0.15, phase: 0.2, alpha: 0.29 },
    { rgb: '43,214,232', level: 0.24, wave: 0.095, thickness: 0.17, phase: 2.25, alpha: 0.32 },
    { rgb: '143,107,255', level: 0.12, wave: 0.14, thickness: 0.2, phase: 4.45, alpha: 0.36 },
  ];

  function resize(nextWidth, nextHeight, dpr = 1) {
    if (disposed || !context) return;
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    // A phone never needs a DPR-sized surface for a heavily blurred ribbon.
    scale = Math.min(mobile ? 1 : 2, Math.max(1, dpr)) * 0.5;
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function centreAt(x, ribbon, seconds) {
    const position = x / width;
    return height * (
      ribbon.level
      + Math.sin(position * 4.2 + ribbon.phase + seconds * 0.12) * ribbon.wave
      + Math.sin(position * 7.6 - ribbon.phase - seconds * 0.055) * ribbon.wave * 0.32
    );
  }

  function draw(timeMs) {
    if (disposed || !context) return;
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';
    const seconds = timeMs / 1000;
    const step = Math.max(12, width / 48);

    ribbons.forEach((ribbon, index) => {
      const thickness = Math.max(62, Math.min(height, width * 1.25) * ribbon.thickness);
      const gradient = context.createLinearGradient(0, -height * 0.2, 0, height * 0.58);
      gradient.addColorStop(0, `rgba(${ribbon.rgb},0)`);
      gradient.addColorStop(0.32, `rgba(${ribbon.rgb},0.3)`);
      gradient.addColorStop(0.54, `rgba(${ribbon.rgb},1)`);
      gradient.addColorStop(0.78, `rgba(${ribbon.rgb},0.34)`);
      gradient.addColorStop(1, `rgba(${ribbon.rgb},0)`);
      context.fillStyle = gradient;
      context.globalAlpha = Math.min(1, ribbon.alpha * intensity + (wishMode ? .1 : 0));
      context.beginPath();
      context.moveTo(-step, centreAt(-step, ribbon, seconds) - thickness / 2);
      for (let x = 0; x <= width + step; x += step) {
        context.lineTo(x, centreAt(x, ribbon, seconds) - thickness / 2);
      }
      for (let x = width + step; x >= -step; x -= step) {
        context.lineTo(x, centreAt(x, ribbon, seconds) + thickness / 2);
      }
      context.closePath();
      context.fill();

      // One faint reflected glow near each edge leaves the text area quiet.
      const x = index === 1 ? width * 0.98 : width * 0.02;
      const y = height * (index === 2 ? 0.79 : 0.28);
      const radius = Math.max(width * 0.33, 130);
      const glow = context.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, `rgba(${ribbon.rgb},0.17)`);
      glow.addColorStop(1, `rgba(${ribbon.rgb},0)`);
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);
    });
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
  }

  return {
    resize,
    draw,
    setIntensity(value) {
      if (Number.isFinite(value)) intensity = Math.max(0, Math.min(1.5, value));
    },
    setWishMode(value) { wishMode = Boolean(value); },
    destroy() {
      disposed = true;
      context?.clearRect(0, 0, width, height);
    },
  };
}
