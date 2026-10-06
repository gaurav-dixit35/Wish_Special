import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECKS_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CDPClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Set();
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(String(data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timeout);
        if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result);
      } else {
        for (const listener of this.listeners) listener(message);
      }
    });
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Chrome debugging connection closed.'));
      }
      this.pending.clear();
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 20000);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
}

export async function launch({ chromePath = process.env.CHROME_PATH || DEFAULT_CHROME } = {}) {
  await mkdir(CHECKS_DIR, { recursive: true });
  const profileDir = await mkdtemp(join(CHECKS_DIR, 'chrome-profile-'));
  const child = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--disable-sync',
    '--metrics-recording-only', '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0', `--user-data-dir=${profileDir}`, 'about:blank',
  ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  const websocketUrl = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Chrome did not expose CDP within 15s. ${stderr.slice(-1000)}`));
    }, 15000);
    const finish = (callback, value) => {
      clearTimeout(timeout);
      callback(value);
    };
    child.once('error', (error) => finish(reject, error));
    child.once('exit', (code) => finish(reject, new Error(`Chrome exited early (${code}). ${stderr.slice(-1000)}`)));
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) finish(resolve, match[1]);
    });
  });
  const socket = new WebSocket(websocketUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const client = new CDPClient(socket);
  const browser = {
    client, child, profileDir,
    async close() {
      try { await client.send('Browser.close'); } catch { /* Closing may close the socket first. */ }
      if (socket.readyState === WebSocket.OPEN) socket.close();
      for (let attempt = 0; attempt < 30 && child.exitCode === null; attempt++) await pause(100);
      if (child.exitCode === null) child.kill();
      await writeFile(join(CHECKS_DIR, 'chrome-stderr.log'), stderr, 'utf8');
    },
  };
  return browser;
}

export async function open(browser, {
  width = 390, height = 844, mobile = true,
  scripts = [], blockedURLs = [], reducedMotion = false,
} = {}) {
  const { targetId } = await browser.client.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.client.send('Target.attachToTarget', { targetId, flatten: true });
  const page = {
    browser, targetId, sessionId, exceptions: [], warnings: [],
    send: (method, params) => browser.client.send(method, params, sessionId),
    async close() {
      browser.client.listeners.delete(listener);
      await browser.client.send('Target.closeTarget', { targetId });
    },
  };
  const listener = (message) => {
    if (message.sessionId !== sessionId) return;
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      page.exceptions.push(details.exception?.description || details.text);
    }
    if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) {
      page.warnings.push(message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '));
    }
  };
  browser.client.listeners.add(listener);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Network.enable');
  await viewport(page, { width, height, mobile });
  if (blockedURLs.length) await page.send('Network.setBlockedURLs', { urls: blockedURLs });
  if (reducedMotion) await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  for (const source of scripts) await page.send('Page.addScriptToEvaluateOnNewDocument', { source });
  return page;
}

export async function viewport(page, { width, height, mobile = true }) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height,
  });
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
}

export async function navigate(page, url) {
  let listener;
  let timeout;
  const loaded = new Promise((resolve, reject) => {
    listener = (message) => {
      if (message.sessionId === page.sessionId && message.method === 'Page.domContentEventFired') resolve();
    };
    page.browser.client.listeners.add(listener);
    timeout = setTimeout(() => reject(new Error(`DOM ready timed out: ${url}`)), 20000);
  });
  try {
    const result = await page.send('Page.navigate', { url });
    if (result.errorText) throw new Error(`Navigation failed: ${result.errorText}`);
    await loaded;
  } finally {
    clearTimeout(timeout);
    page.browser.client.listeners.delete(listener);
  }
}

export async function evaluate(page, expression, ...args) {
  const source = typeof expression === 'function'
    ? `(${expression.toString()})(...${JSON.stringify(args)})`
    : expression;
  const result = await page.send('Runtime.evaluate', {
    expression: source, awaitPromise: true, returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}
export { evaluate as eval };

export async function waitFor(page, predicate, {
  timeout = 22000, interval = 80, label = 'page condition', args = [],
} = {}) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await evaluate(page, predicate, ...args);
      if (value) return value;
    } catch (error) { lastError = error; }
    await pause(interval);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

export async function click(page, selector) {
  const point = await evaluate(page, (query) => {
    const nodes = document.querySelectorAll(query);
    if (nodes.length !== 1) throw new Error(`Expected one click target for ${query}, found ${nodes.length}.`);
    const element = nodes[0];
    if (element.hidden || element.disabled || getComputedStyle(element).display === 'none') {
      throw new Error(`Click target is unavailable: ${query}`);
    }
    element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height) throw new Error(`Click target has no layout box: ${query}`);
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }, selector);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}

export async function screenshot(page, path, { fullPage = false } = {}) {
  await mkdir(dirname(path), { recursive: true });
  const options = { format: 'png', captureBeyondViewport: fullPage };
  if (fullPage) {
    const { cssContentSize } = await page.send('Page.getLayoutMetrics');
    options.clip = { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 };
  }
  const { data } = await page.send('Page.captureScreenshot', options);
  await writeFile(path, Buffer.from(data, 'base64'));
  return path;
}
