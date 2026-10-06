let nextLightboxId = 1;
const focusableSelector = 'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]';

function focusWithoutScroll(element) {
  if (!element?.isConnected || typeof element.focus !== 'function') return;
  try { element.focus({ preventScroll: true }); } catch { element.focus(); }
}

function readTransform(element) {
  const style = getComputedStyle(element);
  const numbers = style.transform.match(/^matrix\(([^)]+)\)$/)?.[1].split(',').map(Number);
  const matrix3d = style.transform.match(/^matrix3d\(([^)]+)\)$/)?.[1].split(',').map(Number);
  const a = numbers?.[0] ?? matrix3d?.[0] ?? 1;
  const b = numbers?.[1] ?? matrix3d?.[1] ?? 0;
  const c = numbers?.[2] ?? matrix3d?.[4] ?? 0;
  const d = numbers?.[3] ?? matrix3d?.[5] ?? 1;
  const scaleX = Math.hypot(a, b) || 1;
  return {
    x: numbers?.[4] ?? matrix3d?.[12] ?? 0,
    y: numbers?.[5] ?? matrix3d?.[13] ?? 0,
    scaleX,
    scaleY: (a * d - b * c) / scaleX,
    rotation: Math.atan2(b, a) * 180 / Math.PI,
    opacity: Number(style.opacity) || 0,
  };
}

// The original polaroid is rotated and crops its photo. Match both at each
// endpoint, then turn it upright while revealing the complete photograph.
export function photoTransition(rect, size, destination, rotation = 0) {
  const angle = rotation * Math.PI / 180;
  const scaleX = size.width / destination.width;
  const scaleY = size.height / destination.height;
  const cover = Math.max(scaleX, scaleY);
  return {
    frame: {
      x: rect.left + rect.width / 2 - (Math.cos(angle) * size.width - Math.sin(angle) * size.height) / 2 - destination.left,
      y: rect.top + rect.height / 2 - (Math.sin(angle) * size.width + Math.cos(angle) * size.height) / 2 - destination.top,
      scaleX, scaleY, rotation, opacity: 1,
    },
    image: { scaleX: cover / scaleX, scaleY: cover / scaleY },
  };
}

function lockBackground(overlay) {
  const body = document.body;
  const html = document.documentElement;
  const scroll = { x: window.scrollX, y: window.scrollY };
  const properties = ['position', 'top', 'left', 'right', 'width', 'overflow', 'paddingRight'];
  const previous = Object.fromEntries(properties.map((name) => [name, body.style[name]]));
  const htmlOverflow = html.style.overflow;
  const scrollbar = Math.max(0, window.innerWidth - html.clientWidth);
  const paddingRight = parseFloat(getComputedStyle(body).paddingRight) || 0;
  const backgrounds = [];
  const supportsInert = 'inert' in HTMLElement.prototype;

  for (const element of body.children) {
    if (element === overlay || ['SCRIPT', 'STYLE', 'LINK'].includes(element.tagName)) continue;
    const entry = {
      element, inert: element.getAttribute('inert'), ariaHidden: element.getAttribute('aria-hidden'),
      tabStops: [],
    };
    if (!supportsInert) {
      const candidates = [...element.querySelectorAll(focusableSelector)];
      if (element.matches(focusableSelector)) candidates.push(element);
      for (const candidate of candidates) {
        entry.tabStops.push([candidate, candidate.getAttribute('tabindex')]);
        candidate.setAttribute('tabindex', '-1');
      }
    }
    element.setAttribute('inert', '');
    element.setAttribute('aria-hidden', 'true');
    backgrounds.push(entry);
  }
  // Fixed positioning also locks document scrolling on older iOS Safari.
  body.style.position = 'fixed';
  body.style.top = `${-scroll.y}px`;
  body.style.left = `${-scroll.x}px`;
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  body.style.paddingRight = `${paddingRight + scrollbar}px`;
  html.style.overflow = 'hidden';
  let restored = false;

  return () => {
    if (restored) return;
    restored = true;
    for (const { element, inert, ariaHidden, tabStops } of backgrounds) {
      if (inert === null) element.removeAttribute('inert');
      else element.setAttribute('inert', inert);
      if (ariaHidden === null) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', ariaHidden);
      for (const [candidate, tabindex] of tabStops) {
        if (tabindex === null) candidate.removeAttribute('tabindex');
        else candidate.setAttribute('tabindex', tabindex);
      }
    }
    for (const name of properties) body.style[name] = previous[name];
    html.style.overflow = htmlOverflow;
    window.scrollTo(scroll.x, scroll.y);
  };
}

