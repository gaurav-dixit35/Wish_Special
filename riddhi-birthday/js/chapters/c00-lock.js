import { createTimeLock } from '../timelock.js';

export const id = 0;
let scope;

// A deliberately local, lightweight placeholder until the ten dog PNGs arrive.
const sleepyDog = `<svg viewBox="0 0 320 180" aria-hidden="true">
  <defs>
    <linearGradient id="pillow" x2="0" y2="1"><stop stop-color="#667fae"/><stop offset="1" stop-color="#354d7c"/></linearGradient>
    <linearGradient id="fur" x2=".4" y2="1"><stop stop-color="#fbe6b5"/><stop offset="1" stop-color="#e3b677"/></linearGradient>
    <linearGradient id="ear" x2=".7" y2="1"><stop stop-color="#dca363"/><stop offset="1" stop-color="#b87841"/></linearGradient>
  </defs>
  <ellipse cx="160" cy="159" rx="124" ry="13" fill="#020b21" opacity=".35"/>
  <path d="M37 140Q52 119 151 127Q236 117 281 139Q295 158 263 163L62 163Q31 158 37 140" fill="url(#pillow)"/>
  <path d="M45 149Q154 164 274 146" fill="none" stroke="#96b5e4" stroke-width="2" opacity=".3"/>
  <g class="dog-art">
    <path d="M219 112Q277 81 274 122Q273 145 228 144" fill="#e9bd80" stroke="#d7a26c" stroke-width="3"/>
    <ellipse cx="192" cy="110" rx="67" ry="37" fill="url(#fur)"/>
    <path d="M171 112Q190 143 238 136Q227 156 177 146" fill="#f5dba6"/>
    <ellipse cx="193" cy="139" rx="39" ry="13" fill="#f9e4b9"/>
    <path d="M213 140l-1 7m9-8-1 6" stroke="#d3ac80" stroke-width="2" stroke-linecap="round"/>
    <path d="M110 114Q140 105 159 127L151 142Q125 146 106 133" fill="#769dc7"/>
    <circle cx="141" cy="135" r="6" fill="#ffd36b"/>
    <path d="M76 84Q69 57 89 54Q108 55 119 76" fill="url(#ear)"/>
    <path d="M79 76Q80 56 91 63L103 80" fill="#ebc28e"/>
    <path d="M70 101Q64 68 101 65Q133 55 153 78Q170 94 151 126Q124 150 84 132Q67 124 70 101" fill="url(#fur)"/>
    <path d="M127 79Q150 61 164 83Q174 100 158 127Q148 139 136 127Q139 100 127 79" fill="url(#ear)"/>
    <path d="M79 108Q93 94 112 108Q131 111 122 126Q105 144 81 130Q71 122 79 108" fill="#fff0ce"/>
    <ellipse cx="80" cy="121" rx="9" ry="6" fill="#3b2e33" transform="rotate(12 80 121)"/>
    <path d="M93 100q7 7 15 0" fill="none" stroke="#604938" stroke-width="3" stroke-linecap="round"/>
    <path d="M115 85q4-3 9-1" fill="none" stroke="#b48456" stroke-width="2" stroke-linecap="round"/>
    <path d="M83 128q6 5 12 0" fill="none" stroke="#9f7153" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="115" cy="118" rx="7" ry="4" fill="#e5a486" opacity=".48"/>
    <ellipse cx="92" cy="142" rx="27" ry="10" fill="#fae4b9"/>
    <path d="M73 141v6m7-7v8" stroke="#d3ac80" stroke-width="2" stroke-linecap="round"/>
  </g>
</svg>`;

