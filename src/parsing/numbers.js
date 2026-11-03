// Turning Moodle's display text into numbers.
//
// Golden rule (Design doc 3.3): an empty grade is NOT a zero. Moodle shows "-" for a grade
// that hasn't been entered; that must become null, while "0.00" becomes 0.

const EMPTY_MARKERS = new Set(['', '-', '–', '—']);

/**
 * True for Moodle's "not graded yet" markers ("-", "", dashes) - including when other text
 * follows, like a quiz's "- Grade analysis" link. A negative number ("-5.00") is not empty.
 */
export function isEmptyGrade(text) {
  const trimmed = text.trim();
  return EMPTY_MARKERS.has(trimmed) || /^[-–—](\s|$)/.test(trimmed);
}

/**
 * Finds a percentage written inside other text, e.g. the "70.00" in "C- (70.00 %)" -
 * how Moodle shows grades when a course displays them as "letter (percentage)".
 * Prefers a parenthesised value. Returns null if there isn't one.
 * @param {string} text
 * @returns {number|null}
 */
export function percentInText(text) {
  const match =
    text.replace(/,/g, '').match(/\(\s*(-?\d+(?:\.\d+)?)\s*%\s*\)/) ??
    text.replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : null;
}

// NC State's standard letter scale (bottom of each range). Individual courses can define
// their own letters in Moodle, so a letter-only grade is always an *estimate*.
const LETTER_FLOORS = {
  'A+': 97, A: 93, 'A-': 90,
  'B+': 87, B: 83, 'B-': 80,
  'C+': 77, C: 73, 'C-': 70,
  'D+': 67, D: 63, 'D-': 60,
  F: 0,
};

/**
 * Estimates a percentage for a letter grade ("A+", "B-") as the bottom of its range - the
 * conservative choice, so "what do I need" never comes out too low. Reads the leading
 * letter, so trailing text like a quiz's "Grade analysis" link doesn't get in the way.
 * @param {string} text
 * @returns {number|null} null if the text doesn't start with a letter grade
 */
export function letterGradeFloor(text) {
  const match = text.trim().toUpperCase().match(/^([A-DF][+-]?)(?=\s|\(|$)/);
  return match ? (LETTER_FLOORS[match[1]] ?? null) : null;
}

/**
 * Parses a grade like "18.00", "1,234.5" or "-". Returns null for empty/unparseable.
 * @param {string} text
 * @returns {number|null}
 */
export function parseGrade(text) {
  const trimmed = text.trim();
  if (EMPTY_MARKERS.has(trimmed)) return null;

  const match = trimmed.replace(/,/g, '').match(/^-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/**
 * Parses a percentage like "90.00 %" or "90%". Returns null for empty/unparseable.
 * @param {string} text
 * @returns {number|null}
 */
export function parsePercent(text) {
  return parseGrade(text.replace('%', ''));
}

/**
 * Parses a range like "0–20" (Moodle uses an en dash) into { min, max }.
 * @param {string} text
 * @returns {{ min: number, max: number }|null}
 */
export function parseRange(text) {
  const match = text.replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)\s*[–—-]\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  return { min: Number(match[1]), max: Number(match[2]) };
}
