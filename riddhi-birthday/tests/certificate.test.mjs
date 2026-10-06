import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../js/config.js';
import { CERTIFICATE_SIZE, certificateDetails, wrapCertificateText, drawCertificate, createCertificatePNG } from '../js/certificate.js';

function contextFixture() {
  const calls = [];
  const context = {
    font: '400 43px Nunito, sans-serif',
    fillStyle: '#000',
    measureText(text) {
      const size = Number(this.font.match(/(\d+)px/)?.[1] ?? 43);
      return { width: Array.from(text).length * size * .53 };
    },
    fillText(text, x, y) { calls.push({ text, x, y, font: this.font, color: this.fillStyle, width: this.measureText(text).width }); },
    createLinearGradient() { return { addColorStop() {} }; },
  };
  for (const method of ['save','restore','translate','scale','beginPath','ellipse','fill','fillRect','strokeRect','moveTo','lineTo','stroke','arc']) context[method] = () => {};
  return { context, calls };
}

function canvasFixture({ encode, fonts = Promise.resolve() } = {}) {
  const { context, calls } = contextFixture();
  const canvas = {
    width: 0, height: 0,
    getContext: () => context,
    toBlob(callback, type) {
      assert.equal(type, 'image/png');
      if (encode) encode(callback);
      else callback(new Blob(['birthday-png'], { type }));
    },
  };
  let created = 0;
  const documentRef = { fonts: { ready: fonts }, createElement(tag) { assert.equal(tag, 'canvas'); created += 1; return canvas; } };
  return { context, calls, canvas, documentRef, get created() { return created; } };
}

test('Gold Level depends on every actual stamp ID, not the collection size or other keys', () => {
  const state = { stamps: new Set([1,2,3,4,5,6,7,99]) };
  assert.deepEqual(certificateDetails(config, state).earned, [true,true,true,true,true,true,true,false]);
  assert.equal(certificateDetails(config, state).count, 7);
  assert.equal(certificateDetails(config, state).gold, false);
  state.stamps.add('8');
  assert.equal(certificateDetails(config, state).gold, false);
  state.stamps.add(8);
  const details = certificateDetails(config, state);
  assert.equal(details.gold, true);
  assert.equal(details.count, 8);
  assert.equal(details.date, config.ui.date);
  assert.equal(details.name, 'Riddhi Chheda');
  assert.equal(details.age, config.age);
});

test('the print canvas preserves original certificate copy and fits its current text within the border', () => {
  const { canvas, calls } = canvasFixture();
  drawCertificate(canvas, config, { stamps: new Set([1,3,5]) });
  assert.equal(canvas.width, CERTIFICATE_SIZE.width);
  assert.equal(canvas.height, CERTIFICATE_SIZE.height);
  const body = calls.filter(call => call.y >= 868 && call.y < 1104);
  assert.equal(body.map(call => call.text).join(' '), config.certificate);
  assert.ok(calls.some(call => call.text === config.certificateUi.progress.replace('{count}', '3')));
  assert.ok(!calls.some(call => call.text === config.finale.gold));
  for (const call of calls) {
    assert.ok(call.x - call.width / 2 >= 100, `left border: ${call.text}`);
    assert.ok(call.x + call.width / 2 <= canvas.width - 100, `right border: ${call.text}`);
    assert.ok(call.y > 100 && call.y < canvas.height - 100, `vertical border: ${call.text}`);
  }
});

test('a later eighth stamp produces Gold in the next render without altering progress', () => {
  const fixture = canvasFixture();
  const state = { stamps: new Set([1,2,3,4,5,6,7]) };
  drawCertificate(fixture.canvas, config, state);
  assert.ok(!fixture.calls.some(call => call.text === config.finale.gold));
  state.stamps.add(8);
  fixture.calls.length = 0;
  drawCertificate(fixture.canvas, config, state);
  assert.ok(fixture.calls.some(call => call.text === config.finale.gold));
  assert.deepEqual([...state.stamps], [1,2,3,4,5,6,7,8]);
});

test('wrapping breaks long words without tearing a joined emoji apart', () => {
  const context = { measureText: text => ({ width: [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length * 10 }) };
  const text = 'BirthdayLove👨‍👩‍👧‍👦Forever';
  const lines = wrapCertificateText(context, text, 60);
  assert.equal(lines.join(''), text);
  assert.ok(lines.some(line => line.includes('👨‍👩‍👧‍👦')));
  assert.ok(lines.every(line => context.measureText(line).width <= 60));
  assert.deepEqual(wrapCertificateText(context, 'one two\nthree', 60), ['one','two','three']);
});

test('PNG export succeeds with system fonts if font readiness fails', async () => {
  const fixture = canvasFixture({ fonts: Promise.reject(new Error('Font unavailable')) });
  const blob = await createCertificatePNG(config, { stamps: new Set() }, { documentRef: fixture.documentRef });
  assert.equal(blob.type, 'image/png');
  assert.ok(blob.size > 0);
  assert.equal(fixture.created, 1);
});

test('cancelling before or during font readiness never creates a late canvas', async () => {
  let finishFonts;
  const fixture = canvasFixture({ fonts: new Promise(resolve => { finishFonts = resolve; }) });
  const before = new AbortController(); before.abort();
  await assert.rejects(createCertificatePNG(config, { stamps: new Set() }, { documentRef: fixture.documentRef, signal: before.signal }), { name: 'AbortError' });
  const during = new AbortController();
  const pending = createCertificatePNG(config, { stamps: new Set() }, { documentRef: fixture.documentRef, signal: during.signal });
  await Promise.resolve(); during.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  finishFonts(); await Promise.resolve();
  assert.equal(fixture.created, 0);
});

test('a null encoder result is an error and cannot be reported as a saved image', async () => {
  const fixture = canvasFixture({ encode: callback => callback(null) });
  await assert.rejects(createCertificatePNG(config, { stamps: new Set() }, { documentRef: fixture.documentRef }), /could not be created/);
});

test('cancelling a pending encoder rejects promptly and safely ignores a late blob', async () => {
  let finishEncoding;
  let signalStarted;
  const started = new Promise(resolve => { signalStarted = resolve; });
  const fixture = canvasFixture({ encode: callback => { finishEncoding = callback; signalStarted(); } });
  const aborter = new AbortController();
  const pending = createCertificatePNG(config, { stamps: new Set() }, { documentRef: fixture.documentRef, signal: aborter.signal });
  await started; aborter.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  finishEncoding(new Blob(['late'], { type: 'image/png' }));
  await Promise.resolve();
  assert.equal(fixture.created, 1);
});
