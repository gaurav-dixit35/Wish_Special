import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, open, navigate, evaluate, screenshot, click, waitFor, viewport } from './cdp.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const ARTIFACTS = join(dirname(fileURLToPath(import.meta.url)), 'artifacts');
const TARGET = new Date('2026-10-15T00:00:00+05:30').getTime();
const results = [];
const selector = {
  lock: '[data-chapter="0"]', loader: '[data-chapter="1"]',
  dog: '[data-testid="dog-button"]', begin: '[data-testid="begin-button"]',
  sound: '#sound-toggle', replay: '[data-testid="loader-replay"]',
  status: '[data-testid="loader-status"]', percent: '[data-testid="loader-percent"]',
};
const visible = (query) => {
  const element = document.querySelector(query);
  if (!element || element.hidden || !element.getClientRects().length) return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
};
const loaderObservation = `(() => {
  window.__loaderQA = { firstVisible: null, readyVisible: null };
  const shown = (query) => {
    const e = document.querySelector(query);
    return e && !e.hidden && e.getClientRects().length && getComputedStyle(e).display !== 'none';
  };
  new MutationObserver(() => {
    const q = window.__loaderQA;
    if (q.firstVisible === null && shown('[data-chapter="1"]')) q.firstVisible = performance.now();
    if (q.readyVisible === null && shown('[data-testid="loader-replay"]')) q.readyVisible = performance.now();
  }).observe(document, { childList: true, subtree: true, attributes: true });
})();`;

await mkdir(ARTIFACTS, { recursive: true });
const response = await fetch(BASE).catch((error) => { throw new Error(`Start the local server at ${BASE} before QA: ${error.message}`); });
assert.equal(response.status, 200, 'Local index.html must be served successfully.');
const browser = await launch();

