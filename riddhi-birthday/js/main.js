import { config } from './config.js';
import { state, awardStamp as persistStamp } from './state.js';
import { createPreloader } from './preloader.js';
import { createAudioEngine } from './audio.js';
import { createAurora } from './aurora.js';
import { createStars } from './stars.js';
import { skyLandmarks } from './sky-layout.js';
import { createConfetti } from './confetti.js';
import { createHUD } from './hud.js';
import { createWishService } from './wish.js';
import { createEggs } from './eggs.js';
import * as lockChapter from './chapters/c00-lock.js';
import * as loaderChapter from './chapters/c01-loader.js';
import * as entranceChapter from './chapters/c02-entrance.js';
import * as identityChapter from './chapters/c03-identity.js';
import * as cakeChapter from './chapters/c04-cake.js';
import * as wishChapter from './chapters/c05-wish.js';
import * as balloonsChapter from './chapters/c06-balloons.js';
import * as cardsChapter from './chapters/c07-cards.js';
import * as memoriesChapter from './chapters/c08-memories.js';
import * as gamesChapter from './chapters/c09-games.js';
import * as vouchersChapter from './chapters/c10-vouchers.js';
import * as eggsChapter from './chapters/c11-eggs.js';
import * as voiceChapter from './chapters/c12-voice.js';
import * as letterChapter from './chapters/c13-letter.js';
import * as finaleChapter from './chapters/c14-finale.js';
import * as happinessChapter from './chapters/c15-happiness.js';

// Set allowPreview to false in config.js before sharing the final birthday link.
const query = new URLSearchParams(location.search);
const preview = config.allowPreview !== false && query.get('preview') === '1';
const previewLock = preview && query.get('scene') === 'lock';
const mobile = matchMedia('(max-width: 767px)').matches;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = document.querySelector('#stage');
const chapters = new Map([[0, lockChapter], [1, loaderChapter], [2, entranceChapter], [3, identityChapter], [4, cakeChapter], [5, wishChapter], [6, balloonsChapter], [7, cardsChapter], [8, memoriesChapter], [9, gamesChapter], [10, vouchersChapter], [11, eggsChapter], [12, voiceChapter], [13, letterChapter], [14, finaleChapter], [15, happinessChapter]]);
const chapterNames = ['lock', 'loader', 'entrance', 'identity', 'cake', 'wish', 'balloons', 'cards', 'memories', 'games', 'vouchers', 'eggs', 'voice', 'letter', 'finale', 'happiness'];
const queuedChapters = new Set();
const rootScope = createScope();
let active = null;
let transition = Promise.resolve();
let toastTimer;
let disposed = false;
let pendingVoucher = null;

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

// Each chapter owns one scope. Pending waits resolve on teardown, and every
// animation/listener/timer is stopped without touching the persistent music.
function createScope() {
  const cleanups = new Set();
  let alive = true;
  const scope = {
    get alive() { return alive; },
    add(cleanup) { if (alive) cleanups.add(cleanup); else cleanup(); return cleanup; },
    on(target, event, handler, options) {
      target.addEventListener(event, handler, options);
      return scope.add(() => target.removeEventListener(event, handler, options));
    },
    every(callback, milliseconds) {
      const handle = setInterval(() => { if (alive) callback(); }, milliseconds);
      return scope.add(() => clearInterval(handle));
    },
    wait(milliseconds) {
      return new Promise((resolve) => {
        if (!alive) return resolve(false);
        const cancel = () => { clearTimeout(handle); resolve(false); };
        const handle = setTimeout(() => { cleanups.delete(cancel); resolve(alive); }, milliseconds);
        cleanups.add(cancel);
      });
    },
    motion(element, from, to, options = {}) {
      return new Promise((resolve) => {
        if (!alive || !element) return resolve(false);
        const duration = reducedMotion ? 0.06 : (options.duration ?? 0.7);
        let animation;
        let settled = false;
        const previousWillChange = element.style.willChange;
        element.style.willChange = 'transform, opacity';
        const finish = (success) => {
          if (settled) return;
          settled = true;
          element.style.willChange = previousWillChange;
          cleanups.delete(cancel);
          resolve(success && alive);
        };
        const cancel = () => {
          if (animation?.kill) animation.kill();
          else animation?.cancel();
          finish(false);
        };
        cleanups.add(cancel);
        if (globalThis.gsap) {
          animation = gsap.fromTo(element, from, { ...to, duration, ease:options.ease ?? 'power3.out', onComplete:() => finish(true), onInterrupt:() => finish(false) });
        } else if (typeof element.animate === 'function') {
          const frame = (values) => {
            const output = {};
            if ('opacity' in values) output.opacity = values.opacity;
            const transforms = [];
            if ('x' in values || 'y' in values) transforms.push(`translate(${values.x ?? 0}px, ${values.y ?? 0}px)`);
            if ('rotation' in values) transforms.push(`rotate(${values.rotation}deg)`);
            if ('scale' in values) transforms.push(`scale(${values.scale})`);
            if ('scaleX' in values) transforms.push(`scaleX(${values.scaleX})`);
            if ('scaleY' in values) transforms.push(`scaleY(${values.scaleY})`);
            if ('skewX' in values) transforms.push(`skewX(${values.skewX}deg)`);
            if ('skewY' in values) transforms.push(`skewY(${values.skewY}deg)`);
            if ('rotate' in values) transforms.push(`rotate(${values.rotate}deg)`);
            if ('rotationY' in values) transforms.push(`rotateY(${values.rotationY}deg)`);
            if (transforms.length) output.transform = transforms.join(' ');
            return output;
          };
          animation = element.animate([frame(from), frame(to)], { duration:duration * 1000, easing:'cubic-bezier(.2,.7,.2,1)', fill:'forwards' });
          animation.finished.then(() => {
            Object.assign(element.style, frame(to));
            animation.cancel();
            finish(true);
          }).catch(() => finish(false));
        } else {
          if ('opacity' in to) element.style.opacity = String(to.opacity);
          finish(true);
        }
      });
    },
    destroy() {
      if (!alive) return;
      alive = false;
      for (const cleanup of [...cleanups]) cleanup();
      cleanups.clear();
    },
  };
  return scope;
}

