import { getPasswordError } from "./passwordPolicy";

describe("password policy", () => {
  it("refuses short passwords", () => {
    expect(getPasswordError("abc123")).toMatch(/al menos 10/);
    expect(getPasswordError("abcdefgh1")).toMatch(/al menos 10/);
  });

  it("requires letters and numbers", () => {
    expect(getPasswordError("abcdefghij")).toMatch(/letras y numeros/);
    expect(getPasswordError("1234567890")).toMatch(/letras y numeros/);
  });

  it("accepts a password that meets the rule", () => {
    expect(getPasswordError("laboratorio2026")).toBeNull();
  });
});
