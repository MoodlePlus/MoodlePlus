# Parsing guide

How Moodle+ reads WolfWare pages: where everything lives, what each parser reads, and how to
fix a parser when a real page breaks it. Read the "Parsing Strategy" and "Data Model" sections
of the Design doc (3.1, 3.2) alongside this.

## How it fits together

```
WolfWare page
   │
   ▼
src/content-scripts/main.js      the only parsing content script; runs on every WolfWare page
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

## What's where

| File | What it does |
|---|---|
| [`src/parsing/dom.js`](../src/parsing/dom.js) | `queryFirst` (try selectors in order), `cleanText`, `numberParamFromUrl` |
| [`src/parsing/numbers.js`](../src/parsing/numbers.js) | Grade text → numbers: `parseGrade("-")` → `null`, `parseGrade("0.00")` → `0`, `percentInText("C- (70.00 %)")` → `70`, `letterGradeFloor("A+")` → `97` |
| [`src/parsing/pageType.js`](../src/parsing/pageType.js) | Which page this is (from `<body id="page-…">`), the course id and name, and whether it's a Moodle page at all |
| [`src/parsing/parsers/userReport.js`](../src/parsing/parsers/userReport.js) | One course's gradebook → grade categories for the calculator (FR-4) |
| [`src/parsing/parsers/gradesOverview.js`](../src/parsing/parsers/gradesOverview.js) | Grades overview → the student's course list (FR-1) |
| [`src/parsing/parsers/calendarUpcoming.js`](../src/parsing/parsers/calendarUpcoming.js) | Upcoming events → due dates for the calendar (FR-2) |
| [`src/content-scripts/main.js`](../src/content-scripts/main.js) | Runs the right parser on each page and saves the result |
| [`src/storage/courseCache.js`](../src/storage/courseCache.js) | Where parsed data is stored, plus weights the student entered |
| [`scripts/capture-fixtures.mjs`](../scripts/capture-fixtures.mjs) | Saves real pages from the local Moodle as test fixtures |

Tests sit next to each file (`*.test.js`). Each parser is tested against:

- **hand-written pages** in `tests/fixtures/handmade/`: fast, and always available.
  `user-report-nested-letters.html` copies the shape of a real NC State course (anonymised).
- **real captured pages** for student1–3 in `tests/fixtures/moodle/`: skipped with
  `describe.skipIf` until those exist.

## What real WolfWare gradebooks do

The local test course is tidy. Real courses aren't, and the user report parser handles all of
these (see the tests in `userReport.test.js`):

- **Nested categories** (e.g. Individual → Personal Contribution → Logs). Every grade item counts
  toward its *top-level* category, because that's what a syllabus gives weights for.
- **Hidden columns.** Instructors can hide "Calculated weight", "Range" and "Percentage". A
  weight that can't be read stays `null`, and the student enters it in the calculator.
- **Letter grades.** A percentage printed in the grade ("C- (70.00 %)") is used as-is. A bare
  letter ("A+") is estimated at the bottom of NC State's range and flagged as estimated.
- **Extra text in grade cells**, like a quiz's "Grade analysis" link next to the grade.

## Setup (about 15 minutes)

1. Start the local Moodle (first time: `./moodle.sh init`, about 5 minutes):
   ```bash
   cd tests/moodle-env
   ./moodle.sh start
   ```
2. Save the real pages as test fixtures. This logs in as student1–3 and writes
   `tests/fixtures/moodle/<student>/*.html`:
   ```bash
   npm run capture-fixtures
   ```
   **Due dates are relative to when the site was last seeded, not when you capture.** If your
   local Moodle has been sitting around for a while, Homework 4 / Quiz 3 may have aged out of
   the "upcoming events" window (or already be overdue) by the time you capture - the page will
   genuinely show fewer events, which is correct behavior, not a parser bug. Run
   `./moodle.sh reset` first if you want fixtures with the due dates fresh again.
3. Run the tests. Tests for the real pages are skipped until step 2 has run; now they run too:
   ```bash
   npm test
   ```
4. See it in the browser: `npm run build:localhost`, load `dist/` in Chrome (see the README),
   log in to <http://localhost:8000> as `student1` / `student1` and open
   <http://localhost:8000/grade/report/user/index.php?id=2>. In DevTools → Console, pick the
   **Moodle+** context from the dropdown at the top (content scripts log there, not in the page's
   context). You should see `[Moodle+] Read userReport: 4 categories, current grade 86.65% …`.

## When a parser breaks on a real page

1. Open the page, then DevTools → Console → **Moodle+** context. Every parser warning and
   failure is logged there with a `[Moodle+]` prefix; it usually names the problem directly.
2. Save the page (Ctrl+S, "Webpage, HTML only") and open it next to the closest hand-written
   fixture. Compare the table's classes, the `levelN` classes on name cells, how total rows are
   marked (`baggt`/`baggb`), and which columns exist.
3. **Before saving it into the repo, replace your name, student ID and grades.** Better still,
   copy just the structure into a new hand-written fixture, like
   `user-report-nested-letters.html`.
4. Write a failing test against it, fix the parser, and re-run `npm test` - the real-page tests
   make sure the fix doesn't break the local course.

## Rules for every parser

1. **Selectors, most stable first.** Use `queryFirst(doc, [...])` with `data-*` attributes first,
   then ids/classes, then structure. Never "the 3rd column": find cells by class.
2. **An empty grade is `null`, never `0`.** Moodle shows `-` for "not entered yet".
   `parseGrade` and `isEmptyGrade` already handle this; don't bypass them.
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
