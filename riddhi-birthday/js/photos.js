// Photo cards never expose a loading or broken image. The placeholder stays
// until a preloaded image's own clone has decoded successfully.
export function mountPhoto(ctx, { mount, src, alt = '', label = '' } = {}) {
  const placeholder = document.createElement('div');
  placeholder.className = 'memory-photo-placeholder';
  const dog = document.createElement('span');
  dog.className = 'memory-photo-placeholder-dog';
  dog.setAttribute('aria-hidden', 'true');
  dog.textContent = '🐶';
  const message = document.createElement('span');
  message.className = 'memory-photo-placeholder-label';
  message.textContent = String(label);
  placeholder.append(dog, message);
  mount.append(placeholder);

  let image = null;
  let settled = false;
  let destroyed = false;
  let decoding = false;
  let unsubscribe = () => {};
  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });
  const timeout = setTimeout(() => settle(false), 5000);

  function settle(success) {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    unsubscribe();
    if (!success && !destroyed && ctx.scope.alive && src && ctx.preloader?.results?.get(src)?.status !== 'placeholder') {
      console.warn(`[photo] Keeping the placeholder for ${src}; the photo did not finish decoding.`);
    }
    resolveReady(success);
  }

  function tryImage() {
    if (destroyed || settled || decoding) return;
    if (!src || !ctx.preloader?.getImage) { settle(false); return; }
    const loaded = ctx.preloader.getImage(src);
    if (!loaded) {
      if (ctx.preloader.loaded || ctx.preloader.results?.get(src)?.status === 'placeholder') settle(false);
      return;
    }
    decoding = true;
    unsubscribe();
    let candidate;
    try {
      candidate = loaded.cloneNode();
      candidate.className = 'memory-photo-image';
      candidate.alt = String(alt);
      candidate.decoding = 'async';
      candidate.draggable = false;
      Promise.resolve(typeof candidate.decode === 'function' ? candidate.decode() : undefined)
        .then(() => {
          if (destroyed || settled || !ctx.scope.alive) return;
          if (!candidate.naturalWidth || !candidate.naturalHeight) { settle(false); return; }
          image = candidate;
          mount.append(image);
          placeholder.hidden = true;
          mount.classList.add('has-memory-photo');
          settle(true);
        }).catch(() => settle(false));
    } catch { settle(false); }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    settle(false);
    unsubscribe();
    // Keep the current card intact for its outgoing chapter/stack animation.
  }

  tryImage();
  if (!settled && !decoding && ctx.preloader?.subscribe) {
    unsubscribe = ctx.preloader.subscribe(tryImage);
    if (settled || decoding) unsubscribe();
  }
  ctx.scope.add(destroy);
  return { ready, get image() { return image; }, destroy };
}
