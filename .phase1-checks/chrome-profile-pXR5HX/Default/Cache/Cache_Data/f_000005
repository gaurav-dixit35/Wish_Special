import { createDog } from '../dog.js';
import { cakeMarkup } from '../cake-art.js';
import { createBlowDetector } from '../mic.js';

export const id = 4;
let scope;

export function init(ctx) {
  scope = ctx.scope;
  const s = scope;
  try {
    const { section, config, escape:e } = ctx;
    const copy = config.cakeUi;
    const actionKeys = ['bake', 'decorate', 'candles', 'light'];
    let step = 0;
    let busy = true;
    let phase = 'building';
    let breaths = 0;
    let queuedSecondBlow = false;
    let flamesLit = false;
    let flickerScope;
    let microphoneStatus = 'idle';
    let microphoneUnavailable = false;
    let leaving = false;

    section.setAttribute('aria-labelledby', 'cake-heading');
    section.dataset.cakePhase = phase;
    section.innerHTML = `<div class="cake-content"><header class="cake-header"><p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>${e(copy.eyebrow)}</p><h1 id="cake-heading">${e(copy.title)}</h1><p class="cake-intro">${e(copy.intro)}</p></header><div class="cake-art-stage">${cakeMarkup({name:config.name,age:config.age,bannerText:copy.banner,ariaLabel:copy.artLabel,escape:e})}<span class="cake-art-spark cake-art-spark-one" aria-hidden="true">✧</span><span class="cake-art-spark cake-art-spark-two" aria-hidden="true">✦</span><span class="cake-art-spark cake-art-spark-three" aria-hidden="true">✧</span></div><div class="cake-step-card glass"><ol class="cake-steps" aria-label="${e(copy.stepLabel)}">${copy.steps.map((label,index) => `<li class="${index === 0 ? 'is-current' : ''}"${index === 0 ? ' aria-current="step"' : ''}><span class="cake-step-number" aria-hidden="true">${index + 1}</span><span>${e(label)}</span></li>`).join('')}</ol><div class="cake-instruction" role="status" aria-live="polite" aria-atomic="true"><p class="cake-step-count">${e(copy.stepLabel)} <strong>1</strong> ${e(copy.of)} ${copy.steps.length}</p><h2>${e(copy.hints[0])}</h2></div><div class="cake-build-controls"><button class="primary-button cake-action" data-testid="cake-action" type="button" disabled>${e(copy.actions.bake)}</button><span class="cake-working" hidden>${e(copy.working)}</span></div><div class="cake-countdown" role="status" aria-live="polite" aria-atomic="true" hidden></div><div class="cake-blow-controls" hidden><p class="cake-breath-count" aria-live="polite" aria-atomic="true"></p><button class="primary-button cake-tap-blow" data-testid="cake-blow" type="button">${e(copy.tapBlow)}</button><button class="secondary-button cake-mic-enable" data-testid="cake-microphone" type="button">${e(copy.micEnable)}</button><div class="cake-mic-meter" hidden><span>${e(copy.micLevel)}</span><span class="cake-mic-track" aria-hidden="true"><i></i></span></div><p class="cake-mic-status" role="status" aria-live="polite"></p><p class="cake-mic-hint">${e(copy.micHint)}</p></div><div class="cake-completion" hidden><p class="cake-earned"><span aria-hidden="true">🐾</span><span>${e(copy.stampEarned)}</span></p><p class="cake-complete-text">${e(copy.completeText)}</p><div class="cake-complete-actions">${ctx.hasChapter(5) ? `<button class="primary-button" data-testid="cake-next" type="button">${e(copy.next)}<span class="button-arrow" aria-hidden="true">↗</span></button>` : ''}<button class="secondary-button" data-testid="cake-replay" type="button">${e(copy.replay)}<span aria-hidden="true">↻</span></button><button class="cake-back" data-testid="cake-back" type="button">${e(copy.back)}</button></div></div></div></div>`;

    const art = section.querySelector('.cake-art-stage');
    const stageGlow = document.createElement('span');
    stageGlow.className = 'cake-stage-glow';
    stageGlow.setAttribute('aria-hidden', 'true');
    art.prepend(stageGlow);
    const card = section.querySelector('.cake-step-card');
    const instruction = section.querySelector('.cake-instruction h2');
    const stepCount = section.querySelector('.cake-step-count');
    const stepItems = [...section.querySelectorAll('.cake-steps li')];
    const buildControls = section.querySelector('.cake-build-controls');
    const action = section.querySelector('.cake-action');
    const working = section.querySelector('.cake-working');
    const countdown = section.querySelector('.cake-countdown');
    const blowControls = section.querySelector('.cake-blow-controls');
    const breathCount = section.querySelector('.cake-breath-count');
    const tapBlow = section.querySelector('.cake-tap-blow');
    const micButton = section.querySelector('.cake-mic-enable');
    const micStatus = section.querySelector('.cake-mic-status');
    const micHint = section.querySelector('.cake-mic-hint');
    const micMeter = section.querySelector('.cake-mic-meter');
    const micFill = section.querySelector('.cake-mic-track i');
    const body = art.querySelector('.cake-body');
    const frosting = art.querySelector('.cake-frosting');
    const frostingReveal = art.querySelector('.cake-frosting-reveal');
    const sprinkles = [...art.querySelectorAll('.cake-sprinkle')];
    const cherries = [...art.querySelectorAll('.cake-cherry')];
    const banner = art.querySelector('.cake-banner');
    const candles = [...art.querySelectorAll('.cake-candle')];
    const flames = [...art.querySelectorAll('.cake-flame')];
    const glow = art.querySelector('.cake-glow');
    const smoke = [...art.querySelectorAll('.cake-smoke')];
    const match = art.querySelector('.cake-match');
    const slice = art.querySelector('.cake-slice');
    const fork = art.querySelector('.cake-fork');
    const dog = createDog(ctx, {mount:card,variant:7,mood:'idle',className:'dog-top cake-guide'});
    s.add(() => dog.destroy());
    s.add(() => flickerScope?.destroy());

    function setPhase(value) {
      phase = value;
      section.dataset.cakePhase = value;
    }

    function caught(error) { if (s.alive) ctx.fail(error); }

    function updateMicUi() {
      if (!s.alive) return;
      const listening = microphoneStatus === 'listening';
      const requesting = microphoneStatus === 'requesting';
      micButton.hidden = microphoneUnavailable;
      micHint.hidden = microphoneUnavailable;
      micButton.disabled = requesting || breaths >= 2;
      micButton.textContent = listening ? copy.micStop : requesting ? copy.micRequesting : copy.micEnable;
      micButton.setAttribute('aria-pressed', String(listening));
      micStatus.textContent = listening ? copy.micListening : requesting ? copy.micRequesting : '';
      micMeter.hidden = !listening;
      if (!listening) micFill.style.transform = 'scaleX(0)';
    }

    const mic = createBlowDetector({
      threshold:.18,
      holdMs:250,
      onBlow:() => requestBlow(),
      onLevel:(level) => {
        if (s.alive) micFill.style.transform = `scaleX(${Math.max(0,Math.min(1,level / .3))})`;
      },
      onStatus:(status) => {
        microphoneStatus = status;
        if (status === 'listening' && s.alive) ctx.audio.duck();
        else ctx.audio.unduck();
        if (status === 'unavailable') microphoneUnavailable = true;
        updateMicUi();
      },
    });
    s.add(() => { mic.destroy(); ctx.audio.unduck(); });
    if (!globalThis.isSecureContext || !globalThis.navigator?.mediaDevices?.getUserMedia || !(globalThis.AudioContext || globalThis.webkitAudioContext)) {
      microphoneUnavailable = true;
    }
    updateMicUi();

    function updateBreaths() {
      breathCount.textContent = copy.blows.replace('{count}', String(breaths));
      tapBlow.disabled = breaths >= 2;
      micButton.disabled = microphoneStatus === 'requesting' || breaths >= 2;
    }

    function updateSteps() {
      stepItems.forEach((item,index) => {
        item.classList.toggle('is-current', index === step);
        item.classList.toggle('is-done', index < step);
        if (index === step) item.setAttribute('aria-current', 'step');
        else item.removeAttribute('aria-current');
        item.querySelector('.cake-step-number').textContent = index < step ? '✓' : String(index + 1);
      });
      if (step >= actionKeys.length) { stepCount.hidden = true; return; }
      stepCount.querySelector('strong').textContent = String(step + 1);
      instruction.textContent = copy.hints[step];
      action.textContent = copy.actions[actionKeys[step]];
    }

    function stopFlicker() {
      flickerScope?.destroy();
      flickerScope = null;
    }

    function startFlicker() {
      stopFlicker();
      if (!s.alive || !flamesLit || document.hidden || ctx.reducedMotion) return;
      flickerScope = ctx.createScope();
      const fs = flickerScope;
      flames.forEach((flame) => {
        void (async () => {
          let last = {scaleX:1,scaleY:1,skewX:0,opacity:1};
          while (fs.alive && s.alive && flamesLit) {
            const next = {scaleX:.88 + Math.random() * .2,scaleY:.86 + Math.random() * .23,skewX:-6 + Math.random() * 12,opacity:.85 + Math.random() * .15};
            if (!await fs.motion(flame, last, next, {duration:.08 + Math.random() * .06,ease:'none'})) return;
            last = next;
          }
        })().catch(caught);
      });
      void (async () => {
        let last = 1;
        while (fs.alive && s.alive && flamesLit) {
          const next = .78 + Math.random() * .22;
          const duration = .08 + Math.random() * .06;
          const moved = await Promise.all([
            fs.motion(glow, {opacity:last}, {opacity:next}, {duration,ease:'none'}),
            fs.motion(stageGlow, {opacity:last}, {opacity:next}, {duration,ease:'none'}),
          ]);
          if (!moved.every(Boolean)) return;
          last = next;
        }
      })().catch(caught);
    }

    async function bake() {
      art.classList.add('is-baking');
      if (!await s.motion(body, {y:-300,scaleX:1,scaleY:1,opacity:0}, {y:0,scaleX:1,scaleY:1,opacity:1}, {duration:.75,ease:'power2.in'})) return false;
      ctx.audio.playSfx('thud');
      if (!await s.motion(body, {scaleX:1,scaleY:1}, {scaleX:1.055,scaleY:.85}, {duration:.13,ease:'power2.out'})) return false;
      const landed = await s.motion(body, {scaleX:1.055,scaleY:.85}, {scaleX:1,scaleY:1}, {duration:.35,ease:'back.out(2)'});
      if (landed) art.classList.remove('is-baking');
      return landed;
    }

    async function decorate() {
      frosting.style.opacity = '1';
      ctx.audio.playSfx('sparkle');
      if (!await s.motion(frostingReveal, {scaleX:0}, {scaleX:1}, {duration:.8,ease:'power2.inOut'})) return false;
      const sprinkled = await Promise.all(sprinkles.map(async (sprinkle,index) => {
        if (!await s.wait(ctx.reducedMotion ? 0 : index * 24)) return false;
        return s.motion(sprinkle, {y:-120,rotate:-35,opacity:0}, {y:0,rotate:0,opacity:1}, {duration:.45,ease:'bounce.out'});
      }));
      if (!s.alive || sprinkled.some((done) => !done)) return false;
      const topped = await Promise.all(cherries.map(async (cherry,index) => {
        if (!await s.wait(ctx.reducedMotion ? 0 : index * 80)) return false;
        return s.motion(cherry, {y:-14,scale:0,opacity:0}, {y:0,scale:1,opacity:1}, {duration:.35,ease:'back.out(2.2)'});
      }));
      if (!s.alive || topped.some((done) => !done)) return false;
      return s.motion(banner, {scaleX:0,scaleY:.85,opacity:0}, {scaleX:1,scaleY:1,opacity:1}, {duration:.6,ease:'back.out(1.3)'});
    }

    async function placeCandles() {
      for (const candle of candles) {
        ctx.audio.playSfx('pop');
        if (!await s.motion(candle, {y:-90,scaleY:.8,opacity:0}, {y:0,scaleY:1,opacity:1}, {duration:.5,ease:'back.out(1.6)'})) return false;
        if (!await s.wait(ctx.reducedMotion ? 0 : 130)) return false;
      }
      return s.alive;
    }

    async function lightCandles() {
      ctx.audio.playSfx('match');
      if (!await s.motion(match, {x:-45,y:45,rotate:-22,opacity:0}, {x:65,y:-45,rotate:10,opacity:1}, {duration:.4,ease:'power2.out'})) return false;
      if (!await s.motion(match, {x:65,y:-45,rotate:10,opacity:1}, {x:151,y:-7,rotate:0,opacity:1}, {duration:.35,ease:'power2.inOut'})) return false;
      if (!await s.motion(flames[0], {scaleX:.3,scaleY:0,opacity:0}, {scaleX:1,scaleY:1,opacity:1}, {duration:.3,ease:'back.out(1.6)'})) return false;
      if (!await s.motion(match, {x:151,y:-7,rotate:0,opacity:1}, {x:229,y:-7,rotate:0,opacity:1}, {duration:.4,ease:'power2.inOut'})) return false;
      if (!await s.motion(flames[1], {scaleX:.3,scaleY:0,opacity:0}, {scaleX:1,scaleY:1,opacity:1}, {duration:.3,ease:'back.out(1.6)'})) return false;
      flamesLit = true;
      const lit = await Promise.all([
        s.motion(match, {x:229,y:-7,rotate:0,opacity:1}, {x:360,y:-65,rotate:22,opacity:0}, {duration:.4}),
        s.motion(glow, {opacity:0}, {opacity:1}, {duration:.5}),
        s.motion(stageGlow, {opacity:0}, {opacity:1}, {duration:.5}),
      ]);
      if (!s.alive || lit.some((done) => !done)) return false;
      startFlicker();
      return true;
    }

    async function runStep() {
      if (!s.alive || busy || phase !== 'building') return;
      const returnFocus = document.activeElement === action;
      busy = true;
      action.disabled = true;
      action.hidden = true;
      action.setAttribute('aria-busy', 'true');
      working.hidden = false;
      const done = await [bake, decorate, placeCandles, lightCandles][step]();
      if (!done || !s.alive) return;
      step += 1;
      updateSteps();
      working.hidden = true;
      action.removeAttribute('aria-busy');
      if (step < actionKeys.length) {
        // Each stage finishes before the next tap can do anything.
        busy = false;
        action.disabled = false;
        action.hidden = false;
        if (returnFocus && [document.body, action].includes(document.activeElement)) action.focus({preventScroll:true});
      } else {
        buildControls.hidden = true;
        setPhase('countdown');
        instruction.textContent = config.cake.wishPrompt;
        countdown.hidden = false;
        for (const number of ['3', '2', '1']) {
          countdown.textContent = number;
          if (!await s.motion(countdown, {scale:.8,opacity:0}, {scale:1,opacity:1}, {duration:.2,ease:'back.out(1.6)'})) return;
          if (!await s.wait(ctx.reducedMotion ? 600 : 750)) return;
        }
        countdown.textContent = copy.blowNow;
        countdown.classList.add('is-blow');
        if (!await s.motion(countdown, {scale:.8,opacity:0}, {scale:1,opacity:1}, {duration:.25})) return;
        setPhase('first-ready');
        instruction.textContent = copy.readyToBlow;
        blowControls.hidden = false;
        updateBreaths();
        mic.setArmed(true);
        if (returnFocus && [document.body, action].includes(document.activeElement)) tapBlow.focus({preventScroll:true});
      }
    }

    async function extinguish() {
      flamesLit = false;
      stopFlicker();
      ctx.audio.playSfx('blow');
      const out = await Promise.all([
        ...flames.map((flame) => s.motion(flame, {scaleX:1,scaleY:1,skewX:0,opacity:1}, {scaleX:.6,scaleY:0,skewX:20,opacity:0}, {duration:.25,ease:'power2.in'})),
        s.motion(glow, {opacity:1}, {opacity:0}, {duration:.3}),
        s.motion(stageGlow, {opacity:1}, {opacity:0}, {duration:.3}),
      ]);
      if (!s.alive || out.some((done) => !done)) return false;
      return (await Promise.all(smoke.map(async (puff,index) => {
        if (!await s.wait(ctx.reducedMotion ? 0 : index * 70)) return false;
        return s.motion(puff, {x:0,y:0,scale:.6,opacity:.65}, {x:(index - 1) * 14,y:-58,scale:1.5,opacity:0}, {duration:.76,ease:'power1.out'});
      }))).every(Boolean) && s.alive;
    }

    async function firstBlow() {
      countdown.hidden = true;
      instruction.textContent = copy.relighting;
      // Smoke rises during the pause, so the relight happens 1.2s after the blow.
      if (!(await Promise.all([extinguish(), s.wait(1200)])).every(Boolean) || !s.alive) return;
      if (!(await Promise.all([
        ...flames.map((flame) => s.motion(flame, {scaleX:.5,scaleY:0,skewX:0,opacity:0}, {scaleX:1,scaleY:1,skewX:0,opacity:1}, {duration:.3,ease:'back.out(1.8)'})),
        s.motion(glow, {opacity:0}, {opacity:1}, {duration:.35}),
        s.motion(stageGlow, {opacity:0}, {opacity:1}, {duration:.35}),
      ])).every(Boolean) || !s.alive) return;
      flamesLit = true;
      startFlicker();
      ctx.audio.playSfx('sparkle');
      void dog.speak(config.cake.party, {mood:'jump',autoDismiss:4200});
      // One fast second tap is remembered, but the joke always gets its reveal.
      if (!await s.wait(ctx.reducedMotion ? 300 : 400)) return;
      if (queuedSecondBlow) {
        setPhase('second-out');
        await secondBlow();
      } else {
        setPhase('second-ready');
        instruction.textContent = copy.secondBlow;
      }
    }

    function requestBlow() {
      if (!s.alive || document.hidden || breaths >= 2) return;
      if (phase === 'first-ready') {
        breaths = 1;
        setPhase('relighting');
        updateBreaths();
        void firstBlow().catch(caught);
      } else if (phase === 'relighting') {
        queuedSecondBlow = true;
        breaths = 2;
        updateBreaths();
        mic.setArmed(false);
        mic.stop();
      } else if (phase === 'second-ready') {
        breaths = 2;
        setPhase('second-out');
        updateBreaths();
        void secondBlow().catch(caught);
      }
    }

    async function stealSlice() {
      instruction.textContent = copy.sliceTitle;
      if (!await s.motion(slice, {x:0,y:0,opacity:0}, {x:60,y:10,opacity:1}, {duration:.65,ease:'power2.out'})) return false;
      void dog.speak(config.cake.slice, {mood:'party-hat',autoDismiss:6000});
      if (!await s.wait(ctx.reducedMotion ? 350 : 650)) return false;
      if (!await s.motion(fork, {x:160,y:-75,rotate:15,opacity:0}, {x:-47,y:38,rotate:0,opacity:1}, {duration:.5,ease:'power2.out'})) return false;
      if (!await s.wait(250)) return false;
      ctx.audio.playSfx('whoosh');
      return (await Promise.all([
        s.motion(slice, {x:60,y:10,opacity:1}, {x:420,y:-25,opacity:0}, {duration:.75,ease:'power2.in'}),
        s.motion(fork, {x:-47,y:38,rotate:0,opacity:1}, {x:313,y:3,rotate:-8,opacity:0}, {duration:.75,ease:'power2.in'}),
      ])).every(Boolean) && s.alive;
    }

    async function celebrate() {
      const celebration = document.createElement('div');
      celebration.className = 'cake-celebration';
      celebration.setAttribute('aria-hidden', 'true');
      document.body.append(celebration);
      s.add(() => celebration.remove());
      const palette = ['#ffd89b', '#9fb9ff', '#c4a6f9', '#ffb6bd', '#82d9cd'];
      const jobs = [];
      for (let index = 0; index < 30; index += 1) {
        const balloon = index >= 20;
        const particle = document.createElement('span');
        particle.className = balloon ? 'cake-party-balloon' : 'cake-streamer';
        particle.style.left = `${3 + Math.random() * 94}%`;
        particle.style.setProperty('--party-color', palette[index % palette.length]);
        celebration.append(particle);
        jobs.push((async () => {
          if (!await s.wait(ctx.reducedMotion ? 0 : (balloon ? (index - 20) * 120 : index * 35))) return false;
          const travel = innerHeight + (balloon ? 220 : 140);
          const drift = (Math.random() - .5) * (ctx.mobile ? 90 : 220);
          const completed = await s.motion(particle,
            {x:0,y:0,rotate:balloon ? -10 : -40,opacity:ctx.reducedMotion ? .3 : .9},
            {x:ctx.reducedMotion ? 0 : drift,y:ctx.reducedMotion ? 0 : (balloon ? -travel : travel),rotate:balloon ? 12 : 230 + Math.random() * 300,opacity:0},
            {duration:balloon ? 3.4 : 2.7,ease:'none'});
          particle.remove();
          return completed;
        })());
      }
      for (let burst = 0; burst < 3; burst += 1) {
        if (!s.alive) return false;
        void ctx.confetti.burst({particleCount:ctx.mobile ? 50 : 80,spread:75 + burst * 15,origin:{x:[.28,.72,.5][burst],y:.63},colors:palette});
        if (!await s.wait(ctx.reducedMotion ? 120 : 320)) return false;
      }
      const completed = (await Promise.all(jobs)).every(Boolean) && s.alive;
      celebration.remove();
      return completed;
    }

    async function secondBlow() {
      mic.setArmed(false);
      mic.stop();
      tapBlow.disabled = true;
      micButton.disabled = true;
      if (!await extinguish()) return;
      blowControls.hidden = true;
      setPhase('slice');
      if (!await stealSlice()) return;
      setPhase('celebrating');
      instruction.textContent = copy.completeTitle;
      if (!await celebrate()) return;
      setPhase('complete');
      section.dataset.complete = 'true';
      ctx.awardStamp(2);
      const completion = section.querySelector('.cake-completion');
      completion.hidden = false;
      if (!await s.motion(completion, {y:12,opacity:0}, {y:0,opacity:1}, {duration:.45})) return;
      instruction.tabIndex = -1;
      instruction.focus({preventScroll:true});
      dog.setMood('party-hat');
    }

    s.on(action, 'click', (event) => { if (event.detail <= 1) void runStep().catch(caught); });
    s.on(action, 'keydown', (event) => { if (event.repeat && ['Enter', ' '].includes(event.key)) event.preventDefault(); });
    // Do not filter double clicks here: the fast second birthday breath counts.
    s.on(tapBlow, 'click', requestBlow);
    s.on(tapBlow, 'keydown', (event) => { if (event.repeat && ['Enter', ' '].includes(event.key)) event.preventDefault(); });
    s.on(micButton, 'click', () => {
      if (!s.alive || breaths >= 2 || !['first-ready','relighting','second-ready'].includes(phase)) return;
      if (mic.active) { mic.stop(); return; }
      // Permission is requested only from this explicit microphone gesture.
      void mic.start().catch(() => {
        if (!s.alive) return;
        microphoneUnavailable = true;
        mic.stop();
        updateMicUi();
      });
    });
    s.on(document, 'visibilitychange', () => {
      if (document.hidden) { mic.stop(); stopFlicker(); }
      else if (flamesLit) startFlicker();
    });
    s.on(window, 'pagehide', () => { mic.stop(); stopFlicker(); });

    function leave(chapter, button, force = false) {
      if (!s.alive || leaving) return;
      leaving = true;
      button.disabled = true;
      mic.stop();
      void ctx.go(chapter, {force});
    }
    const replay = section.querySelector('[data-testid="cake-replay"]');
    const back = section.querySelector('[data-testid="cake-back"]');
    s.on(replay, 'click', () => leave(4,replay,true));
    s.on(back, 'click', () => leave(2,back));
    const next = section.querySelector('[data-testid="cake-next"]');
    if (next) s.on(next, 'click', () => leave(5,next));

    void (async () => {
      if (await ctx.entered === false || !s.alive) return;
      busy = false;
      action.disabled = false;
      void dog.speak(copy.dogIntro, {mood:'idle',autoDismiss:4000});
    })().catch(caught);
  } catch (error) { if (s.alive) ctx.fail(error); }
}

export function destroy() { scope?.destroy(); scope = null; }
