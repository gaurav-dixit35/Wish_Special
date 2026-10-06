import { createDog } from '../dog.js';

export const id = 2;
let scope;

export function init(ctx) {
  scope = ctx.scope;
  const s = scope;
  try {
    const { section, config, escape:e } = ctx;
    const copy = config.entrance;
    let started = false;
    let leaving = false;
    let gateGuide;
    section.setAttribute('aria-labelledby', 'entrance-heading');
    section.innerHTML = `<div class="entrance-content"><div class="entrance-stage"></div></div>`;
    const stage = section.querySelector('.entrance-stage');

    async function celebrate() {
      try {
        if (started || !s.alive) return;
        started = true;
        const gate = stage.querySelector('.entrance-gate');
        if (gate) {
          if (await ctx.entered === false || !s.alive) return;
          if (!await s.motion(gate, {opacity:1,y:0}, {opacity:0,y:-12}, {duration:.3})) return;
        }
        gateGuide?.destroy();
        stage.innerHTML = `<div class="entrance-countdown">
          <p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>${e(copy.eyebrow)}</p>
          <h1 id="entrance-heading" class="countdown-intro">${e(copy.countdownLabel)}</h1>
          <div class="entrance-number-orbit" aria-hidden="true"><span class="countdown-orbit-star">✦</span><span class="entrance-number">10</span></div>
          <p class="entrance-count-hint">${e(copy.countdownHint)}</p>
        </div>`;
        // Existing music: render before the chapter fades in. New arrival:
        // crossfade from the tap gate, then start the countdown.
        if (await ctx.entered === false || !s.alive) return;
        if (gate && !await s.motion(stage.firstElementChild, {opacity:0,y:12}, {opacity:1,y:0}, {duration:.35})) return;
        const number = stage.querySelector('.entrance-number');
        for (let value = 10; value >= 1; value -= 1) {
          if (!s.alive) return;
          const tick = performance.now();
          number.textContent = String(value);
          ctx.audio.playSfx('pop');
          if (value === 3) ctx.audio.playSfx('whistle');
          if (!await s.motion(number, {scale:1.6,opacity:0}, {scale:1,opacity:1}, {duration:.32,ease:'back.out(1.5)'})) return;
          if (!await s.wait(Math.max(0, 800 - (performance.now() - tick)))) return;
          if (!await s.motion(number, {scale:1,opacity:1}, {scale:.88,opacity:0}, {duration:.2})) return;
          if (!await s.wait(Math.max(0, 1000 - (performance.now() - tick)))) return;
        }
        if (!await s.motion(stage.firstElementChild, {opacity:1}, {opacity:0}, {duration:.22})) return;
        stage.innerHTML = `<div class="entrance-fireworks"><h1 id="entrance-heading" class="sr-only">${e(copy.greeting)} ${e(copy.name)}</h1><span class="entrance-starburst" aria-hidden="true">✦</span></div>`;
        for (let burst = 0; burst < 6; burst += 1) {
          if (!s.alive) return;
          ctx.confetti.burst({particleCount:20,origin:{x:.15 + Math.random() * .7,y:.2 + Math.random() * .3},shapes:['circle']});
          ctx.audio.playSfx('pop');
          if (burst < 5 && !await s.wait(500)) return;
        }
        await revealWelcome();
      } catch (error) { if (s.alive) ctx.fail(error); }
    }

    async function revealWelcome() {
      if (!s.alive) return;
      const letters = (word) => [...word].map((letter) => `<span class="birthday-letter" aria-hidden="true">${e(letter)}</span>`).join('');
      stage.innerHTML = `<div class="entrance-welcome">
        <p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>${e(copy.eyebrow)}</p>
        <h1 id="entrance-heading" class="birthday-heading" tabindex="-1" aria-label="${e(`${copy.greeting} ${copy.name}`)}">${copy.greeting.split(' ').map((word) => `<span class="birthday-word">${letters(word)}</span>`).join('')}<span class="birthday-word birthday-name">${letters(copy.name)}</span></h1>
        <p class="entrance-subtitle">${e(copy.subtitle)}</p>
        <div class="entrance-dog-mount"></div>
        <div class="entrance-gift-wrap"><button class="gift-button" data-testid="entrance-open" type="button" disabled>
          <span class="gift-illustration" aria-hidden="true"><svg viewBox="0 0 120 108"><defs><linearGradient id="gift-wrap" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#92a8fa"/><stop offset="1" stop-color="#6c69d6"/></linearGradient></defs><ellipse cx="60" cy="99" rx="40" ry="6" fill="#9ebdff" opacity=".1"/><path d="M25 48h70v43a7 7 0 0 1-7 7H32a7 7 0 0 1-7-7Z" fill="url(#gift-wrap)" stroke="#c1c8ff" stroke-width="1.5"/><path d="M51 49h18v49H51Z" fill="#ffdc91"/><rect x="20" y="34" width="80" height="22" rx="5" fill="#9c9bed" stroke="#cbc7ff" stroke-width="1.5"/><path d="M51 34h18v22H51Z" fill="#ffe5aa"/><path d="M59 34C32 36 26 14 37 11c12-3 20 12 22 23Zm2 0c27 2 33-20 22-23-12-3-20 12-22 23Z" fill="none" stroke="#ffe5aa" stroke-width="7" stroke-linecap="round"/><path d="m17 19 2 5 5 2-5 2-2 5-2-5-5-2 5-2Zm87 42 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z" fill="#ffdc91"/></svg></span>
          <span class="primary-button gift-button-label">${e(copy.button)}<span class="button-arrow" aria-hidden="true">↗</span></span>
        </button></div>
      </div>`;
      const heading = stage.querySelector('h1');
      const dog = createDog(ctx, {mount:stage.querySelector('.entrance-dog-mount'),variant:1,mood:'party-hat',className:'entrance-guide'});
      s.add(() => dog.destroy());
      dog.element.style.opacity = '0';
      const gift = stage.querySelector('.entrance-gift-wrap');
      gift.style.opacity = '0';
      const subtitle = stage.querySelector('.entrance-subtitle');
      subtitle.style.opacity = '0';
      const button = stage.querySelector('.gift-button');
      s.on(button, 'click', () => {
        if (leaving || button.disabled || !s.alive) return;
        leaving = true;
        button.disabled = true;
        ctx.audio.playSfx('sparkle');
        void ctx.go(3);
      });
      await Promise.all([...stage.querySelectorAll('.birthday-letter')].map(async (letter, index) => {
        if (!await s.wait(ctx.reducedMotion ? 0 : index * 60)) return;
        await s.motion(letter, {y:-80,opacity:0}, {y:0,opacity:1}, {duration:.7,ease:'back.out(1.5)'});
      }));
      if (!s.alive) return;
      heading.focus({preventScroll:true});
      ctx.confetti.cannons();
      ctx.audio.playSfx('sparkle');
      if (!await s.motion(subtitle, {opacity:0,y:10}, {opacity:1,y:0}, {duration:.4})) return;
      if (!await s.motion(dog.element, {opacity:0,y:80,scale:.8}, {opacity:1,y:0,scale:1}, {duration:.7,ease:'back.out(1.8)'})) return;
      void dog.speak(copy.dog, {mood:'party-hat',autoDismiss:0});
      if (!await s.motion(gift, {opacity:0,y:16}, {opacity:1,y:0}, {duration:.5})) return;
      button.disabled = false;
      if (!ctx.reducedMotion) {
        const illustration = stage.querySelector('.gift-illustration');
        s.every(() => {
          if (leaving) return;
          void (async () => {
            try {
              for (const [from,to] of [[0,-6],[-6,6],[6,-6],[-6,0]]) {
                if (!await s.motion(illustration, {rotate:from}, {rotate:to}, {duration:.125,ease:'power2.inOut'})) return;
              }
            } catch (error) { if (s.alive) ctx.fail(error); }
          })();
        }, 3000);
      }
    }

    if (!ctx.state.audioOn) {
      stage.innerHTML = `<div class="entrance-gate glass"><span class="entrance-gate-star" aria-hidden="true">✦</span><p class="eyebrow">${e(copy.eyebrow)}</p><h1 id="entrance-heading">${e(copy.gateTitle)}</h1><p>${e(copy.gateText)}</p><button class="primary-button" data-testid="entrance-begin" type="button">${e(copy.begin)}<span class="button-arrow" aria-hidden="true">↗</span></button></div>`;
      gateGuide = createDog(ctx, {mount:stage.querySelector('.entrance-gate'),variant:2,mood:'party-hat',className:'dog-top'});
      const begin = stage.querySelector('button');
      s.on(begin, 'click', () => {
        if (started || begin.disabled) return;
        begin.disabled = true;
        // Keep audio unlocking inside the gesture; the visual sequence is independent.
        try { void Promise.resolve(ctx.startAudio()).catch(() => {}); } catch { /* Silent playback is also a valid birthday. */ }
        void celebrate();
      });
    } else {
      void celebrate();
    }
  } catch (error) { if (s.alive) ctx.fail(error); }
}

export function destroy() { scope?.destroy(); scope = null; }
