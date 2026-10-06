# Riddhi’s birthday world

A mobile-first static birthday site for Riddhi’s 22nd birthday, using plain
HTML, CSS, and JavaScript ES modules. The unlock is **15 October 2026 at
12:00 AM IST** (`2026-10-15T00:00:00+05:30`). No backend, package install, or
build step is required.

## The eight phases

1. **Foundation, lock, and loader:** design tokens, mobile layout, saved state,
   preload/fallback handling, audio, countdown, aurora, stars, C0 and C1.
2. **Welcome and identity:** dog helper, confetti, HUD, C2 and C3.
3. **Birthday cake:** C4, its full cake sequence, microphone blowing, and tap
   fallback.
4. **Wishes and balloons:** C5/C6, wish delivery and offline retry.
5. **Nickname cards and memories:** C7/C8, flips, swipes, and photo lightbox.
6. **Games, vouchers, and secrets:** C9/C10/C11.
7. **Voice, letter, and finale:** C12/C13/C14 and the downloadable certificate.
8. **Polish and launch checks:** mobile layout, performance, accessibility,
   missing files, and full journey verification.

Phases **1 through 7** are implemented. The journey now runs from C0 (lock)
through C1 (loader), C2 (birthday welcome), C3 (identity check), and C4
(birthday cake) into C5 (wishes), C6 (balloons), C7 (nickname cards), C8
(memories), C9 (games), C10 (vouchers), C11 (hidden secrets), C12 (voice),
C13 (letter), C14 (certificate), and the new C15 (happiness candle ending). All eight paw stamps can be collected and the
finale offers a downloadable birthday certificate. Phase 8 personalization and the candle ending are implemented. Checks of the
updated chapters are recorded below; personal voice and real-device launch
verification remain pending.
All original personal messages, nicknames, memories, quiz, letter, and finale
copy remain together in the owner-editable `js/config.js`.

## Run locally

From this `riddhi-birthday` folder, run:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open <http://localhost:8000/>. ES modules require this HTTP server; opening
`index.html` directly as a file is not supported. Stop the server with Ctrl+C.

- Normal lock: <http://localhost:8000/>
- Bypass the date for testing: <http://localhost:8000/?preview=1>
- Keep the lock scene visible in preview:
  <http://localhost:8000/?preview=1&scene=lock>
- Jump from the loader to the identity check during development:
  <http://localhost:8000/?preview=1&scene=identity>
- Jump from the loader to the birthday bakery during development:
  <http://localhost:8000/?preview=1&scene=cake>
- Wish chapter: <http://localhost:8000/?preview=1&scene=wish>
- Balloon chapter: <http://localhost:8000/?preview=1&scene=balloons>
- Nickname cards: <http://localhost:8000/?preview=1&scene=cards>
- Memory stack: <http://localhost:8000/?preview=1&scene=memories>
- Games: <http://localhost:8000/?preview=1&scene=games>
- Vouchers: <http://localhost:8000/?preview=1&scene=vouchers>
- Secret collection: <http://localhost:8000/?preview=1&scene=secrets>
- Voice message: <http://localhost:8000/?preview=1&scene=voice>
- Personal letter: <http://localhost:8000/?preview=1&scene=letter>
- Certificate: <http://localhost:8000/?preview=1&scene=finale>
- Final happiness candle: <http://localhost:8000/?preview=1&scene=happiness>

The development preview is intentionally available for the owner. Remove or
change the preview bypass before the final release (`allowPreview: false` in
`js/config.js`). A client-side date check
cannot keep the birthday content secret from someone using browser developer
tools. For the spec’s intended launch, host only a stripped lock page beforehand
and publish the complete site on 14 October night. This project has **not been
deployed**.

## Assets and fallbacks

The paths in `config.assets` describe the final images, dog stickers, audio,
and fonts. The asset folders contain real optimized memory/game photos, ten dog stickers,
and eight music/effect MP3s. See their `SOURCES.md` files for public-media credits. Missing images use
local placeholders; the sleeping dog in phase 1 is a lightweight inline SVG.
After a user tap, synthesized placeholder audio stands in for unavailable
music and sound effects. The two personal voice recordings are still to be added.

External fonts and the pinned animation library are optional enhancements.
If they cannot be reached, system fonts and local transition fallbacks keep the
lock and loader usable. “Offline fallback” means handling unavailable optional
resources in an already loaded/local-served page; there is no service worker
or promise of a first visit working without a network connection.

