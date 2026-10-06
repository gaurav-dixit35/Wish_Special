import { happinessCopy as copy } from '../happiness-copy.js';

export const id = 15;
let scope;

const heart = '<svg viewBox="0 0 48 44" aria-hidden="true"><path d="M24 39S4 27 4 14C4 3 18 0 24 10 30 0 44 3 44 14c0 13-20 25-20 25Z"/></svg>';
const spark = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 1 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/></svg>';

export function init(ctx) {
  const s = scope = ctx.scope;
  try {
    const { section, config, escape: e } = ctx;
    let ready = false;
    let started = false;
    let leaving = false;
    section.classList.add('happiness-world');
    section.classList.toggle('happiness-reduced', ctx.reducedMotion);
    section.setAttribute('aria-labelledby', 'happiness-heading');
    section.innerHTML = `<div class="happiness-content"><header class="happiness-heading"><p class="eyebrow happiness-eyebrow">${e(copy.eyebrow)}</p><h1 id="happiness-heading" tabindex="-1">${e(copy.title)}</h1><p class="happiness-intro">${e(copy.intro)}</p></header><div class="happiness-scene" role="img" aria-label="${e(copy.candleLabel.replace('{name}', config.name))}"><div class="happiness-horizon" aria-hidden="true"></div><div class="happiness-constellations" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<span style="--twinkle-x:${8 + (i * 29) % 87}%;--twinkle-y:${12 + (i * 17) % 66}%;--twinkle-delay:${i * .34}s">${spark}</span>`).join('')}</div><div class="happiness-sky-lights" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<span class="happiness-small-flight" style="--light-x:${5 + (i * 29) % 92}%;--light-delay:${(i % 7) * .23}s;--light-rest:${9 + (i * 17) % 67}%;--light-rise:${160 + (i * 41) % 240}px;--light-scale:${.4 + (i % 4) * .12};--light-turn:${i % 2 ? -5 : 5}deg"><span class="happiness-small-lantern"><i></i></span></span>`).join('')}</div><div class="happiness-personal-flight" aria-hidden="true"><div class="happiness-personal-sway"><div class="happiness-candle"><span class="happiness-lantern-rib happiness-rib-left"></span><span class="happiness-lantern-rib happiness-rib-right"></span><span class="happiness-golden-heart">${heart}</span><span class="happiness-lantern-name">${e(config.name)}</span><span class="happiness-lantern-note">${e(copy.candleName)}</span><span class="happiness-candle-cup"><i class="happiness-wick"></i><i class="happiness-flame"></i></span><span class="happiness-lantern-base"></span></div><span class="happiness-lantern-tassel"></span></div></div><div class="happiness-launch-ring" aria-hidden="true"></div></div><div class="happiness-moment"><button class="primary-button happiness-light" type="button" data-testid="happiness-light" disabled><span class="happiness-button-spark" aria-hidden="true">${spark}</span>${e(copy.light)}</button><p class="happiness-status" role="status" aria-live="polite" aria-atomic="true"></p><div class="happiness-signoff" hidden><p>${e(copy.signature)}</p><p class="happiness-signer">${e(copy.signer)}</p><p class="happiness-gift">${e(config.finale.last)}</p></div></div><nav class="happiness-actions" aria-label="${e(copy.replay)}"><button class="primary-button happiness-replay" type="button" data-testid="happiness-replay" hidden disabled>${e(copy.replay)}</button><button class="secondary-button" type="button" data-testid="happiness-back" disabled>${e(copy.back)}</button></nav></div>`;

    const lightButton = section.querySelector('[data-testid="happiness-light"]');
    const backButton = section.querySelector('[data-testid="happiness-back"]');
    const replayButton = section.querySelector('[data-testid="happiness-replay"]');
    const status = section.querySelector('.happiness-status');
    const scene = section.querySelector('.happiness-scene');
    const heading = section.querySelector('#happiness-heading');
    const personalFlight = section.querySelector('.happiness-personal-flight');

    // Sequence time is time actually spent on this page. Both the clock and
    // the CSS flights pause in a hidden tab, so returning never skips the wish.
    function waitWhileVisible(milliseconds) {
      return new Promise(resolve => {
        let remaining = milliseconds;
        let timer = null;
        let lastStart = 0;
        let settled = false;
        const finish = result => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          document.removeEventListener('visibilitychange', visibility);
          resolve(result && s.alive && !leaving);
        };
        const resume = () => {
          if (settled || document.hidden || !s.alive || leaving) return;
          lastStart = performance.now();
          timer = setTimeout(() => finish(true), Math.max(0, remaining));
        };
        const visibility = () => {
          if (document.hidden && timer !== null) {
            remaining -= Math.min(remaining, performance.now() - lastStart);
            clearTimeout(timer); timer = null;
          } else if (!document.hidden && timer === null) resume();
        };
        document.addEventListener('visibilitychange', visibility);
        s.add(() => finish(false));
        resume();
      });
    }

    function finishBirthday() {
      if (!s.alive || leaving) return;
      section.classList.add('is-finished');
      personalFlight.style.willChange = '';
      section.querySelector('.happiness-eyebrow').textContent = copy.finishedEyebrow;
      heading.textContent = copy.finishedTitle;
      section.querySelector('.happiness-intro').textContent = copy.finishedIntro;
      scene.setAttribute('aria-label', copy.candleSkyLabel);
      lightButton.hidden = true;
      section.querySelector('.happiness-signoff').hidden = false;
      replayButton.hidden = false;
      replayButton.disabled = false;
      status.textContent = copy.finishedStatus;
      status.classList.add('sr-only');
      // Move focus off the now-hidden lighting control into the final greeting.
      heading.focus({ preventScroll: true });
      const headingBounds = heading.getBoundingClientRect();
      if (headingBounds.top < 250 || headingBounds.bottom > innerHeight * .85) {
        heading.scrollIntoView({ block: 'center', behavior: ctx.reducedMotion ? 'auto' : 'smooth' });
      }
      ctx.audio.playSfx('sparkle');
      void ctx.confetti.cannons();
    }

    s.on(lightButton, 'click', () => {
      if (!ready || started || leaving || !s.alive) return;
      started = true;
      lightButton.disabled = true;
      section.classList.add('is-lit');
      scene.setAttribute('aria-label', copy.candleLitLabel);
      status.textContent = copy.lighting;
      if (!ctx.state.muted && !ctx.audio.playing) void ctx.startAudio();
      ctx.audio.playSfx('match');
      void (async () => {
        if (!await waitWhileVisible(ctx.reducedMotion ? 500 : 1450)) return;
        status.textContent = copy.rising;
        personalFlight.style.willChange = ctx.reducedMotion ? '' : 'transform';
        section.classList.add('is-released');
        ctx.audio.playSfx('whoosh');
        if (!await waitWhileVisible(ctx.reducedMotion ? 350 : 4800)) return;
        finishBirthday();
      })().catch(error => { if (s.alive) ctx.fail(error); });
    });

    const leave = destination => {
      if (!ready || leaving || !s.alive) return;
      leaving = true;
      section.querySelectorAll('button').forEach(button => { button.disabled = true; });
      section.classList.add('happiness-paused');
      void ctx.go(destination);
    };
    s.on(backButton, 'click', () => leave(14));
    s.on(replayButton, 'click', () => leave(3));
    s.on(document, 'visibilitychange', () => {
      section.classList.toggle('happiness-paused', document.hidden || leaving);
      if (document.hidden) ctx.confetti.reset();
    });
    s.add(() => {
      section.classList.add('happiness-paused');
      personalFlight.style.willChange = '';
    });

    void (async () => {
      if (await ctx.entered === false || !s.alive) return;
      ready = true;
      section.classList.add('is-ready');
      section.classList.toggle('happiness-paused', document.hidden);
      lightButton.disabled = false;
      backButton.disabled = false;
    })().catch(error => { if (s.alive) ctx.fail(error); });
  } catch (error) { if (s.alive) ctx.fail(error); }
}

export function destroy() { scope?.destroy(); scope = null; }
