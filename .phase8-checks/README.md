# Personalization and candle-ending browser checks

Run `node review.mjs` while the local site is served at http://127.0.0.1:4173/.
The runner uses the existing local headless-Chrome helper in `.phase1-checks`;
it does not use the old Phase 1 smoke suite or its terminal-loader assumptions.

Coverage: real photo loading, all memory cards and updated labels, native music
play request after a click, all five secret-clue targets, second-wish opening/
closing without submission, missing personal voice continuation, exact updated
letter and separate signature/postscript, certificate PNG export, C14→C15,
light→release→greeting, reduced motion, phone/desktop overflow and JS exceptions.

Screenshots and results.json are local QA artifacts; they are not deployed.
No wish submissions or external uploads are performed. Personal voice notes
remain absent and are intentionally tested through their honest missing state.
