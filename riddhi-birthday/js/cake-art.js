// Native vector artwork for C4. Animated groups use absolute SVG coordinates so
// the chapter can translate/scale them without overwriting a placement transform.
const escapeAttribute = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

const sprinklePositions = [
  [165, 192, -27], [187, 199, 28], [208, 185, -16], [230, 198, 37],
  [251, 186, -30], [274, 199, 20], [296, 185, 32], [317, 199, -31],
  [337, 192, 20], [355, 200, -32], [125, 250, 30], [147, 262, -22],
  [166, 262, -34], [187, 267, 30], [208, 267, -23], [229, 272, 36],
  [251, 266, -31], [274, 272, 24], [296, 266, 32], [317, 269, -25],
  [339, 262, 25], [360, 263, -24], [380, 251, 33], [394, 258, -30],
];

function candleMarkup(digit, center, index, escape) {
  const number = digit === '2'
    ? `<path d="M ${center - 20} 134 C ${center - 20} 116 ${center - 1} 111 ${center + 12} 119 C ${center + 29} 130 ${center + 13} 144 ${center + 4} 152 L ${center - 19} 173 H ${center + 20}" fill="none" stroke="url(#cake-candle-gold)" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>
       <path d="M ${center - 20} 131 C ${center - 18} 118 ${center - 1} 116 ${center + 10} 122 M ${center - 17} 171 H ${center + 17}" fill="none" stroke="#fff3bd" stroke-width="3" stroke-linecap="round" opacity=".82"/>`
    : `<text x="${center}" y="181" text-anchor="middle" fill="url(#cake-candle-gold)" stroke="#ffe0a2" stroke-width="1.5" font-family="Georgia, 'Times New Roman', serif" font-size="89" font-weight="700">${escape(digit)}</text>`;
  return `<g class="cake-candle" data-candle="${index}" opacity="0" style="transform-box:fill-box;transform-origin:center bottom">
    <path d="M ${center} 119 V 108" fill="none" stroke="#766077" stroke-width="3" stroke-linecap="round"/>
    ${number}
    <ellipse cx="${center}" cy="184" rx="24" ry="4" fill="#b788ad" opacity=".18"/>
  </g>`;
}

function flameMarkup(center, index) {
  return `<g class="cake-flame" data-flame="${index}" opacity="0" style="transform-box:fill-box;transform-origin:center bottom">
    <ellipse cx="${center}" cy="98" rx="23" ry="28" fill="url(#cake-flame-halo)"/>
    <path d="M ${center} 74 C ${center + 1} 85 ${center + 13} 88 ${center + 10} 99 C ${center + 8} 111 ${center - 9} 111 ${center - 10} 101 C ${center - 12} 91 ${center - 2} 85 ${center} 74 Z" fill="url(#cake-flame-gold)"/>
    <path class="cake-flame-inner" d="M ${center} 91 C ${center + 1} 97 ${center + 6} 99 ${center + 4} 105 C ${center + 2} 110 ${center - 5} 108 ${center - 5} 103 C ${center - 5} 99 ${center - 1} 96 ${center} 91 Z" fill="#fff9da"/>
  </g>`;
}

function cherryMarkup(x, y, index) {
  return `<g class="cake-cherry" data-cherry="${index}" opacity="0" style="transform-box:fill-box;transform-origin:center bottom">
    <ellipse cx="${x + 1}" cy="${y + 8}" rx="10" ry="3" fill="#c984ac" opacity=".23"/>
    <path d="M ${x} ${y - 3} Q ${x - 1} ${y - 16} ${x + 8} ${y - 18}" fill="none" stroke="#568b89" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M ${x + 4} ${y - 12} Q ${x + 11} ${y - 18} ${x + 14} ${y - 14} Q ${x + 10} ${y - 9} ${x + 4} ${y - 12}" fill="#87c5a9"/>
    <path d="M ${x} ${y - 6} C ${x + 12} ${y - 14} ${x + 15} ${y + 6} ${x + 4} ${y + 9} C ${x - 10} ${y + 14} ${x - 16} ${y - 8} ${x - 5} ${y - 8} Q ${x - 2} ${y - 8} ${x} ${y - 6} Z" fill="url(#cake-cherry-coral)"/>
    <ellipse cx="${x - 5}" cy="${y - 2}" rx="2.5" ry="3.5" fill="#ffddd9" opacity=".9"/>
  </g>`;
}

