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
npm run dev
```

## Build

Produce a production build in `dist/`:

```bash
npm run build
```

## Loading the extension

### Chrome

1. Run `npm run build` (or `npm run dev` for a watch build).
2. Go to `chrome://extensions`.
3. Enable **Developer mode** (top right toggle).
4. Click **Load unpacked** and select the `dist/` folder.

### Firefox (temporary install)

1. Run `npm run build` (or `npm run dev`).
2. Go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…**.
4. Select any file inside `dist/` (e.g. `dist/manifest.json`).

Note: Firefox temporary add-ons are removed when Firefox restarts, so you'll need to reload after every restart.

## Local Moodle testing

NCSU does not provide API access to WolfWare, so we develop and test against a **self-hosted local Moodle instance run via Docker** rather than the live site. If you don't already have this set up, search for **"bitnami moodle docker"** for a current setup guide.

## Linting & tests

```bash
npm run lint
npm run test
```

## Configuration notes

- The content script match pattern in [`manifest.json`](manifest.json) (`*://wolfware.ncsu.edu/*`) is a **placeholder** — confirm the actual WolfWare/Moodle domain(s) and subdomains (and adjust for your local Docker Moodle instance during development) before relying on it.

## Project structure

```
MoodlePlus/
├── manifest.json              # Manifest V3 skeleton
├── vite.config.js             # Vite + vite-plugin-web-extension config
├── src/
│   ├── background/
│   │   └── service-worker.js     # MV3 background service worker (stub)
│   ├── content-scripts/
│   │   ├── dashboard-parser.js   # Parses the WolfWare dashboard (stub)
│   │   ├── course-parser.js      # Parses individual course pages (stub)
│   │   └── gradebook-parser.js   # Parses gradebook/grades pages (stub)
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   └── storage/
│       └── index.js              # browser.storage wrapper (stub)
├── tests/
│   └── smoke.test.js
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
