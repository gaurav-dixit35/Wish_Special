// One guide owns one listener and at most two timers. Chapters dispose their
// scope, which also stops a message or image decode still in progress.
let nextVariant = 1;
let previousVariant = 0;

export function createDog(ctx, { mount = ctx.section, variant, mood = 'idle', className = '' } = {}) {
  let selected = Number.isInteger(variant) ? ((variant - 1) % 10 + 10) % 10 + 1 : nextVariant;
  if (selected === previousVariant) selected = selected % 10 + 1;
  previousVariant = selected;
  nextVariant = selected % 10 + 1;
  const source = ctx.config.assets?.dogs?.[selected - 1] ?? `dogs/dog-${String(selected).padStart(2, '0')}.png`;
  const element = document.createElement('div');
  element.className = `birthday-dog ${className}`.trim();
  element.dataset.variant = selected;
  element.innerHTML = '<div class="dog-movement"><div class="dog-wobble"><div class="dog-avatar" role="img"><span class="dog-placeholder" aria-hidden="true">🐶</span><span class="guide-party-hat" aria-hidden="true"></span></div></div></div><button class="guide-speech" type="button" hidden><span aria-hidden="true"></span></button><span class="sr-only guide-live" role="status" aria-live="polite" aria-atomic="true"></span>';
  const avatar = element.querySelector('.dog-avatar');
  const bubble = element.querySelector('.guide-speech');
  const visibleText = bubble.firstElementChild;
  const live = element.querySelector('.guide-live');
  avatar.setAttribute('aria-label', ctx.config.ui.guideAlt ?? ctx.config.ui.dogAlt);
  if (ctx.eggs && ctx.config.eggsUi && ctx.state.chapter >= 3) {
    const nose = document.createElement('button');
    nose.type = 'button';
    nose.className = 'dog-nose';
    nose.dataset.egg = 'dog';
    nose.setAttribute('aria-label', ctx.config.eggsUi.dogLabel);
    element.querySelector('.dog-wobble').append(nose);
    ctx.scope.on(nose, 'click', () => {
      if (!ctx.scope.alive) return;
      setMood('sneeze');
      void speak(ctx.config.eggs[2], {mood:'sneeze', autoDismiss:2500});
      void ctx.scope.wait(700).then((alive) => { if (alive) setMood(mood); });
    });
  }
  mount.append(element);

  let destroyed = false;
  let typingTimer = null;
  let dismissTimer = null;
  let resolveSpeech = null;
  let typing = false;
  let fullText = '';
  let dismissDelay = 5000;
  let imageStarted = false;
  let unsubscribeImage = () => {};
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

  function clearTimers() {
    clearTimeout(typingTimer);
    clearTimeout(dismissTimer);
    typingTimer = dismissTimer = null;
  }

  function settleSpeech(completed) {
    const resolve = resolveSpeech;
    resolveSpeech = null;
    resolve?.(completed);
  }

  function dismiss() {
    clearTimers();
    typing = false;
    bubble.hidden = true;
    settleSpeech(false);
  }

  function finishTyping() {
    clearTimeout(typingTimer);
    typingTimer = null;
    typing = false;
    visibleText.textContent = fullText;
    settleSpeech(true);
    if (dismissDelay > 0) dismissTimer = setTimeout(dismiss, dismissDelay);
  }

  function onBubbleTap() {
    if (typing) finishTyping();
    else dismiss();
  }
  bubble.addEventListener('click', onBubbleTap);

  function setMood(value = 'idle') {
    if (destroyed) return;
    element.dataset.mood = ['idle', 'jump', 'sneeze', 'party-hat'].includes(value) ? value : 'idle';
  }

  function speak(text, { mood: nextMood, autoDismiss = 5000 } = {}) {
    if (destroyed || !ctx.scope.alive) return Promise.resolve(false);
    clearTimers();
    settleSpeech(false);
    if (nextMood) setMood(nextMood);
    fullText = String(text ?? '');
    dismissDelay = Number.isFinite(autoDismiss) ? Math.max(0, autoDismiss) : 5000;
    const characters = segmenter
      ? Array.from(segmenter.segment(fullText), (part) => part.segment) : Array.from(fullText);
    bubble.hidden = false;
    // Assistive technology receives the entire message once, never 25ms updates.
    bubble.setAttribute('aria-label', `${fullText} ${ctx.config.ui.dismissSpeech ?? ''}`.trim());
    live.textContent = fullText;
    visibleText.textContent = '';
    typing = true;
    return new Promise((resolve) => {
      resolveSpeech = resolve;
      let position = 0;
      const next = () => {
        if (destroyed || !ctx.scope.alive) { dismiss(); return; }
        position += 1;
        visibleText.textContent = characters.slice(0, position).join('');
        if (position >= characters.length) finishTyping();
        else typingTimer = setTimeout(next, 25);
      };
      if (ctx.reducedMotion || !characters.length) finishTyping();
      else typingTimer = setTimeout(next, 25);
    });
  }

  function tryImage() {
    if (destroyed || imageStarted) return;
    const loadedImage = ctx.preloader?.getImage(source);
    if (!loadedImage) {
      if (ctx.preloader?.loaded || ctx.preloader?.results?.get(source)?.status === 'placeholder') unsubscribeImage();
      return;
    }
    imageStarted = true;
    unsubscribeImage();
    const image = loadedImage.cloneNode();
    image.className = 'guide-image';
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
    decoded.then(() => {
      if (destroyed || !ctx.scope.alive || !image.naturalWidth) return;
      // The cloned image enters the DOM only after its own decode has settled.
      avatar.prepend(image);
      avatar.classList.add('has-guide-image');
      element.classList.add('has-guide-art');
    }).catch(() => {
      if (!destroyed) console.warn(`[dog] Keeping the birthday guide placeholder for ${source}.`);
    });
  }

  function destroy({ remove = false } = {}) {
    if (destroyed) {
      if (remove) element.remove();
      return;
    }
    destroyed = true;
    clearTimers();
    typing = false;
    settleSpeech(false);
    unsubscribeImage();
    bubble.removeEventListener('click', onBubbleTap);
    // Teardown precedes the parent chapter's exit fade. Keep the current
    // artwork and message visible, frozen in place, until that fade finishes.
    element.querySelectorAll('.dog-movement, .dog-wobble').forEach((part) => {
      part.style.animationPlayState = 'paused';
    });
    if (remove) element.remove();
  }

  setMood(mood);
  tryImage();
  if (!imageStarted && !ctx.preloader?.loaded && ctx.preloader?.subscribe) {
    unsubscribeImage = ctx.preloader.subscribe(tryImage);
    // subscribe calls back immediately; a synchronously found image needs no watcher.
    if (imageStarted) unsubscribeImage();
  }
  ctx.scope.add(destroy);
  return { element, speak, setMood, destroy };
}