export function cakeMarkup({ name = '', age = 22, bannerText = '', ariaLabel = '', escape = escapeAttribute } = {}) {
  const safe = typeof escape === 'function' ? escape : escapeAttribute;
  const digits = String(age).replace(/\D/g, '').padStart(2, '0').slice(-2);
  const colors = ['#f098bb', '#91c9d8', '#b9a0df', '#e7b860', '#d0789e', '#769bd0'];
  const sprinkles = sprinklePositions.map(([x, y, angle], index) =>
    `<g class="cake-sprinkle" data-sprinkle="${index}" opacity="0" style="transform-box:fill-box;transform-origin:center"><rect x="${x}" y="${y}" width="8" height="3" rx="1.5" fill="${colors[index % colors.length]}" transform="rotate(${angle} ${x + 4} ${y + 1.5})"/></g>`
  ).join('');

  return `<svg class="cake-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 400" width="100%" role="img" aria-label="${safe(ariaLabel)}" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="cake-lower-icing" x1="0" y1="0" x2="1" y2=".3">
        <stop stop-color="#738aca"/><stop offset=".35" stop-color="#b6b9f0"/><stop offset=".68" stop-color="#a7a2df"/><stop offset="1" stop-color="#6f73b4"/>
      </linearGradient>
      <linearGradient id="cake-upper-icing" x1="0" y1="0" x2="1" y2=".3">
        <stop stop-color="#99b4df"/><stop offset=".38" stop-color="#cfddf1"/><stop offset=".7" stop-color="#bfd0ea"/><stop offset="1" stop-color="#8aa1cd"/>
      </linearGradient>
      <linearGradient id="cake-cream" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="#fff9ee"/><stop offset=".6" stop-color="#f9e9e1"/><stop offset="1" stop-color="#edd2d4"/>
      </linearGradient>
      <linearGradient id="cake-candle-gold" x1="0" y1="0" x2="1" y2=".55">
        <stop stop-color="#d6a059"/><stop offset=".3" stop-color="#ffe0a0"/><stop offset=".56" stop-color="#ffe8b5"/><stop offset="1" stop-color="#c18a48"/>
      </linearGradient>
      <linearGradient id="cake-plate-gold" x1="0" y1="0" x2="1" y2="0">
        <stop stop-color="#8d7259"/><stop offset=".3" stop-color="#f8dba6"/><stop offset=".6" stop-color="#caa577"/><stop offset=".8" stop-color="#ffe4ad"/><stop offset="1" stop-color="#937156"/>
      </linearGradient>
      <linearGradient id="cake-plate-top" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="#ecdded"/><stop offset="1" stop-color="#aaa1c7"/>
      </linearGradient>
      <linearGradient id="cake-flame-gold" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="#ffd48c"/><stop offset=".58" stop-color="#ffc16e"/><stop offset="1" stop-color="#ee915c"/>
      </linearGradient>
      <radialGradient id="cake-flame-halo">
        <stop stop-color="#ffd495" stop-opacity=".45"/><stop offset=".5" stop-color="#ffca80" stop-opacity=".12"/><stop offset="1" stop-color="#ffb970" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="cake-aura">
        <stop stop-color="#ffdfaa" stop-opacity=".25"/><stop offset=".65" stop-color="#efb394" stop-opacity=".1"/><stop offset="1" stop-color="#efb394" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="cake-cherry-coral" cx=".3" cy=".24" r=".85">
        <stop stop-color="#ffb2c3"/><stop offset=".5" stop-color="#e77a99"/><stop offset="1" stop-color="#b34e7b"/>
      </radialGradient>
      <linearGradient id="cake-slice-face" x1="0" y1="0" x2="1" y2=".2">
        <stop stop-color="#f5dfe2"/><stop offset="1" stop-color="#dcbaca"/>
      </linearGradient>
      <clipPath id="cake-frosting-clip" clipPathUnits="userSpaceOnUse">
        <rect class="cake-frosting-reveal" x="100" y="170" width="320" height="130" style="transform-box:fill-box;transform-origin:left center"/>
      </clipPath>
      <clipPath id="cake-lower-frosting-clip" clipPathUnits="userSpaceOnUse">
        <path d="M 0 0 H 520 V 400 H 0 Z M 150 0 V 240 C 150 270 370 270 370 240 V 0 Z" clip-rule="evenodd"/>
      </clipPath>
    </defs>

    <ellipse class="cake-glow" cx="260" cy="231" rx="226" ry="168" fill="url(#cake-aura)" opacity="0"/>

    <g class="cake-banner" opacity="0" style="transform-box:fill-box;transform-origin:left center">
      <g transform="translate(0 -20)">
      <path d="M 43 29 Q 260 88 477 29" fill="none" stroke="#ddc49d" stroke-width="1.3" opacity=".74"/>
      <path d="M 53 32 L 72 37 L 59 57 Z" fill="#a9bcdd" opacity=".87"/>
      <path d="M 448 37 L 467 32 L 461 57 Z" fill="#bfa9d7" opacity=".87"/>
      <path d="M 80 34 Q 260 48 440 34 L 440 80 Q 260 92 80 80 Z" fill="#efe2d3"/>
      <path d="M 87 39 Q 260 52 433 39 M 87 75 Q 260 87 433 75" fill="none" stroke="#cda87a" stroke-width="1" opacity=".65"/>
      <text x="260" y="75" text-anchor="middle" fill="#6d567a" font-family="Georgia, 'Times New Roman', serif" font-size="30" font-style="italic">${safe(bannerText || name)}</text>
      <circle cx="43" cy="29" r="2.5" fill="#eed5a7"/><circle cx="477" cy="29" r="2.5" fill="#eed5a7"/>
      </g>
    </g>

    <g class="cake-plate">
      <ellipse cx="260" cy="350" rx="170" ry="13" fill="#080e28" opacity=".23"/>
      <path d="M 82 337 C 82 366 438 366 438 337 L 438 343 C 438 372 82 372 82 343 Z" fill="url(#cake-plate-gold)"/>
      <ellipse cx="260" cy="337" rx="178" ry="24" fill="url(#cake-plate-top)" stroke="url(#cake-plate-gold)" stroke-width="4"/>
      <ellipse cx="260" cy="337" rx="161" ry="17" fill="none" stroke="#faf0e2" stroke-width="1" opacity=".67"/>
    </g>

    <g class="cake-body" opacity="0" style="transform-box:fill-box;transform-origin:center bottom">
      <ellipse cx="260" cy="333" rx="146" ry="13" fill="#6e6797" opacity=".24"/>
      <path d="M 112 252 C 112 222 408 222 408 252 V 320 C 408 354 112 354 112 320 Z" fill="url(#cake-lower-icing)"/>
      <ellipse cx="260" cy="252" rx="148" ry="24" fill="#c3c7ed"/>
      <path d="M 115 314 C 139 341 381 341 405 314 V 323 C 373 347 147 347 115 323 Z" fill="#7587bf" opacity=".5"/>
      <path d="M 116 323 C 151 349 369 349 404 323" fill="none" stroke="#e9c98c" stroke-width="3" stroke-linecap="round"/>
      <path d="M 124 273 V 311" fill="none" stroke="#e8e8ff" stroke-width="4" stroke-linecap="round" opacity=".24"/>
      <path d="M 396 274 V 312" fill="none" stroke="#61629e" stroke-width="3" stroke-linecap="round" opacity=".2"/>
      <path d="M 150 193 C 150 168 370 168 370 193 V 240 C 370 270 150 270 150 240 Z" fill="url(#cake-upper-icing)"/>
      <ellipse cx="260" cy="192" rx="110" ry="19" fill="#dce4f1"/>
      <path d="M 154 241 C 178 263 342 263 366 241" fill="none" stroke="#f1d8a4" stroke-width="2.7" stroke-linecap="round"/>
      <path d="M 160 211 V 236" fill="none" stroke="#f2f6ff" stroke-width="3.5" stroke-linecap="round" opacity=".39"/>
      <path d="M 359 212 V 237" fill="none" stroke="#738bb8" stroke-width="2.5" stroke-linecap="round" opacity=".22"/>
      <g fill="#eee3f4" opacity=".58">
        <path d="M 161 282 L 163 288 L 169 290 L 163 292 L 161 298 L 159 292 L 153 290 L 159 288 Z"/>
        <path d="M 353 287 L 355 291 L 359 293 L 355 295 L 353 299 L 351 295 L 347 293 L 351 291 Z"/>
        <circle cx="198" cy="308" r="2"/><circle cx="330" cy="309" r="2"/>
      </g>
      <path d="M 201 289 Q 260 298 319 289" fill="none" stroke="#f4e5f3" stroke-width="1" opacity=".24"/>
      <text x="260" y="331" text-anchor="middle" fill="#f8f1ff" font-family="Georgia, 'Times New Roman', serif" font-size="30" font-style="italic" letter-spacing="1">${safe(name)}</text>
    </g>

    <g class="cake-frosting" opacity="0" clip-path="url(#cake-frosting-clip)">
      <g clip-path="url(#cake-lower-frosting-clip)">
      <path d="M 110 250 C 110 217 410 217 410 250 V 261 Q 409 269 401 266 L 392 262 V 276 Q 391 285 383 282 Q 379 280 379 272 V 266 L 357 269 V 278 Q 354 286 349 278 V 271 L 326 274 V 286 Q 324 297 316 293 Q 312 291 312 283 V 276 L 286 277 V 284 Q 282 292 277 284 V 279 L 252 279 V 292 Q 250 302 241 298 Q 237 296 237 288 V 279 L 211 277 V 283 Q 207 291 202 283 V 276 L 179 273 V 285 Q 175 295 168 286 V 270 L 146 265 V 276 Q 142 286 135 278 V 262 L 120 264 Q 111 268 110 259 Z" fill="url(#cake-cream)"/>
      <ellipse cx="260" cy="247" rx="145" ry="20" fill="#fff6ea"/>
      </g>
      <path d="M 149 190 C 149 164 371 164 371 190 V 202 Q 368 210 362 206 L 354 205 V 215 Q 351 225 344 216 V 209 L 324 212 V 222 Q 321 233 314 225 V 215 L 289 218 V 225 Q 285 233 280 225 V 219 L 258 220 V 232 Q 254 241 247 233 V 220 L 224 219 V 226 Q 220 234 215 226 V 217 L 192 214 V 225 Q 188 234 181 225 V 211 L 165 206 V 212 Q 159 221 154 212 Z" fill="url(#cake-cream)"/>
      <ellipse cx="260" cy="188" rx="107" ry="17" fill="#fff8ee"/>
      <path d="M 163 185 C 193 169 327 169 357 185" fill="none" stroke="#fffdf6" stroke-width="2" stroke-linecap="round" opacity=".8"/>
    </g>

    ${sprinkles}
    ${[[174, 184], [347, 184], [140, 246], [380, 246], [259, 270]].map(([x, y], index) => cherryMarkup(x, y, index)).join('')}
    ${candleMarkup(digits[0], 221, 0, safe)}
    ${candleMarkup(digits[1], 299, 1, safe)}
    ${flameMarkup(221, 0)}
    ${flameMarkup(299, 1)}

    <g class="cake-smoke" opacity="0" fill="none" stroke="#dce1f1" stroke-width="2.7" stroke-linecap="round" style="transform-box:fill-box;transform-origin:center bottom"><path d="M 221 107 C 210 93 234 82 221 67 C 210 56 222 46 224 39" opacity=".65"/></g>
    <g class="cake-smoke" opacity="0" fill="none" stroke="#e5dced" stroke-width="2.3" stroke-linecap="round" style="transform-box:fill-box;transform-origin:center bottom"><path d="M 299 107 C 309 93 287 83 299 70 C 310 56 299 48 297 39" opacity=".55"/></g>
    <g class="cake-smoke" opacity="0" fill="none" stroke="#e0dcf4" stroke-width="1.8" stroke-linecap="round" style="transform-box:fill-box;transform-origin:center bottom"><path d="M 260 93 C 250 79 272 72 263 58 C 253 49 260 43 263 37" opacity=".33"/></g>

    <g class="cake-slice" opacity="0" style="transform-box:fill-box;transform-origin:center bottom">
      <ellipse cx="337" cy="340" rx="43" ry="8" fill="#202644" opacity=".2"/>
      <path d="M 299 290 L 329 270 L 374 296 L 329 313 Z" fill="#fff1e7"/>
      <path d="M 299 290 L 329 313 V 343 L 299 320 Z" fill="#a6addf"/>
      <path d="M 329 313 L 374 296 V 326 L 329 343 Z" fill="url(#cake-slice-face)"/>
      <path d="M 329 321 L 374 304 V 309 L 329 326 Z M 329 332 L 374 315 V 320 L 329 337 Z" fill="#b89ccd"/>
      <path d="M 299 290 L 329 313 L 374 296 V 302 L 329 319 L 299 296 Z" fill="#fff5ec"/>
      <path d="M 299 317 L 329 340 L 374 323" fill="none" stroke="#edcc9b" stroke-width="2"/>
      <path d="M 320 288 L 326 291 M 337 292 L 342 289 M 344 302 L 350 300" stroke="#bd8bbb" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M 321 300 L 326 302 M 336 282 L 340 285" stroke="#94b8d5" stroke-width="2.7" stroke-linecap="round"/>
    </g>

    <g class="cake-fork" opacity="0" style="transform-box:fill-box;transform-origin:90% 90%">
      <path d="M 444 287 L 451 300 Q 455 307 463 309 L 488 339" fill="none" stroke="#8b7286" stroke-width="7" stroke-linecap="round"/>
      <path d="M 444 285 L 451 298 Q 455 305 463 307 L 488 337" fill="none" stroke="url(#cake-plate-gold)" stroke-width="5.5" stroke-linecap="round"/>
      <path d="M 439 290 L 448 300 Q 454 308 462 306 M 449 280 L 458 290 Q 465 299 462 306 M 444 285 L 462 306 M 453 277 L 462 287 Q 471 298 462 306" fill="none" stroke="#f4d9b0" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M 469 315 L 486 335" fill="none" stroke="#fff0ce" stroke-width="1.2" stroke-linecap="round"/>
    </g>

    <g class="cake-match" opacity="0" style="transform-box:fill-box;transform-origin:center">
      <path d="M 70 110 L 100 149" fill="none" stroke="#c78f64" stroke-width="6" stroke-linecap="round"/>
      <path d="M 72 114 L 99 148" fill="none" stroke="#f2cea0" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="70" cy="110" rx="4" ry="6" fill="#ab6d66"/>
      <ellipse cx="70" cy="103" rx="21" ry="23" fill="url(#cake-flame-halo)"/>
      <path d="M 71 86 C 72 93 81 98 77 107 C 75 115 64 114 63 107 C 61 100 68 93 71 86 Z" fill="url(#cake-flame-gold)"/>
      <path d="M 70 99 C 77 108 69 115 67 107 Z" fill="#fff5d9"/>
    </g>
  </svg>`;
}
