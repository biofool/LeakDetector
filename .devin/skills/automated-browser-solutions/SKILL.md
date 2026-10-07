---
name: automated-browser-solutions
description: Pick the right browser-automation path when Chromium cannot run on this Ubuntu host. Use for e2e/browser testing, headless browsing, scraping, screenshots, or any task that would invoke Playwright/Puppeteer/Chromium on this machine — including the workaround that existing Playwright suites already run here via the firefox/webkit projects.
---

# Automated Browser Solutions

## The core fact

**Chromium does not run on this Ubuntu host** (kernel/sandbox restriction).
Chromium-in-Playwright, Puppeteer, Chrome DevTools MCP launching its own
Chrome, Cypress, and plain `chromium`/`google-chrome` binaries all fail for
the same reason. Switching test *frameworks* does not help — they all drive
the same browser binary.

**But Firefox and WebKit DO run here.** Playwright is multi-browser, so the
fix is usually a `--project` flag, not a new tool.

## Verified state on this host (2026-10-02, Playwright 1.62.1)

- `~/.cache/ms-playwright/firefox-1538` and `webkit-2336` — launch OK
- Chromium binaries present in ms-playwright but cannot launch on host
- `bash tests/e2e/run.sh redirects --project=firefox` in quantumaikido.com:
  14/14 passed end-to-end (stub PHP servers included)

If a Playwright browser fails with "Executable doesn't exist at
.../firefox-NNNN", the package version and installed browser revision
drifted — run `node_modules/.bin/playwright install firefox webkit`.

## Decision tree

### 1. Existing repo has a Playwright suite → run the firefox/webkit projects

quantumaikido.com `tests/e2e/playwright.config.js` already defines
`chromium`/`firefox`/`webkit` projects:

```bash
bash tests/e2e/run.sh --project=firefox            # host-safe today
bash tests/e2e/run.sh --project=webkit
bash tests/e2e/run.sh redirects --project=firefox  # one spec
```

`run.sh`'s chromium check auto-skips when chromium binaries exist, so it
passes through cleanly. If a repo's config only has a chromium project,
add the other two project entries — tests rarely need per-browser code.

### 2. Need real Chromium specifically → Debian container

For Chromium-only gates (deploy checks, CDP features, Chrome-only bugs):

```bash
docker run --rm -v "$PWD:/repo" -w /repo -e PLAYWRIGHT_BROWSERS_PATH=/ms-pw \
  node:20-bookworm bash -c "npm ci && npx playwright install --with-deps chromium && npx playwright test --project=chromium"
```

Mounting `PLAYWRIGHT_BROWSERS_PATH` to a volume avoids re-downloading
browsers each run. This is the documented path in both repo AGENTS.md files.

### 3. Real Chromium without containerizing the test runner → remote CDP

Launch headless Chromium in the container, drive it from host Playwright:

```bash
# in container:
chromium --headless --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 about:blank
# on host:
node -e "require('playwright').chromium.connectOverCDP('http://CONTAINER_IP:9222')"
```

Also works against Browserless (`wss://...` endpoint) if a container isn't
practical.

### 4. Ad-hoc agent browsing (not CI) → chrome-devtools MCP

A `chrome-devtools` MCP server is configured in `~/.config/devin/mcp_config.json`
(navigate, click, fill/fill_form, evaluate_script, screenshot, emulate,
network inspection). It needs a Chrome it can launch — on this host point it
at a remote/browserUrl Chrome (same container trick) or use it for pages a
system browser can reach. For simply *viewing* a local dev server, prefer
Devin's `browser_preview` — no browser binary needed on the preview side.

### 5. DOM logic without a real browser → jsdom / happy-dom

Component-level assertions (DOM structure, form logic, event handlers) run
in vitest/jest with `happy-dom` or `jsdom`. Fast, zero browser dependency —
but no real layout, fonts, or rendering engine.

### 6. Status/redirect/content smoke checks → plain HTTP

Deploy verification like "is /demo.html 200, is /dashboard 403, does the
canonical answer text appear" needs only `curl` or `requests`. The
AIRichardMoon staging smoke suite is mostly this. Don't reach for a browser
when a status code and a grep answer the question.

### 7. Hosted grids → last resort

BrowserStack / Sauce / Browserless cloud / Playwright `connect(wsEndpoint)`.
Paid, network-dependent; only when local browsers genuinely can't cover a
matrix (real Safari on macOS, mobile Safari, Edge).

## What does NOT help on this host

- Puppeteer — Chromium-only (its experimental Firefox/BiDi path is fragile)
- Cypress — Chromium/Electron-based
- Selenium/WebdriverIO — fine tools, but the *browser* is the constraint;
  Selenium+geckodriver (Firefox) is the only Selenium combo that works here
- `npx playwright install chromium` — installs fine, still can't launch

## Caveats

- **Visual baselines are per-project**: `snapshotPathTemplate` keys
  screenshots by projectName — chromium baselines can't be regenerated or
  compared via the firefox project. Visual diff work still needs the Debian
  container.
- **Engine differences are real**: passing under firefox/webkit does not
  prove Chromium rendering. For a Chromium-only deploy gate, containerize.
- Keep browser revisions in sync with the installed `@playwright/test`
  version; run `playwright install` after any package bump.
