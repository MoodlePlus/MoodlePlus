// Pure color math for page dark mode (src/content-scripts/pageDarkMode.js): given an
// element's computed background/text/border color, decide what it should become in dark
// mode - or null to leave it alone. Works from the page's real colors instead of a list
// of selectors, because NC State's own WolfWare theme is private and we can't see its CSS.
//
// The rules, in short:
//   - already-dark backgrounds (NC State red headers, primary buttons) stay as they are
//   - white/light-gray surfaces become charcoal; lighter originals end up *darker*, so
//     cards still separate from the page the way they did in light mode
//   - light *tinted* surfaces (alerts, badges) keep their hue, just deep and muted
//   - dark text becomes light; colored text (links, NC State red) keeps its hue, softened

/** @typedef {{ r: number, g: number, b: number, a: number }} RGBA */

/**
 * Parses a computed color ("rgb(1, 2, 3)" / "rgba(1, 2, 3, 0.5)"). Anything else
 * (e.g. a wide-gamut color() value) returns null and the element is left alone.
 * @param {string|null|undefined} value
 * @returns {RGBA|null}
 */
export function parseColor(value) {
  const match = value?.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (!match) return null;
  const [, r, g, b, alpha] = match;
  let a = 1;
  if (alpha !== undefined) a = alpha.endsWith('%') ? parseFloat(alpha) / 100 : parseFloat(alpha);
  return { r: Number(r), g: Number(g), b: Number(b), a };
}

/** @param {RGBA} color @returns {{ h: number, s: number, l: number }} each 0..1 */
export function rgbToHsl({ r, g, b }) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h / 6, s, l };
}

function hslToCss({ h, s, l }, a = 1) {
  const deg = Math.round(h * 360);
  const pct = (x) => `${Math.round(x * 1000) / 10}%`;
  return a < 1 ? `hsla(${deg}, ${pct(s)}, ${pct(l)}, ${a})` : `hsl(${deg}, ${pct(s)}, ${pct(l)})`;
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Neutral grays get this slight cool tint, matching the extension's own dark palette.
const NEUTRAL = { h: 220 / 360, s: 0.08 };
const isNeutral = (hsl) => hsl.s < 0.15;

/**
 * @param {RGBA|null} color
 * @returns {string|null} the dark-mode background, or null to leave the element alone
 */
export function remapBackground(color) {
  if (!color || color.a === 0) return null;
  const hsl = rgbToHsl(color);
  if (hsl.l < 0.45) return null; // already dark: keep brand colors and dark UI as designed

  const l = clamp(0.15 + (0.98 - hsl.l) * 0.6, 0.13, 0.32);
  if (isNeutral(hsl)) return hslToCss({ ...NEUTRAL, l }, color.a);
  return hslToCss({ h: hsl.h, s: hsl.s * 0.45, l: Math.min(l + 0.04, 0.32) }, color.a);
}

/**
 * @param {RGBA|null} color
 * @returns {string|null} the dark-mode text color, or null to leave it alone
 */
export function remapText(color) {
  if (!color || color.a === 0) return null;
  const hsl = rgbToHsl(color);
  if (hsl.l > 0.55) return null; // already light enough to read on dark

  // Darker originals become lighter, so body text vs. muted text keeps its contrast.
  if (isNeutral(hsl)) return hslToCss({ ...NEUTRAL, s: 0.04, l: clamp(0.9 - hsl.l * 0.35, 0.7, 0.9) }, color.a);
  return hslToCss({ h: hsl.h, s: Math.min(hsl.s, 0.7), l: clamp(0.76 - hsl.l * 0.2, 0.62, 0.8) }, color.a);
}

/**
 * @param {RGBA|null} color
 * @returns {string|null} the dark-mode border color, or null to leave it alone
 */
export function remapBorder(color) {
  if (!color || color.a === 0) return null;
  const hsl = rgbToHsl(color);
  if (hsl.l < 0.6) return null;
  return hslToCss({ ...NEUTRAL, s: 0.06, l: clamp(0.3 - (hsl.l - 0.6) * 0.25, 0.2, 0.3) }, color.a);
}