function waitForFontStyles() {
  const link = document.querySelector('#font-css');
  if (!link || link.dataset.ready || link.sheet) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timeout);
      link.removeEventListener('load', finish);
      link.removeEventListener('error', finish);
      resolve();
    };
    const timeout = setTimeout(finish, 1800);
    link.addEventListener('load', finish, {once:true});
    link.addEventListener('error', finish, {once:true});
  });
}

const fontReady = waitForFontStyles();
const preloader = createPreloader(config.assets, { fontReady });
const audio = createAudioEngine({ config, state, preloader });
const preloadDone = preloader.start();
const sky = createSky();
const wishes = createWishService({config});
if (state.wishSent || wishes.get('birthday')) sky.addWishStar('birthday');
if (wishes.get('secret')) sky.addWishStar('secret');
const confetti = createConfetti({mobile, reducedMotion});
const hud = createHUD({
  mount:document.querySelector('#hud'), config, state, scope:rootScope,
  go, hasChapter:(id) => chapters.has(id), confetti, escapeHTML,
});
const eggs = createEggs({
  config, state, scope:rootScope, audio, sky, wishes, preloader,
  toast:showToast, awardStamp, confetti, escape:escapeHTML, reducedMotion,
  refreshHud:() => hud.refresh(),
});
rootScope.add(audio.onVoiceActivity?.(updateSound) ?? (() => {}));

function awardStamp(id) {
  const earned = persistStamp(id);
  if (earned) hud.refresh({earnedId:id});
  return earned;
}

