import { describe, expect, it } from "vitest";
import { DEFAULT_RESULTS_MESSAGE, resultsMessage, whatsappNumber } from "./whatsapp";

describe("whatsappNumber", () => {
  it("builds a wa.me number from a Venezuelan phone", () => {
    expect(whatsappNumber("0414-123.45.67")).toBe("584141234567");
    expect(whatsappNumber("4141234567")).toBe("584141234567");
    expect(whatsappNumber("+58 414 1234567")).toBe("584141234567");
    expect(whatsappNumber("")).toBeNull();
  });
});

describe("resultsMessage", () => {
  it("uses the lab's message, or the default when empty, and appends the link", () => {
    expect(resultsMessage("Hola, te escribimos del Laboratorio Rivalta:", "https://x/p")).toBe(
      "Hola, te escribimos del Laboratorio Rivalta: https://x/p",
    );
    expect(resultsMessage("   ", "https://x/p")).toBe(`${DEFAULT_RESULTS_MESSAGE} https://x/p`);
    expect(resultsMessage(null, "https://x/p")).toBe(`${DEFAULT_RESULTS_MESSAGE} https://x/p`);
  });
});
