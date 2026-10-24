# Parsing guide

How the parsing layer is set up, what's already done, and what to build next, in order.
Read the "Parsing Strategy" and "Data Model" sections of the Design doc (3.1, 3.2) alongside this.

## How it fits together

```
WolfWare page
   │
   ▼
src/content-scripts/main.js      the only content script; runs on every WolfWare page
   │  detectPage()               which page is this? (src/parsing/pageType.js)
   │  parseXxx(document)         the matching parser (src/parsing/parsers/)
   ▼
src/storage/courseCache.js       saves the result, keyed by course, with a timestamp
   │
   ▼
popup / overlay UI               reads from storage, never from the page
```

**Parsers are pure functions.** Each one takes a `Document` and returns either
`{ ok: true, data, warnings }` or `{ ok: false, reason }`, using the helpers in
[`result.js`](../src/parsing/result.js). Parsers don't touch storage or `browser.*`; `main.js`
does that. This means you can test a parser in Vitest with a saved HTML page, without
loading the extension.

## What's already done

| File | Status |
|---|---|
| [`src/parsing/dom.js`](../src/parsing/dom.js) | Done. `queryFirst` (try selectors in order), `cleanText`, `numberParamFromUrl` |
| [`src/parsing/numbers.js`](../src/parsing/numbers.js) | Done. `parseGrade("-")` → `null`, `parseGrade("0.00")` → `0`, `parsePercent`, `parseRange` |
| [`src/parsing/pageType.js`](../src/parsing/pageType.js) | Done. Detects the page from Moodle's `<body id="page-…">` and reads the course id |
| [`src/parsing/parsers/userReport.js`](../src/parsing/parsers/userReport.js) | **Written, needs checking against the real page** (task 1) |
| [`src/parsing/parsers/gradesOverview.js`](../src/parsing/parsers/gradesOverview.js) | **Yours** (task 2). Skeleton with step-by-step TODOs |
| [`src/parsing/parsers/calendarUpcoming.js`](../src/parsing/parsers/calendarUpcoming.js) | **Yours** (task 3). Skeleton with step-by-step TODOs |
| [`src/content-scripts/main.js`](../src/content-scripts/main.js) | Done. Already wired to all three parsers and storage |
| [`src/storage/courseCache.js`](../src/storage/courseCache.js) | Done. `saveCourseData`, `saveCourseList`, `saveParseStatus` |
| [`scripts/capture-fixtures.mjs`](../scripts/capture-fixtures.mjs) | Done. Saves real pages from the local Moodle for tests |

The user report parser was written against a **hand-written** copy of the page
([`tests/fixtures/handmade/user-report.html`](../tests/fixtures/handmade/user-report.html)),
because the real site wasn't available when it was written. Its logic is tested, but class
names may not match the real page exactly. Checking that is task 1, and it's a good way to learn
how the code works before writing your own parser.

## Setup (about 15 minutes)

1. Start the local Moodle (first time: `./moodle.sh init`, about 5 minutes):
   ```bash
   cd tests/moodle-env
   ./moodle.sh start
   ```
2. Save the real pages as test fixtures. This logs in as student1-3 and writes
   `tests/fixtures/moodle/<student>/*.html`:
   ```bash
   npm run capture-fixtures
   ```
3. Run the tests. Tests for the real pages are skipped until step 2 has run; now they run too:
   ```bash
   npm test
   ```
4. See it in the browser: `npm run dev`, load `dist/` in Chrome (see the README), log in to
   <http://localhost:8000> as `student1` / `student1` and open
   <http://localhost:8000/grade/report/user/index.php?id=2>. In DevTools → Console, pick the
   **Moodle+** context from the dropdown at the top (content scripts log there, not in the page's
   context). You should see `[Moodle+] Read userReport: 4 categories, current grade 86.65% …`.

## Task 1: check the user report parser against the real page

Goal: the three `parseUserReport (real page, studentN)` tests pass. They check the parser +
grade calculator against Moodle's own numbers (`tests/moodle-env/README.md`, section 4).

