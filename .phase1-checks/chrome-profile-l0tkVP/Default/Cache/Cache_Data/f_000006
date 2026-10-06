import { mountPhoto } from '../photos.js';
import { activeModal } from '../modal.js';
import { createMatchRound, createCatcherRound, wheelRotationFor, wheelSegmentAt } from '../games.js';

export const id = 9;
let scope;

export function init(ctx) {
  scope = ctx.scope;
  const s = scope;
  try {
    const { section, config, escape: e } = ctx;
    const copy = config.gamesUi;
    const played = new Set();
    const skipped = new Set();
    let gameScope = null;
    let currentGame = null;
    let ready = false;
    let leaving = false;
    let earned = ctx.state.stamps.has(6);
    section.setAttribute('aria-labelledby', 'games-heading');
    section.innerHTML = `<div class="games-content"><header class="games-header"><p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>${e(copy.eyebrow)}</p><h1 id="games-heading">${e(copy.title)}</h1><p>${e(copy.intro)}</p></header><div class="games-menu">${copy.tiles.map((tile, index) => `<button class="game-tile glass" data-game="${e(tile.id)}" type="button" disabled style="--game-accent:${['#b8dafa', '#e2cba2', '#e2c5e8', '#badccf'][index]}"><span class="game-tile-icon" aria-hidden="true">${e(tile.icon)}</span><span class="game-tile-title">${e(tile.title)}</span><span class="game-tile-description">${e(tile.description)}</span><span class="game-tile-detail">${e(tile.detail)}</span><span class="game-tile-action">${e(copy.play)} <span aria-hidden="true">↗</span></span></button>`).join('')}</div><div class="game-host" hidden></div><div class="games-footer"><p class="games-stamp" role="status" aria-live="polite"${earned ? '' : ' hidden'}>${e(copy.stamp)}</p>${ctx.hasChapter(10) ? `<button class="primary-button" data-arcade-action="next" type="button"${earned ? '' : ' hidden'}>${e(copy.next)}</button>` : ''}<button class="secondary-button" data-arcade-action="skip-all" type="button" disabled${earned ? ' hidden' : ''}>${e(copy.skipAll)}</button>${ctx.hasChapter(8) ? `<button class="secondary-button" data-arcade-action="back" type="button" disabled>${e(copy.back)}</button>` : ''}</div></div>`;
    const menu = section.querySelector('.games-menu');
    const host = section.querySelector('.game-host');
    const footer = section.querySelector('.games-footer');
    const stamp = section.querySelector('.games-stamp');
    s.add(() => { gameScope?.destroy(); gameScope = null; });

    function caught(error) { if (s.alive) ctx.fail(error); }
    function award() {
      ctx.awardStamp(6);
      earned = true;
      stamp.hidden = false;
      section.querySelector('[data-arcade-action="skip-all"]').hidden = true;
      const next = section.querySelector('.games-footer [data-arcade-action="next"]');
      if (next) next.hidden = false;
    }
    function returnMenu() {
      const lastGame = currentGame;
      gameScope?.destroy();
      gameScope = null;
      currentGame = null;
      host.hidden = true;
      host.innerHTML = '';
      menu.hidden = false;
      footer.hidden = false;
      for (const tile of menu.querySelectorAll('[data-game]')) {
        const status = tile.querySelector('.game-tile-action');
        status.textContent = played.has(tile.dataset.game) ? copy.finished : skipped.has(tile.dataset.game) ? copy.skipped : `${copy.play} ↗`;
        tile.classList.toggle('is-played', played.has(tile.dataset.game));
      }
      if (lastGame) menu.querySelector(`[data-game="${lastGame}"]`)?.focus({ preventScroll: true });
    }
    function leave() {
      if (leaving || !s.alive || !earned) return;
      leaving = true;
      gameScope?.destroy();
      void ctx.go(10);
    }
    function finishGame(message, { detail = '', voucherIndex = null } = {}) {
      if (!gameScope?.alive || !s.alive) return;
      const game = currentGame;
      played.add(game);
      skipped.delete(game);
      award();
      gameScope.destroy();
      gameScope = null;
      const tile = copy.tiles.find(item => item.id === game);
      host.innerHTML = `<div class="game-result glass"><span class="game-result-icon" aria-hidden="true">${e(tile.icon)}</span><p class="eyebrow">${e(voucherIndex === null ? copy.resultTitle : copy.wheelPrize)}</p><h2 tabindex="-1">${e(message)}</h2>${detail ? `<p>${e(detail)}</p>` : ''}<p class="game-result-stamp">${e(copy.stamp)}</p>${voucherIndex !== null ? `<button class="primary-button" data-arcade-action="voucher" data-voucher="${voucherIndex}" type="button">${e(copy.wheelOpen)}</button>` : ctx.hasChapter(10) ? `<button class="primary-button" data-arcade-action="next" type="button">${e(copy.next)}</button>` : ''}<button class="secondary-button" data-game="${e(game)}" type="button">${e(copy.again)}</button><button class="secondary-button" data-arcade-action="menu" type="button">${e(copy.menu)}</button></div>`;
      host.querySelector('h2').focus({ preventScroll: true });
      void ctx.confetti.burst({ particleCount: ctx.mobile ? 32 : 52, origin: { x: .5, y: .55 }, colors: ['#b8dafa', '#e2cba2', '#e2c5e8'] });
      ctx.audio.playSfx('match');
    }
    function startGame(game) {
      if (!ready || leaving || !s.alive) return;
      const tile = copy.tiles.find(item => item.id === game);
      if (!tile) return;
      gameScope?.destroy();
      gameScope = ctx.createScope();
      currentGame = game;
      menu.hidden = true;
      footer.hidden = true;
      host.hidden = false;
      host.innerHTML = `<div class="game-panel glass"><div class="game-toolbar"><span aria-hidden="true">${e(tile.icon)}</span><h2 tabindex="-1">${e(tile.title)}</h2><button class="secondary-button" data-arcade-action="skip" type="button">${e(copy.skip)}</button></div><div class="game-body"></div></div>`;
      const child = { ...ctx, scope: gameScope };
      const body = host.querySelector('.game-body');
      const launch = { match: playMatch, catcher: playCatcher, quiz: playQuiz, wheel: playWheel }[game];
      launch(child, body, finishGame, caught);
      host.querySelector('h2').focus({ preventScroll: true });
      host.scrollIntoView({ block: 'nearest', behavior: ctx.reducedMotion ? 'auto' : 'smooth' });
    }
    s.on(section, 'click', event => {
      if (!ready || leaving || !s.alive) return;
      const gameButton = event.target.closest('[data-game]');
      if (gameButton) { try { startGame(gameButton.dataset.game); } catch (error) { caught(error); } return; }
      const button = event.target.closest('[data-arcade-action]');
      if (!button) return;
      switch (button.dataset.arcadeAction) {
        case 'skip':
          if (currentGame && !played.has(currentGame)) skipped.add(currentGame);
          if (skipped.size + played.size === copy.tiles.length) award();
          returnMenu();
          break;
        case 'skip-all':
          copy.tiles.forEach(tile => { if (!played.has(tile.id)) skipped.add(tile.id); });
          award();
          stamp.textContent = copy.skipAllDone;
          returnMenu();
          section.querySelector('.games-footer [data-arcade-action="next"]')?.focus({ preventScroll: true });
          break;
        case 'menu': returnMenu(); break;
        case 'next': leave(); break;
        case 'back': leaving = true; void ctx.go(8); break;
        case 'voucher':
          leaving = true;
          if (ctx.openVoucher) void ctx.openVoucher(Number(button.dataset.voucher));
          else void ctx.go(10);
          break;
      }
    });
    void (async () => {
      if (await ctx.entered === false || !s.alive) return;
      ready = true;
      section.querySelectorAll('button:disabled').forEach(button => { button.disabled = false; });
    })().catch(caught);
  } catch (error) { if (s.alive) ctx.fail(error); }
}