function createSky() {
  let aurora;
  let stars;
  let frame = 0;
  let lastFrame = -Infinity;
  let elapsed = 0;
  let lastTime = null;
  let keyboardMode = false;
  let chapterId = 0;
  const moonTarget = document.querySelector('#egg-moon');
  const starTarget = document.querySelector('#egg-star');
  try {
    aurora = createAurora(document.querySelector('#aurora'), {mobile});
    stars = createStars(document.querySelector('#stars'), {mobile});
  } catch (error) {
    console.warn('[sky] Keeping the static night sky.', error);
  }
  function syncTargets() {
    for (const [target, position] of [
      [moonTarget, stars?.getMoonPosition()],
      [starTarget, stars?.getShootingStarPosition()],
    ]) {
      if (!target) continue;
      target.hidden = chapterId < 3 || !position;
      if (!target.hidden) {
        const x = Math.max(28, Math.min(innerWidth - 28, position.x));
        const y = Math.max(28, Math.min(innerHeight - 28, position.y));
        target.style.transform = `translate(${x - 28}px, ${y - 28}px)`;
      }
    }
  }
  function updateRestingStar() {
    stars?.setRestingStar(reducedMotion || keyboardMode || chapterId === 11);
    refresh();
    syncTargets();
  }
  function resize() {
    document.documentElement.style.setProperty('--viewport-height', `${innerHeight}px`);
    aurora?.resize(innerWidth, innerHeight, devicePixelRatio || 1);
    stars?.resize(innerWidth, innerHeight, Math.min(devicePixelRatio || 1, 2));
    if (reducedMotion) { aurora?.draw(elapsed); stars?.draw(elapsed); }
    syncTargets();
  }
  function draw(now) {
    if (document.hidden || disposed) return;
    if (lastTime !== null) elapsed += Math.min(now - lastTime, 100);
    lastTime = now;
    if (now - lastFrame >= (mobile ? 1000 / 30 : 1000 / 60)) {
      lastFrame = now;
      aurora?.draw(elapsed);
      stars?.draw(elapsed);
      syncTargets();
    }
    if (!reducedMotion) frame = requestAnimationFrame(draw);
  }
  function visibility() {
    document.body.classList.toggle('is-hidden', document.hidden);
    cancelAnimationFrame(frame);
    lastTime = null;
    if (!document.hidden) { lastFrame = -Infinity; frame = requestAnimationFrame(draw); }
  }
  rootScope.on(window, 'resize', resize);
  rootScope.on(document, 'visibilitychange', visibility);
  rootScope.on(document, 'keydown', (event) => {
    if (event.key === 'Tab' && !keyboardMode) {
      keyboardMode = true;
      updateRestingStar();
    }
  });
  updateRestingStar();
  resize();
  frame = requestAnimationFrame(draw);
  rootScope.add(() => { cancelAnimationFrame(frame); aurora?.destroy(); stars?.destroy(); });
  function refresh() { if (reducedMotion) { aurora?.draw(elapsed); stars?.draw(elapsed); syncTargets(); } }
  return {
    aurora, stars,
    setChapter(id) { chapterId = id; updateRestingStar(); },
    getWishStarPosition(key = 'birthday') { return stars?.getWishStarPosition(key) ?? skyLandmarks(innerWidth, innerHeight, mobile).wishes[key]; },
    setWishMode(value) { aurora?.setWishMode(value); refresh(); },
    addWishStar(key, position) { stars?.addWishStar(key, position); refresh(); },
  };
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3800);
}

function updateSound() {
  const enabled = (state.audioOn || audio.voicePlaying) && !state.muted;
  const button = document.querySelector('#sound-toggle');
  button.setAttribute('aria-pressed', String(enabled));
  button.setAttribute('aria-label', enabled ? config.ui.disableSound : config.ui.enableSound);
  document.querySelector('#sound-label').textContent = enabled ? config.ui.soundOn : config.ui.soundOff;
  document.dispatchEvent(new CustomEvent('birthday:soundchange'));
}

async function startAudio() {
  // Call audio.start() synchronously from the tap, before any other awaits.
  const result = await audio.start();
  if (result && state.muted) audio.toggleMute();
  updateSound();
  return result;
}

function showError(error, section, scope) {
  console.warn('[chapter] A chapter could not finish; keeping the route open.', error);
  scope.destroy();
  const recovery = createScope();
  if (active?.section === section) active.scope = recovery;
  else rootScope.add(() => recovery.destroy());
  section.style.opacity = '1';
  section.style.transform = 'none';
  section.innerHTML = `<div class="error-card glass"><h2>${escapeHTML(config.ui.fallbackTitle)}</h2><p>${escapeHTML(config.ui.fallbackText)}</p><button class="primary-button" type="button">${escapeHTML(config.ui.skip)}</button></div>`;
  recovery.on(section.querySelector('button'), 'click', (event) => {
    event.currentTarget.disabled = true;
    const next = chapters.has(state.chapter + 1) ? state.chapter + 1 : 2;
    void go(state.unlocked ? next : 0, {force:true});
  });
}