Keep personal wording in `js/config.js`; add real photos and voice notes in
`others/`. Place supplied dog stickers in `dogs/` and music/SFX in `audio/`.
The complete counts, photo subjects, recording purposes, filenames, optional
assets, and launch details are listed in [OWNER-CHECKLIST.md](OWNER-CHECKLIST.md).
The Web3Forms key is still a placeholder. Set `config.web3formsKey` to the
access key for the intended recipient before enabling email delivery. Until
then, wishes stay queued locally and the UI says they are waiting to be passed
along. No real submissions were made during development. The request format
follows the [Web3Forms API reference](https://docs.web3forms.com/getting-started/api-reference).

## Phase 2 behavior

- After loading, the welcome waits for a tap if music has not yet started.
  It then counts from 10 to 1, reveals the birthday greeting, fires confetti,
  and brings in the party-hat dog guide and gift button.
- The gift opens three personal identity questions. The second question has
  a playful runaway “No”; affirmative answers always stay available, and
  keyboard activation does not require chasing the button.
- Completing the questions triggers two scanning passes and a VERIFIED stamp,
  then saves paw stamp #1. Replaying does not duplicate the reward.
- The HUD begins at C3, with eight paw slots, sound controls, and a replay menu
  containing reached, implemented chapters. The birthday tune is shared across
  all chapters and is not restarted by navigation.
- The reusable dog helper supports typed speech, tap-to-finish/dismiss, moods,
  decoded PNGs when supplied, and local placeholders. Confetti has a bounded
  fallback if its CDN library is unavailable.

## Phase 3 behavior

- Four separate taps build a native SVG cake: two tiers land on a golden
  plate, frosting reveals, 24 sprinkles fall, five cherries pop into place,
  a banner unfurls, and two number candles make “22”.
- A match lights the candles, the flames flicker, and a short countdown
  leads into the birthday wish. The first blow has a playful relighting
  surprise; the second puts the candles out for good. A fast second blow
  is remembered through the relighting animation.
- “Tap to blow” stays available throughout the blowing sequence. Microphone
  detection is optional and starts only on its own button tap. Denied,
  unavailable, or unanswered permission falls back to tapping. No microphone
  audio is recorded or sent anywhere. Leaving the chapter or hiding the page
  releases the microphone; using it again requires a fresh tap.
- A cheeky fork steals a slice, then confetti, streamers, and balloons finish
  the celebration. Paw stamp #2 is saved once. Cake replay and a return to
  the welcome remain available at the end.
- Music continues across chapters and lowers while the microphone listens.
  The cake requires no extra image downloads, and its animations support
  reduced motion and the existing fallback when the animation CDN is absent.

Per the owner’s updated workflow, **Phase 2–5 smoke/browser tests are deferred
until the end**. Source review, syntax/import checks, and isolated helper tests
do not establish browser or real-device behavior. The checks below record the
earlier Phase 1 results; they do not cover the later chapters.

Phase 3 source checks passed for all 18 JavaScript files, module imports,
required cake configuration, and SVG layer counts (24 sprinkles, five cherries,
two candles, two flames, and three smoke wisps).

At the final verification phase, exercise all four cake steps, microphone
grant/denial/unavailability, tapping twice quickly, hiding the page while
permission is pending or listening, chapter replay during each animation,
stamp deduplication, reduced motion, and missing CDN/audio assets. Check the
complete sequence on both phone viewports and with keyboard navigation.

## Phase 4 behavior

- C5 offers a labeled, 280-character wish field and the original disclosure
  about passing the wish along. Blank wishes stay editable with a gentle prompt.
  A submitted wish shrinks into an orb, follows a curved sparkle trail, and
  becomes a golden sky star. Aurora ribbon opacity increases by 0.1 here and
  returns to normal on leaving. Reduced motion uses a short fade.
- Submitting awards paw stamp #3; keeping the wish private and continuing
  without submitting does not award it. The keepsake and star survive replay
  and reload. Reopening a submitted wish does not create another submission.
- `js/wish.js` owns an outbox for the whole app, so chapter changes cannot
  cancel delivery. It saves pending text under `localStorage.pendingWish`
  before trying the request, retries on load/online and with bounded backoff,
  and marks delivery complete only after an acknowledged success response.
  A sent receipt retains its identifier and removes its private wish text.
  Blocked storage uses memory and the UI explains that the page must stay open.
  The helper has separate birthday and secret slots for the later second wish.
- `state.wishSent` means the birthday wish was accepted into the experience;
  the outbox separately tracks email delivery. The app never treats that
  keepsake flag alone as confirmation that email was delivered.
- C6 has ten floating SVG balloons, each with the original personal message.
  A pop is claimed before animating, followed by a matching confetti burst and
  a message card with a dog. The dialog supports keyboard focus, Escape, and
  tap dismissal. Balloon #10 reveals the moon clue for the later secrets phase.
  After all ten, the chapter offers replay and a return to the wish star.

Phase 4 validation: all 21 JavaScript files passed syntax checks; new modules
import successfully. Six isolated outbox tests passed with mocked responses
and storage: missing key, invalid input and repeated taps, failed delivery and
reload, blocked storage, request cancellation, and independent wish slots.
No real email, browser, or smoke test was run. Run these local checks with:

```powershell
node --experimental-default-type=module --test tests/wish.test.mjs
```

Final browser verification must cover wish animation and reload, offline/online
retry with the final key, private-storage messaging, fast balloon taps, all ten
messages, modal focus/scroll restoration, reduced motion, mobile layouts, and
navigation while animations or delivery are in progress.

## Phase 5 behavior

- C7 displays all eleven original nickname cards in a horizontal carousel.
  Each card turns over to reveal its personal message; the final card has
  the extra second-tap reveal, “Best decision ever. 💙”. Swipe, navigation
  buttons, and keyboard controls make the collection accessible. Flipping
  all eleven cards saves paw stamp #4 once.
- C8 displays ten memories as a stack of taped polaroids, preserving the
  original tags and captions. Swipe a card aside or use the next-memory
  button. Completing the stack reveals the original closing message and
  saves paw stamp #5. Both chapters support replay without duplicate rewards.
- Supplied photos are cloned from the preload cache and decoded before
  becoming visible. Missing photos remain gentle placeholders; the stack
  still works. Real photo files have not been supplied yet. Their exact
  filenames are listed in `others/photos/README.md`.
- A decoded photo opens in a lightbox with a zoom transition, full-image
  framing, its caption, and a close control. Its transition matches the
  polaroid's rotation and crop before revealing the full photograph. The
  overlay manages keyboard focus and restores the background on close or
  chapter exit. Reduced motion uses a fade for the lightbox.

Phase 5 source checks passed for all 25 JavaScript files and all 40 local
module/stylesheet references. The new modules import successfully. Five
isolated photo tests passed: rotated transition geometry, crop aspect ratio,
decode-before-display, cancellation during decode, and missing/corrupt image
fallbacks. These use mock images and do not verify browser rendering. Run:

```powershell
node --experimental-default-type=module --test tests/photos.test.mjs
```

Phase 5 browser/smoke checks remain deferred. At final verification, cover all
eleven flips and the final extra reveal, carousel swipe/keyboard navigation,
rapid repeated input, left/right memory swipes and vertical page scrolling,
cancelled drags, photo decode failure, missing photos, lightbox open/close and
resize, navigation during animation, stamp deduplication, and both mobile
viewports. Use real photos for the final lightbox and image-crop checks.

## Phase 6 behavior

- C9 offers photo matching, a 30-second dog catcher, the five original
  personal quiz questions, and an eight-segment voucher wheel. Each game
  has a skip control. Finishing any game or choosing Skip all saves paw #6.
  The wheel uses the six real vouchers, with two repeated slots, and opens
  the matching card in C10. No voucher depends on winning a particular game.
- C10 contains six silver scratch cards. Pointer strokes remove the foil;
  clearing 55% reveals the whole voucher. Each also has a keyboard reveal
  control. Scratches survive resizing during that visit. Revealing all six
  saves paw #7. The revealed cards are framed for screenshots.
- Five secrets are available throughout the journey from C3: the moon,
  shooting star, a guide dog's nose, five taps on the title, and the footer
  heart. The HUD tracks discoveries; C11 provides clues and lets you revisit
  the second wish and secret message. Discoveries and stamps persist without
  duplicating rewards. Finding all five gives a golden paw and stamp #8.
- The shooting star rests in place for keyboard navigation, reduced motion,
  and C11. Its target, the moon, dog noses, and footer heart are 56px.
  The second wish shares the existing outbox and honest delivery status.
  It never displays previously submitted private text.
- The footer secret plays `others/voice/secret.mp3` when supplied. Missing
  recordings use a coming-soon message. Music lowers during playback, mute
  stays respected, and hiding the page or changing chapters stops the voice.
- Games and scratch effects clean up on navigation. The catcher's clock
  pauses while the tab is hidden. Matching-card placeholders remain distinct
  even before the six `extra-*.webp` photos are added.

The Phase 4 follow-up review fixed the wish star's placement behind the mobile
HUD and connected its flight to the same visible sky position. A submitted
wish now saves its paw immediately, including when the chapter is left during
the animation. Hidden balloon dialogs no longer block secret discovery; an
open balloon message supports keyboard access to its dog's nose and provides
the sneeze response inside the dialog. Opening a balloon message also reserves
its modal during the pop animation so two dialogs cannot open together.

The mobile HUD reserves a clear column for the moon, resting shooting star,
and both wish stars, including at 320px width. Coverage geometry, modal guards,
saved secrets, games, voice lifecycle, wishes, and existing core/photo helpers
are covered by isolated Node tests. These checks do not verify browser layout.
Run the complete helper suite with:

```powershell
node --experimental-default-type=module --test tests/*.test.mjs
```

After Phase 6 and the Phase 4 follow-up: all 49 isolated tests pass, all 33
JavaScript files pass syntax checks, the three new chapter modules import,
and all 56 local module/stylesheet references resolve.

Browser and smoke checks remain deferred to Phase 8 at the owner's request.
Final checks must include all four game paths and skips, repeated spins and
voucher routing, scratch gestures and resize, keyboard-only discovery, second
wish queuing/retry, real voice playback, mute, and navigation during effects.

## Phase 7 behavior

- C12 offers a large play/pause control and 32 waveform bars. Recordings use
  the preload cache, lower the music while playing, respect global mute, and
  resume from the paused position. Configuring multiple paths in `config.voice`
  creates a playlist; titles and optional transcripts live in `config.voiceTracks`.
  The waveform follows a Web Audio analyser when available and uses a gentle
  decorative fallback otherwise. Missing voice files show “Coming soon 🎙️”
  while the route to the letter stays open.
- Main and secret recordings take turns rather than playing over each other.
  Hiding the tab pauses the main recording and stops the secret clip. Returning
  to the page does not start a recording without another tap. Navigation cleans
  up the chapter's player and restores the music level.
- C13 preserves every original letter line. Text appears at 40ms per grapheme,
  with 400ms line pauses and an extra 180ms after commas; emoji stay intact.
  Tapping the letter or its reveal button finishes the text immediately.
  Reduced motion presents the complete letter, and screen readers receive
  the full static text without repeated character announcements. The final
  signature fades in gold beside the curled-up dog.
- C14 celebrates with a ten-second firework sequence, twelve rising paper
  lanterns, and a dog parade. Decorations pause while hidden and use reduced
  motion alternatives. The certificate shows the actual eight-stamp collection;
  Gold Level requires all eight earned stamps. A last secret discovered here
  updates the collection, and the next export uses the current rewards.
- Download builds a 2400×1800 PNG using native canvas and drawn decorations.
  It does not depend on supplied images. The original certificate wording,
  recipient, age, birthday date, and earned stamps appear in the keepsake.
  An Open PNG link remains available for saving in browsers that handle
  downloads differently. Reaching the finale opens replay entries for C3–C13
  without awarding any unearned stamps.

After Phase 7, all 78 isolated Node tests pass, all 39 JavaScript files pass
syntax checks, C12–C14 import successfully, and all 68 local module/stylesheet
references resolve. These checks cover helper behavior and source integration;
they do not verify browser layout or actual-device media playback.

Real memory photos and downloaded music/effects/dog stickers are now connected.
The two personal voice recordings remain pending as planned. See
[OWNER-CHECKLIST.md](OWNER-CHECKLIST.md) for the updated media inventory. Browser/smoke
testing was deferred until Phase 8. Remaining launch checks include actual mobile voice playback,
waveform fallback, rapid play/pause/track changes, letter taps, PNG downloads,
replay, missing CDNs, and the full C0–C14 journey.

## Personalization update and candle ending

- Memory 8 is Symposium. Memory 9 is Matheran, using the supplied Matheran.jpg;
  memory 10 is the Ganpati visit, using Beach.jpeg as requested. All ten memory
  labels are free of emoji. Six matching-game photos reuse the supplied photos.
- The new Miss Barbie letter is preserved verbatim, including both gold
  signature lines and the separate italic cake postscript. The certificate
  signs off as Your Bandar 🐒 in both its card and exported PNG.
- C11 clue buttons now show a visible ring around the actual target and anchored
  instructions, including the remaining taps for the name secret. A return
  button leads back to the clue. Repeated discoveries never duplicate rewards.
- C14 leads to C15: light a unique blue-and-gold Riddhi candle, let it rise among
  fourteen warm lanterns, then reveal Happy Birthday, Miss Barbie! with party
  confetti. The sequence pauses while hidden and supports reduced motion. Its
  own replay/back controls leave the closing sky clear of the floating HUD.
- Music is a recognizable acoustic-guitar Happy Birthday To You arrangement.
  Music, seven effects, and dog stickers are bundled locally with source records.

Current automated checks: **81 isolated Node tests** pass; **41 JavaScript
files** parse and **73 local imports/stylesheets** resolve. All **34 supplied
media assets** are present (16 WebP photos, 10 PNG dogs, and 8 MP3s). The only
missing configured files are the two personal voice notes.

Chrome checks cover all ten memory cards, music starting from a real click,
all five clue targets and the second-wish dialog, missing-voice continuation,
the full updated letter, a real 2400×1800 certificate PNG export, and the
certificate-to-candle ending. Tested widths are 390px, 320px with reduced motion,
and 1440px. The changed flows have no horizontal overflow or uncaught errors.
These are desktop Chrome tests with mobile viewport emulation, not actual-phone
verification. Scripts, JSON results, and screenshots live outside the deployable
site in `../.phase8-checks/`. Total site size is about 19.35 MiB, including all
preserved original photos. Nothing has been published.

## Phase 1 acceptance checks

- At 360×640 and 390×844, verify readable text, safe-area spacing, a visible
  begin button, and no horizontal scrolling.
- On the normal URL, verify the D:H:M:S countdown and dog responses on its
  third and sixth taps.
- Verify audio stays silent until a tap and that the sound control toggles it.
- In preview, verify progress completes and the heart finishes its sequence.
  Phase 2 now continues to the welcome; Phase 1 originally ended at the loader.
- To exercise a real unlock, temporarily set `config.targetISO` a minute into
  the future, reload the normal URL, and verify an automatic lock-to-loader
  transition; restore the birthday date immediately afterward.
- With optional assets/CDNs unavailable, verify warnings remain nonfatal and
  the loader still finishes.
- Hide and restore the tab; verify the countdown catches up and background
  animation resumes. Verify reduced-motion mode and restricted local storage
  do not block the journey.
- Check keyboard focus, button activation, screen-reader labels, and mute.

Automated validation completed for phase 1:

- 10 core tests passed: persistence and invalid storage, exact IST deadline,
  one-time unlock, asset caching/deduplication, decode timeout, cleanup,
  stylesheet-aware font loading, and unavailable audio APIs.
- 6 headless Chrome browser check groups passed: dog taps and sound, preview
  loading and replay, mobile/desktop layout, automatic midnight unlock,
  restricted storage, and blocked CDNs with reduced motion.
- Viewports checked: **360×640, 390×844, and 1440×1000**. The main lock button
  fits the initial viewport, tap targets are at least 48px, and no horizontal
  overflow or uncaught JavaScript exceptions were detected.
- The loader was observed for at least 2.5 seconds before its completion
  sequence. Post-unlock audio starts only after a tap.

Run the core checks with Node (optional development tooling, not a site
dependency):

```powershell
node --experimental-default-type=module --test tests/core.test.mjs
```

The workspace's `.phase1-checks/` folder holds the original browser test
runner, screenshots, and JSON results; it is outside the deployable site
folder. Its terminal-loader assertions describe the Phase 1 build and need
updating for the full journey when smoke testing resumes.
These checks do not replace real-phone verification, especially iPhone Safari
15+ and Android Chrome 100+. Test again with the final media on mobile data and
Wi-Fi before launch. The complete site should stay below the 25 MB budget.