function playMatch(ctx, mount, finish, caught) {
  const { scope: s, config, escape: e } = ctx;
  const copy = config.gamesUi;
  const round = createMatchRound();
  mount.innerHTML = `<p class="game-hint">${e(copy.matchHint)}</p><div class="match-grid">${round.cards.map((card, index) => `<button class="match-card" type="button" data-card="${index}" aria-label="${e(copy.matchCard.replace('{number}', index + 1))}" aria-pressed="false"><span class="match-rotator"><span class="match-face match-back" aria-hidden="true"><span>🐾</span></span><span class="match-face match-front" aria-hidden="true"><span class="match-photo" data-photo="${index}"></span><span class="match-symbol">${e(copy.pairSymbols[card.pair])}</span></span></span></button>`).join('')}</div><p class="match-progress" role="status" aria-live="polite">${e(copy.matchProgress.replace('{count}', 0))}</p>`;
  const cards = [...mount.querySelectorAll('.match-card')];
  const status = mount.querySelector('.match-progress');
  cards.forEach((card, index) => {
    const pair = round.cards[index].pair;
    mountPhoto(ctx, { mount: card.querySelector('.match-photo'), src: `others/photos/extra-${String(pair + 1).padStart(2, '0')}.webp`, alt: '', label: '' });
    s.on(card, 'click', () => { void turn(index).catch(caught); });
  });
  async function flip(index, open) {
    const card = cards[index];
    card.setAttribute('aria-pressed', String(open));
    card.setAttribute('aria-label', open ? copy.matchRevealed.replace('{number}', index + 1).replace('{name}', copy.pairNames[round.cards[index].pair]) : copy.matchCard.replace('{number}', index + 1));
    return s.motion(card.querySelector('.match-rotator'), { rotationY: open ? 0 : 180 }, { rotationY: open ? 180 : 0 }, { duration: .35 });
  }
  async function turn(index) {
    if (!round.choose(index) || !s.alive) return;
    ctx.audio.playSfx('pop');
    const animation = flip(index, true);
    if (!round.comparing) { await animation; return; }
    // Input stays locked throughout the reveal, comparison, and return motion.
    const restoreCardFocus = cards.includes(document.activeElement);
    cards.forEach(card => { card.disabled = true; });
    // The comparison window starts with the second tap, including its flip.
    if (!(await Promise.all([animation, s.wait(700)])).every(Boolean)) return;
    const chosen = round.selected;
    const matched = round.cards[chosen[0]].pair === round.cards[chosen[1]].pair;
    if (!matched) {
      status.textContent = copy.matchMiss;
      if (!(await Promise.all(chosen.map(item => flip(item, false)))).every(Boolean)) return;
    }
    const result = round.resolve();
    const count = round.matched.size / 2;
    status.textContent = result.match ? copy.matchFound.replace('{count}', count) : copy.matchProgress.replace('{count}', count);
    cards.forEach((card, item) => {
      const done = round.matched.has(item);
      card.disabled = done;
      card.classList.toggle('is-matched', done);
    });
    if (restoreCardFocus && document.activeElement === document.body && !activeModal()) {
      const next = result.match ? cards.find(card => !card.disabled) : cards[index];
      next?.focus({preventScroll:true});
    }
    if (result.match) ctx.audio.playSfx('match');
    if (result.complete && await s.wait(450)) finish(copy.matchWin);
  }
}

