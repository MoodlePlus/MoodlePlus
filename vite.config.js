import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';

// The local Docker Moodle instance from tests/moodle-env/ (see moodle.env).
const LOCAL_MOODLE_MATCH = 'http://localhost:8000/*';

// --mode is a dash-separated list of flags:
//   "firefox"   build for Firefox instead of Chrome (output goes to dist-firefox/)
//   "localhost" also run content scripts on the local Moodle instance
//              (Vite reserves the mode name "local", hence the longer name)
// `npm run dev` always includes the local instance; production builds never do.
export default defineConfig(({ command, mode }) => {
  const flags = mode.split('-');
  const browser = flags.includes('firefox') ? 'firefox' : 'chrome';
  const includeLocalMoodle = command === 'serve' || flags.includes('localhost');

  return {
    build: {
      outDir: browser === 'firefox' ? 'dist-firefox' : 'dist',
    },
    plugins: [
      webExtension({
        manifest: 'manifest.json',
        browser,
        transformManifest(manifest) {
          if (includeLocalMoodle) {
            for (const contentScript of manifest.content_scripts ?? []) {
              contentScript.matches.push(LOCAL_MOODLE_MATCH);
            }
          }
          return manifest;
        },
      }),
    ],
  };
});
