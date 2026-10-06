// Coverage is tracked on a small grid instead of reading a full canvas on every
// pointer move. Coordinates and brush radii are normalized so a resize keeps
// both the scratched picture and the progress already earned.
export function createScratchCoverage({ columns = 80, rows = 60 } = {}) {
  const width = Math.max(1, Math.floor(columns));
  const height = Math.max(1, Math.floor(rows));
  const cells = new Uint8Array(width * height);
  let cleared = 0;
  return {
    get fraction() { return cleared / cells.length; },
    mark(from, to, radiusX, radiusY = radiusX) {
      if (![from?.x, from?.y, to?.x, to?.y, radiusX, radiusY].every(Number.isFinite) || radiusX <= 0 || radiusY <= 0) return cleared / cells.length;
      const left = Math.max(0, Math.floor((Math.min(from.x, to.x) - radiusX) * width));
      const right = Math.min(width - 1, Math.ceil((Math.max(from.x, to.x) + radiusX) * width));
      const top = Math.max(0, Math.floor((Math.min(from.y, to.y) - radiusY) * height));
      const bottom = Math.min(height - 1, Math.ceil((Math.max(from.y, to.y) + radiusY) * height));
      const ax = from.x / radiusX;
      const ay = from.y / radiusY;
      const dx = (to.x - from.x) / radiusX;
      const dy = (to.y - from.y) / radiusY;
      const lengthSquared = dx * dx + dy * dy;
      for (let row = top; row <= bottom; row += 1) {
        for (let column = left; column <= right; column += 1) {
          const index = row * width + column;
          if (cells[index]) continue;
          const px = (column + .5) / width / radiusX - ax;
          const py = (row + .5) / height / radiusY - ay;
          const t = lengthSquared ? Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSquared)) : 0;
          if ((px - t * dx) ** 2 + (py - t * dy) ** 2 <= 1) {
            cells[index] = 1;
            cleared += 1;
          }
        }
      }
      return cleared / cells.length;
    },
  };
}

export function createScratchSurface({ canvas, scope, label, hint, enabled = () => true, onProgress = () => {}, onReveal = () => {} }) {
  const coverage = createScratchCoverage();
  const strokes = [];
  const context = canvas.getContext('2d');
  let pointer = null;
  let destroyed = false;
  let revealed = false;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let observer;

  function cancelPointer() {
    const previous = pointer;
    pointer = null;
    canvas.classList.remove('is-scratching');
    if (!previous) return;
    try { if (canvas.hasPointerCapture(previous.id)) canvas.releasePointerCapture(previous.id); } catch { /* Capture may already have ended. */ }
  }

  function erase(stroke) {
    if (!context || !width || !height) return;
    context.save();
    context.globalCompositeOperation = 'destination-out';
    context.scale(width * stroke.radiusX, height * stroke.radiusY);
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(stroke.from.x / stroke.radiusX, stroke.from.y / stroke.radiusY);
    context.lineTo(stroke.to.x / stroke.radiusX, stroke.to.y / stroke.radiusY);
    context.stroke();
    // A zero-length stroke is a tap. Drawing a disc also closes the tiny seam
    // between line segments in browsers with different stroke rasterizers.
    context.beginPath();
    context.arc(stroke.to.x / stroke.radiusX, stroke.to.y / stroke.radiusY, 1, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function paintFoil() {
    if (!context || !width || !height) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    if (revealed) return;
    const foil = context.createLinearGradient(0, 0, width, height);
    foil.addColorStop(0, '#9cacbe');
    foil.addColorStop(.28, '#e3e9f0');
    foil.addColorStop(.48, '#adbaca');
    foil.addColorStop(.72, '#d4dde8');
    foil.addColorStop(1, '#91a3b9');
    context.fillStyle = foil;
    context.fillRect(0, 0, width, height);
    context.lineWidth = 1;
    context.strokeStyle = '#ffffff20';
    for (let x = -height; x < width; x += 18) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + height, height);
      context.stroke();
    }
    context.strokeStyle = '#52668130';
    context.strokeRect(12, 12, width - 24, height - 24);
    context.fillStyle = '#334b6b';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '34px Fredoka, sans-serif';
    context.fillText('✦', width / 2, height * .31);
    context.font = '800 19px Nunito, sans-serif';
    context.fillText(label, width / 2, height * .52, width - 42);
    context.font = '16px Nunito, sans-serif';
    context.fillStyle = '#465d7b';
    context.fillText(hint, width / 2, height * .67, width - 38);
    strokes.forEach(erase);
  }

  function resize() {
    if (destroyed) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
    if (Math.abs(width - rect.width) < .25 && Math.abs(height - rect.height) < .25 && pixelRatio === ratio) return;
    cancelPointer();
    width = rect.width;
    height = rect.height;
    pixelRatio = ratio;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    paintFoil();
  }

  function reveal() {
    if (destroyed || revealed || !scope.alive || !enabled()) return false;
    revealed = true;
    cancelPointer();
    strokes.length = 0;
    if (context) context.clearRect(0, 0, width, height);
    canvas.classList.add('is-revealed');
    onProgress(1);
    onReveal();
    return true;
  }

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return rect.width && rect.height ? { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height } : null;
  }

  function scratch(from, to) {
    if (!context || !width || !height) return;
    const stroke = { from, to, radiusX: 22 / width, radiusY: 22 / height };
    strokes.push(stroke);
    erase(stroke);
    const fraction = coverage.mark(from, to, stroke.radiusX, stroke.radiusY);
    onProgress(fraction);
    if (fraction >= .55) reveal();
  }

  scope.on(canvas, 'pointerdown', (event) => {
    if (destroyed || revealed || pointer || !scope.alive || !enabled() || !context || event.button !== 0 || !event.isPrimary) return;
    resize();
    const start = point(event);
    if (!start) return;
    if (event.cancelable) event.preventDefault();
    pointer = { id: event.pointerId, last: start };
    canvas.classList.add('is-scratching');
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Window listeners still finish the gesture. */ }
    scratch(start, start);
  }, { passive: false });
  scope.on(window, 'pointermove', (event) => {
    if (!pointer || pointer.id !== event.pointerId || destroyed || revealed) return;
    if (event.cancelable) event.preventDefault();
    const next = point(event);
    if (!next) return;
    const previous = pointer.last;
    pointer.last = next;
    scratch(previous, next);
  }, { passive: false });
  scope.on(window, 'pointerup', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const next = point(event);
    if (next) scratch(pointer.last, next);
    cancelPointer();
  }, { passive: true });
  scope.on(window, 'pointercancel', (event) => { if (pointer?.id === event.pointerId) cancelPointer(); }, { passive: true });
  scope.on(canvas, 'lostpointercapture', (event) => { if (pointer?.id === event.pointerId) cancelPointer(); });
  scope.on(window, 'blur', cancelPointer);
  scope.on(document, 'visibilitychange', () => { if (document.hidden) cancelPointer(); });
  scope.on(window, 'resize', resize);
  if (globalThis.ResizeObserver) {
    observer = new ResizeObserver(resize);
    observer.observe(canvas);
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelPointer();
    observer?.disconnect();
    strokes.length = 0;
  }
  scope.add(destroy);
  if (!context) canvas.classList.add('has-no-context');
  resize();
  return { reveal, resize, destroy, get revealed() { return revealed; }, get progress() { return revealed ? 1 : coverage.fraction; } };
}