function playCatcher(ctx, mount, finish, caught) {
  const { scope: s, config, escape: e } = ctx;
  const copy = config.gamesUi;
  const round = createCatcherRound();
  let running = false;
  let frame = 0;
  let lastTime = null;
  let width = 480;
  let height = 370;
  let direction = 0;
  let heldPointer = null;
  let lastSecond = 30;
  const popups = [];
  mount.innerHTML = `<p class="game-hint">${e(copy.catcherHint)}</p><p class="catcher-legend">${e(copy.catcherLegend)}</p><div class="catcher-scoreboard"><span class="catcher-score">${e(copy.catcherScore.replace('{score}', 0))}</span><span class="catcher-time">${e(copy.catcherTime.replace('{seconds}', 30))}</span></div><div class="catcher-arena"><canvas tabindex="0" role="img" aria-label="${e(copy.catcherCanvas)}"></canvas><div class="catcher-overlay"><span aria-hidden="true">🐶</span><p>${e(copy.catcherReady)}</p></div></div><div class="catcher-controls"><button class="catcher-arrow" type="button" data-direction="-1" aria-label="${e(copy.catcherLeft)}">←</button><button class="primary-button catcher-toggle" type="button">${e(copy.catcherStart)}</button><button class="catcher-arrow" type="button" data-direction="1" aria-label="${e(copy.catcherRight)}">→</button></div><p class="catcher-announcement sr-only" role="status" aria-live="polite">${e(copy.catcherReady)}</p>`;
  const canvas = mount.querySelector('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The treat patrol canvas is unavailable.');
  const overlay = mount.querySelector('.catcher-overlay');
  const toggle = mount.querySelector('.catcher-toggle');
  const time = mount.querySelector('.catcher-time');
  const score = mount.querySelector('.catcher-score');
  const announcement = mount.querySelector('.catcher-announcement');
  const dogImage = ctx.preloader.getImage('dogs/dog-01.png');

  function draw() {
    context.clearRect(0, 0, width, height);
    const state = round.state;
    context.strokeStyle = '#9fc8eb30';
    context.lineWidth = 1;
    context.setLineDash([4, 8]);
    context.beginPath(); context.moveTo(14, height * .935); context.lineTo(width - 14, height * .935); context.stroke();
    context.setLineDash([]);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `${Math.max(25, width * .065)}px "Segoe UI Emoji", sans-serif`;
    for (const item of state.items) context.fillText({ bone: '🦴', heart: '💙', broccoli: '🥦' }[item.kind], item.x * width, item.y * height);
    const dogSize = Math.max(44, width * .17);
    if (dogImage?.naturalWidth) {
      const ratio = Math.min(dogSize / dogImage.naturalWidth, dogSize / dogImage.naturalHeight);
      const dw = dogImage.naturalWidth * ratio;
      const dh = dogImage.naturalHeight * ratio;
      context.drawImage(dogImage, state.dogX * width - dw / 2, height * .86 - dh / 2, dw, dh);
    } else {
      context.font = `${dogSize}px "Segoe UI Emoji", sans-serif`;
      context.fillText('🐶', state.dogX * width, height * .86);
    }
    context.font = `800 17px Nunito, sans-serif`;
    for (const popup of popups) {
      context.globalAlpha = Math.max(0, 1 - popup.age / .9);
      context.fillStyle = popup.positive ? '#ffe0a4' : '#f4b5c2';
      context.fillText(popup.text, popup.x * width, Math.max(28, popup.y * height - popup.age * 40));
    }
    context.globalAlpha = 1;
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    const ratio = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }
  function stop() {
    running = false;
    direction = 0;
    lastTime = null;
    cancelAnimationFrame(frame);
    frame = 0;
    heldPointer = null;
  }
  function pause() {
    if (!running) return;
    stop();
    overlay.hidden = false;
    overlay.querySelector('p').textContent = copy.catcherPaused;
    toggle.textContent = copy.catcherResume;
    announcement.textContent = copy.catcherPaused;
  }
  function tick(now) {
    frame = 0;
    if (!s.alive || !running || document.hidden) return;
    if (activeModal()) { pause(); return; }
    const delta = lastTime === null ? 0 : Math.max(0, (now - lastTime) / 1000);
    lastTime = now;
    if (direction) round.moveDog(round.state.dogX + direction * delta * .8);
    const events = round.step(delta);
    for (const event of events) {
      const combo = event.combo > 1 && event.combo % 3 === 0;
      popups.push({ x: Math.max(.17, Math.min(.83, event.x)), y: .77, text: combo ? copy.catcherCombo.replace('{count}', event.combo) : `${event.value > 0 ? '+' : ''}${event.value}`, positive: event.value > 0, age: 0 });
      ctx.audio.playSfx(event.value > 0 ? 'pop' : 'thud');
      if (combo) announcement.textContent = copy.catcherCombo.replace('{count}', event.combo);
    }
    for (let index = popups.length - 1; index >= 0; index -= 1) { popups[index].age += delta; if (popups[index].age > .9) popups.splice(index, 1); }
    if (events.length) score.textContent = copy.catcherScore.replace('{score}', round.state.score);
    const seconds = Math.ceil(round.state.remaining);
    if (seconds !== lastSecond) {
      lastSecond = seconds;
      time.textContent = copy.catcherTime.replace('{seconds}', seconds);
      if (seconds % 10 === 0 || seconds === 5) announcement.textContent = `${time.textContent}. ${score.textContent}.`;
    }
    draw();
    if (round.state.finished) { stop(); finish(copy.catcherEnd.replace('{score}', round.state.score)); return; }
    frame = requestAnimationFrame(guardedTick);
  }
  function guardedTick(now) { try { tick(now); } catch (error) { stop(); caught(error); } }
  function start() {
    if (!s.alive || round.state.finished || document.hidden) return;
    running = true;
    lastTime = null;
    overlay.hidden = true;
    toggle.textContent = copy.catcherPause;
    announcement.textContent = copy.catcherRunning;
    if (!frame) frame = requestAnimationFrame(guardedTick);
    canvas.focus({ preventScroll: true });
  }
  function follow(event) {
    const rect = canvas.getBoundingClientRect();
    round.moveDog((event.clientX - rect.left) / Math.max(1, rect.width));
    draw();
  }
  s.on(toggle, 'click', () => { if (running) pause(); else start(); });
  s.on(canvas, 'pointerdown', event => {
    if (!running || !event.isPrimary || event.button !== 0) return;
    heldPointer = event.pointerId;
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Pointer tracking still works inside the arena. */ }
    follow(event);
  });
  s.on(canvas, 'pointermove', event => { if (running && (event.pointerType === 'mouse' || heldPointer === event.pointerId)) follow(event); });
  s.on(canvas, 'pointerup', event => { if (heldPointer === event.pointerId) heldPointer = null; });
  s.on(canvas, 'pointercancel', () => { heldPointer = null; });
  s.on(canvas, 'lostpointercapture', () => { heldPointer = null; });
  s.on(mount, 'keydown', event => {
    if (!running || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    direction = event.key === 'ArrowLeft' ? -1 : 1;
  });
  s.on(window, 'keyup', event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) direction = 0; });
  for (const button of mount.querySelectorAll('[data-direction]')) {
    s.on(button, 'click', () => { if (running) { round.moveDog(round.state.dogX + Number(button.dataset.direction) * .13); draw(); } });
    s.on(button, 'pointerdown', event => { if (running && event.isPrimary) direction = Number(button.dataset.direction); });
  }
  s.on(window, 'pointerup', () => { direction = 0; });
  s.on(window, 'pointercancel', () => { direction = 0; });
  s.on(window, 'blur', pause);
  s.on(document, 'visibilitychange', () => { if (document.hidden) pause(); });
  s.on(window, 'resize', resize);
  if (typeof ResizeObserver === 'function') { const observer = new ResizeObserver(resize); observer.observe(canvas); s.add(() => observer.disconnect()); }
  s.add(stop);
  resize();
}

