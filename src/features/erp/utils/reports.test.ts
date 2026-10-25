import { buildPeriod, formatPercent, formatShortDate, isValidPeriod, percentChange, share } from "./reports";

describe("report periods", () => {
  const now = new Date(2026, 9, 18, 15, 30); // 18 Oct 2026, local time

  it("builds the preset ranges with inclusive ends", () => {
    expect(buildPeriod("today", now)).toEqual({ preset: "today", from: "2026-10-18", to: "2026-10-18" });
    expect(buildPeriod("this_month", now)).toEqual({ preset: "this_month", from: "2026-10-01", to: "2026-10-18" });
    expect(buildPeriod("last_month", now)).toEqual({ preset: "last_month", from: "2026-09-01", to: "2026-09-30" });
    expect(buildPeriod("last_30", now)).toEqual({ preset: "last_30", from: "2026-09-19", to: "2026-10-18" });
  });

  it("rejects malformed or inverted ranges", () => {
    expect(isValidPeriod({ from: "2026-10-01", to: "2026-10-18" })).toBe(true);
    expect(isValidPeriod({ from: "2026-10-18", to: "2026-10-01" })).toBe(false);
    expect(isValidPeriod({ from: "", to: "2026-10-01" })).toBe(false);
  });
});

describe("report figures", () => {
  it("computes the change against the previous period", () => {
    expect(percentChange(115, 100)).toBe(15);
    expect(percentChange(80, 100)).toBe(-20);
    expect(percentChange(50, 0)).toBeNull();
  });

  it("computes shares and formats percentages", () => {
    expect(share(1, 3)).toBe(33.3);
    expect(share(5, 0)).toBe(0);
    expect(formatPercent(78.5)).toBe("78,5%");
    expect(formatPercent(null)).toBe("—");
  });

  it("formats chart dates as day/month", () => {
    expect(formatShortDate("2026-10-05")).toBe("05/10");
  });
});
