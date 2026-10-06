export const id = 1;
let scope;

export function init(ctx) {
  scope = ctx.scope;
  const s = scope;
  try {
    const {config, section, escape:e} = ctx;
    const copy = config.loading;
    const started = performance.now();
    let messageIndex = 0;
    let complete = false;
    section.setAttribute('aria-labelledby', 'loader-heading');
    section.innerHTML = `<div class="loader-content">
      <p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span><span class="loader-eyebrow">${e(copy.eyebrow)}</span></p>
      <h1 id="loader-heading" class="loader-title">${e(copy.title)}</h1>
      <p class="loader-subtitle">${e(copy.subtitle)}</p>
      <div class="heart-scene" aria-hidden="true">
        <div class="heart-halo"></div><div class="heart-ring"></div>
        <span class="heart-star left">✧</span><span class="heart-star right">✦</span>
        <svg class="heart-svg" viewBox="0 0 200 200">
          <defs>
            <linearGradient id="heart-colour" x1="0" y1="1" x2=".8" y2="0"><stop stop-color="#6dafff"/><stop offset=".6" stop-color="#a6a4ff"/><stop offset="1" stop-color="#d4bcff"/></linearGradient>
            <clipPath id="heart-shape"><path d="M100 166C83 149 26 119 26 75C26 37 76 26 100 60C124 26 174 37 174 75C174 119 117 149 100 166Z"/></clipPath>
          </defs>
          <path d="M100 166C83 149 26 119 26 75C26 37 76 26 100 60C124 26 174 37 174 75C174 119 117 149 100 166Z" fill="#92bfff0b" stroke="#a9c7ff" stroke-width="2"/>
          <g clip-path="url(#heart-shape)"><rect class="heart-fill" x="0" y="0" width="200" height="200" fill="url(#heart-colour)" style="transform:translateY(180px)"/></g>
          <path d="M46 72Q49 53 65 54" fill="none" stroke="#e8f3ff" stroke-width="5" stroke-linecap="round" opacity=".65"/>
        </svg>
      </div>
      <p class="load-message" data-testid="loader-status" role="status" aria-live="polite">${e(config.loader[0])}</p>
      <div class="loading-meter" role="progressbar" aria-label="${e(copy.progressLabel)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="loading-meter-fill"></div></div>
      <p class="load-percent" data-testid="loader-percent">0%</p>
      <div class="ready-actions" hidden><p class="ready-description">${e(copy.readyDescription)}</p><button class="primary-button" data-testid="loader-begin" type="button">${e(copy.begin)}<span class="button-arrow" aria-hidden="true">↗</span></button><button class="secondary-button" data-testid="loader-replay" type="button">${e(copy.replay)}<span aria-hidden="true">↻</span></button></div>
    </div>`;
    const fill = section.querySelector('.heart-fill');
    const meter = section.querySelector('.loading-meter');
    const meterFill = section.querySelector('.loading-meter-fill');
    const percent = section.querySelector('.load-percent');
    const message = section.querySelector('.load-message');
    s.add(ctx.preloader.subscribe((progress) => {
      if (!s.alive) return;
      const fraction = Math.min(1, Math.max(0, progress));
      fill.style.transform = `translateY(${180 * (1 - fraction)}px)`;
      meterFill.style.transform = `scaleX(${fraction})`;
      percent.textContent = `${Math.round(fraction * 100)}%`;
      meter.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
    }));
    const stopMessages = s.every(() => {
      if (complete) return;
      void (async () => {
        if (!await s.motion(message, {opacity:1}, {opacity:0}, {duration:.2})) return;
        if (complete) { message.style.opacity = '1'; return; }
        messageIndex = (messageIndex + 1) % config.loader.length;
        message.textContent = config.loader[messageIndex];
        await s.motion(message, {opacity:0}, {opacity:1}, {duration:.3});
      })();
    }, 1600);
    const replay = section.querySelector('[data-testid="loader-replay"]');
    s.on(replay, 'click', () => { replay.disabled = true; void ctx.go(1, {force:true}); });
    const begin = section.querySelector('[data-testid="loader-begin"]');
    const reflectSound = () => { begin.hidden = ctx.state.audioOn && !ctx.state.muted; };
    s.on(document, 'birthday:soundchange', reflectSound);
    s.on(begin, 'click', () => { void ctx.startAudio(); });
    reflectSound();

    void (async () => {
      try {
        await ctx.preloadDone;
        if (!s.alive || !await s.wait(Math.max(0,2500 - (performance.now() - started)))) return;
        complete = true;
        stopMessages();
        const heart = section.querySelector('.heart-svg');
        for (let beat = 0; beat < 2; beat += 1) {
          if (!await s.motion(heart, {scale:1}, {scale:1.15}, {duration:.3,ease:'power2.inOut'})) return;
          if (!await s.motion(heart, {scale:1.15}, {scale:1}, {duration:.3,ease:'power2.inOut'})) return;
        }
        if (!await s.motion(section.querySelector('.heart-ring'), {scale:.7,opacity:.8}, {scale:1.7,opacity:0}, {duration:.9})) return;
        if (!s.alive || ctx.onLoaderReady()) return;
        section.classList.add('loader-ready');
        section.dataset.ready = 'true';
        section.querySelector('.loader-eyebrow').textContent = copy.readyEyebrow;
        section.querySelector('h1').textContent = copy.ready;
        message.textContent = copy.completeLabel;
        message.style.opacity = '1';
        percent.hidden = true;
        section.querySelector('.loader-subtitle').hidden = true;
        const actions = section.querySelector('.ready-actions');
        actions.hidden = false;
        void s.motion(actions, {opacity:0,y:12}, {opacity:1,y:0}, {duration:.7});
      } catch (error) { if (s.alive) ctx.fail(error); }
    })();
  } catch (error) { ctx.fail(error); }
}

export function destroy() { scope?.destroy(); scope = null; }