async function check(name, callback) {
  const startedAt = Date.now();
  try {
    const detail = await callback();
    results.push({ name, passed: true, milliseconds: Date.now() - startedAt, detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, passed: false, milliseconds: Date.now() - startedAt, error: error.stack });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

async function scene(page, query) {
  await waitFor(page, visible, { args: [query], label: query });
}

async function ready(page) {
  await scene(page, selector.loader);
  await waitFor(page, visible, { args: [selector.replay], timeout: 25000, label: 'loader ready/replay control' });
  await waitFor(page, () => Number(getComputedStyle(document.querySelector('.ready-actions')).opacity) >= .99, {label:'ready actions fully visible'});
  const text = await evaluate(page, (query) => document.querySelector(query)?.innerText, selector.percent);
  assert.match(text || '', /100/, 'Loader should finish at 100%.');
  assert.deepEqual(page.exceptions, [], 'There must be no uncaught browser exceptions.');
}

async function inspectLayout(page) {
  const layout = await evaluate(page, () => ({
    viewport: { width: innerWidth, height: innerHeight },
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    buttons: [...document.querySelectorAll('button')].filter((e) => !e.hidden && e.getClientRects().length)
      .map((e) => { const r = e.getBoundingClientRect(); return { id: e.id || e.dataset.testid || e.textContent.trim(), width: r.width, height: r.height }; }),
  }));
  assert.ok(layout.scrollWidth <= layout.viewport.width + 1, `Horizontal overflow: ${JSON.stringify(layout)}`);
  for (const button of layout.buttons) {
    assert.ok(button.width >= 47.5 && button.height >= 47.5, `Tap target is smaller than 48px: ${JSON.stringify(button)}`);
  }
  return layout;
}

try {
  await check('Lock, third/sixth dog taps, and sound control', async () => {
    const page = await open(browser, { width: 390, height: 844 });
    try {
      await navigate(page, `${BASE}/`);
      await scene(page, selector.lock);
      await waitFor(page, () => document.querySelector('#stage')?.innerText.includes('Just for you.'), { label: 'personal lock heading' });
      for (let i = 0; i < 3; i++) await click(page, selector.dog);
      await waitFor(page, () => document.querySelector('#toast')?.innerText.includes('Shhh... wait for midnight 😴'), { label: 'third-tap message' });
      for (let i = 0; i < 3; i++) await click(page, selector.dog);
      await waitFor(page, () => document.querySelector('#toast')?.innerText.includes("Okay okay, you're impatient, Miss 😤"), { label: 'sixth-tap message' });
      await click(page, selector.begin);
      await waitFor(page, () => document.querySelector('#sound-toggle')?.getAttribute('aria-pressed') === 'true', {label:'audio started after tap'});
      const controlState = (query) => {
        const e = document.querySelector(query);
        return [e?.getAttribute('aria-label'), e?.getAttribute('aria-pressed'), e?.textContent].join('|');
      };
      const soundBefore = await evaluate(page, controlState, selector.sound);
      await click(page, selector.sound);
      await waitFor(page, (query, previous) => {
        const e = document.querySelector(query);
        return [e?.getAttribute('aria-label'), e?.getAttribute('aria-pressed'), e?.textContent].join('|') !== previous;
      }, { args: [selector.sound, soundBefore], label: 'sound control changed state' });
      assert.deepEqual(page.exceptions, []);
      return { layout: await inspectLayout(page), warnings: page.warnings.length };
    } finally { await page.close(); }
  });

  await check('Preview loader minimum duration, ready state, and replay', async () => {
    const page = await open(browser, { width: 390, height: 844, scripts: [loaderObservation] });
    try {
      await navigate(page, `${BASE}/?preview=1`);
      await scene(page, selector.loader);
      await screenshot(page, join(ARTIFACTS, 'loader-progress-390x844.png'));
      await ready(page);
      const timing = await evaluate(page, () => window.__loaderQA);
      assert.notEqual(timing.firstVisible, null, 'Loader entry must be observed.');
      assert.notEqual(timing.readyVisible, null, 'Ready state must be observed.');
      assert.ok(timing.readyVisible - timing.firstVisible >= 2400, `Loader too brief: ${JSON.stringify(timing)}`);
      await screenshot(page, join(ARTIFACTS, 'loader-ready-390x844.png'));
      await click(page, '[data-testid="loader-begin"]');
      await waitFor(page, () => document.querySelector('#sound-toggle')?.getAttribute('aria-pressed') === 'true', {label:'post-unlock audio starts on tap'});
      await click(page, selector.replay);
      await waitFor(page, (query) => {
        const e = document.querySelector(query);
        return !e || e.hidden || !e.getClientRects().length;
      }, { args: [selector.replay], timeout: 3000, label: 'replay leaves ready state' });
      await ready(page);
      return { timing, layout: await inspectLayout(page), warnings: page.warnings.length };
    } finally { await page.close(); }
  });

  await check('Mobile and desktop layout/screenshots', async () => {
    const page = await open(browser);
    const layouts = [];
    try {
      for (const [width, height] of [[360, 640], [390, 844], [1440, 1000]]) {
        await viewport(page, { width, height, mobile: width < 600 });
        await navigate(page, `${BASE}/?preview=1&scene=lock`);
        await scene(page, selector.lock);
        await waitFor(page, (query) => Number(getComputedStyle(document.querySelector(query)).opacity) >= 0.99, { args: [selector.lock], label: 'lock entrance fully visible' });
        await waitFor(page, () => !document.querySelector('#stage')?.getAnimations({ subtree: true }).some((animation) => animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().iterations)), { timeout: 4000, label: 'finite entrance animations complete' });
        layouts.push(await inspectLayout(page));
        const beginBounds = await evaluate(page, () => {
          const rect = document.querySelector('[data-testid="begin-button"]').getBoundingClientRect();
          return {top:rect.top,bottom:rect.bottom,height:innerHeight};
        });
        assert.ok(beginBounds.top >= 0 && beginBounds.bottom <= beginBounds.height, `Begin button must fit initial viewport: ${JSON.stringify(beginBounds)}`);
        await screenshot(page, join(ARTIFACTS, `lock-${width}x${height}.png`));
      }
      assert.deepEqual(page.exceptions, []);
      return layouts;
    } finally { await page.close(); }
  });

  await check('Date boundary unlock automatically enters loader', async () => {
    const page = await open(browser, {
      scripts: [`{ const start = performance.now(); Date.now = () => ${TARGET} - 2000 + performance.now() - start; }`],
    });
    try {
      await navigate(page, `${BASE}/`);
      await scene(page, selector.lock);
      await scene(page, selector.loader);
      await ready(page);
      return { automaticUnlock: true, warnings: page.warnings.length };
    } finally { await page.close(); }
  });

  await check('Blocked localStorage remains nonfatal', async () => {
    const page = await open(browser, {
      scripts: [`Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('QA restricted storage', 'SecurityError'); } });`],
    });
    try {
      await navigate(page, `${BASE}/?preview=1`);
      await ready(page);
      return { warnings: page.warnings.length };
    } finally { await page.close(); }
  });

  await check('Blocked optional CDNs and reduced-motion fallback', async () => {
    const page = await open(browser, {
      reducedMotion: true,
      blockedURLs: ['*://cdnjs.cloudflare.com/*', '*://fonts.googleapis.com/*', '*://fonts.gstatic.com/*'],
    });
    try {
      await navigate(page, `${BASE}/?preview=1`);
      await ready(page);
      assert.equal(await evaluate(page, () => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
      await screenshot(page, join(ARTIFACTS, 'loader-ready-offline-fonts.png'));
      return { layout: await inspectLayout(page), warnings: page.warnings.length };
    } finally { await page.close(); }
  });
} finally {
  await browser.close();
  await writeFile(join(ARTIFACTS, 'smoke-results.json'), JSON.stringify({ baseURL: BASE, ranAt: new Date().toISOString(), results }, null, 2));
}

console.log(`${results.filter((result) => result.passed).length}/${results.length} checks passed. Artifacts: ${ARTIFACTS}`);
if (results.some((result) => !result.passed)) process.exitCode = 1;
