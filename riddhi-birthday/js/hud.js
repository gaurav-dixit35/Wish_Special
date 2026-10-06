const STAMP_IDS = Array.from({ length:8 }, (_, index) => index + 1);

const paw = `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M10 21c0-3 3-8 6-8s6 5 6 8c0 4-4 3-6 3s-6 1-6-3Z"/><ellipse cx="6.5" cy="13" rx="3" ry="4" transform="rotate(-25 6.5 13)"/><ellipse cx="13" cy="7.5" rx="3" ry="4"/><ellipse cx="21" cy="7.5" rx="3" ry="4"/><ellipse cx="27" cy="14" rx="3" ry="4" transform="rotate(25 27 14)"/></svg>`;

function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (token, key) => values[key] ?? token);
}

// The HUD survives chapter changes. Only chapters actually reached in this
// visit are replayable. Reaching the finale opens the full chapter collection;
// this changes navigation only, never the stamps earned by playing.
export function createHUD({ mount, config, state, scope, go, hasChapter, confetti, escapeHTML }) {
  const copy = config.hud;
  const listeners = [];
  const reached = new Set();
  const renderedStamps = new Set();
  let currentChapter = state.chapter;
  let alive = true;
  let replaying = false;

  const listen = (target, event, handler, options) => {
    listeners.push(scope.on(target, event, handler, options));
  };

  mount.innerHTML = `
    <section class="hud-collection" aria-labelledby="hud-collection-title">
      <h2 id="hud-collection-title" class="sr-only">${escapeHTML(copy.title)}</h2>
      <p class="hud-progress" role="status" aria-live="polite" aria-atomic="true"></p>
      <ol class="hud-paws">${STAMP_IDS.map((id) => `<li data-stamp="${id}"><span class="hud-paw" role="img">${paw}</span></li>`).join('')}</ol>
      <p class="hud-secrets" role="status" aria-live="polite" aria-atomic="true"><span class="hud-secret-label"></span><span class="hud-secret-count"></span></p>
    </section>
    <div class="hud-replay">
      <section id="hud-replay-menu" class="hud-replay-menu" aria-labelledby="hud-replay-title" hidden>
        <div class="hud-replay-heading">
          <h2 id="hud-replay-title">${escapeHTML(copy.replayTitle)}</h2>
          <button class="hud-replay-close" type="button" aria-label="${escapeHTML(copy.close)}"><span aria-hidden="true">×</span></button>
        </div>
        <div class="hud-replay-chapters"></div>
      </section>
      <button class="hud-replay-toggle" type="button" aria-expanded="false" aria-controls="hud-replay-menu"><span class="hud-replay-icon" aria-hidden="true">↻</span>${escapeHTML(copy.replay)}</button>
    </div>`;

  const collection = mount.querySelector('.hud-collection');
  const progress = mount.querySelector('.hud-progress');
  const secretLabel = mount.querySelector('.hud-secret-label');
  const secretCount = mount.querySelector('.hud-secret-count');
  const slots = new Map(STAMP_IDS.map((id) => [id, mount.querySelector(`[data-stamp="${id}"] .hud-paw`)]));
  const replay = mount.querySelector('.hud-replay');
  const toggle = mount.querySelector('.hud-replay-toggle');
  const menu = mount.querySelector('#hud-replay-menu');
  const chapterList = mount.querySelector('.hud-replay-chapters');

  function closeMenu({ restoreFocus = false } = {}) {
    const wasOpen = !menu.hidden;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (wasOpen && restoreFocus && !mount.hidden) toggle.focus({ preventScroll:true });
  }

  function renderReplay() {
    const entries = copy.chapters.filter(({ id }) => id >= 3 && id <= 15 && reached.has(id) && hasChapter(id));
    chapterList.innerHTML = entries.map(({ id, label }) => `
      <button class="hud-replay-chapter" type="button" data-chapter="${id}"${id === currentChapter ? ' aria-current="step"' : ''}${replaying ? ' disabled' : ''}>
        <span>${escapeHTML(label)}</span><span aria-hidden="true">↗</span>
      </button>`).join('');
    toggle.disabled = replaying || !entries.length;
  }

  function refresh({ earnedId } = {}) {
    if (!alive) return;
    const stamps = STAMP_IDS.filter((id) => state.stamps.has(id));
    const newlyEarned = stamps.includes(earnedId) && !renderedStamps.has(earnedId);
    for (const id of STAMP_IDS) {
      const earned = stamps.includes(id);
      const slot = slots.get(id);
      slot.classList.toggle('is-earned', earned);
      slot.setAttribute('aria-label', format(copy.slot, { number:id, status:earned ? copy.earned : copy.unearned }));
    }
    const complete = stamps.length === STAMP_IDS.length;
    const message = complete ? copy.gold : format(copy.progress, { earned:stamps.length, total:STAMP_IDS.length });
    if (progress.textContent !== message) progress.textContent = message;
    collection.classList.toggle('is-complete', complete);
    const secrets = [1, 2, 3, 4, 5].filter((id) => state.eggsFound.has(id)).length;
    const allSecrets = secrets === 5;
    secretLabel.textContent = allSecrets ? config.eggsUi.hudComplete : config.eggsUi.hudLabel;
    secretCount.textContent = format(config.eggsUi.hudCount, {count:secrets});
    secretCount.hidden = allSecrets;
    collection.classList.toggle('has-golden-paw', allSecrets);
    renderedStamps.clear();
    stamps.forEach((id) => renderedStamps.add(id));
    if (newlyEarned && !mount.hidden) {
      const slot = slots.get(earnedId);
      void scope.motion(slot, { scale:.35, opacity:.35, rotate:-12 }, { scale:1, opacity:1, rotate:0 }, { duration:.65, ease:'back.out(2.5)' });
      const bounds = slot.getBoundingClientRect();
      void confetti?.burst({
        particleCount:12,
        origin:{ x:(bounds.left + bounds.width / 2) / innerWidth, y:(bounds.top + bounds.height / 2) / innerHeight },
        spread:55,
        startVelocity:14,
        gravity:.7,
        colors:['#ffd36b', '#9fd0ff', '#e8f3ff'],
      });
    }
  }

  function setChapter(id) {
    if (!alive) return;
    currentChapter = id;
    if (id >= 3 && id <= 15 && hasChapter(id)) reached.add(id);
    if (id >= 14) copy.chapters.forEach(({id:chapterId}) => {
      if (chapterId >= 3 && chapterId <= 13 && hasChapter(chapterId)) reached.add(chapterId);
    });
    closeMenu();
    // The closing candle has its own replay controls. Give its sky and greeting
    // the whole frame; the collection returns when visiting the certificate.
    mount.hidden = id < 3 || id === 15;
    document.body.classList.toggle('has-hud', id >= 3 && id !== 15);
    refresh();
    renderReplay();
  }

  listen(toggle, 'click', () => {
    if (replaying || toggle.disabled) return;
    if (!menu.hidden) { closeMenu(); return; }
    renderReplay();
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    void scope.motion(menu, { opacity:0, y:10 }, { opacity:1, y:0 }, { duration:.2 });
    chapterList.querySelector('button')?.focus({ preventScroll:true });
  });
  listen(mount.querySelector('.hud-replay-close'), 'click', () => closeMenu({ restoreFocus:true }));
  listen(document, 'keydown', (event) => {
    if (event.key !== 'Escape' || menu.hidden) return;
    event.preventDefault();
    closeMenu({ restoreFocus:true });
  });
  listen(document, 'pointerdown', (event) => {
    if (!menu.hidden && !replay.contains(event.target)) closeMenu({ restoreFocus:true });
  });
  listen(chapterList, 'click', async (event) => {
    const button = event.target.closest('button[data-chapter]');
    if (!button || !chapterList.contains(button) || replaying) return;
    const id = Number(button.dataset.chapter);
    if (!reached.has(id) || !hasChapter(id)) return;
    replaying = true;
    closeMenu({ restoreFocus:true });
    renderReplay();
    try { await go(id, { force:true }); }
    finally {
      replaying = false;
      if (alive) renderReplay();
    }
  });

  function destroy() {
    if (!alive) return;
    alive = false;
    listeners.forEach((remove) => remove());
    mount.hidden = true;
    mount.replaceChildren();
    document.body.classList.remove('has-hud');
  }

  scope.add(destroy);
  setChapter(currentChapter);
  return { setChapter, refresh, destroy };
}
