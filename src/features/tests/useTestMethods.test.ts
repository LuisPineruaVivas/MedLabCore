import { describe, expect, it } from "vitest";
import { resolveTestMethods, type TestMethod } from "./useTestMethods";

const method = (overrides: Partial<TestMethod>): TestMethod => ({
  id: "method-1",
  org_id: null,
  name: "Método global",
  description: null,
  is_active: true,
  id_global_ref: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("resolveTestMethods", () => {
  it("keeps global methods and organization-specific methods", () => {
    const methods = resolveTestMethods([
      method({ id: "global", name: "ELISA" }),
      method({ id: "local", org_id: "org-1", name: "PCR" }),
    ], "org-1");

    expect(methods.map((item) => item.name)).toEqual(["ELISA", "PCR"]);
  });

  it("prefers an organization fork over its global source", () => {
    const methods = resolveTestMethods([
      method({ id: "global", name: "ELISA" }),
      method({ id: "fork", org_id: "org-1", id_global_ref: "global", name: "ELISA automatizado" }),
    ], "org-1");

    expect(methods).toHaveLength(1);
    expect(methods[0]).toMatchObject({ id: "fork", name: "ELISA automatizado" });
  });
});
