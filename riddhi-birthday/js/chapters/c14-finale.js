import { createDog } from '../dog.js';
import { certificateDetails, createCertificatePNG } from '../certificate.js';
import { happinessCopy } from '../happiness-copy.js';

export const id = 14;
let scope;

const pawSVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="10" cy="16" rx="5" ry="7" transform="rotate(-20 10 16)"/><ellipse cx="20" cy="9" rx="5" ry="7"/><ellipse cx="31" cy="10" rx="5" ry="7"/><ellipse cx="40" cy="18" rx="5" ry="7" transform="rotate(20 40 18)"/><path d="M11 33c0-6 7-16 13-16s13 10 13 16c0 7-7 9-13 6-6 3-13 1-13-6Z"/></svg>';

export function init(ctx) {
  const s = scope = ctx.scope;
  try {
    const { section, config, escape: e } = ctx;
    const copy = config.finaleUi;
    const certificate = config.certificateUi;
    let ready = false;
    let leaving = false;
    let exporting = false;
    let currentURL = null;
    let exportFingerprint = '';
    const aborter = new AbortController();
    const urls = new Set();
    section.classList.add('finale-world');
    section.innerHTML = `<div class="finale-lanterns" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<div class="finale-lantern-flight" style="--lantern-left:${5 + (i * 31) % 91}%;--lantern-delay:${i * .65}s;--lantern-scale:${.5 + (i % 4) * .14}"><div class="finale-lantern"><i></i></div></div>`).join('')}</div><div class="finale-content"><p class="eyebrow">${e(copy.eyebrow)}</p><h1 class="finale-title" tabindex="-1">${e(copy.title)}</h1><p class="finale-intro">${e(copy.intro)}</p><article class="birthday-certificate" aria-labelledby="certificate-heading"><div class="certificate-corners" aria-hidden="true"></div><p class="certificate-eyebrow">${e(certificate.eyebrow)}</p><h2 id="certificate-heading">${e(certificate.title)}</h2><p class="certificate-subtitle">${e(certificate.subtitle)}</p><div class="certificate-seal" aria-hidden="true">${pawSVG}</div><p class="certificate-name">${e(certificate.recipient)}</p><p class="certificate-age">${e(certificate.age.replace('{age}', String(config.age)))}</p><p class="certificate-copy">${e(config.certificate)}</p><p class="certificate-date">${e(config.ui.date)}</p><div class="certificate-keepsakes"><p>${e(certificate.collection)}</p><ol class="certificate-paws">${Array.from({ length: 8 }, (_, index) => `<li data-certificate-stamp="${index + 1}"><span>${pawSVG}</span><span class="sr-only"></span></li>`).join('')}</ol><p class="certificate-progress" role="status" aria-live="polite"></p><p class="certificate-gold"></p></div></article><div class="finale-save"><button class="primary-button" type="button" data-testid="certificate-download" disabled>${e(copy.download)}</button><p class="certificate-export-status" role="status" aria-live="polite"></p><a class="secondary-button certificate-open" href="#" target="_blank" rel="noopener" hidden>${e(copy.openPNG)}</a><p class="certificate-save-hint">${e(copy.saveHint)}</p></div><p class="finale-afterword finale-bridge">${e(ctx.hasChapter(15) ? happinessCopy.certificateBridge : copy.afterword)}</p><div class="finale-actions">${ctx.hasChapter(15) ? `<button class="primary-button" type="button" data-testid="finale-next" disabled>${e(happinessCopy.certificateNext)}</button>` : ''}<button class="secondary-button" type="button" data-testid="finale-replay" disabled>${e(copy.replay)}</button>${ctx.hasChapter(13) ? `<button class="secondary-button" type="button" data-testid="finale-back" disabled>${e(copy.back)}</button>` : ''}</div></div><div class="finale-dog-parade" aria-hidden="true" inert></div>`;
    const download = section.querySelector('[data-testid="certificate-download"]');
    const open = section.querySelector('.certificate-open');
    const status = section.querySelector('.certificate-export-status');
    const card = section.querySelector('.birthday-certificate');
    const parade = section.querySelector('.finale-dog-parade');
    for (let i = 0; i < 6; i += 1) {
      const carriage = document.createElement('div');
      carriage.className = 'finale-dog-carriage';
      carriage.style.setProperty('--parade-delay', `${-i * 4}s`);
      carriage.style.setProperty('--resting-left', `${4 + i * 17}%`);
      parade.append(carriage);
      createDog({ ...ctx, eggs: null }, { mount: carriage, variant: i + 1, mood: 'party-hat', className: 'finale-parade-dog' });
    }
    const fingerprint = () => certificateDetails(config, ctx.state).earned.map(Number).join('');
    function refresh() {
      if (!s.alive) return;
      const details = certificateDetails(config, ctx.state);
      card.classList.toggle('is-gold', details.gold);
      section.querySelectorAll('[data-certificate-stamp]').forEach((item, index) => {
        item.classList.toggle('is-earned', details.earned[index]);
        item.lastElementChild.textContent = config.hud.slot.replace('{number}', String(index + 1)).replace('{status}', details.earned[index] ? config.hud.earned : config.hud.unearned);
      });
      section.querySelector('.certificate-progress').textContent = certificate.progress.replace('{count}', String(details.count));
      section.querySelector('.certificate-gold').textContent = details.gold ? config.finale.gold : certificate.alwaysSpecial;
      if (exportFingerprint && exportFingerprint !== fingerprint()) { open.hidden = true; status.textContent = copy.updated; }
      section.querySelectorAll('.finale-actions button').forEach(button => { button.disabled = !ready || leaving; });
      download.disabled = !ready || leaving || exporting;
    }
    if (ctx.eggs?.subscribe) s.add(ctx.eggs.subscribe(refresh));
    refresh();

    s.add(() => {
      aborter.abort();
      section.classList.add('finale-paused');
      // A download may still be consuming its object URL during the exit fade.
      // Releasing shortly afterwards avoids both a broken save and a URL leak.
      for (const url of urls) setTimeout(() => URL.revokeObjectURL(url), 30000);
      urls.clear();
    });
    s.on(download, 'click', () => {
      if (!ready || leaving || exporting) return;
      exporting = true; refresh(); download.textContent = copy.preparing; status.textContent = '';
      void (async () => {
        let blob = null;
        // One task owns the busy state even if a last secret is found while
        // fonts or PNG encoding are settling. Eight stamps bound the retries.
        for (let attempt = 0; attempt < 9; attempt += 1) {
          const renderedFingerprint = fingerprint();
          const candidate = await createCertificatePNG(config, ctx.state, { signal: aborter.signal });
          if (!s.alive) return;
          if (renderedFingerprint === fingerprint()) { blob = candidate; break; }
        }
        if (!blob) throw new Error('The certificate collection changed during export.');
        const url = URL.createObjectURL(blob);
        if (currentURL) {
          const previousURL = currentURL;
          urls.delete(previousURL);
          setTimeout(() => URL.revokeObjectURL(previousURL), 30000);
        }
        currentURL = url; urls.add(url); exportFingerprint = fingerprint();
        open.href = url; open.hidden = false;
        const link = document.createElement('a');
        link.href = url; link.download = certificate.filename; link.hidden = true;
        document.body.append(link);
        try { link.click(); } finally { link.remove(); }
        status.textContent = copy.ready;
      })().catch(error => {
        if (s.alive && error.name !== 'AbortError') { status.textContent = copy.failed; console.warn('[certificate] PNG export remains available to retry.', error); }
      }).finally(() => {
        if (!s.alive) return;
        exporting = false; download.textContent = copy.download; refresh();
      });
    });
    const leave = chapter => {
      if (!ready || leaving) return;
      leaving = true; refresh(); void ctx.go(chapter);
    };
    s.on(section.querySelector('[data-testid="finale-replay"]'), 'click', () => leave(3));
    const next = section.querySelector('[data-testid="finale-next"]');
    if (next) s.on(next, 'click', () => leave(15));
    const back = section.querySelector('[data-testid="finale-back"]');
    if (back) s.on(back, 'click', () => leave(13));
    let fireworkTimer = null;
    let remaining = 10000;
    let lastTick = 0;
    let started = false;
    const burst = () => {
      void ctx.confetti.burst({ particleCount: ctx.mobile ? 34 : 60, spread: 360, startVelocity: 25, gravity: .45, ticks: 85, shapes: ['circle'],
        origin: { x: .15 + Math.random() * .7, y: .16 + Math.random() * .36 }, colors: ['#ffd36b','#9fd0ff','#ffb8d3','#ab98ff'] });
    };
    const stopTimer = () => { clearTimeout(fireworkTimer); fireworkTimer = null; };
    const nextBurst = () => {
      if (!s.alive || document.hidden || remaining <= 0) return;
      const delay = Math.min(1200, remaining);
      lastTick = performance.now();
      fireworkTimer = setTimeout(() => {
        fireworkTimer = null; remaining -= performance.now() - lastTick;
        if (!s.alive || document.hidden || remaining <= 0) return;
        burst(); nextBurst();
      }, delay);
    };
    s.add(stopTimer);
    s.on(document, 'visibilitychange', () => {
      section.classList.toggle('finale-paused', document.hidden);
      if (document.hidden) {
        if (fireworkTimer !== null) remaining -= Math.min(remaining, performance.now() - lastTick);
        stopTimer();
        ctx.confetti.reset();
      } else if (started && !ctx.reducedMotion && remaining > 0) nextBurst();
    });
    s.on(section.querySelector('.finale-lanterns'), 'animationend', event => {
      if (event.animationName === 'birthday-lantern-rise') event.target.classList.add('has-risen');
    });
    void (async () => {
      if (await ctx.entered === false || !s.alive) return;
      ready = true; started = true; refresh();
      section.classList.add('is-celebrating');
      section.classList.toggle('finale-paused', document.hidden);
      if (!document.hidden) { burst(); if (!ctx.reducedMotion) nextBurst(); }
    })().catch(error => { if (s.alive) ctx.fail(error); });
  } catch (error) { if (s.alive) ctx.fail(error); }
}

export function destroy() { scope?.destroy(); scope = null; }
