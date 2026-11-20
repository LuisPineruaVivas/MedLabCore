import { describe, expect, it } from "vitest";
import { whatsappNumber } from "./whatsapp";

describe("whatsappNumber", () => {
  it("builds a wa.me number from a Venezuelan phone", () => {
    expect(whatsappNumber("0414-123.45.67")).toBe("584141234567");
    expect(whatsappNumber("4141234567")).toBe("584141234567");
    expect(whatsappNumber("+58 414 1234567")).toBe("584141234567");
    expect(whatsappNumber("")).toBeNull();
  });
});
