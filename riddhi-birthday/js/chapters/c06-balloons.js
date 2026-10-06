import { createDog } from '../dog.js';

export const id = 6;
let scope;
const colors = ['#9fcaff','#c4a7ee','#f4b5c8','#9cdbcd','#efcf91'];

function balloonArt(index) {
  const color = colors[index % colors.length];
  return `<svg viewBox="0 0 100 160" aria-hidden="true"><defs><radialGradient id="balloon-${index}" cx=".3" cy=".25" r=".8"><stop stop-color="#fff1"/><stop offset="1" stop-color="#0002"/></radialGradient></defs><path d="M50 96 C32 111 67 129 48 156" fill="none" stroke="#bdd1ed80" stroke-width="1.2"/><path d="M50 89 L43 101 Q50 98 57 101 Z" fill="${color}"/><ellipse cx="50" cy="48" rx="37" ry="44" fill="${color}"/><ellipse cx="50" cy="48" rx="37" ry="44" fill="url(#balloon-${index})"/><ellipse cx="34" cy="29" rx="7" ry="13" fill="#fff" opacity=".3" transform="rotate(28 34 29)"/><path d="M68 70 Q64 80 54 83" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".22"/></svg>`;
}

export function init(ctx) {
  scope = ctx.scope;
  const s = scope;
  try {
    const {section,config,escape:e} = ctx;
    const copy = config.balloonsUi;
    const popped = new Set();
    let ready = false;
    let locked = false;
    let current = -1;
    let closing = false;
    let opening = false;
    let pendingDismiss = false;
    let leaving = false;
    let modalScope;
    let restorePage = () => {};
    section.setAttribute('aria-labelledby','balloons-heading');
    section.innerHTML = `<div class="balloons-content"><header class="balloons-header"><p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>${e(copy.eyebrow)}</p><h1 id="balloons-heading">${e(copy.title)}</h1><p>${e(copy.intro)}</p></header><p class="balloons-progress" role="status" aria-live="polite"></p><div class="balloon-lane">${config.balloons.map((_,index) => `<div class="balloon-slot" style="--balloon-column:${index % 5};--balloon-row:${Math.floor(index / 5)};--float-duration:${3 + index % 5 * .5}s;--float-delay:${-index * .37}s"><span class="balloon-empty" aria-hidden="true">✧</span><div class="balloon-float"><button class="balloon-button" type="button" data-balloon="${index}" aria-label="${e(copy.popLabel.replace('{number}',String(index + 1)))}" disabled><span class="balloon-pop">${balloonArt(index)}<span class="balloon-number" aria-hidden="true">${index + 1}</span></span></button></div></div>`).join('')}</div><div class="balloons-guide-mount"></div><div class="balloons-completion glass" hidden><span class="balloons-complete-star" aria-hidden="true">✧</span><h2 tabindex="-1">${e(config.balloonsDone)}</h2><p>${e(copy.completeText)}</p><p class="balloons-secret">${e(copy.hint)}</p>${ctx.hasChapter(7) ? `<button class="primary-button" data-testid="balloons-next" type="button">${e(copy.next)}</button>` : ''}<button class="secondary-button" data-testid="balloons-replay" type="button">${e(copy.replay)}</button><button class="secondary-button" data-testid="balloons-back" type="button">${e(copy.back)}</button></div></div>`;
    const buttons = [...section.querySelectorAll('[data-balloon]')];
    const progress = section.querySelector('.balloons-progress');
    const completion = section.querySelector('.balloons-completion');
    const dog = createDog(ctx,{mount:section.querySelector('.balloons-guide-mount'),variant:9,className:'identity-guide'});
    const overlay = document.createElement('div');
    overlay.className = 'balloon-dialog-backdrop';
    overlay.hidden = true;
    overlay.innerHTML = `<div class="balloon-message-card glass" role="dialog" aria-modal="true" aria-labelledby="balloon-message-title" aria-describedby="balloon-message-text" tabindex="-1"><h2 id="balloon-message-title"></h2><p id="balloon-message-text"></p><p class="balloon-message-hint" hidden>${e(copy.hint)}</p><button class="primary-button" type="button">${e(copy.close)}</button></div>`;
    document.body.append(overlay);
    const dialog = overlay.firstElementChild;
    const close = dialog.querySelector('button');
    s.add(() => { delete section.dataset.modalPending; modalScope?.destroy(); restorePage(); overlay.remove(); });
    s.add(() => section.querySelectorAll('.balloon-float').forEach((node) => { node.style.animationPlayState = 'paused'; }));

    function updateProgress() {
      progress.textContent = copy.progress.replace('{count}',String(popped.size)).replace('{total}',String(buttons.length));
      buttons.forEach((button,index) => { button.disabled = !ready || locked || popped.has(index); });
    }

    function isolateDialog() {
      const background = [...document.body.children].filter((node) => node !== overlay && !['SCRIPT','STYLE'].includes(node.tagName));
      const saved = background.map((node) => [node,node.inert,node.getAttribute('aria-hidden')]);
      const overflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      saved.forEach(([node]) => { node.inert = true; node.setAttribute('aria-hidden','true'); });
      restorePage = () => {
        saved.forEach(([node,inert,hidden]) => {
          node.inert = inert;
          if (hidden === null) node.removeAttribute('aria-hidden'); else node.setAttribute('aria-hidden',hidden);
        });
        document.body.style.overflow = overflow;
        restorePage = () => {};
      };
    }

    async function finish() {
      completion.hidden = false;
      section.dataset.complete = 'true';
      void ctx.confetti.burst({particleCount:ctx.mobile ? 40 : 65,origin:{x:.5,y:.7}});
      if (!await s.motion(completion,{y:15,opacity:0},{y:0,opacity:1},{duration:.45})) return;
      completion.querySelector('h2').focus({preventScroll:true});
      void dog.speak(config.balloonsDone,{mood:'jump',autoDismiss:4000});
    }

    async function dismiss() {
      if (overlay.hidden || closing || !s.alive) return;
      if (opening) { pendingDismiss = true; return; }
      closing = true;
      if (!await s.motion(dialog,{scale:1,opacity:1},{scale:.94,opacity:0},{duration:.18})) return;
      overlay.hidden = true;
      modalScope?.destroy();
      modalScope = null;
      dialog.querySelector('.birthday-dog')?.remove();
      restorePage();
      locked = false;
      closing = false;
      updateProgress();
      if (popped.size === buttons.length) { await finish(); return; }
      const next = buttons.find((button,index) => index > current && !popped.has(index)) ?? buttons.find((button,index) => !popped.has(index));
      next?.focus({preventScroll:true});
    }

    async function pop(index) {
      if (!ready || locked || popped.has(index) || !s.alive) return;
      locked = true;
      // Reserve the dialog while the balloon pops so a sky tap cannot open a
      // second modal during this short transition.
      section.dataset.modalPending = 'true';
      popped.add(index); // Claim immediately: rapid taps can never pop it twice.
      current = index;
      updateProgress();
      const button = buttons[index];
      const art = button.querySelector('.balloon-pop');
      if (!await s.motion(art,{scale:1,opacity:1},{scale:1.15,opacity:1},{duration:.15,ease:'back.out(1.7)'})) return;
      const rect = button.getBoundingClientRect();
      ctx.audio.playSfx('pop');
      void ctx.confetti.burst({particleCount:12,colors:[colors[index % colors.length]],origin:{x:(rect.left + rect.width / 2) / innerWidth,y:(rect.top + rect.height * .3) / innerHeight},spread:85,startVelocity:18});
      if (!await s.motion(art,{scale:1.15,opacity:1},{scale:.15,opacity:0},{duration:.14})) return;
      button.hidden = true;
      button.closest('.balloon-slot').classList.add('is-popped');
      dialog.querySelector('h2').textContent = copy.messageTitle.replace('{number}',String(index + 1));
      dialog.querySelector('#balloon-message-text').textContent = config.balloons[index];
      dialog.querySelector('.balloon-message-hint').hidden = index !== 9;
      modalScope = ctx.createScope();
      createDog({...ctx,scope:modalScope},{mount:dialog,variant:index + 1,className:'dog-top',mood:'party-hat'});
      opening = true;
      pendingDismiss = false;
      overlay.hidden = false;
      delete section.dataset.modalPending;
      dialog.style.opacity = '0';
      close.focus({preventScroll:true});
      isolateDialog();
      if (!await s.motion(dialog,{scale:.6,opacity:0},{scale:1,opacity:1},{duration:.4,ease:'back.out(1.7)'})) return;
      opening = false;
      if (pendingDismiss) await dismiss();
    }

    function caught(error) { if (s.alive) ctx.fail(error); }
    buttons.forEach((button,index) => s.on(button,'click',() => { void pop(index).catch(caught); }));
    s.on(close,'click',() => { void dismiss().catch(caught); });
    s.on(overlay,'click',(event) => {
      if (event.target === overlay || (dialog.contains(event.target) && !event.target.closest('.birthday-dog'))) void dismiss().catch(caught);
    });
    s.on(document,'keydown',(event) => {
      if (overlay.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); void dismiss().catch(caught); }
      if (event.key === 'Tab') {
        const controls = [...dialog.querySelectorAll('button, [tabindex]')]
          .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
        const first = controls[0] ?? close;
        const last = controls[controls.length - 1] ?? close;
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    });
    // Focus containment also supports browsers predating the inert attribute.
    s.on(document,'focusin',(event) => { if (!overlay.hidden && !dialog.contains(event.target)) close.focus(); });
    const leave = (chapter,force = false) => {
      if (leaving || !s.alive) return;
      leaving = true;
      void ctx.go(chapter,{force});
    };
    s.on(section.querySelector('[data-testid="balloons-replay"]'),'click',() => leave(6,true));
    s.on(section.querySelector('[data-testid="balloons-back"]'),'click',() => leave(5));
    const next = section.querySelector('[data-testid="balloons-next"]');
    if (next) s.on(next,'click',() => leave(7));
    updateProgress();
    void (async () => {
      if (await ctx.entered === false || !s.alive) return;
      ready = true;
      updateProgress();
      void dog.speak(copy.dogIntro,{autoDismiss:5000});
    })().catch(caught);
  } catch (error) { if (s.alive) ctx.fail(error); }
}

export function destroy() { scope?.destroy(); scope = null; }