function playQuiz(ctx, mount, finish, caught) {
  const { scope: s, config, escape: e } = ctx;
  const copy = config.gamesUi;
  let index = 0;
  let remembered = 0;
  let answered = false;
  mount.innerHTML = `<p class="quiz-progress"></p><div class="quiz-question"><h3 tabindex="-1"></h3><div class="quiz-options"></div></div><p class="quiz-feedback" role="status" aria-live="polite"></p><button class="primary-button quiz-next" type="button" hidden></button>`;
  const progress = mount.querySelector('.quiz-progress');
  const question = mount.querySelector('h3');
  const options = mount.querySelector('.quiz-options');
  const feedback = mount.querySelector('.quiz-feedback');
  const next = mount.querySelector('.quiz-next');
  function render() {
    answered = false;
    const item = config.quiz[index];
    progress.textContent = copy.quizProgress.replace('{number}', index + 1).replace('{total}', config.quiz.length);
    question.textContent = item.q;
    options.innerHTML = item.o.map((text, option) => `<button class="quiz-option" data-option="${option}" type="button"><span aria-hidden="true">${String.fromCharCode(65 + option)}</span>${e(text)}</button>`).join('');
    feedback.textContent = '';
    next.hidden = true;
    next.disabled = false;
    next.textContent = index === config.quiz.length - 1 ? copy.quizFinish : copy.quizNext;
    if (index) question.focus({ preventScroll: true });
  }
  async function answer(button) {
    if (answered || !s.alive) return;
    answered = true;
    const correct = Number(button.dataset.option) === config.quiz[index].c;
    if (correct) remembered += 1;
    options.querySelectorAll('button').forEach(item => { item.disabled = true; });
    button.classList.add(correct ? 'is-correct' : 'is-close');
    feedback.textContent = correct ? copy.quizCorrect : copy.quizClose;
    if (correct) {
      const rect = button.getBoundingClientRect();
      void ctx.confetti.burst({ particleCount: ctx.mobile ? 12 : 20, origin: { x: (rect.left + rect.width / 2) / innerWidth, y: (rect.top + rect.height / 2) / innerHeight }, colors: ['#a4e6bf', '#cdf6dc'] });
      ctx.audio.playSfx('sparkle');
      await s.motion(button, { scale: .96 }, { scale: 1 }, { duration: .3 });
    } else {
      ctx.audio.playSfx('pop');
      for (const [from, to] of [[0, -6], [-6, 6], [6, -3], [-3, 0]]) {
        if (!await s.motion(button, { x: from }, { x: to }, { duration: .07 })) return;
      }
    }
    if (!s.alive) return;
    next.hidden = false;
    next.focus({ preventScroll: true });
  }
  s.on(options, 'click', event => { const button = event.target.closest('[data-option]'); if (button) void answer(button).catch(caught); });
  s.on(next, 'click', () => {
    if (!answered || next.disabled) return;
    next.disabled = true;
    index += 1;
    if (index >= config.quiz.length) finish(copy.quizWin, { detail: copy.quizRemembered.replace('{count}', remembered).replace('{total}', config.quiz.length) });
    else render();
  });
  render();
}

