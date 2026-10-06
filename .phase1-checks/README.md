# Local phase 1 browser checks

Requires Node 22+ (native `WebSocket` and `fetch`), installed Google Chrome,
and the completed birthday site served at `http://127.0.0.1:4173`.
No npm dependencies are required. The in-app Node REPL/browser tool was
unavailable in this session, so these checks use an isolated headless Chrome.

Start the site from `D:\gwebspecial\riddhi-birthday`:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Then run from the workspace:

```powershell
node .phase1-checks/smoke.mjs
```

`BASE_URL` and `CHROME_PATH` environment variables can override their defaults.
The browser is spawned with `windowsHide: true`, a workspace-only profile,
and a random debugging port bound to localhost. It is closed after the run.
Profiles, screenshots, logs, and JSON results remain inside `.phase1-checks`.
These files are development checks and are not part of the deployed site.

`cdp.mjs` exports `launch`, `open`, `navigate`, `evaluate` (also `eval`),
`screenshot`, `click`, `waitFor`, and `viewport` for focused follow-up checks.
`smoke.mjs` covers the lock interactions, loader/replay, automatic unlock,
mobile/desktop layout, missing resources, blocked storage, optional CDN
failures, and reduced-motion mode. Date and storage changes apply only to
test documents using `Page.addScriptToEvaluateOnNewDocument`.

Headless Chromium checks do not prove real iOS/Android audio, safe-area,
touch, or browser compatibility. Run the phone checks in the app README too.