function go(id, {force = false} = {}) {
  if (disposed || !chapters.has(id) || queuedChapters.has(id) || (id > 0 && !state.unlocked)) return transition;
  queuedChapters.add(id);
  transition = transition.then(async () => {
    if (disposed || (!force && active?.id === id)) return;
    const chapter = chapters.get(id);
    if (!chapter) return;
    if (active) {
      const previous = active;
      // Close root-owned interactions before tearing down their focused chapter.
      eggs.setChapter(-1);
      // Stop chapter work before the exit transition; music and sky remain alive.
      previous.chapter.destroy();
      previous.scope.destroy();
      confetti.reset();
      const exitScope = createScope();
      await exitScope.motion(previous.section, {opacity:1,y:0}, {opacity:0,y:-20}, {duration:.5,ease:'power2.in'});
      exitScope.destroy();
      previous.section.remove();
    }
    const section = document.createElement('section');
    section.className = `chapter chapter-${chapterNames[id] ?? id}`;
    section.dataset.chapter = id;
    section.style.opacity = '0';
    const scope = createScope();
    stage.append(section);
    // Begin each chapter at its heading after the previous one has faded away.
    window.scrollTo(0, 0);
    active = {id,chapter,section,scope};
    state.chapter = id;
    hud.setChapter(id);
    sky.setChapter(id);
    eggs.setChapter(id);
    for (const target of document.querySelectorAll('.egg-name, #egg-footer-heart')) target.disabled = id < 3;
    const selectedVoucher = id === 10 ? pendingVoucher : null;
    pendingVoucher = null;
    let resolveEntered;
    const entered = new Promise((resolve) => { resolveEntered = resolve; });
    scope.add(() => resolveEntered(false));
    const context = {
      config, state, section, scope, preloader, preloadDone, audio, sky, wishes, eggs,
      preview, previewLock, reducedMotion, mobile, go, escape:escapeHTML,
      toast:showToast, startAudio, entered, confetti, awardStamp, createScope,
      selectedVoucher,
      openVoucher(index) {
        if (!scope.alive || !Number.isInteger(index) || index < 0 || index >= config.vouchers.length) return;
        pendingVoucher = index;
        void go(10);
      },
      hasChapter:(chapterId) => chapters.has(chapterId),
      fail(error) { showError(error, section, scope); },
      onLoaderReady() {
        const previewChapter = new Map([['identity',3], ['cake',4], ['wish',5], ['balloons',6], ['cards',7], ['memories',8], ['games',9], ['vouchers',10], ['secrets',11], ['eggs',11], ['voice',12], ['letter',13], ['finale',14], ['happiness',15], ['birthday',15]]).get(query.get('scene'));
        const next = preview && previewChapter ? previewChapter : 2;
        if (chapters.has(next)) { void go(next); return true; }
        return false;
      },
    };
    try { await chapter.init(context); }
    catch (error) { showError(error, section, scope); }
    if (scope.alive) {
      const didEnter = await scope.motion(section, {opacity:0,y:20}, {opacity:1,y:0}, {duration:.7,ease:'power3.out'});
      const heading = section.querySelector('h1');
      if (heading && id !== 0) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
      resolveEntered(didEnter);
    }
  }).catch((error) => {
    console.error('[app] Transition failed.', error);
    if (active) showError(error, active.section, active.scope);
  }).finally(() => queuedChapters.delete(id));
  return transition;
}

async function boot() {
  void wishes.flush();
  document.title = config.ui.brand;
  for (const element of document.querySelectorAll('[data-copy]')) {
    const value = element.dataset.copy.split('.').reduce((source, key) => source?.[key], config);
    element.textContent = value ?? '';
  }
  for (const target of document.querySelectorAll('[data-egg]')) {
    target.setAttribute('aria-label', config.eggsUi[`${target.dataset.egg}Label`]);
  }
  updateSound();
  rootScope.on(document.querySelector('#sound-toggle'), 'click', () => {
    if (!audio.playing && !audio.voicePlaying) { void startAudio(); return; }
    audio.toggleMute();
    updateSound();
  });
  if (preview) {
    const badge = document.querySelector('#preview-badge');
    badge.textContent = config.ui.preview;
    badge.hidden = false;
  }
  await fontReady;
  // Preload actual display weights before revealing the chapter. A slow font
  // provider must never hold the midnight lock hostage; use system fallbacks.
  await Promise.race([
    Promise.allSettled(['500 1em Fredoka','400 1em Nunito'].map((font) => document.fonts?.load(font))),
    rootScope.wait(1500),
  ]);
  await go(0);
}

rootScope.on(window, 'pagehide', (event) => {
  if (event.persisted) return;
  disposed = true;
  active?.chapter.destroy();
  active?.scope.destroy();
  hud.destroy();
  eggs.destroy();
  confetti.destroy();
  audio.destroy();
  wishes.destroy();
  preloader.destroy();
  clearTimeout(toastTimer);
  rootScope.destroy();
});

boot().catch((error) => {
  const section = document.createElement('section');
  section.className = 'chapter';
  stage.replaceChildren(section);
  showError(error, section, rootScope);
});
