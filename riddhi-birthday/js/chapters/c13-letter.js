import { createDog } from '../dog.js';
import { createLetterTyper } from '../letter.js';

export const id = 13;
let scope;

export function init(ctx) {
  scope = ctx.scope;
  const s = scope;
  try {
    const { section, config, escape: e } = ctx;
    const copy = config.letterUi;
    const original = Array.from(config.letter, line => String(line));
    const lines = original;
    const styles = config.letterStyles ?? { heading: 0, signature: [lines.length - 1] };
    const signatureLines = new Set(styles.signature ?? []);
    const lineClass = (index) => `${signatureLines.has(index) ? ' is-signature' : ''}${index === styles.postscript ? ' is-postscript' : ''}${index === styles.heading ? ' is-heading' : ''}`;
    let ready = false;
    let leaving = false;
    section.setAttribute('aria-labelledby', 'letter-heading');
    section.innerHTML = `<div class="letter-content"><header class="letter-header"><p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>${e(copy.eyebrow)}</p><h1 id="letter-heading">${e(copy.title)}</h1><p>${e(copy.intro)}</p></header><div class="letter-reading-tools"><p id="letter-hint">${e(copy.hint)}</p><button class="secondary-button letter-finish" data-testid="letter-finish" type="button" aria-controls="letter-paper" disabled>${e(copy.finish)}</button></div><article id="letter-paper" class="letter-paper glass" aria-label="${e(copy.paperLabel)}"><div class="letter-paper-top" aria-hidden="true"><span class="letter-tiny-star">✦</span><span class="letter-paper-rule"></span><span class="letter-paper-heart">♡</span></div><div class="sr-only letter-readable">${original.map(line => line ? `<p>${e(line)}</p>` : '<br>').join('')}</div><div class="letter-body" aria-hidden="true">${lines.map((line, index) => `<p class="letter-line${line ? '' : ' letter-line-gap'}${lineClass(index)}"><span class="letter-line-reserve">${e(line) || '&nbsp;'}</span><span class="letter-line-copy"></span></p>`).join('')}</div><div class="letter-paper-bottom" aria-hidden="true"><span>✧</span><span class="letter-paper-rule"></span><span>✦</span></div><div class="letter-dog-mount"></div></article><p class="letter-status sr-only" role="status" aria-live="polite"></p><div class="letter-actions">${ctx.hasChapter(14) ? `<button class="primary-button" data-testid="letter-next" type="button" disabled>${e(copy.next)}</button>` : ''}${ctx.hasChapter(12) ? `<button class="secondary-button" data-testid="letter-back" type="button" disabled>${e(copy.back)}</button>` : ''}</div></div>`;

    const paper = section.querySelector('.letter-paper');
    const finishButton = section.querySelector('.letter-finish');
    const lineElements = [...section.querySelectorAll('.letter-line-copy')];
    const cursor = document.createElement('span');
    cursor.className = 'letter-cursor';
    cursor.textContent = '▎';
    cursor.setAttribute('aria-hidden', 'true');
    const dog = createDog(ctx, { mount: section.querySelector('.letter-dog-mount'), variant: 9, className: 'letter-guide' });
    dog.element.querySelector('.dog-avatar').setAttribute('aria-label', copy.dogAlt);
    const dream = document.createElement('span');
    dream.className = 'letter-dog-dream';
    dream.textContent = copy.dogDream;
    dream.setAttribute('aria-hidden', 'true');
    dog.element.append(dream);

    const typer = createLetterTyper({
      lines,
      reducedMotion: ctx.reducedMotion,
      onUpdate({ lineIndex, text }) {
        if (!s.alive || leaving) return;
        const line = lineElements[lineIndex];
        line.textContent = text;
        line.append(cursor);
        if (signatureLines.has(lineIndex) && text) line.classList.add('is-revealed');
      },
      onComplete() {
        if (!s.alive || leaving) return;
        cursor.remove();
        section.dataset.letterComplete = 'true';
        finishButton.textContent = copy.finished;
        finishButton.setAttribute('aria-disabled', 'true');
        section.querySelector('#letter-hint').textContent = copy.completedHint;
        section.querySelector('.letter-status').textContent = copy.completeStatus;
        // Signature lines retain their gold fade; the postscript remains a
        // separate paragraph below them, in the owner's exact reading order.
        section.querySelectorAll('.is-signature .letter-line-copy').forEach(line => line.classList.add('is-revealed'));
      },
      onError: ctx.fail,
    });
    s.add(() => { typer.destroy(); cursor.remove(); });

    function reveal() { if (ready && !leaving && s.alive) typer.finish(); }
    s.on(finishButton, 'click', reveal);
    s.on(section, 'click', event => {
      // Reading taps finish the letter. Navigation and the guide retain their
      // own actions; a scroll, text selection, or held pointer does not skip.
      if (event.target.closest('button, a, input, textarea, select, [role="button"]')) return;
      if (String(window.getSelection?.() ?? '').length) return;
      reveal();
    });
    for (const [testId, destination] of [['letter-next', 14], ['letter-back', 12]]) {
      const button = section.querySelector(`[data-testid="${testId}"]`);
      if (button) s.on(button, 'click', () => {
        if (!ready || leaving || !s.alive) return;
        leaving = true;
        typer.destroy();
        section.querySelectorAll('button').forEach(control => { control.disabled = true; });
        void ctx.go(destination);
      });
    }
    // The chapter's transition owns its entry. Starting a timer during init
    // would hide the opening lines before the paper has actually appeared.
    void (async () => {
      await ctx.entered;
      if (!s.alive) return;
      ready = true;
      section.querySelectorAll('.letter-actions button, .letter-finish').forEach(button => { button.disabled = false; });
      paper.dataset.ready = 'true';
      typer.start();
    })().catch(ctx.fail);
  } catch (error) { ctx.fail(error); }
}

export function destroy() { scope?.destroy(); scope = null; }
