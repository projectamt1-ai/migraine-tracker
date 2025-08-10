# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 – Initial MVP

- Scaffolded project structure with `index.html`, service worker, manifest and icons.
- Implemented a localStorage data layer (`storage.js`) supporting CRUD on episodes, settings persistence, and export/import (CSV & JSON).
- Added rule‑based pattern analysis (`patterns.js`) covering frequent triggers, time‑of‑day clustering, day‑of‑week trends, rising intensity and medication overuse.
- Created simple charting module (`charts.js`) using the HTML canvas to draw line, bar and horizontal bar charts for intensity, weekly counts and trigger frequencies.
- Built central state manager (`app.js`) exposing subscription model for UI updates, and wired reminder scheduling via the Notifications API.
- Developed UI layer (`ui.js`) with accessible forms for logging episodes, timeline filtering/search, settings (theme, reduced motion, reminders, export/import) and display of insights.
- Added responsive, migraine‑friendly styles with dark mode and reduced motion support.
- Configured a service worker (`sw.js`) to cache static assets for offline use and PWA installation; provided `manifest.json` with icons and metadata.
- Added basic unit tests for pattern detection and CSV export (Vitest) and an example end‑to‑end Playwright test.