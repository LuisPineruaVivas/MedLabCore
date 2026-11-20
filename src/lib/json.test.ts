import { parseJsonObject } from "./json";

describe("parseJsonObject", () => {
  it("parses valid JSON text and passes objects through unchanged", () => {
    expect(parseJsonObject('{"sections":[{"name":"A"}]}')).toEqual({ sections: [{ name: "A" }] });
    const value = { category: "Hematologia" };
    expect(parseJsonObject(value)).toBe(value);
  });

  it("returns {} for malformed or non-object values instead of throwing", () => {
    expect(parseJsonObject("{bad")).toEqual({});
    expect(parseJsonObject("[]")).toEqual({});
    expect(parseJsonObject("null")).toEqual({});
    expect(parseJsonObject("")).toEqual({});
    expect(parseJsonObject(null)).toEqual({});
    expect(parseJsonObject(undefined)).toEqual({});
    expect(parseJsonObject([1, 2])).toEqual({});
  });
});
