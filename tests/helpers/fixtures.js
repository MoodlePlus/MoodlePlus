// Loads saved HTML pages from tests/fixtures/ as real DOM Documents for parser tests.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

/** Absolute path of a fixture, e.g. fixturePath('moodle/student1/user-report.html'). */
export function fixturePath(relativePath) {
  return join(FIXTURES_DIR, relativePath);
}

export function fixtureExists(relativePath) {
  return existsSync(fixturePath(relativePath));
}

/**
 * @param {string} relativePath path under tests/fixtures/
 * @param {string} [url] the URL the page was saved from (some parsers resolve links against it)
 * @returns {Document}
 */
export function loadFixture(relativePath, url = 'http://localhost:8000/') {
  const html = readFileSync(fixturePath(relativePath), 'utf8');
  return new JSDOM(html, { url }).window.document;
}

/** Builds a Document from an HTML string, for small inline test cases. */
export function htmlToDocument(html, url = 'http://localhost:8000/') {
  return new JSDOM(html, { url }).window.document;
}
