// Every parser returns one of these two shapes, so callers never have to guess whether
// a parse worked. Never return partial or guessed data as `ok: true` - fail instead and
// the UI can show "couldn't read this page" (Design doc 3.2, NFR-4).

/**
 * @template T
 * @param {T} data
 * @param {string[]} [warnings] things that looked off but didn't stop the parse
 * @returns {{ ok: true, data: T, warnings: string[] }}
 */
export function ok(data, warnings = []) {
  return { ok: true, data, warnings };
}

/**
 * @param {string} reason a short, human-readable explanation of what couldn't be found
 * @returns {{ ok: false, reason: string }}
 */
export function fail(reason) {
  return { ok: false, reason };
}
