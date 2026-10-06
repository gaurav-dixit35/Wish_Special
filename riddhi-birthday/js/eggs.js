import { discoverEgg } from './state.js';
import { activeModal, modalAllowsSecret } from './modal.js';

const eggIds = [1, 2, 3, 4, 5];
const targetIds = { moon: 1, star: 2, dog: 3, name: 4, heart: 5 };
const focusableSelector = 'button, a[href], input, textarea, select, [tabindex]';

// The guide lives outside transformed chapter panels. Keep its pointer aligned
// with the real hiding place while keeping the instructions inside the screen.
export function clueGuidePosition(target, panel, viewport) {
  const margin = 12;
  const gap = 16;
  const width = Math.min(panel.width, Math.max(0, viewport.width - margin * 2));
  const left = Math.max(margin, Math.min(viewport.width - width - margin,
    target.left + target.width / 2 - width / 2));
  const below = target.bottom + gap + panel.height <= viewport.height - margin;
  const top = Math.max(margin, Math.min(viewport.height - panel.height - margin,
    below ? target.bottom + gap : target.top - panel.height - gap));
  return { left, top, below, arrow: Math.max(20, Math.min(width - 20, target.left + target.width / 2 - left)) };
}

// Only the five story secrets count. A restored collection also repairs its
// final stamp if a previous visit ended between saving the secret and stamp.
export function createEggCollection(state, onComplete = () => {}) {
  let completed = false;
  const count = () => eggIds.filter((id) => state.eggsFound.has(id)).length;
  function complete(restored) {
    if (completed || count() !== eggIds.length) return;
    completed = true;
    onComplete({ restored });
  }
  complete(true);
  return {
    get count() { return count(); },
    discover(id) {
      if (!eggIds.includes(id) || !discoverEgg(id, state)) return false;
      complete(false);
      return true;
    },
  };
}

function focus(element) {
  if (!element?.isConnected) return;
  try { element.focus({ preventScroll: true }); } catch { element.focus(); }
}

