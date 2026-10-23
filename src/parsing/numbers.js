// Turning Moodle's display text into numbers.
//
// Golden rule (Design doc 3.3): an empty grade is NOT a zero. Moodle shows "-" for a grade
// that hasn't been entered; that must become null, while "0.00" becomes 0.

const EMPTY_MARKERS = new Set(['', '-', '–', '—']);

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