export function init(ctx) {
  scope = ctx.scope;
  const s = scope;
  try {
    const {config, section, escape:e} = ctx;
    const copy = config.lock;
    let taps = 0;
    let waking = false;
    section.setAttribute('aria-labelledby', 'lock-heading');
    section.innerHTML = `<div class="lock-content">
      <p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>${e(copy.eyebrow)}</p>
      <h1 id="lock-heading" class="lock-heading"><span>${e(copy.headlineBefore)}</span><span class="headline-accent">${e(copy.headlineAccent)}</span></h1>
      <p class="lock-description">${e(copy.description)}</p>
      <div class="dog-scene">
        <span class="dog-bubble">${e(copy.bubble)}</span>
        <span class="dog-spark one" aria-hidden="true">✧</span><span class="dog-spark two" aria-hidden="true">✦</span>
        <button class="sleeping-dog" data-testid="dog-button" type="button" aria-label="${e(config.ui.dogAlt)}">${sleepyDog}</button>
        <span class="dog-zzz" aria-hidden="true">${e(copy.zzz)}</span>
      </div>
      <div class="countdown-card">
        <p class="countdown-heading"><span class="tiny-star" aria-hidden="true">✦</span>${e(copy.waiting)}</p>
        <div class="countdown-grid" role="timer" aria-label="${e(copy.waiting)}" aria-live="off">
          ${config.ui.countdownLabels.map((label,i) => `<div class="time-unit"><span class="time-number" data-unit="${i}">00</span><span class="time-label">${e(label)}</span></div>`).join('')}
        </div>
        <p class="date-note">${e(copy.dateNote)}</p>
      </div>
      <div class="lock-actions"><button class="primary-button" data-testid="begin-button" type="button"><span>${e(copy.begin)}</span><span class="button-arrow" aria-hidden="true">↗</span></button><p class="begin-note">${e(copy.title)}</p></div>
      <p class="dog-hint">${e(copy.dogHint)}</p>
    </div>`;

    const dog = section.querySelector('.sleeping-dog');
    const bubble = section.querySelector('.dog-bubble');
    const button = section.querySelector('[data-testid="begin-button"]');
    const buttonLabel = button.querySelector('span');
    const digits = [...section.querySelectorAll('.time-number')];
    s.on(dog, 'click', () => {
      if (waking) return;
      taps += 1;
      if (taps <= 2) ctx.audio.playSfx('snore');
      if (taps === 3 || taps === 6) {
        const message = taps === 3 ? copy.tap3 : copy.tap6;
        ctx.toast(message);
        void s.motion(bubble, {opacity:.3}, {opacity:1}, {duration:.3});
      }
    });
    const reflectSound = () => {
      buttonLabel.textContent = ctx.state.audioOn && !ctx.state.muted ? copy.playing : copy.begin;
    };
    s.on(document, 'birthday:soundchange', reflectSound);
    reflectSound();
    s.on(button, 'click', () => { void ctx.startAudio(); });
    const clock = createTimeLock({
      preview:ctx.preview && !ctx.previewLock,
      onTick({days,hours,minutes,seconds}) {
        [days,hours,minutes,seconds].forEach((value,i) => {
          const text = String(value).padStart(2,'0');
          if (digits[i].textContent !== text) digits[i].textContent = text;
        });
      },
      onUnlock() {
        if (!s.alive || waking) return;
        waking = true;
        ctx.state.unlocked = true;
        bubble.textContent = copy.unlocking;
        section.querySelector('.dog-zzz').hidden = true;
        dog.disabled = true;
        const art = dog.querySelector('.dog-art');
        art.style.animation = 'none';
        void (async () => {
          await s.motion(art, {scaleY:1,rotate:0}, {scaleY:1.1,rotate:-3}, {duration:.45,ease:'power3.out'});
          if (await s.wait(250)) void ctx.go(1);
        })();
      },
    });
    s.add(clock.stop);
    s.on(document, 'visibilitychange', () => {
      if (document.hidden) clock.stop();
      else clock.start();
    });
    clock.start();
  } catch (error) { ctx.fail(error); }
}

export function destroy() { scope?.destroy(); scope = null; }
