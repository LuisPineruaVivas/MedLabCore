/**
 * Turns a lab's brand color into theme variables that always meet WCAG AA.
 * The lab color is the interface's only ink (primary actions, active nav, focus ring, links),
 * so it must read as text on the molded ground of each theme: darkened on the light ground,
 * lightened on the dark one, keeping the lab's hue.
 */

type Hsl = { h: number; s: number; l: number };

/** Ground colors of each theme (index.css --background). */
export const LIGHT_GROUND = "#e4e9ef";
export const DARK_GROUND = "#181e26";
const LIGHT_INK = "#ffffff";
const DARK_INK = "#0e1319";

export function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = match[1].length === 3 ? match[1].split("").map((c) => c + c).join("") : match[1];
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]) {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: [number, number, number], b: [number, number, number]) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function rgbToHsl([r, g, b]: [number, number, number]): Hsl {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)) as [number, number, number];
}

const css = ({ h, s, l }: Hsl) => `${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%`;

/** Moves lightness one step at a time until `color` reaches `ratio` against `ground`. */
function fitContrast(color: Hsl, ground: string, ratio: number, direction: -1 | 1): Hsl {
  const groundRgb = hexToRgb(ground)!;
  let next = { ...color };
  while (contrast(hslToRgb(next), groundRgb) < ratio && next.l > 0 && next.l < 100) {
    next = { ...next, l: Math.min(100, Math.max(0, next.l + direction)) };
  }
  return next;
}

export interface LabThemeVars {
  light: Record<string, string>;
  dark: Record<string, string>;
}

export function labThemeVars(brandHex: string | null | undefined, fallbackHex = "#0b766c"): LabThemeVars {
  const rgb = hexToRgb(brandHex ?? "") ?? hexToRgb(fallbackHex)!;
  const base = rgbToHsl(rgb);
  // Text-grade on each ground (4.5:1); white or dark ink on top then clears 4.5:1 too.
  const light = fitContrast(base, LIGHT_GROUND, 4.5, -1);
  const dark = fitContrast({ ...base, s: Math.min(base.s, 75) }, DARK_GROUND, 5, 1);
  const tint = (l: number, s = Math.min(base.s, 45)) => css({ h: base.h, s, l });

  return {
    light: {
      "--primary": css(light),
      "--primary-foreground": css(rgbToHsl(hexToRgb(LIGHT_INK)!)),
      "--ring": css(light),
      "--accent": tint(88),
      "--accent-foreground": css({ ...light, l: Math.max(light.l - 8, 0) }),
      "--sidebar-primary": css(light),
      "--sidebar-ring": css(light),
      "--chart-1": css(light),
    },
    dark: {
      "--primary": css(dark),
      "--primary-foreground": css(rgbToHsl(hexToRgb(DARK_INK)!)),
      "--ring": css(dark),
      "--accent": tint(22, Math.min(base.s, 35)),
      "--accent-foreground": css({ ...dark, l: Math.min(dark.l + 8, 100) }),
      "--sidebar-primary": css(dark),
      "--sidebar-ring": css(dark),
      "--chart-1": css(dark),
    },
  };
}

/** The `<style>` text that applies a lab's theme over index.css. */
export function labThemeCss(vars: LabThemeVars) {
  const block = (entries: Record<string, string>) => Object.entries(entries).map(([key, value]) => `${key}: ${value};`).join(" ");
  return `:root { ${block(vars.light)} } .dark { ${block(vars.dark)} }`;
}

/** Exposed for tests: the rendered RGB of an HSL triple as written by labThemeVars. */
export function cssHslToRgb(value: string): [number, number, number] {
  const [h, s, l] = value.replace(/%/g, "").split(" ").map(Number);
  return hslToRgb({ h, s, l });
}
