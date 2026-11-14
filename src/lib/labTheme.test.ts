import { describe, expect, it } from "vitest";
import { contrast, cssHslToRgb, DARK_GROUND, hexToRgb, LIGHT_GROUND, labThemeCss, labThemeVars } from "./labTheme";

const ratioOn = (value: string, ground: string) => contrast(cssHslToRgb(value), hexToRgb(ground)!);

describe("labThemeVars", () => {
  // A pale yellow, a mid sky blue, a very dark navy and the product default: all must end AA.
  for (const color of ["#f5e663", "#0ea5e9", "#0b1d3a", "#0b766c"]) {
    it(`keeps ${color} at AA as text on both grounds and under its own ink`, () => {
      const { light, dark } = labThemeVars(color);
      expect(ratioOn(light["--primary"], LIGHT_GROUND)).toBeGreaterThanOrEqual(4.5);
      expect(ratioOn(dark["--primary"], DARK_GROUND)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(cssHslToRgb(light["--primary"]), cssHslToRgb(light["--primary-foreground"]))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(cssHslToRgb(dark["--primary"]), cssHslToRgb(dark["--primary-foreground"]))).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("keeps the lab's hue", () => {
    const { light } = labThemeVars("#0ea5e9");
    expect(Number(light["--primary"].split(" ")[0])).toBeCloseTo(199, -1);
  });

  it("falls back on an invalid color", () => {
    expect(labThemeVars("not-a-color").light["--primary"]).toBe(labThemeVars("#0b766c").light["--primary"]);
  });

  it("renders light and dark blocks", () => {
    const text = labThemeCss(labThemeVars("#0ea5e9"));
    expect(text).toMatch(/^:root \{ --primary: .*\} \.dark \{ --primary: /);
  });
});
