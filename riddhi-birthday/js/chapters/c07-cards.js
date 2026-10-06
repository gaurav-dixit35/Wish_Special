import { createDog } from '../dog.js';

export const id = 7;
let scope;

const palettes = [
  ['#b6d8ff', '#b3a0ec'], ['#ffe0a2', '#edb8b3'],
  ['#ffc4df', '#c2b7ff'], ['#d0c2ff', '#b0dded'],
  ['#ffe4a5', '#ffc0b5'], ['#d5d1ff', '#a8cdf5'],
  ['#b5e7d9', '#b8d5ff'], ['#f4daaf', '#d3b9f7'],
  ['#ffd0e5', '#ddc3ef'], ['#b9d7ff', '#f5c2c6'],
  ['#e8d19a', '#bcb8fa'],
];

export function init(ctx) {
  scope = ctx.scope;
  const s = scope;
  try {
    const { section, config, escape: e } = ctx;
    const copy = config.cardsUi;
    const cards = config.cards;
    if (!cards.length) throw new Error('The birthday card collection is empty.');
    const discovered = new Set();
    const states = cards.map(() => ({ page: 0, angle: 0, busy: false }));
    let ready = false;
    let activeIndex = 0;
    let targetIndex = 0;
    let programmaticScroll = false;
    let settleTimer;
    let pointer = null;
    let dragged = false;
    let completed = false;
    let leaving = false;
    const position = (index) => copy.position.replace('{number}', String(index + 1)).replace('{total}', String(cards.length));
    const actionLabel = (index, page) => page === 0
      ? copy.revealLabel.replace('{name}', cards[index][0])
      : page === 1 && cards[index][2]
        ? copy.extraLabel
        : copy.frontLabel.replace('{name}', cards[index][0]);

    // Faces are repainted only while turned away. This makes the last card's
    // third message a real second flip, with the original nickname still reachable.
    function faceMarkup(index, page) {
      const tuple = cards[index];
      const number = `<span class="nickname-card-number" aria-hidden="true">${String(index + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}</span>`;
      if (page === 0) {
        const separator = tuple[0].lastIndexOf(' ');
        const name = separator > 0 ? tuple[0].slice(0, separator) : tuple[0];
        const emoji = separator > 0 ? tuple[0].slice(separator + 1) : '✧';
        return `${number}<span class="nickname-symbol" aria-hidden="true">${e(emoji)}</span><span class="nickname-name">${e(name)}</span><span class="nickname-face-hint">${e(copy.flipHint)} <span aria-hidden="true">↻</span></span>`;
      }
      return `${number}<span class="nickname-reason-star" aria-hidden="true">${page === 2 ? '✦' : '✧'}</span><span class="nickname-reason">${e(tuple[page])}</span><span class="nickname-face-hint">${e(page === 1 && tuple[2] ? copy.extraHint : copy.frontLabel.replace('{name}', tuple[0]))} <span aria-hidden="true">↻</span></span>`;
    }

    section.setAttribute('aria-labelledby', 'cards-heading');
    section.innerHTML = `<div class="cards-content"><header class="cards-header"><p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>${e(copy.eyebrow)}</p><h1 id="cards-heading">${e(copy.title)}</h1><p>${e(copy.intro)}</p></header><div class="cards-carousel" role="region" aria-roledescription="carousel" aria-label="${e(copy.carouselLabel)}"><div class="cards-track">${cards.map((tuple, index) => {
      const palette = palettes[index % palettes.length];
      return `<article class="nickname-slide${index === 0 ? ' is-current' : ''}" role="group" aria-roledescription="slide" aria-label="${e(position(index))}" style="--nickname-a:${palette[0]};--nickname-b:${palette[1]}"><div class="nickname-dog-mount"></div><button class="nickname-flip" type="button" data-card="${index}" data-testid="nickname-card-${index + 1}" aria-label="${e(actionLabel(index, 0))}" aria-describedby="nickname-face-${index}-0" tabindex="${index === 0 ? 0 : -1}" disabled><span class="nickname-rotator"><span class="nickname-face nickname-face-front" id="nickname-face-${index}-0">${faceMarkup(index, 0)}</span><span class="nickname-face nickname-face-back" id="nickname-face-${index}-1" aria-hidden="true">${faceMarkup(index, 1)}</span></span></button><span class="nickname-discovered" aria-hidden="true">✦</span></article>`;
    }).join('')}</div><div class="cards-navigation"><button class="cards-arrow cards-previous" type="button" aria-label="${e(copy.previous)}" disabled><span aria-hidden="true">←</span></button><p class="cards-position" aria-live="off">${e(position(0))}</p><button class="cards-arrow cards-next" type="button" aria-label="${e(copy.nextCard)}" disabled><span aria-hidden="true">→</span></button></div><div class="cards-dots" role="group" aria-label="${e(copy.carouselLabel)}">${cards.map((_, index) => `<button type="button" data-card-dot="${index}" aria-label="${e(copy.jumpLabel.replace('{number}', String(index + 1)))}"${index === 0 ? ' aria-current="true"' : ''} disabled><span aria-hidden="true"></span></button>`).join('')}</div></div><p class="cards-progress" role="status" aria-live="polite" aria-atomic="true"></p><p class="cards-note">${e(copy.dogIntro)}</p><span class="cards-announcement sr-only" role="status" aria-live="polite" aria-atomic="true"></span><div class="cards-completion glass" hidden><span class="cards-completion-star" aria-hidden="true">✦</span><h2 tabindex="-1">${e(copy.completeTitle)}</h2><p>${e(copy.completeText)}</p><p class="cards-stamp">${e(copy.stamp)}</p>${ctx.hasChapter(8) ? `<button class="primary-button" data-testid="cards-next" type="button">${e(copy.next)}</button>` : ''}<button class="secondary-button" data-testid="cards-replay" type="button">${e(copy.replay)}</button>${ctx.hasChapter(6) ? `<button class="secondary-button" data-testid="cards-back" type="button">${e(copy.back)}</button>` : ''}</div></div>`;

    const track = section.querySelector('.cards-track');
    const slides = [...section.querySelectorAll('.nickname-slide')];
    const buttons = [...section.querySelectorAll('[data-card]')];
    const dots = [...section.querySelectorAll('[data-card-dot]')];
    const previous = section.querySelector('.cards-previous');
    const next = section.querySelector('.cards-next');
    const progress = section.querySelector('.cards-progress');
    const currentPosition = section.querySelector('.cards-position');
    const announcement = section.querySelector('.cards-announcement');
    const completion = section.querySelector('.cards-completion');
    const dogs = slides.map((slide, index) => createDog(ctx, {
      mount: slide.querySelector('.nickname-dog-mount'), variant: index % 10 + 1, className: 'dog-top',
    }));

    function updateControls() {
      previous.disabled = !ready || targetIndex === 0;
      next.disabled = !ready || targetIndex === cards.length - 1;
      buttons.forEach((button, index) => {
        // aria-disabled preserves keyboard focus while a flip is in progress.
        button.disabled = !ready;
        button.setAttribute('aria-disabled', String(!ready || states[index].busy));
        button.tabIndex = index === activeIndex ? 0 : -1;
        slides[index].classList.toggle('is-current', index === activeIndex);
        const nose = slides[index].querySelector('.dog-nose');
        if (nose) { nose.tabIndex = index === activeIndex ? 0 : -1; nose.disabled = !ready; }
      });
      dots.forEach((dot, index) => {
        dot.disabled = !ready;
        if (index === activeIndex) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
        dot.classList.toggle('is-discovered', discovered.has(index));
      });
      currentPosition.textContent = position(activeIndex);
    }

    function updateProgress() {
      progress.textContent = copy.progress.replace('{count}', String(discovered.size)).replace('{total}', String(cards.length));
    }

    function syncActive() {
      if (!s.alive) return;
      const middle = track.getBoundingClientRect().left + track.clientWidth / 2;
      let nearest = 0;
      let distance = Infinity;
      slides.forEach((slide, index) => {
        const rect = slide.getBoundingClientRect();
        const candidate = Math.abs(rect.left + rect.width / 2 - middle);
        if (candidate < distance) { distance = candidate; nearest = index; }
      });
      activeIndex = nearest;
      if (!programmaticScroll) targetIndex = activeIndex;
      updateControls();
    }

    function showCard(index, { focus = false } = {}) {
      if (!ready || !s.alive) return;
      targetIndex = Math.max(0, Math.min(cards.length - 1, index));
      programmaticScroll = true;
      const rect = slides[targetIndex].getBoundingClientRect();
      const trackRect = track.getBoundingClientRect();
      track.scrollTo({
        left: track.scrollLeft + rect.left - trackRect.left - (track.clientWidth - rect.width) / 2,
        behavior: ctx.reducedMotion ? 'auto' : 'smooth',
      });
      if (focus) buttons[targetIndex].focus({ preventScroll: true });
      updateControls();
    }

    async function finish() {
      if (completed || !s.alive) return;
      completed = true;
      ctx.awardStamp(4);
      section.dataset.complete = 'true';
      completion.hidden = false;
      dogs[activeIndex].setMood('jump');
      void ctx.confetti.burst({ particleCount: ctx.mobile ? 35 : 60, origin: { x: .5, y: .65 }, colors: ['#b6d8ff', '#d5bfff', '#ffe0a2'] });
      // Keep focus on the card: the eleventh card still has a second reveal.
      await s.motion(completion, { y: 16, opacity: 0 }, { y: 0, opacity: 1 }, { duration: .45 });
    }

    async function flip(index) {
      const state = states[index];
      if (!ready || state.busy || !s.alive) return;
      state.busy = true;
      const nextPage = (state.page + 1) % (cards[index][2] ? 3 : 2);
      const button = buttons[index];
      const rotator = button.querySelector('.nickname-rotator');
      const faces = [...button.querySelectorAll('.nickname-face')];
      const nextFaceIndex = (Math.round(state.angle / 180) + 1) % 2;
      const nextFace = faces[nextFaceIndex];
      nextFace.innerHTML = faceMarkup(index, nextPage);
      nextFace.classList.toggle('is-extra', nextPage === 2);
      nextFace.classList.toggle('is-nickname', nextPage === 0);
      updateControls();
      if (!await s.motion(rotator, { rotationY: state.angle }, { rotationY: state.angle + 180 }, { duration: .7, ease: 'power2.inOut' })) return;
      state.angle += 180;
      state.page = nextPage;
      state.busy = false;
      faces.forEach((face, faceIndex) => face.setAttribute('aria-hidden', String(faceIndex !== nextFaceIndex)));
      button.setAttribute('aria-describedby', nextFace.id);
      button.setAttribute('aria-label', actionLabel(index, nextPage));
      button.dataset.revealed = String(nextPage);
      announcement.textContent = cards[index][nextPage];
      if (nextPage === 1 && !discovered.has(index)) {
        discovered.add(index);
        slides[index].classList.add('is-discovered');
        updateProgress();
      }
      updateControls();
      if (discovered.size === cards.length) await finish();
    }

    function caught(error) { if (s.alive) ctx.fail(error); }
    buttons.forEach((button, index) => s.on(button, 'click', (event) => {
      if (event.detail && dragged) return;
      void flip(index).catch(caught);
    }));
    s.on(previous, 'click', () => showCard(targetIndex - 1));
    s.on(next, 'click', () => showCard(targetIndex + 1));
    dots.forEach((dot, index) => s.on(dot, 'click', () => showCard(index)));
    s.on(track, 'keydown', (event) => {
      if (event.repeat && ['Enter',' '].includes(event.key)) { event.preventDefault(); return; }
      if (event.altKey || event.ctrlKey || event.metaKey || !ready) return;
      const requested = { ArrowLeft: targetIndex - 1, ArrowRight: targetIndex + 1, Home: 0, End: cards.length - 1 }[event.key];
      if (requested === undefined) return;
      event.preventDefault();
      showCard(requested, { focus: true });
    });
    s.on(track, 'pointerdown', (event) => {
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      dragged = false;
      programmaticScroll = false;
      targetIndex = activeIndex;
    }, { passive: true });
    s.on(track, 'pointermove', (event) => {
      if (pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 12) dragged = true;
    }, { passive: true });
    s.on(track, 'pointercancel', () => { dragged = true; pointer = null; }, { passive: true });
    s.on(track, 'pointerup', () => { pointer = null; }, { passive: true });
    s.on(track, 'wheel', () => { programmaticScroll = false; targetIndex = activeIndex; }, { passive: true });
    s.on(track, 'scroll', () => {
      syncActive();
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => { programmaticScroll = false; syncActive(); }, 160);
    }, { passive: true });
    s.on(window, 'resize', () => { if (ready) showCard(activeIndex); });
    s.add(() => clearTimeout(settleTimer));
    const leave = (chapter, force = false) => {
      if (leaving || !s.alive) return;
      leaving = true;
      void ctx.go(chapter, { force });
    };
    s.on(section.querySelector('[data-testid="cards-replay"]'), 'click', () => leave(7, true));
    const nextChapter = section.querySelector('[data-testid="cards-next"]');
    if (nextChapter) s.on(nextChapter, 'click', () => leave(8));
    const back = section.querySelector('[data-testid="cards-back"]');
    if (back) s.on(back, 'click', () => leave(6));
    updateProgress();
    updateControls();
    void (async () => {
      if (await ctx.entered === false || !s.alive) return;
      ready = true;
      syncActive();
    })().catch(caught);
  } catch (error) { if (s.alive) ctx.fail(error); }
}

export function destroy() { scope?.destroy(); scope = null; }
