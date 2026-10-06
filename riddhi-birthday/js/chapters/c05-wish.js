import { createDog } from '../dog.js';
import { setWishSent } from '../state.js';

export const id = 5;
let scope;

export function init(ctx) {
  scope = ctx.scope;
  const s = scope;
  try {
    const {section, config, escape:e} = ctx;
    const copy = config.wishUi;
    let accepted = Boolean(ctx.state.wishSent || ctx.wishes.get('birthday'));
    let busy = true;
    let leaving = false;
    section.setAttribute('aria-labelledby', 'wish-heading');
    section.innerHTML = `<div class="wish-content"><header class="wish-header"><p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>${e(copy.eyebrow)}</p><h1 id="wish-heading">${e(copy.title)}</h1><p>${e(copy.intro)}</p></header><div class="wish-orbit" aria-hidden="true"><span class="wish-orbit-ring"></span><span class="wish-orbit-star">✧</span><i></i><i></i></div><div class="wish-card glass"><form class="wish-form" novalidate><div class="wish-writing"><label for="birthday-wish">${e(copy.label)}</label><p class="wish-prompt">${e(config.wish.prompt)}</p><textarea id="birthday-wish" name="wish" maxlength="280" rows="4" placeholder="${e(copy.placeholder)}" aria-describedby="wish-counter wish-note wish-validation" required disabled></textarea><div class="wish-field-meta"><span id="wish-counter">${e(copy.count.replace('{count}','0'))}</span><span aria-hidden="true">✦</span></div><p id="wish-validation" class="wish-validation" role="status"></p><button class="primary-button" data-testid="wish-send" type="submit" disabled>${e(config.wish.button)}</button></div><p id="wish-note" class="wish-note">${e(config.wish.note)}</p><button class="secondary-button wish-skip" type="button" disabled>${e(copy.skip)}</button></form><div class="wish-result" hidden><span class="wish-keepsake" role="img" aria-label="${e(copy.starLabel)}">✧</span><h2 tabindex="-1">${e(copy.completeTitle)}</h2><p class="wish-result-copy">${e(copy.completeText)}</p><p class="wish-delivery" role="status" aria-live="polite"></p><p class="wish-stamp">${e(copy.stamp)}</p><button class="primary-button" data-testid="wish-next" type="button">${e(copy.next)}</button></div></div></div>`;
    const form = section.querySelector('form');
    const writing = section.querySelector('.wish-writing');
    const textarea = section.querySelector('textarea');
    const send = section.querySelector('[data-testid="wish-send"]');
    const skip = section.querySelector('.wish-skip');
    const result = section.querySelector('.wish-result');
    const validation = section.querySelector('#wish-validation');
    const dog = createDog(ctx, {mount:section.querySelector('.wish-card'),variant:8,className:'dog-top wish-guide'});
    ctx.sky.setWishMode(true);
    s.add(() => {
      ctx.sky.setWishMode(false);
      if (accepted) ctx.sky.addWishStar('birthday');
    });

    function updateDelivery() {
      if (!s.alive) return;
      const receipt = ctx.wishes.get('birthday');
      const message = !receipt ? copy.completeText : receipt.status === 'sent' ? config.wish.thanks
        : receipt.status === 'sending' ? copy.sending : receipt.durable ? copy.queued : copy.memory;
      section.querySelector('.wish-delivery').textContent = message;
      section.dataset.wishDelivery = receipt?.status ?? 'keepsake';
    }
    s.add(ctx.wishes.subscribe(updateDelivery));

    function showResult() {
      form.hidden = true;
      result.hidden = false;
      section.dataset.complete = 'true';
      ctx.sky.addWishStar('birthday');
      ctx.awardStamp(3);
      updateDelivery();
    }

    async function flyWish() {
      const bounds = writing.getBoundingClientRect();
      const start = {x:bounds.left + bounds.width / 2,y:bounds.top + Math.min(bounds.height / 2,180)};
      const orb = document.createElement('span');
      orb.className = 'wish-flying-orb';
      orb.setAttribute('aria-hidden','true');
      orb.style.left = `${start.x - 14}px`;
      orb.style.top = `${start.y - 14}px`;
      document.body.append(orb);
      s.add(() => orb.remove());
      ctx.audio.playSfx('sparkle');
      if (!(await Promise.all([
        s.motion(writing, {scale:1,opacity:1}, {scale:.15,opacity:0}, {duration:.55}),
        s.motion(orb, {scale:0,opacity:0}, {scale:1,opacity:1}, {duration:.55}),
      ])).every(Boolean)) return false;
      const destination = ctx.sky.getWishStarPosition('birthday');
      const end = {x:destination.x - start.x,y:destination.y - start.y};
      if (ctx.reducedMotion) {
        if (!await s.motion(orb, {opacity:1}, {opacity:0}, {duration:.15})) return false;
      } else {
        let last = {x:0,y:0};
        const sparks = [];
        for (let step = 1; step <= 10; step += 1) {
          const t = step / 10;
          const next = {x:2 * (1-t) * t * (end.x - 90) + t*t*end.x,y:2 * (1-t) * t * (end.y * .3) + t*t*end.y};
          const spark = document.createElement('i');
          spark.className = 'wish-trail-spark';
          spark.setAttribute('aria-hidden','true');
          spark.style.left = `${start.x + last.x}px`;
          spark.style.top = `${start.y + last.y}px`;
          document.body.append(spark);
          s.add(() => spark.remove());
          sparks.push(s.motion(spark, {scale:1,opacity:.8,y:0}, {scale:0,opacity:0,y:14}, {duration:.5}).then(() => spark.remove()));
          if (!await s.motion(orb, {...last,scale:1,opacity:1}, {...next,scale:1,opacity:1}, {duration:.12,ease:'none'})) return false;
          last = next;
        }
        ctx.sky.addWishStar('birthday');
        if (!await s.motion(orb, {...last,scale:1,opacity:1}, {...last,scale:.15,opacity:0}, {duration:.25})) return false;
        await Promise.all(sparks);
      }
      orb.remove();
      return s.alive;
    }

    async function submit(event) {
      event.preventDefault();
      if (busy || accepted || !s.alive) return;
      if (!textarea.value.trim()) {
        validation.textContent = copy.empty;
        textarea.setAttribute('aria-invalid','true');
        textarea.focus();
        return;
      }
      const receipt = ctx.wishes.submit(textarea.value);
      if (!receipt) return;
      accepted = true;
      busy = true;
      setWishSent(true,ctx.state);
      // The wish is accepted now; leaving during its flight must not lose the
      // reward or require replaying the chapter to finish the saved keepsake.
      ctx.awardStamp(3);
      textarea.readOnly = true;
      textarea.blur();
      send.disabled = true;
      skip.disabled = true;
      validation.textContent = copy.travelling;
      if (!await s.wait(120) || !await flyWish()) return;
      textarea.value = '';
      showResult();
      if (!await s.motion(result, {y:14,opacity:0}, {y:0,opacity:1}, {duration:.45})) return;
      result.querySelector('h2').focus({preventScroll:true});
      void dog.speak(copy.stamp,{mood:'jump',autoDismiss:5000});
    }

    function next() {
      if (!s.alive || leaving) return;
      leaving = true;
      void ctx.go(6);
    }
    s.on(form,'submit',(event) => { void submit(event).catch((error) => { if (s.alive) ctx.fail(error); }); });
    s.on(textarea,'input',() => {
      section.querySelector('#wish-counter').textContent = copy.count.replace('{count}',String(textarea.value.length));
      textarea.removeAttribute('aria-invalid');
      validation.textContent = '';
    });
    s.on(skip,'click',next);
    s.on(section.querySelector('[data-testid="wish-next"]'),'click',next);
    if (accepted) { setWishSent(true,ctx.state); showResult(); }
    void (async () => {
      if (await ctx.entered === false || !s.alive) return;
      busy = false;
      if (!accepted) {
        textarea.disabled = send.disabled = skip.disabled = false;
        void dog.speak(copy.dogIntro,{autoDismiss:4500});
      }
    })().catch((error) => { if (s.alive) ctx.fail(error); });
  } catch (error) { if (s.alive) ctx.fail(error); }
}

export function destroy() { scope?.destroy(); scope = null; }
