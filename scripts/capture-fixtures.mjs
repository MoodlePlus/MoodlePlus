// Saves real pages from the local Moodle instance as test fixtures:
//   tests/fixtures/moodle/<student>/<page>.html
//
// Usage (the local Moodle must be running - see tests/moodle-env/README.md):
//   npm run capture-fixtures
//
// Optional environment variables:
//   MOODLE_URL  default http://localhost:8000
//   COURSE_ID   default 2 (the example course on a fresh site)
//
// Only use this against the local test instance. Its accounts and grades are fake, so the
// saved pages are safe to commit.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = process.env.MOODLE_URL ?? 'http://localhost:8000';
const COURSE_ID = Number(process.env.COURSE_ID ?? 2);
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures', 'moodle');

// Passwords match usernames (tests/moodle-env/README.md, "Accounts").
const STUDENTS = ['student1', 'student2', 'student3'];

const PAGES = [
  { file: 'user-report.html', path: `/grade/report/user/index.php?id=${COURSE_ID}` },
  { file: 'grades-overview.html', path: '/grade/report/overview/index.php' },
  { file: 'calendar-upcoming.html', path: '/calendar/view.php?view=upcoming' },
  { file: 'course-page.html', path: `/course/view.php?id=${COURSE_ID}` },
];

/** Just enough cookie handling to keep a Moodle session across requests. */
class CookieJar {
  #cookies = new Map();

  store(response) {
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const eq = pair.indexOf('=');
      this.#cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
    }
  }

  header() {
    return [...this.#cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }
}

/** fetch() that keeps cookies and follows redirects itself (so cookies set mid-redirect stick). */
async function request(jar, path, options = {}, redirectsLeft = 10) {
  const response = await fetch(new URL(path, BASE_URL), {
    ...options,
    redirect: 'manual',
    headers: { ...options.headers, cookie: jar.header() },
  });
  jar.store(response);

  const location = response.headers.get('location');
  if (response.status >= 300 && response.status < 400 && location) {
    if (redirectsLeft === 0) throw new Error(`Too many redirects at ${path}`);
    return request(jar, location, {}, redirectsLeft - 1);
  }
  return response;
}

const isLoginPage = (html) => /<body[^>]*id="page-login-index"/.test(html);

async function login(username, password) {
  const jar = new CookieJar();
  const loginHtml = await (await request(jar, '/login/index.php')).text();
  const logintoken = loginHtml.match(/name="logintoken"[^>]*value="([^"]+)"/)?.[1];
  if (!logintoken) throw new Error("Couldn't find the login form. Is this a Moodle login page?");

  const response = await request(jar, '/login/index.php', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password, logintoken, anchor: '' }),
  });
  if (isLoginPage(await response.text())) throw new Error(`Login failed for ${username}.`);
  return jar;
}

/** Session keys change on every login; blank them so re-captures don't create noisy diffs. */
function redactSessionKeys(html) {
  return html.replace(/("sesskey"\s*:\s*"|sesskey=|name="sesskey" value=")[A-Za-z0-9]+/g, '$1REDACTED');
}

async function main() {
  try {
    await fetch(BASE_URL);
  } catch {
    console.error(`Can't reach ${BASE_URL}. Start the local Moodle first: cd tests/moodle-env && ./moodle.sh start`);
    process.exit(1);
  }

  for (const student of STUDENTS) {
    const jar = await login(student, student);
    await mkdir(join(OUT_DIR, student), { recursive: true });

    for (const page of PAGES) {
      const html = await (await request(jar, page.path)).text();
      if (isLoginPage(html)) throw new Error(`Got the login page instead of ${page.path} for ${student}.`);

      const outFile = join(OUT_DIR, student, page.file);
      await writeFile(outFile, redactSessionKeys(html));
      console.log(`saved ${student}/${page.file}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
