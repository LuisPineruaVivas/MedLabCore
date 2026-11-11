import { describe, expect, it } from "vitest";
import { amountInAccountCurrency, isOverdue, toUsd, transferRate, withLiveUsd } from "./finance";

describe("transferRate", () => {
  it("is local per USD whichever side is USD", () => {
    expect(transferRate("USD", 50, "VES", 2100)).toBe(42);
    expect(transferRate("VES", 4200, "USD", 100)).toBe(42);
  });

  it("is null for same currency, missing amounts or two local currencies", () => {
    expect(transferRate("USD", 50, "USD", 50)).toBeNull();
    expect(transferRate("USD", 50, "VES", 0)).toBeNull();
    expect(transferRate("VES", 10, "EUR", 1)).toBeNull();
  });
});

describe("toUsd", () => {
  it("keeps USD and converts local amounts at the rate, to cents", () => {
    expect(toUsd("USD", 12.5, null)).toBe(12.5);
    expect(toUsd("VES", 400, 40)).toBe(10);
    expect(toUsd("VES", 100, 3)).toBe(33.33);
    expect(toUsd("VES", 100, null)).toBeNull();
  });
});

describe("amountInAccountCurrency", () => {
  it("converts the remaining bill to the paying account's currency", () => {
    expect(amountInAccountCurrency("VES", 300, "VES", null)).toBe(300);
    expect(amountInAccountCurrency("USD", 10, "VES", 40)).toBe(400);
    expect(amountInAccountCurrency("VES", 300, "USD", 40)).toBe(7.5);
    expect(amountInAccountCurrency("USD", 10, "VES", null)).toBeNull();
    expect(amountInAccountCurrency("EUR", 10, "VES", 40)).toBeNull();
  });
});

describe("isOverdue", () => {
  it("only open bills past their due date", () => {
    expect(isOverdue("2026-11-07", "pending", "2026-11-08")).toBe(true);
    expect(isOverdue("2026-11-08", "partial", "2026-11-08")).toBe(false);
    expect(isOverdue("2026-11-01", "paid", "2026-11-08")).toBe(false);
    expect(isOverdue(null, "pending", "2026-11-08")).toBe(false);
  });
});

describe("withLiveUsd", () => {
  it("revalues only bolívar balances at the live rate", () => {
    const rows = [
      { currency: "USD", balance: 10, balance_usd: 10 },
      { currency: "VES", balance: 900, balance_usd: 22.5 },
    ];
    expect(withLiveUsd(rows, 90).map((row) => row.balance_usd)).toEqual([10, 10]);
    expect(withLiveUsd(rows, null)).toBe(rows);
  });
});
