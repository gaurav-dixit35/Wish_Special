import { createDog } from '../dog.js';

export const id = 3;
let scope;

export function init(ctx) {
  scope = ctx.scope;
  const s = scope;
  try {
    const { section, config, escape:e } = ctx;
    const copy = config.identityUi;
    let index = 0;
    let locked = true;
    let questionScope;
    let questionVersion = 0;
    section.setAttribute('aria-labelledby', 'identity-heading');
    section.innerHTML = `<div class="identity-content"><header class="identity-header"><p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>${e(copy.eyebrow)}</p><h1 id="identity-heading">${e(copy.title)}</h1><p class="identity-intro">${e(copy.intro)}</p></header><div class="identity-scene"></div><div class="identity-dog-mount"></div></div>`;
    const scene = section.querySelector('.identity-scene');
    const heading = section.querySelector('h1');
    const intro = section.querySelector('.identity-intro');
    const dog = createDog(ctx, {mount:section.querySelector('.identity-dog-mount'),variant:1,mood:'idle',className:'identity-guide'});
    s.add(() => dog.destroy());
    s.add(() => questionScope?.destroy());

    async function choose(version, button) {
      try {
        if (locked || version !== questionVersion || !s.alive) return;
        locked = true;
        scene.querySelectorAll('button').forEach((answer) => { answer.disabled = true; });
        button.classList.add('answer-selected');
        ctx.audio.playSfx('pop');
        if (!await s.wait(180)) return;
        if (!await s.motion(scene, {opacity:1,y:0}, {opacity:0,y:-12}, {duration:.22})) return;
        questionScope?.destroy();
        index += 1;
        if (index < config.identity.length) {
          renderQuestion();
          if (!await s.motion(scene, {opacity:0,y:15}, {opacity:1,y:0}, {duration:.3})) return;
          // Keep a rapid second tap from selecting the freshly rendered answer.
          if (!await s.wait(240)) return;
          locked = false;
          scene.querySelectorAll('button').forEach((answer) => { answer.disabled = false; });
          scene.querySelector('h2').focus({preventScroll:true});
        } else {
          await verify();
        }
      } catch (error) { if (s.alive) ctx.fail(error); }
    }

    function renderQuestion() {
      questionScope = ctx.createScope();
      const qs = questionScope;
      const version = ++questionVersion;
      const question = config.identity[index];
      scene.innerHTML = `<div class="identity-card glass" data-question="${index + 1}"><div class="identity-card-top"><p class="question-count">${e(copy.questionLabel)} <strong>${index + 1}</strong> ${e(copy.of)} ${config.identity.length}</p><div class="identity-progress" aria-hidden="true">${config.identity.map((_,step) => `<span class="${step < index ? 'step-done' : step === index ? 'step-current' : ''}">${step < index ? '✓' : step + 1}</span>`).join('')}</div></div><h2 class="identity-question" tabindex="-1">${e(question.q)}</h2><div class="identity-answers">${question.a.map((answer,answerIndex) => `<button class="identity-answer" data-answer="${answerIndex}" type="button" disabled><span>${e(answer)}</span><span class="answer-spark" aria-hidden="true">✧</span></button>`).join('')}</div>${question.runaway ? `<div class="runaway-zone"><button class="runaway-answer" type="button" disabled>${e(question.runaway)}</button></div><p class="runaway-status" role="status">${e(copy.runawayHint)}</p>` : `<p class="identity-answer-hint">${e(copy.answerHint)}</p>`}</div>`;
      for (const answer of scene.querySelectorAll('[data-answer]')) {
        qs.on(answer, 'click', (event) => {
          if (event.detail > 1) return;
          void choose(version, answer);
        });
        qs.on(answer, 'keydown', (event) => {
          if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
        });
      }
      createDog({...ctx,scope:qs}, {mount:scene.querySelector('.identity-card'),variant:index + 3,mood:'idle',className:'dog-top'});
      if (question.runaway) setupRunaway(qs, version);
    }

    function setupRunaway(qs, version) {
      const zone = scene.querySelector('.runaway-zone');
      const no = scene.querySelector('.runaway-answer');
      const status = scene.querySelector('.runaway-status');
      let attempts = 0;
      let lastAttempt = -Infinity;
      let position = {x:0,y:0};
      let moving = false;
      let caught = false;
      const bounds = () => ({x:Math.max(0,zone.clientWidth - no.offsetWidth),y:Math.max(0,zone.clientHeight - no.offsetHeight)});
      const place = () => {
        if (caught || moving) return;
        const limits = bounds();
        position = {x:Math.min(limits.x, Math.max(0,attempts ? position.x : limits.x / 2)),y:Math.min(limits.y, Math.max(0,attempts ? position.y : limits.y / 2))};
        no.style.transform = `translate(${position.x}px, ${position.y}px)`;
      };
      place();
      qs.on(window, 'resize', place);
      function catchAnswer() {
        if (caught || locked || version !== questionVersion || !qs.alive) return;
        caught = true;
        no.disabled = true;
        no.hidden = true;
        zone.classList.add('runaway-caught');
        status.textContent = copy.niceTry;
        status.classList.add('is-caught');
        ctx.audio.playSfx('pop');
        void dog.speak(copy.niceTry, {mood:'idle',autoDismiss:3500});
      }
      async function dodge(event) {
        try {
          if (locked || caught || moving || version !== questionVersion || !qs.alive) return;
          if (event?.cancelable && event.type === 'touchstart') event.preventDefault();
          const now = performance.now();
          if (now - lastAttempt < 340) return;
          lastAttempt = now;
          attempts += 1;
          if (attempts >= 5) { catchAnswer(); return; }
          const limits = bounds();
          let next = {x:Math.random() * limits.x,y:Math.random() * limits.y};
          for (let retry = 0; retry < 8 && Math.hypot(next.x - position.x,next.y - position.y) < 75; retry += 1) next = {x:Math.random() * limits.x,y:Math.random() * limits.y};
          if (Math.hypot(next.x - position.x,next.y - position.y) < 60) next = {x:position.x < limits.x / 2 ? limits.x : 0,y:position.y < limits.y / 2 ? limits.y : 0};
          moving = true;
          const previous = position;
          position = next;
          await qs.motion(no, previous, next, {duration:.25,ease:'power2.out'});
          moving = false;
        } catch (error) { if (s.alive) ctx.fail(error); }
      }
      qs.on(no, 'pointerenter', (event) => { if (event.pointerType !== 'touch') void dodge(event); });
      qs.on(no, 'touchstart', (event) => { void dodge(event); }, {passive:false});
      qs.on(zone, 'pointermove', (event) => {
        if (event.pointerType === 'touch' || caught) return;
        const rect = no.getBoundingClientRect();
        const dx = Math.max(rect.left - event.clientX,0,event.clientX - rect.right);
        const dy = Math.max(rect.top - event.clientY,0,event.clientY - rect.bottom);
        if (Math.hypot(dx,dy) <= 60) void dodge(event);
      });
      qs.on(no, 'click', (event) => {
        if (event.detail === 0) catchAnswer();
        else void dodge(event);
      });
    }

    async function verify() {
      const vs = ctx.createScope();
      questionScope = vs;
      heading.textContent = copy.scanTitle;
      intro.textContent = copy.scanText;
      scene.innerHTML = `<div class="identity-scan-shell"><div class="identity-scan-card glass"><div class="identity-scan-lines" aria-hidden="true"></div><div class="identity-monogram" aria-hidden="true">${e(config.name.slice(0,1))}<span>✧</span></div><h2 class="identity-name" tabindex="-1">${e(config.name)}</h2><p class="identity-age">${e(config.ui.age)}</p><span class="identity-laser" aria-hidden="true"></span><div class="identity-stamp" aria-hidden="true">${e(copy.verifiedLabel)}</div></div></div><div class="identity-result" hidden><p class="identity-verified-copy">${e(config.verified)}</p><p class="identity-stamp-earned">${e(copy.stampEarned)}</p><div class="identity-completion"><h2>${e(copy.completeTitle)}</h2><p>${e(copy.completeText)}</p>${ctx.hasChapter(4) ? `<button class="primary-button" data-testid="identity-next" type="button">${e(copy.next)}<span class="button-arrow" aria-hidden="true">↗</span></button>` : ''}<button class="secondary-button" data-testid="identity-replay" type="button">${e(copy.replayEntrance)}<span aria-hidden="true">↻</span></button></div></div>`;
      createDog({...ctx,scope:vs}, {mount:scene.querySelector('.identity-scan-shell'),variant:6,mood:'party-hat',className:'dog-top'});
      const card = scene.querySelector('.identity-scan-card');
      const laser = scene.querySelector('.identity-laser');
      const stamp = scene.querySelector('.identity-stamp');
      if (!await vs.motion(scene, {opacity:0,y:12}, {opacity:1,y:0}, {duration:.4})) return;
      for (let pass = 0; pass < 2; pass += 1) {
        if (!await vs.motion(laser, {y:0,opacity:.9}, {y:card.clientHeight - 4,opacity:.9}, {duration:1.4,ease:'none'})) return;
      }
      laser.hidden = true;
      ctx.audio.playSfx('thud');
      const stampMotion = vs.motion(stamp, {scale:3,rotate:-12,opacity:0}, {scale:1,rotate:-12,opacity:1}, {duration:.28,ease:'back.out(1.5)'});
      if (!ctx.reducedMotion) {
        for (const [from,to] of [[0,-4],[-4,4],[4,-4],[-4,0]]) {
          if (!await vs.motion(section, {x:from}, {x:to}, {duration:.05,ease:'none'})) return;
        }
      }
      if (!await stampMotion || !s.alive) return;
      ctx.awardStamp(1);
      heading.textContent = copy.verifiedTitle;
      intro.textContent = copy.stampEarned;
      card.classList.add('is-verified');
      const result = scene.querySelector('.identity-result');
      result.hidden = false;
      if (!await vs.motion(result, {y:14,opacity:0}, {y:0,opacity:1}, {duration:.5})) return;
      heading.setAttribute('tabindex','-1');
      heading.focus({preventScroll:true});
      void dog.speak(copy.stampEarned, {mood:'jump',autoDismiss:5000});
      let leaving = false;
      const leave = (chapter,button) => {
        if (leaving || !s.alive) return;
        leaving = true;
        button.disabled = true;
        void ctx.go(chapter);
      };
      const replay = scene.querySelector('[data-testid="identity-replay"]');
      vs.on(replay, 'click', () => leave(2,replay));
      const next = scene.querySelector('[data-testid="identity-next"]');
      if (next) vs.on(next, 'click', () => leave(4,next));
    }

    renderQuestion();
    void (async () => {
      try {
        if (await ctx.entered === false || !s.alive) return;
        locked = false;
        scene.querySelectorAll('button').forEach((answer) => { answer.disabled = false; });
        scene.querySelector('h2').focus({preventScroll:true});
        await dog.speak(copy.dogIntro, {mood:'idle',autoDismiss:5000});
      } catch (error) { if (s.alive) ctx.fail(error); }
    })();
  } catch (error) { if (s.alive) ctx.fail(error); }
}

export function destroy() { scope?.destroy(); scope = null; }
