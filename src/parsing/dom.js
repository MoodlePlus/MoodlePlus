// Small DOM helpers shared by all parsers.

/**
 * Tries each selector in order and returns the first element found.
 *
 * Order selectors from most to least stable (Design doc 3.2):
 *   1. data-* attributes, e.g. [data-region="event-item"]
 *   2. ids and Moodle's semantic classes, e.g. table.user-grade
 *   3. structural fallbacks, e.g. #region-main table
 *
 * @param {ParentNode} root
 * @param {string[]} selectors
 * @returns {Element|null}
 */
export function queryFirst(root, selectors) {
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    if (element) return element;
  }
  return null;
}

/**
 * Like queryFirst, but returns every match for the first selector that matches anything.
 * @param {ParentNode} root
 * @param {string[]} selectors
 * @returns {Element[]}
 */
export function queryAllFirst(root, selectors) {
  for (const selector of selectors) {
    const elements = root.querySelectorAll(selector);
    if (elements.length > 0) return [...elements];
  }
  return [];
}

/**
 * The visible text of an element with whitespace collapsed, or "" for null.
 * Moodle hides helper text for screen readers in .sr-only / .accesshide; skip it so
 * "Homework 1" doesn't come back as "Assignment Homework 1".
 * @param {Element|null} element
 */
export function cleanText(element) {
  if (!element) return '';
  const copy = element.cloneNode(true);
  copy.querySelectorAll('.sr-only, .accesshide, .visually-hidden').forEach((hidden) => hidden.remove());
  return copy.textContent.replace(/\s+/g, ' ').trim();
}

/**
 * Reads a numeric query parameter from a link, e.g. id=42 from ".../view.php?id=42".
 * @param {string|null|undefined} href
 * @param {string} param
 * @returns {number|null}
 */
export function numberParamFromUrl(href, param) {
  if (!href) return null;
  try {
    const value = new URL(href, 'http://placeholder.invalid').searchParams.get(param);
    const number = Number(value);
    return value !== null && Number.isFinite(number) ? number : null;
  } catch {
    return null;
  }
}
