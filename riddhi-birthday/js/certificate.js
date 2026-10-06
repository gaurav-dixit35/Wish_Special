// A deliberately asset-independent keepsake: no remote images can taint it.
export const CERTIFICATE_SIZE = Object.freeze({ width: 2400, height: 1800 });

export function certificateDetails(config, state) {
  const earned = Array.from({ length: 8 }, (_, index) => state.stamps.has(index + 1));
  return {
    name: config.certificateUi.recipient,
    age: config.age,
    date: config.ui.date,
    earned,
    count: earned.filter(Boolean).length,
    gold: earned.every(Boolean),
  };
}

// Canvas has no wrapping primitive. Split long words by grapheme as well, so
// changing a name or caption cannot silently draw outside the printed border.
export function wrapCertificateText(context, text, maxWidth) {
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth) { line = candidate; continue; }
      if (line) { lines.push(line); line = ''; }
      if (context.measureText(word).width <= maxWidth) { line = word; continue; }
      const characters = segmenter ? [...segmenter.segment(word)].map(part => part.segment) : Array.from(word);
      for (const character of characters) {
        if (line && context.measureText(line + character).width > maxWidth) {
          lines.push(line); line = '';
        }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

function paw(context, x, y, scale, fill) {
  context.save();
  context.translate(x, y); context.scale(scale, scale); context.fillStyle = fill;
  for (const [left, top, rx, ry, rotation] of [[-20,-15,9,12,-.4],[-7,-29,8,11,-.15],[9,-29,8,11,.15],[23,-15,9,12,.4],[1,9,22,19,0]]) {
    context.beginPath(); context.ellipse(left, top, rx, ry, rotation, 0, Math.PI * 2); context.fill();
  }
  context.restore();
}

export function drawCertificate(canvas, config, state) {
  canvas.width = CERTIFICATE_SIZE.width; canvas.height = CERTIFICATE_SIZE.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Certificate canvas is unavailable.');
  const copy = config.certificateUi;
  const details = certificateDetails(config, state);
  const center = canvas.width / 2;
  context.fillStyle = '#fbf6eb'; context.fillRect(0, 0, canvas.width, canvas.height);
  const wash = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  wash.addColorStop(0, '#eaf2f8'); wash.addColorStop(.5, '#fffaf0'); wash.addColorStop(1, '#efeaf8');
  context.fillStyle = wash; context.fillRect(80, 80, 2240, 1640);
  context.strokeStyle = '#b48a3d'; context.lineWidth = 5; context.strokeRect(64, 64, 2272, 1672);
  context.lineWidth = 1.5; context.strokeRect(86, 86, 2228, 1628);
  context.strokeStyle = '#c3d2e4'; context.lineWidth = 2;
  for (const [x, y, directionX, directionY] of [[116,116,1,1],[2284,116,-1,1],[116,1684,1,-1],[2284,1684,-1,-1]]) {
    context.beginPath(); context.moveTo(x, y + directionY * 140); context.lineTo(x, y); context.lineTo(x + directionX * 140, y); context.stroke();
  }
  context.textAlign = 'center'; context.textBaseline = 'middle';
  const line = (text, y, font, color = '#24395a') => {
    context.font = font; context.fillStyle = color; context.fillText(text, center, y);
  };
  line(copy.eyebrow, 190, '700 32px Nunito, sans-serif', '#677995');
  line(copy.title, 287, '500 92px Fredoka, sans-serif');
  line(copy.subtitle, 371, '400 36px Nunito, sans-serif', '#61708b');
  context.beginPath(); context.arc(center, 508, 73, 0, Math.PI * 2);
  context.fillStyle = details.gold ? '#f6e7b9' : '#e4ebf5'; context.fill();
  context.strokeStyle = details.gold ? '#b9903a' : '#92adc8'; context.lineWidth = 2; context.stroke();
  paw(context, center, 517, 1.15, details.gold ? '#986f20' : '#3b6c9c');
  let nameSize = 110;
  context.font = `500 ${nameSize}px Fredoka, sans-serif`;
  while (context.measureText(details.name).width > 1840 && nameSize > 54) {
    nameSize -= 2; context.font = `500 ${nameSize}px Fredoka, sans-serif`;
  }
  const nameLines = wrapCertificateText(context, details.name, 1840);
  const nameY = 665 - ((nameLines.length - 1) * nameSize * .56);
  nameLines.forEach((text, index) => line(text, nameY + index * nameSize * 1.12, `500 ${nameSize}px Fredoka, sans-serif`));
  line(copy.age.replace('{age}', String(details.age)), 769, '700 37px Nunito, sans-serif', '#806327');
  context.font = '400 43px Nunito, sans-serif';
  const body = wrapCertificateText(context, config.certificate, 1780);
  // Original certificate copy is kept verbatim, including its signature.
  body.forEach((text, index) => line(text, 868 + index * 63, '400 43px Nunito, sans-serif'));
  line(details.date, 1104, '700 34px Nunito, sans-serif', '#677995');
  context.strokeStyle = '#bcc9d8'; context.lineWidth = 2;
  context.beginPath(); context.moveTo(405, 1180); context.lineTo(1995, 1180); context.stroke();
  line(copy.collection, 1253, '700 33px Nunito, sans-serif', '#657591');
  details.earned.forEach((earned, index) => {
    const x = center - 441 + index * 126;
    context.beginPath(); context.arc(x, 1364, 48, 0, Math.PI * 2);
    context.fillStyle = earned ? (details.gold ? '#f2e4bc' : '#dceafa') : '#e8e9eb'; context.fill();
    paw(context, x, 1370, .75, earned ? (details.gold ? '#9b772d' : '#376b9f') : '#a6adba');
  });
  line(copy.progress.replace('{count}', String(details.count)), 1480, '700 35px Nunito, sans-serif');
  line(details.gold ? config.finale.gold : copy.alwaysSpecial, 1565, '500 39px Fredoka, sans-serif', details.gold ? '#89651e' : '#6c7496');
  return details;
}

function aborted() { const error = new Error('Certificate export was cancelled.'); error.name = 'AbortError'; return error; }

function bounded(operation, { signal, timeout, timeoutValue, allowTimeout = false }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(aborted()); return; }
    let settled = false;
    const finish = (value, error) => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', onAbort);
      if (error) reject(error); else resolve(value);
    };
    const onAbort = () => finish(null, aborted());
    const timer = setTimeout(() => allowTimeout ? finish(timeoutValue) : finish(null, new Error('Certificate export timed out.')), timeout);
    signal?.addEventListener('abort', onAbort, { once: true });
    Promise.resolve().then(operation).then(value => finish(value), error => finish(null, error));
  });
}

export async function createCertificatePNG(config, state, { documentRef = globalThis.document, signal } = {}) {
  // Custom fonts get a bounded chance to finish. Built-in fonts remain a valid
  // export if the font CDN is unavailable; no asset download is required.
  await bounded(() => documentRef.fonts?.ready ?? Promise.resolve(), { signal, timeout: 1800, allowTimeout: true })
    .catch(error => { if (error.name === 'AbortError') throw error; });
  if (signal?.aborted) throw aborted();
  const canvas = documentRef.createElement('canvas');
  drawCertificate(canvas, config, state);
  const blob = await bounded(() => new Promise((resolve, reject) => {
    try { canvas.toBlob(value => value ? resolve(value) : reject(new Error('Certificate PNG could not be created.')), 'image/png'); }
    catch (error) { reject(error); }
  }), { signal, timeout: 8000 });
  if (signal?.aborted) throw aborted();
  return blob;
}
