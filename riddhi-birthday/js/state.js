// Only completed keepsakes are persisted. The countdown and audio always start fresh.
const STORAGE_KEY = 'riddhi.birthday.progress.v1';
const stores = new WeakMap();

function browserStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function validId(value) {
  return (typeof value === 'string' && value.length > 0 && value.length <= 64)
    || (Number.isInteger(value) && value >= 0 && value <= 1000);
}

function restoredSet(value) {
  return new Set(Array.isArray(value) ? value.filter(validId).slice(0, 128) : []);
}

export function createState(storage = browserStorage()) {
  const current = {
    unlocked: false,
    audioOn: false,
    muted: false,
    chapter: 0,
    stamps: new Set(),
    eggsFound: new Set(),
    wishSent: false,
  };

  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      current.stamps = restoredSet(saved.stamps);
      current.eggsFound = restoredSet(saved.eggsFound);
      current.wishSent = saved.wishSent === true;
    }
  } catch {
    // Private browsing, full storage, and a damaged save must never block the story.
  }
  stores.set(current, storage);
  return current;
}

export const state = createState();
export default state;

export function saveState(current = state) {
  try {
    const storage = stores.get(current);
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify({
      stamps: [...current.stamps].filter(validId),
      eggsFound: [...current.eggsFound].filter(validId),
      wishSent: current.wishSent === true,
    }));
    return true;
  } catch {
    return false;
  }
}

export function awardStamp(id, current = state) {
  if (!validId(id) || current.stamps.has(id)) return false;
  current.stamps.add(id);
  saveState(current);
  return true;
}

export function discoverEgg(id, current = state) {
  if (!validId(id) || current.eggsFound.has(id)) return false;
  current.eggsFound.add(id);
  saveState(current);
  return true;
}

export function setWishSent(sent = true, current = state) {
  current.wishSent = sent === true;
  saveState(current);
}
