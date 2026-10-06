import { createDog } from '../dog.js';
import { mountPhoto } from '../photos.js';
import { createLightbox } from '../lightbox.js';

export const id = 8;
let scope;

const rotations = [-4, 5, -2, 6, -5, 3, -6, 4, -3, 2];
const paperColors = ['#edf2fb', '#f4ecf4', '#f4efdf', '#e9f1ef', '#eeeaf7'];

export function init(ctx) {
  scope = ctx.scope;
  const s = scope;
  try {
    const { section, config, escape: e } = ctx;
    const copy = config.memoriesUi;
    const memories = config.memories;
    if (!memories.length) throw new Error('The memory collection is empty.');
    let currentIndex = 0;
    let ready = false;
    let busy = false;
    let completed = false;
    let leaving = false;
    let pointer = null;
    let suppressClickUntil = 0;
    const positions = memories.map((_, index) => ({ x: 0, y: index * 12, scale: 1 - index * .045, rotate: rotations[index % rotations.length], opacity: 1 }));
    const positionText = (index) => copy.position.replace('{number}', String(index + 1)).replace('{total}', String(memories.length));

    section.setAttribute('aria-labelledby', 'memories-heading');
    section.innerHTML = `<div class="memories-content"><header class="memories-header"><p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>${e(copy.eyebrow)}</p><h1 id="memories-heading">${e(copy.title)}</h1><p>${e(copy.intro)}</p></header><div class="memories-album"><div class="memories-deck">${memories.map(([, tag, caption], index) => `<article class="memory-card" data-memory="${index}" data-testid="memory-card-${index + 1}" aria-label="${e(positionText(index))}" style="--memory-paper:${paperColors[index % paperColors.length]}"><div class="memory-dog-mount"></div><span class="memory-tape" aria-hidden="true"></span><div class="memory-photo"><button class="memory-photo-open" type="button" aria-label="${e(copy.photoLabel.replace('{tag}', tag))}" aria-disabled="true" tabindex="-1"><span class="memory-photo-zoom" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="5.8"/><path d="m15 15 4.5 4.5M10.5 7.5v6M7.5 10.5h6"/></svg></span></button></div><div class="memory-caption"><span class="memory-number" aria-hidden="true">${String(index + 1).padStart(2, '0')} <span>✦</span></span><h2>${e(tag)}</h2><p>${e(caption)}</p></div></article>`).join('')}</div><div class="memories-controls"><p class="memories-position">${e(positionText(0))}</p><p class="memories-hint">${e(copy.swipeHint)}</p><button class="primary-button memories-advance" data-testid="memory-next" type="button" disabled>${e(copy.nextMemory)}</button></div></div><p class="memories-progress" role="status" aria-live="polite" aria-atomic="true"></p><p class="memories-note">${e(copy.dogIntro)}</p><span class="memories-announcement sr-only" role="status" aria-live="polite" aria-atomic="true"></span><div class="memories-completion glass" hidden><span class="memories-completion-heart" aria-hidden="true">♡</span><h2 tabindex="-1">${e(copy.completeTitle)}</h2><p>${e(config.memoriesEnd)}</p><p class="memories-stamp">${e(copy.stamp)}</p>${ctx.hasChapter(9) ? `<button class="primary-button" data-testid="memories-next" type="button">${e(copy.next)}</button>` : ''}<button class="secondary-button" data-testid="memories-replay" type="button">${e(copy.replay)}</button>${ctx.hasChapter(7) ? `<button class="secondary-button" data-testid="memories-back" type="button">${e(copy.back)}</button>` : ''}</div></div>`;

    const album = section.querySelector('.memories-album');
    const deck = section.querySelector('.memories-deck');
    const cards = [...section.querySelectorAll('.memory-card')];
    const photoButtons = [...section.querySelectorAll('.memory-photo-open')];
    const advance = section.querySelector('.memories-advance');
    const position = section.querySelector('.memories-position');
    const progress = section.querySelector('.memories-progress');
    const announcement = section.querySelector('.memories-announcement');
    const completion = section.querySelector('.memories-completion');
    const lightbox = createLightbox(ctx);
    const photos = cards.map((card, index) => mountPhoto(ctx, {
      mount: card.querySelector('.memory-photo'),
      src: `others/photos/${memories[index][0]}.webp`,
      alt: memories[index][1], label: copy.photoPlaceholder,
    }));
    const dogs = cards.map((card, index) => createDog(ctx, {
      mount: card.querySelector('.memory-dog-mount'), variant: index % 10 + 1, className: 'dog-top',
    }));

    function caught(error) { if (s.alive) ctx.fail(error); }

    function stackPose(index, top = currentIndex) {
      const depth = Math.max(0, index - top);
      return { x: 0, y: depth * 12, scale: 1 - depth * .045, rotate: rotations[index % rotations.length], opacity: 1 };
    }

    function setPose(index, pose) {
      positions[index] = { ...pose };
      const card = cards[index];
      // Keep GSAP's cached transform in sync with direct pointer movement.
      if (globalThis.gsap) globalThis.gsap.set(card, pose);
      else {
        card.style.transform = `translate(${pose.x}px, ${pose.y}px) rotate(${pose.rotate}deg) scale(${pose.scale})`;
        card.style.opacity = String(pose.opacity);
      }
      card.dataset.rotation = String(pose.rotate);
    }

    function updateControls() {
      // The lightbox owns background inertness. Its active guard in each action
      // also covers pending decoding, without making close depend on focus.
      const interactive = ready && !busy && !completed && !leaving;
      advance.disabled = !interactive;
      advance.textContent = currentIndex === memories.length - 1 ? copy.finishStack : copy.nextMemory;
      cards.forEach((card, index) => {
        const isCurrent = index === currentIndex && !completed;
        card.classList.toggle('is-current', isCurrent);
        card.classList.toggle('is-interactive', isCurrent && interactive);
        card.setAttribute('aria-hidden', String(!isCurrent));
        card.toggleAttribute('inert', !isCurrent);
        const nose = card.querySelector('.dog-nose');
        if (nose) { nose.tabIndex = isCurrent ? 0 : -1; nose.disabled = !isCurrent; }
        photoButtons[index].tabIndex = isCurrent && interactive && photos[index].image ? 0 : -1;
        photoButtons[index].setAttribute('aria-disabled', String(!isCurrent || !interactive || !photos[index].image));
      });
    }

    function updateProgress() {
      progress.textContent = copy.progress.replace('{count}', String(currentIndex)).replace('{total}', String(memories.length));
      if (!completed) position.textContent = positionText(currentIndex);
    }

    function renderStack() {
      cards.forEach((card, index) => {
        card.hidden = index < currentIndex || index >= currentIndex + 3;
        card.style.zIndex = String(memories.length - index);
        if (!card.hidden) setPose(index, stackPose(index));
      });
      updateProgress();
      updateControls();
    }

    function releasePointer() {
      const previous = pointer;
      pointer = null;
      if (!previous) return null;
      previous.card.classList.remove('is-dragging');
      try {
        if (previous.card.hasPointerCapture(previous.id)) previous.card.releasePointerCapture(previous.id);
      } catch { /* The browser may already have ended this pointer. */ }
      return previous;
    }

    async function returnCard() {
      const previous = releasePointer();
      if (!previous?.horizontal || !s.alive || busy) return;
      suppressClickUntil = performance.now() + 450;
      busy = true;
      updateControls();
      const target = stackPose(currentIndex);
      if (!await s.motion(cards[currentIndex], positions[currentIndex], target, { duration: .3, ease: 'power3.out' })) return;
      setPose(currentIndex, target);
      cards[currentIndex].style.willChange = '';
      busy = false;
      updateControls();
    }

    async function finish() {
      if (completed || !s.alive) return;
      completed = true;
      ready = false;
      ctx.awardStamp(5);
      section.dataset.complete = 'true';
      album.hidden = true;
      completion.hidden = false;
      updateProgress();
      updateControls();
      announcement.textContent = config.memoriesEnd;
      void ctx.confetti.burst({ particleCount: ctx.mobile ? 36 : 60, origin: { x: .5, y: .6 }, colors: ['#b6d8ff', '#ead5f1', '#ecd6a6'] });
      await s.motion(completion, { opacity: 0, y: 20, scale: .97 }, { opacity: 1, y: 0, scale: 1 }, { duration: .5 });
      if (!s.alive) return;
      completion.querySelector('h2').focus({ preventScroll: true });
      completion.scrollIntoView({ block: 'nearest', behavior: ctx.reducedMotion ? 'auto' : 'smooth' });
    }

    async function dismissCard(direction = 1) {
      if (!ready || busy || completed || !s.alive || lightbox.active) return;
      const focusAtStart = document.activeElement;
      const returnFocus = focusAtStart === advance || focusAtStart === photoButtons[currentIndex];
      releasePointer();
      busy = true;
      suppressClickUntil = performance.now() + 700;
      updateControls();
      const outgoing = currentIndex;
      const animations = [s.motion(cards[outgoing], positions[outgoing], {
        x: direction * 600, y: 26, rotate: direction * 25, scale: 1, opacity: 0,
      }, { duration: .5, ease: 'power2.in' })];
      // The two cards underneath rise into the space being left behind.
      for (let index = outgoing + 1; index < Math.min(cards.length, outgoing + 3); index += 1) {
        animations.push(s.motion(cards[index], positions[index], stackPose(index, outgoing + 1), { duration: .5, ease: 'power3.out' }));
      }
      if (!(await Promise.all(animations)).every(Boolean) || !s.alive) return;
      dogs[outgoing].destroy();
      photos[outgoing].destroy();
      cards[outgoing].style.willChange = '';
      currentIndex += 1;
      busy = false;
      if (currentIndex >= memories.length) { await finish(); return; }
      renderStack();
      announcement.textContent = `${positionText(currentIndex)}. ${memories[currentIndex][1]}. ${memories[currentIndex][2]}`;
      if (returnFocus && [document.body, advance, photoButtons[outgoing]].includes(document.activeElement)) advance.focus({ preventScroll: true });
    }

    async function openPhoto(index) {
      if (!ready || busy || completed || index !== currentIndex || lightbox.active || pointer?.horizontal || !s.alive) return;
      const image = photos[index].image;
      if (!image) return;
      releasePointer();
      const opened = lightbox.open({ source: cards[index].querySelector('.memory-photo'), image, alt: memories[index][1], caption: memories[index][2], rotation: positions[index].rotate });
      updateControls();
      await opened;
      if (s.alive) updateControls();
    }

    photoButtons.forEach((button, index) => {
      s.on(button, 'click', (event) => {
        if (event.detail && performance.now() < suppressClickUntil) { event.preventDefault(); return; }
        void openPhoto(index).catch(caught);
      });
      void photos[index].ready.then(() => { if (s.alive) updateControls(); });
    });
    s.on(advance, 'click', () => { void dismissCard(1).catch(caught); });
    s.on(advance, 'keydown', (event) => {
      if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
    });

    s.on(deck, 'pointerdown', (event) => {
      if (!event.isPrimary || event.button !== 0 || !ready || busy || completed || lightbox.active || pointer) return;
      const card = event.target.closest('.memory-card');
      if (card !== cards[currentIndex]) return;
      pointer = {
        id: event.pointerId, card, x: event.clientX, y: event.clientY,
        horizontal: false, samples: [{ x: event.clientX, time: performance.now() }],
      };
    }, { passive: true });
    s.on(window, 'pointermove', (event) => {
      if (!pointer || pointer.id !== event.pointerId || !s.alive) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (!pointer.horizontal) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.15) {
          suppressClickUntil = performance.now() + 450;
          releasePointer();
          return;
        }
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
        pointer.horizontal = true;
        pointer.card.classList.add('is-dragging');
        pointer.card.style.willChange = 'transform';
        try { pointer.card.setPointerCapture(event.pointerId); } catch { /* Window listeners still complete the gesture. */ }
      }
      if (event.cancelable) event.preventDefault();
      const now = performance.now();
      pointer.samples.push({ x: event.clientX, time: now });
      while (pointer.samples.length > 2 && now - pointer.samples[0].time > 100) pointer.samples.shift();
      const base = stackPose(currentIndex);
      setPose(currentIndex, { ...base, x: dx, y: Math.max(-36, Math.min(36, dy * .18)), rotate: base.rotate + Math.max(-18, Math.min(18, dx / 18)) });
    }, { passive: false });
    s.on(window, 'pointerup', (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      if (!pointer.horizontal) { releasePointer(); return; }
      const dx = event.clientX - pointer.x;
      const now = performance.now();
      const recent = pointer.samples.filter((sample) => now - sample.time <= 100);
      const first = recent[0];
      const velocity = first ? (event.clientX - first.x) / Math.max(1, now - first.time) : 0;
      if (Math.abs(dx) > 90 || Math.abs(velocity) > .5) {
        const direction = Math.sign(Math.abs(dx) > 90 ? dx : velocity) || 1;
        void dismissCard(direction).catch(caught);
      } else void returnCard().catch(caught);
    }, { passive: true });
    s.on(window, 'pointercancel', (event) => { if (pointer?.id === event.pointerId) void returnCard().catch(caught); }, { passive: true });
    s.on(deck, 'lostpointercapture', (event) => {
      // Touch starts with implicit capture on the tapped child. Transferring
      // that capture to the whole card must not cancel the fresh swipe.
      if (pointer?.id === event.pointerId && event.target === pointer.card) void returnCard().catch(caught);
    });
    s.on(window, 'blur', () => { void returnCard().catch(caught); });
    s.on(window, 'resize', () => { void returnCard().catch(caught); });
    s.on(document, 'visibilitychange', () => { if (document.hidden) void returnCard().catch(caught); });
    s.add(() => { releasePointer(); cards.forEach((card) => { card.style.willChange = ''; }); });

    const leave = (chapter, force = false) => {
      if (leaving || !s.alive) return;
      leaving = true;
      updateControls();
      void ctx.go(chapter, { force });
    };
    s.on(section.querySelector('[data-testid="memories-replay"]'), 'click', () => leave(8, true));
    const next = section.querySelector('[data-testid="memories-next"]');
    const back = section.querySelector('[data-testid="memories-back"]');
    if (next) s.on(next, 'click', () => leave(9));
    if (back) s.on(back, 'click', () => leave(7));
    renderStack();
    void (async () => {
      if (await ctx.entered === false || !s.alive) return;
      ready = true;
      updateControls();
    })().catch(caught);
  } catch (error) { if (s.alive) ctx.fail(error); }
}

export function destroy() { scope?.destroy(); scope = null; }
