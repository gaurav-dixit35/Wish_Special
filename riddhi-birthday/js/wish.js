// Root-owned outbox: changing chapters never cancels a submitted wish.
// Only an acknowledged API response is marked sent. Pending text stays local.
const STORAGE_KEY = 'pendingWish';
const ENDPOINT = 'https://api.web3forms.com/submit';
const SLOTS = new Set(['birthday', 'secret']);

function browserStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function createWishService({ config, storage = browserStorage(), fetcher = globalThis.fetch?.bind(globalThis) } = {}) {
  const entries = new Map();
  const subscribers = new Set();
  let disposed = false;
  let flight = null;
  let controller = null;
  let retryTimer = null;
  let retryDelay = 30000;
  let durable = Boolean(storage);

  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
    if (saved?.version === 1 && Array.isArray(saved.entries)) {
      for (const item of saved.entries.slice(0, 2)) {
        if (!SLOTS.has(item?.slot) || typeof item.id !== 'string' || item.id.length > 100) continue;
        const sent = item.status === 'sent';
        if (!sent && (typeof item.text !== 'string' || !item.text.trim() || item.text.length > 280)) continue;
        entries.set(item.slot, {id:item.id,slot:item.slot,text:sent ? '' : item.text,status:sent ? 'sent' : 'queued'});
      }
    }
  } catch { durable = false; }

  function persist() {
    try {
      if (!storage) { durable = false; return; }
      storage.setItem(STORAGE_KEY, JSON.stringify({version:1, entries:[...entries.values()].map((entry) => ({
        ...entry, status:entry.status === 'sent' ? 'sent' : 'queued',
      }))}));
      durable = true;
    } catch { durable = false; }
  }

  function get(slot = 'birthday') {
    const entry = entries.get(slot);
    // Never expose the private text to UI subscribers or diagnostics.
    return entry ? {id:entry.id,slot:entry.slot,status:entry.status,durable} : null;
  }

  function notify() {
    subscribers.forEach((callback) => {
      try { callback(); } catch (error) { console.warn('[wish] Could not refresh the wish display.', error); }
    });
  }

  function configured() {
    return typeof config?.web3formsKey === 'string'
      && /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(config.web3formsKey.trim());
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = null;
    if (disposed || !configured() || globalThis.navigator?.onLine === false || ![...entries.values()].some((entry) => entry.status === 'queued')) return;
    retryTimer = setTimeout(() => { retryTimer = null; void flush(); }, retryDelay);
    retryDelay = Math.min(300000, retryDelay * 2);
  }

  function flush() {
    if (disposed || flight || !configured() || typeof fetcher !== 'function' || globalThis.navigator?.onLine === false) return flight ?? Promise.resolve();
    clearTimeout(retryTimer);
    retryTimer = null;
    flight = (async () => {
      for (const entry of entries.values()) {
        if (disposed) break;
        if (entry.status === 'sent') continue;
        entry.status = 'sending';
        notify();
        controller = new AbortController();
        const timeout = setTimeout(() => controller?.abort(), 12000);
        try {
          const response = await fetcher(ENDPOINT, {
            method:'POST', headers:{'Content-Type':'application/json',Accept:'application/json'},
            credentials:'omit', referrerPolicy:'no-referrer', signal:controller.signal,
            body:JSON.stringify({
              access_key:config.web3formsKey.trim(), subject:config.wishDelivery.subject,
              from_name:config.wishDelivery.fromName, message:entry.text, wish_reference:entry.id,
            }),
          });
          const result = await response.json();
          if (!response.ok || result?.success !== true) throw new Error('Wish not acknowledged');
          entry.status = 'sent';
          entry.text = '';
          retryDelay = 30000;
        } catch {
          entry.status = 'queued';
        } finally {
          clearTimeout(timeout);
          controller = null;
          persist();
          if (!disposed) notify();
        }
        if (entry.status !== 'sent') break;
      }
    })().finally(() => { flight = null; scheduleRetry(); });
    return flight;
  }

  function submit(text, {slot = 'birthday'} = {}) {
    if (disposed || !SLOTS.has(slot)) return null;
    if (entries.has(slot)) return get(slot);
    const value = typeof text === 'string' ? text.trim() : '';
    if (!value || value.length > 280) return null;
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    entries.set(slot, {id,slot,text:value,status:'queued'});
    persist();
    notify();
    void flush();
    return get(slot);
  }

  function onOnline() { retryDelay = 30000; void flush(); }
  function onPageHide() { controller?.abort(); }
  function onPageShow() { if (!disposed) void flush(); }
  globalThis.addEventListener?.('online', onOnline);
  globalThis.addEventListener?.('pagehide', onPageHide);
  globalThis.addEventListener?.('pageshow', onPageShow);

  return {
    get, submit, flush,
    get configured() { return configured(); },
    subscribe(callback) { subscribers.add(callback); callback(); return () => subscribers.delete(callback); },
    destroy() {
      if (disposed) return;
      disposed = true;
      clearTimeout(retryTimer);
      controller?.abort();
      subscribers.clear();
      globalThis.removeEventListener?.('online', onOnline);
      globalThis.removeEventListener?.('pagehide', onPageHide);
      globalThis.removeEventListener?.('pageshow', onPageShow);
    },
  };
}