function playWheel(ctx, mount, finish, caught) {
  const { scope: s, config, escape: e } = ctx;
  const copy = config.gamesUi;
  const slots = copy.wheelSlots;
  const colors = ['#b8d5ee', '#e4c7d9', '#c7c4e8', '#e7d4a8', '#b9d6ce', '#bbcae4', '#d5c5e4', '#d9d5b9'];
  let rotation = 0;
  let spinning = false;
  let pointer = null;
  let suppressClickUntil = 0;
  function point(angle, radius = 150) { const radians = (angle - 90) * Math.PI / 180; return [170 + Math.cos(radians) * radius, 170 + Math.sin(radians) * radius]; }
  const wedges = slots.map((voucher, index) => {
    const from = point(index * 45);
    const to = point((index + 1) * 45);
    const [x, y] = point(index * 45 + 22.5, 101);
    const words = copy.wheelNames[voucher].split(' ');
    const lines = words.length > 1 ? [words.slice(0,-1).join(' '), words[words.length - 1]] : words;
    return `<g><path d="M170 170 L${from.join(' ')} A150 150 0 0 1 ${to.join(' ')} Z" fill="${colors[index]}" stroke="#182640" stroke-width="2"/><text x="${x}" y="${y}" transform="rotate(${index * 45 + 22.5},${x},${y})" text-anchor="middle" dominant-baseline="middle">${lines.map((line, lineIndex) => `<tspan x="${x}" dy="${lineIndex ? '1.05em' : lines.length > 1 ? '-.45em' : '0'}">${e(line)}</tspan>`).join('')}</text></g>`;
  }).join('');
  mount.innerHTML = `<p class="game-hint">${e(copy.wheelHint)}</p><div class="birthday-wheel"><span class="wheel-pointer" aria-hidden="true">▼</span><svg class="wheel-disc" viewBox="0 0 340 340" role="img" aria-label="${e(copy.wheelLabel)}"><circle cx="170" cy="170" r="164" fill="#142542" stroke="#dbc88b" stroke-width="2"/>${wedges}<circle cx="170" cy="170" r="35" fill="#182b48" stroke="#e4cf9e" stroke-width="2"/><text class="wheel-centre" x="170" y="175" text-anchor="middle" dominant-baseline="middle" aria-hidden="true">🐾</text></svg></div><p class="wheel-status" role="status" aria-live="polite"></p><button class="primary-button wheel-spin" type="button">${e(copy.wheelSpin)}</button>`;
  const wheel = mount.querySelector('.wheel-disc');
  const hit = mount.querySelector('.birthday-wheel');
  const spinButton = mount.querySelector('.wheel-spin');
  const status = mount.querySelector('.wheel-status');
  function sizeLabels() {
    const width = wheel.getBoundingClientRect().width;
    if (!width) return;
    // SVG viewBox scaling must not shrink labels below 16 actual CSS pixels.
    const fontSize = `${Math.max(16, 16 * 340 / width)}px`;
    wheel.querySelectorAll('g text').forEach(text => { text.style.fontSize = fontSize; });
  }
  s.on(window, 'resize', sizeLabels);
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(sizeLabels);
    observer.observe(wheel);
    s.add(() => observer.disconnect());
  }
  sizeLabels();
  async function spin() {
    if (spinning || !s.alive) return;
    spinning = true;
    pointer = null;
    spinButton.disabled = true;
    status.textContent = copy.wheelSpinning;
    const chosen = Math.floor(Math.random() * slots.length);
    const target = wheelRotationFor(chosen, rotation, 5 + Math.floor(Math.random() * 3));
    const started = performance.now();
    let lastTick = wheelSegmentAt(rotation);
    const stopTicks = s.every(() => {
      if (document.hidden) return;
      const progress = Math.min(1, (performance.now() - started) / (ctx.reducedMotion ? 60 : 4000));
      const estimated = rotation + (target - rotation) * (1 - (1 - progress) ** 5);
      const tick = wheelSegmentAt(estimated);
      if (tick !== lastTick) { lastTick = tick; ctx.audio.playSfx('tick'); }
    }, 70);
    const landed = await s.motion(wheel, { rotation }, { rotation: target }, { duration: 4, ease: 'power4.out' });
    stopTicks();
    if (!landed || !s.alive) return;
    rotation = target;
    const voucherIndex = slots[wheelSegmentAt(rotation)];
    status.textContent = config.vouchers[voucherIndex];
    if (!await s.wait(ctx.reducedMotion ? 100 : 500)) return;
    finish(config.vouchers[voucherIndex], { voucherIndex });
  }
  s.on(spinButton, 'click', () => { void spin().catch(caught); });
  s.on(hit, 'pointerdown', event => {
    if (spinning || !event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), captured: false };
  }, { passive: true });
  s.on(window, 'pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!pointer.captured) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.2) { pointer = null; return; }
      if (Math.abs(dx) < 12) return;
      pointer.captured = true;
      try { hit.setPointerCapture(event.pointerId); } catch { /* Window events finish the flick. */ }
    }
    if (event.cancelable) event.preventDefault();
  }, { passive: false });
  s.on(window, 'pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const previous = pointer;
    pointer = null;
    const distance = Math.hypot(event.clientX - previous.x, event.clientY - previous.y);
    const velocity = distance / Math.max(1, performance.now() - previous.time);
    if (previous.captured && (distance > 45 || velocity > .25)) {
      suppressClickUntil = performance.now() + 500;
      void spin().catch(caught);
    }
  }, { passive: true });
  s.on(hit, 'click', event => { if (performance.now() < suppressClickUntil) event.preventDefault(); });
  s.on(window, 'pointercancel', () => { pointer = null; });
  s.on(window, 'blur', () => { pointer = null; });
  s.add(() => { pointer = null; });
}

export function destroy() { scope?.destroy(); scope = null; }