// The controller belongs to the whole birthday journey. Chapter navigation
// removes only transient dialogs/audio; discovered keepsakes stay collected.
export function createEggs(ctx) {
  const copy = ctx.config.eggsUi;
  const listeners = new Set();
  let chapter = 0;
  let disposed = false;
  let nameTaps = 0;
  let modal = null;
  let voiceStatus = 'ready';
  let voiceOperation = 0;
  let allowSkyTap = true;
  const collection = createEggCollection(ctx.state, ({ restored }) => {
    ctx.awardStamp(8);
    if (!restored) void ctx.confetti.burst({ particleCount: 64, colors: ['#ffd36b', '#fff0bf', '#9fd0ff'] });
  });

  function publish() {
    if (disposed) return;
    ctx.refreshHud?.();
    listeners.forEach((callback) => {
      try { callback(); } catch (error) { console.warn('[secrets] Could not refresh a keepsake.', error); }
    });
  }

  function canDiscover(id, target) {
    return !disposed && chapter >= 3 && !document.hidden
      && modalAllowsSecret(id, target, activeModal());
  }

  function closeSecondWish({ restoreFocus = true } = {}) {
    const current = modal;
    if (!current) return;
    modal = null;
    current.dispose.forEach((dispose) => dispose());
    current.dialog.remove();
    current.restoreBackground?.();
    if (restoreFocus) focus(current.previousFocus);
  }

  function openSecondWish() {
    if (disposed || chapter < 3 || !ctx.state.eggsFound.has(2)) return false;
    if (modal) { focus(modal.dialog.querySelector('textarea:not([disabled]), button')); return true; }
    if (activeModal()) return false;
    const e = ctx.escape;
    const dialog = document.createElement('dialog');
    dialog.className = 'secret-wish-dialog';
    dialog.setAttribute('aria-labelledby', 'secret-wish-heading');
    dialog.setAttribute('aria-describedby', 'secret-wish-intro');
    dialog.setAttribute('aria-modal', 'true');
    dialog.innerHTML = `<div class="secret-wish-panel"><button class="secret-wish-close" type="button" aria-label="${e(copy.wishClose)}">×</button><span class="secret-wish-icon" aria-hidden="true">✦</span><p class="eyebrow">${e(copy.wishEyebrow)}</p><h2 id="secret-wish-heading">${e(copy.wishTitle)}</h2><p id="secret-wish-intro">${e(copy.wishIntro)}</p><form novalidate><label for="secret-wish-text">${e(copy.wishLabel)}</label><textarea id="secret-wish-text" name="wish" maxlength="280" rows="4" placeholder="${e(copy.wishPlaceholder)}" aria-describedby="secret-wish-counter secret-wish-validation" required></textarea><p id="secret-wish-counter" class="secret-wish-counter">${e(ctx.config.wishUi.count.replace('{count}', '0'))}</p><p id="secret-wish-validation" class="secret-wish-validation" role="status"></p><button class="primary-button" type="submit">${e(ctx.config.wish.button)}</button><p class="secret-wish-note">${e(ctx.config.wish.note)}</p></form><div class="secret-wish-result" hidden><span aria-hidden="true">🌠</span><h3 tabindex="-1">${e(copy.wishSaved)}</h3><p class="secret-wish-delivery" role="status" aria-live="polite"></p><button class="primary-button secret-wish-done" type="button">${e(copy.wishDone)}</button></div></div>`;
    const current = { dialog, previousFocus: document.activeElement, dispose: [], restoreBackground: null };
    modal = current;
    const form = dialog.querySelector('form');
    const textarea = dialog.querySelector('textarea');
    const validation = dialog.querySelector('#secret-wish-validation');
    const result = dialog.querySelector('.secret-wish-result');
    const on = (target, type, callback, options) => {
      target.addEventListener(type, callback, options);
      current.dispose.push(() => target.removeEventListener(type, callback, options));
    };
    const refresh = () => {
      if (modal !== current || disposed) return;
      const receipt = ctx.wishes.get('secret');
      if (!receipt) return;
      form.hidden = true;
      result.hidden = false;
      textarea.value = '';
      ctx.sky.addWishStar('secret');
      result.querySelector('.secret-wish-delivery').textContent = receipt.status === 'sent'
        ? ctx.config.wish.thanks : receipt.status === 'sending' ? ctx.config.wishUi.sending
          : receipt.durable ? ctx.config.wishUi.queued : ctx.config.wishUi.memory;
      dialog.dataset.delivery = receipt.status;
    };

    try {
      document.body.append(dialog);
      const previousOverflow = document.body.style.overflow;
      const previousHtmlOverflow = document.documentElement.style.overflow;
      current.dispose.push(() => {
        document.body.style.overflow = previousOverflow;
        document.documentElement.style.overflow = previousHtmlOverflow;
      });
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else {
        dialog.setAttribute('open', '');
        dialog.setAttribute('role', 'dialog');
        dialog.classList.add('secret-wish-fallback');
        const hidden = [];
        focus(textarea);
        for (const element of document.body.children) {
          if (element === dialog || ['SCRIPT', 'STYLE', 'LINK'].includes(element.tagName)) continue;
          const entry = { element, inert: element.getAttribute('inert'), ariaHidden: element.getAttribute('aria-hidden'), tabStops: [] };
          if (!('inert' in element)) {
            const candidates = [...element.querySelectorAll(focusableSelector)];
            if (element.matches(focusableSelector)) candidates.push(element);
            for (const candidate of candidates) {
              entry.tabStops.push([candidate, candidate.getAttribute('tabindex')]);
              candidate.setAttribute('tabindex', '-1');
            }
          }
          hidden.push(entry);
          element.setAttribute('inert', '');
          element.setAttribute('aria-hidden', 'true');
        }
        current.restoreBackground = () => {
          for (const { element, inert, ariaHidden, tabStops } of hidden) {
            if (inert === null) element.removeAttribute('inert'); else element.setAttribute('inert', inert);
            if (ariaHidden === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', ariaHidden);
            for (const [candidate, tabindex] of tabStops) {
              if (tabindex === null) candidate.removeAttribute('tabindex'); else candidate.setAttribute('tabindex', tabindex);
            }
          }
        };
      }
      on(dialog.querySelector('.secret-wish-close'), 'click', () => closeSecondWish());
      on(dialog.querySelector('.secret-wish-done'), 'click', () => closeSecondWish());
      on(dialog, 'cancel', (event) => { event.preventDefault(); closeSecondWish(); });
      on(dialog, 'click', (event) => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeSecondWish();
      });
      on(document, 'keydown', (event) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeSecondWish(); return; }
        if (event.key !== 'Tab') return;
        const controls = [...dialog.querySelectorAll(focusableSelector)]
          .filter((element) => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
          event.preventDefault(); focus(last);
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          event.preventDefault(); focus(first);
        }
      }, true);
      on(document, 'focusin', (event) => {
        if (modal === current && !dialog.contains(event.target)) focus(dialog.querySelector('.secret-wish-close'));
      }, true);
      on(textarea, 'input', () => {
        dialog.querySelector('#secret-wish-counter').textContent = ctx.config.wishUi.count.replace('{count}', String(textarea.value.length));
        validation.textContent = '';
        textarea.removeAttribute('aria-invalid');
      });
      on(form, 'submit', (event) => {
        event.preventDefault();
        if (ctx.wishes.get('secret')) { refresh(); return; }
        if (!textarea.value.trim()) {
          validation.textContent = ctx.config.wishUi.empty;
          textarea.setAttribute('aria-invalid', 'true');
          focus(textarea);
          return;
        }
        const receipt = ctx.wishes.submit(textarea.value, { slot: 'secret' });
        if (!receipt) return;
        refresh();
        focus(result.querySelector('h3'));
        ctx.audio.playSfx('sparkle');
        void ctx.confetti.burst({ particleCount: 24, colors: ['#ffd36b', '#9fd0ff', '#fff0bf'] });
        publish();
      });
      current.dispose.push(ctx.wishes.subscribe(refresh));
      refresh();
      focus(form.hidden ? dialog.querySelector('.secret-wish-done') : textarea);
      return true;
    } catch (error) {
      closeSecondWish();
      ctx.toast(copy.wishUnavailable);
      console.warn('[secrets] Could not open the second wish.', error);
      return false;
    }
  }

  async function playSecret() {
    if (disposed || chapter < 3 || !ctx.state.eggsFound.has(5) || voiceStatus === 'loading') return false;
    const operation = ++voiceOperation;
    voiceStatus = 'loading';
    publish();
    let started = false;
    try { started = Boolean(await ctx.audio.playVoice('others/voice/secret.mp3')); } catch { /* A missing voice note is a keepsake, never a blocked chapter. */ }
    if (disposed || operation !== voiceOperation) return false;
    voiceStatus = started ? 'started' : 'unavailable';
    publish();
    if (!started) {
      // Leave the discovery toast on screen long enough to read first.
      if (await ctx.scope.wait(1800) && !disposed && operation === voiceOperation) ctx.toast(copy.voiceMissing);
    }
    return started;
  }

  function stopSecret() {
    ++voiceOperation;
    ctx.audio.stopVoice?.();
    voiceStatus = 'ready';
    publish();
  }

  function discover(id, target) {
    if (!canDiscover(id, target) || !collection.discover(id)) return false;
    ctx.toast(ctx.config.eggs[id - 1]);
    ctx.audio.playSfx(id === 3 ? 'pop' : 'sparkle');
    if (id !== 5) void ctx.confetti.burst({ particleCount: id === 3 ? 25 : 14 });
    publish();
    if (id === 2) openSecondWish();
    if (id === 5) void playSecret();
    return true;
  }

  ctx.scope.on(document, 'pointerdown', (event) => {
    const interactive = event.target?.closest?.('button, a, input, textarea, select, canvas, [role="button"], [aria-modal="true"]');
    allowSkyTap = !interactive || interactive.dataset.egg === 'star';
  }, true);
  ctx.scope.on(document, 'keydown', (event) => {
    if (!disposed && chapter >= 3 && event.repeat && (event.key === 'Enter' || event.key === ' ') && event.target?.closest?.('[data-egg="name"]')) event.preventDefault();
  }, true);
  ctx.scope.on(document, 'click', (event) => {
    const target = event.target?.closest?.('[data-egg]');
    if (!target) return;
    const kind = target.dataset.egg;
    const id = targetIds[kind];
    if (!id || !canDiscover(id, target)) return;
    if (ctx.state.eggsFound.has(id)) {
      if (id === 2) openSecondWish();
      if (id === 5) void playSecret();
      if (![2, 5].includes(id)) ctx.toast(ctx.config.eggs[id - 1]);
      return;
    }
    if (kind === 'name') {
      nameTaps += 1;
      if (nameTaps < 5) { ctx.toast(copy.nameProgress.replace('{count}', String(nameTaps))); publish(); return; }
    }
    discover(id, target);
  });
  const removeShootingTap = ctx.sky.stars?.shootingStar?.onTap(() => {
    if (allowSkyTap) discover(2);
  }) ?? (() => {});
  ctx.scope.add(removeShootingTap);
  ctx.scope.add(ctx.audio.onVoiceEnd?.(() => {
    if (disposed || voiceStatus !== 'started') return;
    voiceStatus = 'ready';
    publish();
  }) ?? (() => {}));
  ctx.scope.on(document, 'birthday:soundchange', publish);
  ctx.scope.on(document, 'visibilitychange', () => { if (document.hidden && !disposed) stopSecret(); });

  function destroy() {
    if (disposed) return;
    disposed = true;
    ++voiceOperation;
    closeSecondWish({ restoreFocus: false });
    ctx.audio.stopVoice?.();
    removeShootingTap();
    listeners.clear();
  }
  ctx.scope.add(destroy);
  return {
    discover, openSecondWish, playSecret, stopSecret, destroy,
    get count() { return collection.count; },
    get voiceStatus() { return voiceStatus; },
    get nameTaps() { return nameTaps; },
    setChapter(id) {
      if (disposed) return;
      closeSecondWish({ restoreFocus: false });
      stopSecret();
      chapter = id;
      allowSkyTap = true;
    },
    subscribe(callback) {
      if (disposed || typeof callback !== 'function') return () => {};
      listeners.add(callback);
      callback();
      return () => listeners.delete(callback);
    },
  };
}
