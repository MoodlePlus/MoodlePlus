# Moodle+ (WolfWare Enhancement Extension)

Moodle+ is a Chrome/Firefox browser extension (Manifest V3) that enhances NCSU's WolfWare/Moodle LMS with:

- A unified assignment calendar across all courses
- A grade calculator
- Dark mode
- A responsive mobile overlay

> Status: early scaffolding — most features are stubbed out and not yet implemented.

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS) and npm
- [Git](https://git-scm.com/)
- Chrome and/or Firefox (for loading/testing the unpacked extension)
- [Docker](https://www.docker.com/) (for running a local Moodle instance to develop/test against — see [Local Moodle testing](#local-moodle-testing) below)

## Clone the repo

```bash
git clone https://github.com/MoodlePlus/MoodlePlus.git
cd MoodlePlus
```

## Setup

Install dependencies:

```bash
npm install
```

## Development

Run the dev build (watches source files and rebuilds into `dist/` on change):

```bash
npm run dev            # Chrome
npm run dev:firefox    # Firefox (rebuilds into dist-firefox/)
```

Dev builds also run the content scripts on the local Moodle instance at `http://localhost:8000` (see [Local Moodle testing](#local-moodle-testing)).

## Build

Produce a production build:

```bash
npm run build            # Chrome  -> dist/
npm run build:firefox    # Firefox -> dist-firefox/
```

Firefox doesn't support MV3 background service workers, so the manifest uses `{{chrome}}.` / `{{firefox}}.` key prefixes and [vite-plugin-web-extension](https://github.com/aklinker1/vite-plugin-web-extension) writes the right one for each browser.

To test a one-off (non-watch) build against the local Moodle instance, use `npm run build:localhost` or `npm run build:firefox-localhost`. Never ship these builds: they also inject into anything on `localhost:8000`.

## Loading the extension

### Chrome

1. Run `npm run build` (or `npm run dev` for a watch build).
2. Go to `chrome://extensions`.
3. Enable **Developer mode** (top right toggle).
4. Click **Load unpacked** and select the `dist/` folder.

### Firefox (temporary install)

1. Run `npm run build:firefox` (or `npm run dev:firefox`).
2. Go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…**.
4. Select `dist-firefox/manifest.json`.

Notes:

- Firefox temporary add-ons are removed when Firefox restarts, so you'll need to reload after every restart.
- In Firefox, MV3 site access is opt-in. If the content scripts don't run, open `about:addons` → Moodle+ → **Permissions** and allow access to the WolfWare (or `localhost`) site.

## Local Moodle testing

NCSU does not provide API access to WolfWare, so we develop and test against a **self-hosted local Moodle instance run via Docker** rather than the live site. Start it with the script in [`tests/moodle-env/`](tests/moodle-env/README.md); it serves Moodle at `http://localhost:8000`, which dev builds already match.

## Linting & tests

```bash
npm run lint
npm run test
```

## Configuration notes

- The content script match pattern in [`manifest.json`](manifest.json) is `*://*.wolfware.ncsu.edu/*`, which covers `wolfware.ncsu.edu` and all of its subdomains. Narrow it once the exact course-site hostnames are confirmed.
- The local Moodle match (`http://localhost:8000/*`) is added by [`vite.config.js`](vite.config.js) for dev and `:localhost` builds only, so it never ends up in a production build.

## Project structure

```
MoodlePlus/
├── manifest.json              # Manifest V3 (with {{chrome}}/{{firefox}} keys)
├── vite.config.js             # Vite + vite-plugin-web-extension config
├── src/
│   ├── background/
│   │   └── service-worker.js     # Background script (service worker in Chrome) (stub)
│   ├── content-scripts/
│   │   └── main.js               # The only content script: detects the page, parses, caches
│   ├── parsing/                  # Pure DOM parsers (see docs/parsing-guide.md)
│   │   ├── pageType.js           # Which Moodle page is this?
│   │   ├── dom.js, numbers.js, result.js
│   │   └── parsers/              # userReport.js, gradesOverview.js, calendarUpcoming.js
│   ├── popup/
│   │   ├── popup.html            # Popup with dark mode toggle
│   │   ├── popup.js
│   │   └── popup.css
│   ├── storage/
│   │   ├── index.js              # browser.storage wrapper (all storage goes through here)
│   │   ├── courseCache.js        # Scraped data, keyed by course, with timestamps
│   │   ├── userSettings.js       # Persisted user preferences
│   │   └── userSettings.test.js
│   └── utils/
│       ├── gradeCalculator.js    # Weighted grade + required-final-score logic
│       └── gradeCalculator.test.js
├── tests/
│   ├── smoke.test.js
│   ├── fixtures/                 # Saved Moodle pages for parser tests
│   ├── helpers/                  # Test helpers (loading fixtures as DOM documents)
│   └── moodle-env/               # Local Docker Moodle instance (see its README)
├── scripts/
│   └── capture-fixtures.mjs      # npm run capture-fixtures: save pages from local Moodle
├── docs/
│   └── parsing-guide.md          # Start here if you're working on the parsers
├── eslint.config.js
├── package.json
├── LICENSE
└── CONTRIBUTING.md
```

## Tooling notes

We use **Vite** (via [vite-plugin-web-extension](https://github.com/aklinker1/vite-plugin-web-extension)) rather than Webpack: it needs far less configuration for Manifest V3 extensions, supports building for both Chrome and Firefox from a single `manifest.json`, and gives much faster rebuilds during development.

`npm audit` will report vulnerabilities in `web-ext-run` (a transitive dependency of `vite-plugin-web-extension` used only to optionally auto-launch a browser during `npm run dev` — we don't use that feature). They're unpatched upstream even in the latest release, and the only "fix" `npm audit fix --force` offers is downgrading `vite-plugin-web-extension` to a much older major version. This doesn't affect the built extension in `dist/`. Re-check periodically for an upstream fix, but don't force-downgrade to silence it.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for our branch/PR workflow.

## License

[MIT](LICENSE)