If they fail:

1. Open `tests/fixtures/moodle/student1/user-report.html` in your browser and in your editor
   side by side with `tests/fixtures/handmade/user-report.html`.
2. Compare: the table's classes, the `levelN` classes on the item name cells, how a category
   **total** row is marked (`baggb`/`baggt`?), and what the weight cell says for the dropped
   Homework 2 and the extra credit survey. The spots most likely to need changes are marked
   `TODO(verify)` in `userReport.js`.
3. Fix the selector or rule, re-run `npm test`. When it passes, update the hand-written fixture
   so it matches the real markup too.

## Task 2: grades overview → list of courses (FR-1)

Follow the numbered TODO in [`gradesOverview.js`](../src/parsing/parsers/gradesOverview.js) and
turn the `it.todo` lines in `gradesOverview.test.js` into real tests.

**Done when:** the tests pass against `tests/fixtures/moodle/student1/grades-overview.html`, and
visiting <http://localhost:8000/grade/report/overview/index.php> with the extension loaded logs
`[Moodle+] Read gradesOverview: 1 courses`.

## Task 3: upcoming events → due dates (FR-2)

Same again with [`calendarUpcoming.js`](../src/parsing/parsers/calendarUpcoming.js). `main.js`
already groups the events by course and saves them.

**Done when:** Homework 4, Quiz 3 and the Final Exam come back with correct due dates, read from
timestamps rather than display text.

## Later

- Nested categories in the user report (search `TODO` in `userReport.js`).
- Check against a real WolfWare page from your own account. Save it (Ctrl+S, "Webpage, HTML
  only"), and **replace your name, student ID and grades** before committing it under
  `tests/fixtures/wolfware/`. NC State's theme changes page chrome, but the grade tables use core
  Moodle templates, so most selectors should carry over.

## Rules for every parser

1. **Selectors, most stable first.** Use `queryFirst(doc, [...])` with `data-*` attributes first,
   then ids/classes, then structure. Never "the 3rd column": find cells by class.
2. **An empty grade is `null`, never `0`.** Moodle shows `-` for "not entered yet".
   `parseGrade` already handles this; don't bypass it.
3. **Fail loudly.** If something essential is missing, `return fail("Couldn't find …")`. Never
   return made-up or partial data as `ok`. Use `warnings` for things that look odd but don't break
   the result.
4. **Numbers over display text.** Ids from link `?id=` parameters, dates from timestamps.
5. **Test first.** Write the test against the fixture, watch it fail, then make it pass:
   `npx vitest src/parsing` re-runs on every save.

## Inspecting a page

- Right-click the thing you want → **Inspect**. Look for `id`, `data-*` attributes and
  meaningful class names on it and its parents.
- Try selectors in the Console before putting them in code:
  `document.querySelectorAll('table.user-grade tbody tr').length`
  (`$$('…')` is a DevTools shortcut for `querySelectorAll`).
- Moodle's page type is on `<body id="page-…">`, and the course on `class="… course-2 …"`.
- Reading Moodle's source tells you exactly what markup to expect. The user report is built in
  [`grade/report/user/classes/report/user.php`](https://github.com/moodle/moodle/blob/MOODLE_405_STABLE/grade/report/user/classes/report/user.php)
  (NC State runs Moodle 4.5).

## Resources

- Content scripts: [Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) ·
  [MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts)
- [`querySelector` / `querySelectorAll`](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelectorAll) and
  [CSS attribute selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors)
- [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver), for content that loads after the page
- Moodle docs: [User report](https://docs.moodle.org/405/en/User_report) ·
  [Grade aggregation](https://docs.moodle.org/405/en/Grade_aggregation) (what "Natural", weights and drop-lowest mean)
- [Vitest](https://vitest.dev/guide/) · [jsdom](https://github.com/jsdom/jsdom), which builds the `Document` in tests

Stuck for more than a day? Post it in the team chat (Setup doc, section 9).
