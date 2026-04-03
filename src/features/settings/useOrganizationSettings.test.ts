import { describe, expect, it, vi } from "vitest";
import {
  buildManualExchangeRateUpsert,
  buildOrganizationLogoPath,
} from "./useOrganizationSettings";

describe("organization settings helpers", () => {
  it("builds a deterministic logo upload path", () => {
    expect(buildOrganizationLogoPath("org-1", "logo.png", 123)).toBe("org-1/logo-123.png");
  });

  it("builds the manual exchange rate upsert payload", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T12:00:00Z"));

    expect(
      buildManualExchangeRateUpsert({
        orgId: "org-1",
        rate: 40.5,
        updatedBy: "user-1",
      })
    ).toEqual({
      org_id: "org-1",
      rate: 40.5,
      updated_at: "2026-03-30T12:00:00.000Z",
      updated_by: "user-1",
    });

    vi.useRealTimers();
  });
});
