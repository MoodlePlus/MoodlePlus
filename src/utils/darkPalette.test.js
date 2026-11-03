import { describe, it, expect } from 'vitest';
import { parseColor, rgbToHsl, remapBackground, remapText, remapBorder } from './darkPalette.js';

const lightnessOf = (css) => Number(css.match(/,\s*([\d.]+)%\)$/)?.[1] ?? css.match(/,\s*([\d.]+)%,\s*[\d.]+\)$/)?.[1]) / 100;
const hueOf = (css) => Number(css.match(/^hsla?\((\d+)/)[1]);

describe('parseColor', () => {
  it('parses computed rgb() and rgba() values', () => {
    expect(parseColor('rgb(255, 255, 255)')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('rgba(0, 0, 0, 0.05)')).toEqual({ r: 0, g: 0, b: 0, a: 0.05 });
  });

  it('returns null for anything it does not understand, so the element is left alone', () => {
    expect(parseColor('color(display-p3 1 0 0)')).toBeNull();
    expect(parseColor('')).toBeNull();
    expect(parseColor(undefined)).toBeNull();
  });
});

describe('rgbToHsl', () => {
  it('handles white, black and a saturated color', () => {
    expect(rgbToHsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 1 });
    expect(rgbToHsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 });
    expect(rgbToHsl({ r: 204, g: 0, b: 0 }).h).toBe(0); // NC State red
  });
});

describe('remapBackground', () => {
  it('leaves already-dark backgrounds alone (NC State red, primary buttons, black headers)', () => {
    expect(remapBackground(parseColor('rgb(204, 0, 0)'))).toBeNull();
    expect(remapBackground(parseColor('rgb(15, 108, 191)'))).toBeNull();
    expect(remapBackground(parseColor('rgb(0, 0, 0)'))).toBeNull();
  });

  it('leaves transparent backgrounds alone', () => {
    expect(remapBackground(parseColor('rgba(0, 0, 0, 0)'))).toBeNull();
  });

  it('turns white into a dark charcoal, not pure black', () => {
    const l = lightnessOf(remapBackground(parseColor('rgb(255, 255, 255)')));
    expect(l).toBeGreaterThan(0.1);
    expect(l).toBeLessThan(0.2);
  });

  it('keeps hierarchy: a light-gray surface ends up lighter than a white one did', () => {
    const white = lightnessOf(remapBackground(parseColor('rgb(255, 255, 255)')));
    const gray300 = lightnessOf(remapBackground(parseColor('rgb(222, 226, 230)')));
    expect(gray300).toBeGreaterThan(white);
  });

  it('keeps the hue of light tinted surfaces (e.g. a light-blue alert stays blue-ish)', () => {
    const remapped = remapBackground(parseColor('rgb(204, 229, 255)'));
    expect(hueOf(remapped)).toBeGreaterThan(190);
    expect(hueOf(remapped)).toBeLessThan(230);
    expect(lightnessOf(remapped)).toBeLessThan(0.35);
  });
});

describe('remapText', () => {
  it('leaves light text alone (e.g. white text on a red button)', () => {
    expect(remapText(parseColor('rgb(255, 255, 255)'))).toBeNull();
  });

  it('turns near-black body text into light gray', () => {
    expect(lightnessOf(remapText(parseColor('rgb(29, 33, 37)')))).toBeGreaterThan(0.85);
  });

  it('keeps muted text dimmer than body text', () => {
    const body = lightnessOf(remapText(parseColor('rgb(29, 33, 37)')));
    const muted = lightnessOf(remapText(parseColor('rgb(106, 115, 123)')));
    expect(muted).toBeLessThan(body);
  });

  it('softens colored text but keeps its hue (NC State red links stay red)', () => {
    const remapped = remapText(parseColor('rgb(204, 0, 0)'));
    expect(hueOf(remapped)).toBe(0);
    expect(lightnessOf(remapped)).toBeGreaterThan(0.6);
  });
});

describe('remapBorder', () => {
  it('darkens light borders and leaves dark ones alone', () => {
    expect(lightnessOf(remapBorder(parseColor('rgb(222, 226, 230)')))).toBeLessThan(0.35);
    expect(remapBorder(parseColor('rgb(51, 51, 51)'))).toBeNull();
  });
});
