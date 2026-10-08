import { describe, expect, it } from "vitest";
import { darkenSignaturePixels } from "./enhanceSignatureImage";

describe("darkenSignaturePixels", () => {
  it("darkens faint strokes while preserving near-white backgrounds", () => {
    const pixels = new Uint8ClampedArray([
      200, 200, 200, 255,
      255, 255, 255, 255,
    ]);

    darkenSignaturePixels(pixels);

    expect(pixels[0]).toBeLessThan(200);
    expect(pixels[1]).toBeLessThan(200);
    expect(pixels[2]).toBeLessThan(200);
    expect(Array.from(pixels.slice(4))).toEqual([255, 255, 255, 255]);
  });

  it("preserves fully transparent pixels", () => {
    const pixels = new Uint8ClampedArray([210, 210, 210, 0]);

    darkenSignaturePixels(pixels);

    expect(Array.from(pixels)).toEqual([210, 210, 210, 0]);
  });

  it("darkens color channels without removing their color", () => {
    const pixels = new Uint8ClampedArray([80, 130, 190, 255]);

    darkenSignaturePixels(pixels);

    expect(pixels[0]).toBeLessThan(80);
    expect(pixels[1]).toBeLessThan(130);
    expect(pixels[2]).toBeLessThan(190);
    expect(pixels[3]).toBe(255);
  });
});