export function createLightbox(ctx) {
  const copy = ctx.config.memoriesUi;
  let destroyed = false;
  let session = null;
  let operation = 0;
  let pendingDecode = null;

  function dispose(current, { restoreFocus = true } = {}) {
    if (!current || current.disposed) return;
    current.disposed = true;
    current.motionScope?.destroy();
    current.scope.destroy();
    current.source.style.visibility = current.sourceVisibility;
    current.overlay.remove();
    current.unlock?.();
    if (session === current) session = null;
    if (restoreFocus) focusWithoutScroll(current.previousFocus?.isConnected ? current.previousFocus : current.source);
  }

  function decodeClone(image) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (success) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (pendingDecode === cancel) pendingDecode = null;
        resolve(success);
      };
      const cancel = () => finish(false);
      const timer = setTimeout(cancel, 4000);
      pendingDecode = cancel;
      try {
        Promise.resolve(typeof image.decode === 'function' ? image.decode() : undefined)
          .then(() => finish(Boolean(image.naturalWidth && image.naturalHeight))).catch(cancel);
      } catch { cancel(); }
    });
  }

  async function open({ source, image, alt = '', caption = '', rotation = 0 } = {}) {
    if (destroyed || !ctx.scope.alive || !source?.isConnected || !image?.naturalWidth || !image.naturalHeight) return false;
    const token = ++operation;
    pendingDecode?.();
    if (session) dispose(session, { restoreFocus: false });
    const clone = image.cloneNode();
    clone.className = 'photo-lightbox-image';
    clone.alt = String(alt);
    clone.draggable = false;
    if (!await decodeClone(clone) || token !== operation || destroyed || !ctx.scope.alive || !source.isConnected) return false;

    const sourceRect = source.getBoundingClientRect();
    if (sourceRect.width < 1 || sourceRect.height < 1) return false;
    const overlay = document.createElement('div');
    overlay.className = 'photo-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', copy.lightboxLabel);
    overlay.tabIndex = -1;
    overlay.innerHTML = '<div class="photo-lightbox-shade" aria-hidden="true"></div><button class="photo-lightbox-close" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button><div class="photo-lightbox-space"><figure class="photo-lightbox-frame"></figure></div><p class="photo-lightbox-caption"></p>';
    const shade = overlay.querySelector('.photo-lightbox-shade');
    const closeButton = overlay.querySelector('.photo-lightbox-close');
    const space = overlay.querySelector('.photo-lightbox-space');
    const frame = overlay.querySelector('.photo-lightbox-frame');
    const description = overlay.querySelector('.photo-lightbox-caption');
    closeButton.setAttribute('aria-label', copy.closeLightbox);
    description.textContent = String(caption);
    description.id = `photo-lightbox-caption-${nextLightboxId++}`;
    description.hidden = !caption;
    if (caption) {
      overlay.setAttribute('aria-describedby', description.id);
      description.tabIndex = 0;
    }
    frame.append(clone);
    const current = {
      source, sourceVisibility: source.style.visibility, overlay, frame, image: clone, shade, closeButton,
      rotation: Number.isFinite(rotation) ? rotation : 0,
      previousFocus: document.activeElement, scope: ctx.createScope(), motionScope: null,
      disposed: false, stage: 'opening', closing: null, unlock: null,
    };
    session = current;

    try {
      document.body.append(overlay);
      // Move focus before hiding the card's ancestor from assistive technology.
      focusWithoutScroll(closeButton);
      current.unlock = lockBackground(overlay);
      const bounds = space.getBoundingClientRect();
      const ratio = clone.naturalWidth / clone.naturalHeight;
      const width = Math.max(1, Math.min(1040, bounds.width, bounds.height * ratio));
      const height = width / ratio;
      const left = (bounds.width - width) / 2;
      const top = (bounds.height - height) / 2;
      Object.assign(frame.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
      current.destination = { left: bounds.left + left, top: bounds.top + top, width, height };
      const start = photoTransition(sourceRect, {width:source.offsetWidth,height:source.offsetHeight}, current.destination, current.rotation);
      source.style.visibility = 'hidden';

      current.scope.on(closeButton, 'click', () => { void close(); });
      current.scope.on(overlay, 'click', (event) => {
        if (event.target === overlay || event.target === shade || event.target === space) void close();
      });
      current.scope.on(document, 'keydown', (event) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); void close(); return; }
        if (event.key !== 'Tab') return;
        const items = [...overlay.querySelectorAll(focusableSelector)]
          .filter((element) => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
        const first = items[0] ?? closeButton;
        const last = items[items.length - 1] ?? closeButton;
        if (event.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
          event.preventDefault(); focusWithoutScroll(last);
        } else if (!event.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) {
          event.preventDefault(); focusWithoutScroll(first);
        }
      }, true);
      current.scope.on(document, 'focusin', (event) => {
        if (!overlay.contains(event.target)) focusWithoutScroll(closeButton);
      }, true);
      const resize = () => { void close({ immediate: true }); };
      current.scope.on(window, 'resize', resize);
      if (window.visualViewport) current.scope.on(window.visualViewport, 'resize', resize);
      current.motionScope = ctx.createScope();
      const motion = current.motionScope;
      const finalFrame = {x:0,y:0,scaleX:1,scaleY:1,rotation:0,opacity:1};
      await Promise.all([
        motion.motion(frame, ctx.reducedMotion ? {...finalFrame,opacity:0} : start.frame, finalFrame, { duration: .45, ease: 'power3.out' }),
        motion.motion(clone, ctx.reducedMotion ? {scaleX:1,scaleY:1} : start.image, {scaleX:1,scaleY:1}, {duration:.45,ease:'power3.out'}),
        motion.motion(shade, { opacity: 0 }, { opacity: 1 }, { duration: .35 }),
        motion.motion(closeButton, { opacity: 0, y: -8 }, { opacity: 1, y: 0 }, { duration: .35 }),
        motion.motion(description, { opacity: 0, y: 8 }, { opacity: 1, y: 0 }, { duration: .35 }),
      ]);
      if (current.disposed || current.stage === 'closing' || token !== operation) return false;
      current.stage = 'open';
      return true;
    } catch (error) {
      dispose(current);
      console.warn('[lightbox] Keeping the photo in its memory card.', error);
      return false;
    }
  }

  function close({ immediate = false } = {}) {
    ++operation;
    pendingDecode?.();
    const current = session;
    if (!current || current.disposed) return Promise.resolve(false);
    if (immediate || destroyed || !ctx.scope.alive) { dispose(current); return Promise.resolve(true); }
    if (current.stage === 'closing') return current.closing;
    current.stage = 'closing';
    const from = readTransform(current.frame);
    const imageFrom = readTransform(current.image);
    const shadeOpacity = Number(getComputedStyle(current.shade).opacity) || 0;
    current.motionScope?.destroy();
    current.motionScope = ctx.createScope();
    const target = current.source.isConnected ? current.source.getBoundingClientRect() : null;
    const destination = current.destination;
    const targetTransform = target?.width > 0 && target?.height > 0
      ? photoTransition(target, {width:current.source.offsetWidth,height:current.source.offsetHeight}, destination, current.rotation)
      : {frame:{...from,opacity:0},image:imageFrom};
    if (ctx.reducedMotion) { targetTransform.frame = {...from,opacity:0}; targetTransform.image = {scaleX:imageFrom.scaleX,scaleY:imageFrom.scaleY}; }
    current.closing = Promise.all([
      current.motionScope.motion(current.frame, from, targetTransform.frame, { duration: .4, ease: 'power3.inOut' }),
      current.motionScope.motion(current.image, {scaleX:imageFrom.scaleX,scaleY:imageFrom.scaleY}, targetTransform.image, {duration:.4,ease:'power3.inOut'}),
      current.motionScope.motion(current.shade, { opacity: shadeOpacity }, { opacity: 0 }, { duration: .4 }),
      current.motionScope.motion(current.closeButton, { opacity: 1, y: 0 }, { opacity: 0, y: -8 }, { duration: .2 }),
      current.motionScope.motion(current.overlay.querySelector('.photo-lightbox-caption'), { opacity: 1, y: 0 }, { opacity: 0, y: 8 }, { duration: .2 }),
    ]).then(() => { dispose(current); return true; }).catch(() => { dispose(current); return false; });
    return current.closing;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    ++operation;
    pendingDecode?.();
    dispose(session);
  }

  ctx.scope.add(destroy);
  return { open, close, destroy, get active() { return Boolean(session || pendingDecode); } };
}
