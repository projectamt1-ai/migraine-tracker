# AI Migraine Tracker

**AI Migraine Tracker** is a local‑first, offline‑capable progressive web application (PWA) to help you log migraine episodes, visualise patterns and receive gentle, rule‑based insights. Everything runs entirely on your device; no data ever leaves your browser.

## Features

- **Log episodes** with date/time, intensity, duration, triggers, medications and notes. Add custom triggers and multiple medications per entry. Validation warns you about impossible values and future dates.
- **Timeline** view shows your episodes in reverse chronological order. Filter by last 7/30/90 days or all time and search notes. Edit or delete entries inline.
- **Charts** are drawn with the Canvas API to show your intensity over the last 90 days, episodes per week (12‑week history) and most frequent triggers in the last month.
- **Insights** compute simple patterns after each save: common triggers, time‑of‑day clusters, day‑of‑week trends, rising intensity and potential medication overuse. These suggestions are empathetic and never make medical claims.
- **Reminders** use the Notifications API to send one local notification every day at your chosen time. If notifications are blocked, an in‑app banner explains how to enable them.
- **Export/import** episodes to CSV or JSON. JSON backups can be merged with or replace existing data.
- **Settings** include theme (system, light, dark), reduced motion and reminder configuration. Dark mode and reduced motion honour system preferences by default.
- **Offline & PWA**: A service worker caches the app shell and static assets, so you can log and view episodes without a network connection. The app is installable on desktop and mobile via your browser’s “Add to Home Screen”.

## Installation & Development

The project is 100% static and requires no backend. To run it locally during development you can use any static file server. The provided `dev` script uses [`http-server`](https://www.npmjs.com/package/http-server):

```bash
npm install  # installs dev dependencies (vitest & playwright)
npm run dev  # serves the site at http://localhost:3000
```

Open your browser to `http://localhost:3000` to use the app. When you make changes to the source files the page will automatically reload.

### Tests

Unit tests are written with [Vitest](https://vitest.dev/). They cover the pattern detection logic and CSV export. To run them:

```bash
npm run test
```

An end‑to‑end test using [Playwright](https://playwright.dev/) demonstrates a happy path of logging an episode and seeing it in the timeline. Run it with:

```bash
npm run test:e2e
```

Make sure the dev server (`npm run dev`) is running on `http://localhost:3000` before launching the Playwright test.

## Building for production

There is no build step required. Simply copy the contents of this folder (`index.html`, `manifest.json`, `sw.js`, `assets`, `src`) to your static hosting provider (e.g. GitHub Pages or Vercel). The service worker will cache the app shell on first load.

## File structure

```
index.html          – Entry point with PWA registration
manifest.json       – Web App Manifest
sw.js               – Service worker for offline caching
assets/
  style.css         – Shared styles and themes
  icons/            – PWA icons
src/
  main.js           – Bootstraps the app and UI
  app.js            – Central state manager
  ui.js             – UI rendering and event handling
  storage.js        – Data layer built on localStorage
  patterns.js       – Rule‑based heuristics for insights
  charts.js         – Simple canvas charts
  reminders.js      – Scheduling of notifications
tests/
  patterns.test.js  – Unit tests for patterns
  csv.test.js       – Unit tests for CSV export
  e2e.spec.js       – Playwright happy path test
package.json        – Scripts and dev dependencies
README.md           – This file
```

## Notes & limitations

- This MVP intentionally avoids external dependencies (e.g. Chart.js) to keep the bundle lightweight and offline‑friendly. Charts are drawn manually on `<canvas>` elements.
- Data is stored in the browser’s `localStorage`. Clearing site data will remove all episodes. Consider backing up your data via the JSON export feature.
- Notifications must be enabled manually in your browser to use daily reminders. If blocked, a banner will appear with guidance.
- The insights are rule‑based heuristics and **not** medical advice. For personalised care please consult a healthcare professional.