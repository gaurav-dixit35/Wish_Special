// All assets settle, including unavailable files. No broken asset can hold the heart forever.
export function createPreloader(assets = {}, { timeoutMs = 15000, fontReady = Promise.resolve() } = {}) {
  const entries = [];
  const seen = new Set();
  for (const [group, kind] of [['images', 'image'], ['dogs', 'image'], ['audio', 'audio'], ['fonts', 'font']]) {
    for (const src of Array.isArray(assets[group]) ? assets[group] : []) {
      if (typeof src !== 'string' || !src.trim() || seen.has(src)) continue;
      seen.add(src);
      entries.push({ src, kind });
    }
  }

  const results = new Map();
  const listeners = new Set();
  const pending = new Set();
  const blobURLs = new Set();
  let settled = 0;
  let loaded = false;
  let destroyed = false;
  let startPromise = null;
  const progress = () => entries.length ? settled / entries.length : 1;

  function notifyOne(listener) {
    try { listener(progress(), { settled, total: entries.length }); }
    catch (error) { console.warn('[preloader] Progress listener failed.', error); }
  }

  function loadAsset({ src, kind }) {
    return new Promise((resolve) => {
      let finished = false;
      let image = null;
      const aborter = new AbortController();
      let timer;

      function finish(status, value = null, reason) {
        if (finished) {
          // A fetch may finish just after its timeout. Release any late-created URL.
          if (kind === 'audio' && typeof value === 'string' && value.startsWith('blob:')) {
            URL.revokeObjectURL(value);
            blobURLs.delete(value);
          }
          return;
        }
        finished = true;
        clearTimeout(timer);
        pending.delete(cancel);
        if (image) { image.onload = null; image.onerror = null; }
        if (status !== 'loaded') {
          aborter.abort();
          if (image) image.removeAttribute('src');
          if (!destroyed) console.warn(`[preloader] Placeholder used for ${src}.`, reason ?? 'Asset unavailable.');
        }
        results.set(src, { status, value });
        settled += 1;
        if (!destroyed) listeners.forEach(notifyOne);
        resolve();
      }

      const cancel = () => finish('placeholder', null, 'Loading cancelled.');
      pending.add(cancel);
      timer = setTimeout(() => finish('placeholder', null, 'Loading timed out.'), Math.max(1, timeoutMs));

      try {
        if (kind === 'image') {
          image = new Image();
          image.decoding = 'async';
          image.onload = async () => {
            try {
              if (typeof image.decode === 'function') await image.decode();
              if (!image.naturalWidth) throw new Error('Image has no decodable pixels.');
              finish('loaded', image);
            } catch (error) { finish('placeholder', null, error); }
          };
          image.onerror = () => finish('placeholder', null, 'Image could not be loaded.');
          image.src = src;
        } else if (kind === 'audio') {
          fetch(src, { signal: aborter.signal, cache: 'force-cache' })
            .then((response) => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return response.blob();
            })
            .then((blob) => {
              if (!blob.size) throw new Error('Audio file is empty.');
              if (finished) return;
              const url = URL.createObjectURL(blob);
              blobURLs.add(url);
              finish('loaded', url);
            })
            .catch((error) => finish('placeholder', null, error));
        } else {
          Promise.resolve(fontReady).then(() => {
            if (finished) return null;
            if (!globalThis.document?.fonts?.load) throw new Error('Font loading API is unavailable.');
            return document.fonts.load(src);
          }).then((faces) => {
            if (finished) return;
            if (!faces.length) throw new Error('Requested font is unavailable; using system font.');
            finish('loaded', faces);
          }).catch((error) => finish('placeholder', null, error));
        }
      } catch (error) { finish('placeholder', null, error); }
    });
  }

  function start() {
    if (startPromise) return startPromise;
    if (destroyed) return Promise.resolve({ total: entries.length, loaded: 0, placeholders: 0, cancelled: true });
    startPromise = Promise.all(entries.map(loadAsset)).then(() => {
      loaded = true;
      const placeholders = [...results.values()].filter((entry) => entry.status === 'placeholder').length;
      listeners.forEach(notifyOne);
      return { total: entries.length, loaded: entries.length - placeholders, placeholders, cancelled: destroyed };
    });
    return startPromise;
  }

  return {
    start,
    subscribe(listener) {
      if (typeof listener !== 'function' || destroyed) return () => {};
      listeners.add(listener);
      notifyOne(listener);
      return () => listeners.delete(listener);
    },
    get progress() { return progress(); },
    get results() { return results; },
    get loaded() { return loaded; },
    getImage(src) {
      const entry = results.get(src);
      return entry?.status === 'loaded' && entry.value?.tagName === 'IMG' ? entry.value : null;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      listeners.clear();
      [...pending].forEach((cancel) => cancel());
      blobURLs.forEach((url) => URL.revokeObjectURL(url));
      blobURLs.clear();
    },
  };
}
