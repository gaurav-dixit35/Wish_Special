import { createDog } from '../dog.js';
import { createScratchSurface } from '../scratch.js';

export const id = 10;
let scope;
const accents = ['#e7c295', '#d6b5e8', '#b0c8fa', '#edd78e', '#a9ddd4', '#edbdcc'];

export function init(ctx) {
  scope = ctx.scope;
  const s = scope;
  try {
    const { section, config, escape: e } = ctx;
    const copy = config.vouchersUi;
    if (!config.vouchers.length) throw new Error('The birthday voucher collection is empty.');
    const revealed = new Set();
    let ready = false;
    let leaving = false;
    const selected = Number.isInteger(ctx.selectedVoucher) && ctx.selectedVoucher >= 0 && ctx.selectedVoucher < config.vouchers.length ? ctx.selectedVoucher : null;
    section.setAttribute('aria-labelledby', 'vouchers-heading');
    section.innerHTML = `<div class="vouchers-content"><header class="vouchers-header"><p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>${e(copy.eyebrow)}</p><h1 id="vouchers-heading">${e(copy.title)}</h1><p>${e(copy.intro)}</p></header><div class="vouchers-guide-mount"></div><p class="vouchers-progress" role="status" aria-live="polite" aria-atomic="true"></p><div class="vouchers-grid">${config.vouchers.map((voucher, index) => `<article class="voucher-item${index === selected ? ' is-selected' : ''}" data-voucher="${index}" data-testid="voucher-${index + 1}" tabindex="-1" aria-label="${e(copy.cardLabel.replace('{number}', String(index + 1)))}" style="--voucher-accent:${accents[index % accents.length]}">${index === selected ? `<p class="voucher-selected-note">${e(copy.selected)}</p>` : ''}<div class="voucher-keepsake glass"><div class="voucher-promise" aria-hidden="true"><div class="voucher-topline"><span>${e(copy.keepsake)}</span><span>${String(index + 1).padStart(2, '0')} / ${String(config.vouchers.length).padStart(2, '0')}</span></div><h2>${e(voucher)}</h2><div class="voucher-signature"><span>${e(copy.forYou.replace('{name}', config.name))}</span><span aria-hidden="true">✦</span></div></div><canvas class="voucher-foil" aria-hidden="true"></canvas><span class="voucher-shine" aria-hidden="true">✦</span></div><div class="voucher-controls"><span class="voucher-status">${e(copy.sealed)}</span><button class="voucher-reveal" type="button" data-testid="voucher-reveal-${index + 1}" aria-label="${e(copy.revealLabel.replace('{number}', String(index + 1)))}" disabled>${e(copy.reveal)}</button></div></article>`).join('')}</div><p class="vouchers-save-note">${e(copy.saveHint)}</p><div class="vouchers-completion glass" hidden><span class="vouchers-complete-icon" aria-hidden="true">🐾</span><h2>${e(copy.completeTitle)}</h2><p>${e(copy.stamp)}</p></div><nav class="vouchers-navigation" aria-label="${e(copy.navigation)}">${ctx.hasChapter(11) ? `<button class="primary-button" data-testid="vouchers-next" type="button" disabled>${e(copy.next)}</button>` : ''}<button class="secondary-button" data-testid="vouchers-replay" type="button" disabled>${e(copy.replay)}</button>${ctx.hasChapter(9) ? `<button class="secondary-button" data-testid="vouchers-back" type="button" disabled>${e(copy.back)}</button>` : ''}</nav><p class="vouchers-note">${e(copy.dogIntro)}</p><span class="vouchers-announcement sr-only" role="status" aria-live="polite" aria-atomic="true"></span></div>`;

    const cards = [...section.querySelectorAll('.voucher-item')];
    const buttons = [...section.querySelectorAll('.voucher-reveal')];
    const progress = section.querySelector('.vouchers-progress');
    const completion = section.querySelector('.vouchers-completion');
    const announcement = section.querySelector('.vouchers-announcement');
    const dog = createDog(ctx, { mount: section.querySelector('.vouchers-guide-mount'), variant: 6, className: 'voucher-guide', mood: 'party-hat' });
    function caught(error) { if (s.alive) ctx.fail(error); }
    function refresh() {
      progress.textContent = copy.progress.replace('{count}', String(revealed.size)).replace('{total}', String(cards.length));
      buttons.forEach((button, index) => {
        button.disabled = !ready || leaving;
        button.setAttribute('aria-disabled', String(revealed.has(index) || !ready || leaving));
      });
      section.querySelectorAll('.vouchers-navigation button').forEach(button => { button.disabled = !ready || leaving; });
    }

    async function onReveal(index) {
      if (!s.alive || revealed.has(index)) return;
      revealed.add(index);
      const card = cards[index];
      card.classList.add('is-revealed');
      card.querySelector('.voucher-promise').removeAttribute('aria-hidden');
      card.querySelector('.voucher-status').textContent = copy.unsealed;
      buttons[index].textContent = copy.revealed;
      buttons[index].setAttribute('aria-label', copy.revealedLabel.replace('{number}', String(index + 1)));
      announcement.textContent = config.vouchers[index];
      ctx.audio.playSfx('sparkle');
      const rect = card.querySelector('.voucher-keepsake').getBoundingClientRect();
      void ctx.confetti.burst({ particleCount: ctx.mobile ? 14 : 22, colors: [accents[index % accents.length], '#e3edff'], origin: { x: Math.max(0, Math.min(1, (rect.left + rect.width / 2) / innerWidth)), y: Math.max(0, Math.min(1, (rect.top + rect.height / 2) / innerHeight)) }, spread: 85, startVelocity: 17 });
      refresh();
      if (revealed.size === cards.length) {
        ctx.awardStamp(7);
        section.dataset.complete = 'true';
        completion.hidden = false;
        void s.motion(completion, { opacity: 0, y: 15 }, { opacity: 1, y: 0 }, { duration: .4 });
        void dog.speak(copy.completeDog, { mood: 'jump', autoDismiss: 4500 });
      }
      await s.motion(card.querySelector('.voucher-shine'), { opacity: 1, scale: .6, rotate: -30 }, { opacity: 0, scale: 1.8, rotate: 20 }, { duration: ctx.reducedMotion ? .06 : .75 });
    }

    const scratches = cards.map((card, index) => createScratchSurface({
      canvas: card.querySelector('canvas'), scope: s, label: copy.foilTitle, hint: copy.foilHint,
      enabled: () => ready && !leaving,
      onProgress: fraction => {
        if (!s.alive || revealed.has(index) || fraction >= .55) return;
        card.querySelector('.voucher-status').textContent = fraction > 0 ? copy.scratched.replace('{percent}', String(Math.floor(fraction * 100))) : copy.sealed;
      },
      onReveal: () => { void onReveal(index).catch(caught); },
    }));
    buttons.forEach((button, index) => s.on(button, 'click', () => { scratches[index].reveal(); }));
    const leave = (chapter, force = false) => {
      if (!ready || leaving || !s.alive) return;
      leaving = true;
      refresh();
      void ctx.go(chapter, { force });
    };
    s.on(section.querySelector('[data-testid="vouchers-replay"]'), 'click', () => leave(10, true));
    const next = section.querySelector('[data-testid="vouchers-next"]');
    const back = section.querySelector('[data-testid="vouchers-back"]');
    if (next) s.on(next, 'click', () => leave(11));
    if (back) s.on(back, 'click', () => leave(9));
    refresh();
    void (async () => {
      if (await ctx.entered === false || !s.alive) return;
      ready = true;
      scratches.forEach(scratch => scratch.resize());
      refresh();
      if (selected !== null) {
        cards[selected].focus({ preventScroll: true });
        cards[selected].scrollIntoView({ behavior: ctx.reducedMotion ? 'auto' : 'smooth', block: 'center' });
      }
    })().catch(caught);
  } catch (error) { if (s.alive) ctx.fail(error); }
}

export function destroy() { scope?.destroy(); scope = null; }
