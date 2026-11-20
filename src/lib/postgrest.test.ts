import { ilikeAny, matchAllWords, pgrstValue } from "./postgrest";

describe("PostgREST filter helpers", () => {
  it("quotes values so commas and parentheses stay inside the value", () => {
    expect(ilikeAny(["first_name", "last_name"], "Pérez, Juan")).toBe(
      'first_name.ilike."%Pérez, Juan%",last_name.ilike."%Pérez, Juan%"'
    );
    expect(ilikeAny(["phone"], " (0412) ")).toBe('phone.ilike."%(0412)%"');
  });

  it("escapes double quotes and backslashes", () => {
    expect(pgrstValue('he said "x"')).toBe('"he said \\"x\\""');
    expect(pgrstValue("a\\b")).toBe('"a\\\\b"');
  });

  it("makes % and _ typed by the user match literally", () => {
    // LIKE pattern \%  -> quoted for PostgREST as \\%
    expect(ilikeAny(["action"], "100%")).toBe('action.ilike."%100\\\\%%"');
    expect(ilikeAny(["action"], "a_b")).toBe('action.ilike."%a\\\\_b%"');
  });

  it("requires every word to match some column", () => {
    expect(matchAllWords(["first_name", "last_name"], "  carlos ")).toBe(ilikeAny(["first_name", "last_name"], "carlos"));
    expect(matchAllWords(["first_name"], "perez, carlos")).toBe(matchAllWords(["first_name"], "perez carlos"));
    expect(matchAllWords(["first_name", "last_name"], "carlos  perez")).toBe(
      'and(or(first_name.ilike."%carlos%",last_name.ilike."%carlos%"),or(first_name.ilike."%perez%",last_name.ilike."%perez%"))'
    );
  });
});
