import { createDog } from '../dog.js';
import { clueGuidePosition } from '../eggs.js';

export const id = 11;
let scope;

export function init(ctx) {
  scope = ctx.scope;
  const s = scope;
  try {
    const { section, config, escape: e } = ctx;
    const copy = config.eggsUi;
    let ready = false;
    let leaving = false;
    section.setAttribute('aria-labelledby', 'eggs-heading');
    section.innerHTML = `<div class="eggs-content"><header class="eggs-header"><p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>${e(copy.eyebrow)}</p><h1 id="eggs-heading">${e(copy.title)}</h1><p>${e(copy.intro)}</p></header><div class="eggs-constellation glass"><div class="eggs-medallion" role="img" aria-label="${e(copy.collectionLabel)}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44"/><path d="M38 49c4-13 20-13 24 0 4 5 14 10 10 19-4 8-14 1-22 1s-18 7-22-1c-4-9 6-14 10-19ZM32 44c-6 1-12-9-10-15 3-10 15-2 14 8 0 3-1 6-4 7ZM47 34c-7 2-13-9-10-16 5-8 14-3 15 7 0 5-1 8-5 9ZM65 41c-6-1-8-12-4-17 8-7 15 3 12 11-2 4-5 7-8 6ZM76 55c-7-1-5-14 1-17 11-5 15 8 8 14-3 3-6 4-9 3Z"/></svg><span class="eggs-medallion-star" aria-hidden="true">✦</span></div><p class="eggs-progress" role="status" aria-live="polite"></p><div class="eggs-progress-stars" aria-hidden="true">${Array.from({ length: 5 }, () => '<i>✦</i>').join('')}</div><p class="eggs-hunt-hint">${e(copy.huntHint)}</p></div><ol class="eggs-clues">${copy.clues.map((clue, index) => `<li class="egg-clue glass" data-secret="${index + 1}"><div class="egg-clue-top"><span class="egg-clue-icon" aria-hidden="true">${e(clue.icon)}</span><span class="egg-clue-status">${e(copy.waiting)}</span></div><h2>${e(clue.title)}</h2><p>${e(clue.hint)}</p><p class="egg-clue-reveal" hidden></p><button class="secondary-button egg-clue-look" type="button" data-target="${e(clue.target)}" aria-label="${e(copy.lookLabel.replace('{secret}', clue.title))}" disabled>${e(copy.look)}</button></li>`).join('')}</ol><div class="eggs-keepsakes glass" hidden><h2>${e(copy.keepsakesTitle)}</h2><p>${e(copy.keepsakesText)}</p><div class="eggs-keepsake-actions"><button class="secondary-button" data-testid="secret-wish-open" type="button" hidden>${e(copy.secondWish)}</button><button class="secondary-button" data-testid="secret-voice-play" type="button" hidden>${e(copy.voicePlay)}</button><button class="secondary-button" data-testid="secret-voice-stop" type="button" hidden>${e(copy.voiceStop)}</button></div><p class="eggs-voice-status" role="status" aria-live="polite"></p></div><div class="eggs-complete" hidden><span class="eggs-complete-stars" aria-hidden="true">✦ ✧ ✦</span><h2>${e(copy.completeTitle)}</h2><p>${e(copy.completeText)}</p><p class="eggs-stamp">${e(copy.stamp)}</p></div><div class="eggs-actions">${ctx.hasChapter(12) ? `<button class="primary-button" data-testid="eggs-next" type="button" disabled>${e(copy.next)}</button>` : `<p class="eggs-rest-note">${e(copy.rest)}</p><button class="primary-button" data-testid="eggs-replay" type="button" disabled>${e(copy.replay)}</button>`}${ctx.hasChapter(10) ? `<button class="secondary-button" data-testid="eggs-back" type="button" disabled>${e(copy.back)}</button>` : ''}</div></div>`;
    createDog(ctx, { mount: section.querySelector('.eggs-constellation'), variant: 9, className: 'dog-top eggs-guide' });
    const clueItems = [...section.querySelectorAll('.egg-clue')];
    const wishButton = section.querySelector('[data-testid="secret-wish-open"]');
    const voiceButton = section.querySelector('[data-testid="secret-voice-play"]');
    const stopButton = section.querySelector('[data-testid="secret-voice-stop"]');
    let activeClue = null;
    const guide = document.createElement('aside');
    guide.className = 'egg-clue-guide';
    guide.hidden = true;
    guide.innerHTML = `<p id="egg-clue-instruction" role="status" aria-live="polite" aria-atomic="true"></p><div class="egg-clue-guide-actions"><button type="button" class="egg-clue-return">${e(copy.clueBack ?? 'Back to my clues')}</button><button type="button" class="egg-clue-dismiss" aria-label="${e(copy.clueClose ?? 'Close this clue')}">×</button></div>`;
    document.body.append(guide);
    const instruction = guide.querySelector('p');
    const actionCopy = {
      moon: 'Tap the highlighted moon.',
      star: 'Tap the highlighted star to open your second wish.',
      dog: 'Boop the highlighted nose.',
      name: 'Tap “Riddhi” five times. {remaining} to go.',
      heart: 'Tap the highlighted heart for your secret message.',
      ...copy.clueActions,
    };

    function positionGuide() {
      if (!activeClue || guide.hidden || !activeClue.target.isConnected) return;
      const bounds = activeClue.target.getBoundingClientRect();
      const position = clueGuidePosition(bounds, guide.getBoundingClientRect(), { width: innerWidth, height: innerHeight });
      guide.style.left = `${position.left}px`;
      guide.style.top = `${position.top}px`;
      guide.style.setProperty('--clue-arrow', `${position.arrow}px`);
      guide.dataset.side = position.below ? 'below' : 'above';
    }

    function closeGuide({ returnToClue = false } = {}) {
      if (!activeClue) return;
      const { target, button, describedBy } = activeClue;
      target.classList.remove('is-clue-target');
      if (describedBy === null) target.removeAttribute('aria-describedby');
      else target.setAttribute('aria-describedby', describedBy);
      activeClue = null;
      guide.hidden = true;
      if (returnToClue && button.isConnected) {
        button.scrollIntoView({ block: 'center', behavior: ctx.reducedMotion ? 'auto' : 'smooth' });
        button.focus({ preventScroll: true });
      }
    }

    function refreshGuide() {
      if (!activeClue) return;
      const found = ctx.state.eggsFound.has(activeClue.id);
      const message = found ? (copy.clueFound ?? 'Secret found. Your collection has been updated.')
        : actionCopy[activeClue.kind].replace('{remaining}', String(Math.max(0, 5 - ctx.eggs.nameTaps)));
      if (instruction.textContent !== message) instruction.textContent = message;
      guide.dataset.found = String(found);
      positionGuide();
    }

    s.on(window, 'scroll', positionGuide, { passive: true, capture: true });
    s.on(window, 'resize', positionGuide, { passive: true });
    s.on(guide.querySelector('.egg-clue-return'), 'click', () => closeGuide({ returnToClue: true }));
    s.on(guide.querySelector('.egg-clue-dismiss'), 'click', () => closeGuide({ returnToClue: true }));
    s.on(document, 'keydown', (event) => {
      if (event.key !== 'Escape' || !activeClue || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      closeGuide({ returnToClue: true });
    });
    s.add(() => { closeGuide(); guide.remove(); });

    function refresh() {
      if (!s.alive) return;
      const count = ctx.eggs.count;
      const complete = count === 5;
      const voiceStatus = ctx.eggs.voiceStatus;
      section.dataset.complete = String(complete);
      section.querySelector('.eggs-progress').textContent = copy.progress.replace('{count}', String(count));
      section.querySelector('.eggs-medallion').setAttribute('aria-label', complete ? copy.goldPaw : copy.collectionLabel);
      section.querySelectorAll('.eggs-progress-stars i').forEach((star, index) => star.classList.toggle('is-found', index < count));
      clueItems.forEach((item, index) => {
        const found = ctx.state.eggsFound.has(index + 1);
        item.classList.toggle('is-found', found);
        item.querySelector('.egg-clue-status').textContent = found ? copy.found : copy.waiting;
        const reveal = item.querySelector('.egg-clue-reveal');
        reveal.hidden = !found;
        reveal.textContent = found ? config.eggs[index] : '';
      });
      const hasWish = ctx.state.eggsFound.has(2);
      const hasVoice = ctx.state.eggsFound.has(5);
      section.querySelector('.eggs-keepsakes').hidden = !hasWish && !hasVoice;
      wishButton.hidden = !hasWish;
      wishButton.textContent = ctx.wishes.get('secret') ? copy.secondWishSaved : copy.secondWish;
      voiceButton.hidden = !hasVoice;
      voiceButton.textContent = voiceStatus === 'loading' ? copy.voiceLoading : voiceStatus === 'started' ? copy.voiceReplay : copy.voicePlay;
      stopButton.hidden = !hasVoice || voiceStatus !== 'started';
      const status = section.querySelector('.eggs-voice-status');
      status.textContent = !hasVoice ? '' : voiceStatus === 'unavailable' ? copy.voiceMissing
        : voiceStatus === 'started' ? (ctx.state.muted ? copy.voiceMuted : copy.voiceStarted) : '';
      section.querySelector('.eggs-complete').hidden = !complete;
      section.querySelectorAll('button').forEach((button) => { button.disabled = !ready || leaving; });
      if (voiceStatus === 'loading') voiceButton.disabled = true;
      refreshGuide();
    }

    s.add(ctx.eggs.subscribe(refresh));
    s.add(ctx.wishes.subscribe(refresh));
    s.on(wishButton, 'click', () => ctx.eggs.openSecondWish());
    s.on(voiceButton, 'click', () => { void ctx.eggs.playSecret(); });
    s.on(stopButton, 'click', () => ctx.eggs.stopSecret());
    for (const button of section.querySelectorAll('.egg-clue-look')) {
      s.on(button, 'click', () => {
        if (!ready || leaving) return;
        const target = button.dataset.target === 'dog'
          ? section.querySelector('[data-egg="dog"]') : document.querySelector(`[data-egg="${button.dataset.target}"]`);
        if (!target || target.hidden || target.disabled || !target.getClientRects().length) { ctx.toast(copy.targetUnavailable); return; }
        closeGuide();
        activeClue = { target, button, kind: button.dataset.target, id: Number(button.closest('[data-secret]').dataset.secret), describedBy: target.getAttribute('aria-describedby') };
        target.classList.add('is-clue-target');
        target.setAttribute('aria-describedby', [activeClue.describedBy, instruction.id].filter(Boolean).join(' '));
        guide.hidden = false;
        refreshGuide();
        if (!['moon', 'star'].includes(button.dataset.target)) target.scrollIntoView({ block: 'center', behavior: ctx.reducedMotion ? 'auto' : 'smooth' });
        target.focus({ preventScroll: true });
        positionGuide();
      });
    }
    function leave(chapter) {
      if (!ready || leaving || !s.alive) return;
      leaving = true;
      refresh();
      void ctx.go(chapter);
    }
    const next = section.querySelector('[data-testid="eggs-next"]');
    const back = section.querySelector('[data-testid="eggs-back"]');
    const replay = section.querySelector('[data-testid="eggs-replay"]');
    if (next) s.on(next, 'click', () => leave(12));
    if (back) s.on(back, 'click', () => leave(10));
    if (replay) s.on(replay, 'click', () => leave(3));
    void (async () => {
      if (await ctx.entered === false || !s.alive) return;
      ready = true;
      refresh();
    })().catch((error) => { if (s.alive) ctx.fail(error); });
  } catch (error) { if (s.alive) ctx.fail(error); }
}

export function destroy() { scope?.destroy(); scope = null; }
