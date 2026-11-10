# Tiko – Read & Count

A calm, fun, bilingual (English / French) reading and maths app for a young learner, built as an offline Progressive Web App.

**Open it:** https://krishnenc.github.io/tiko/

## Install on an Android tablet
1. Open the link above in **Chrome**.
2. Tap **⋮ → Add to Home screen / Install app**. It now opens full-screen and works offline.
3. Tablet **Settings → General management → Text-to-speech → Google → Install voice data**, then download **English (UK)** and **French (France)**.

## Updating
Push changes to `main`. GitHub Pages redeploys in a minute or two, and the tablet picks up the new version the next time the app is opened.
Bump `VERSION` in `sw.js` (and `APP_VERSION` in `app.js`) when you change files, so the offline cache refreshes.

## Developing
See [docs/DEVELOPING.md](docs/DEVELOPING.md) for the architecture, the design rules, how to add an activity, and how to test and ship.

Progress is stored only on the tablet (browser storage). Clearing Chrome's site data resets it.
