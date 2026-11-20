import { describe, expect, it } from "vitest";
import { amountInAccountCurrency, dueLabel, installmentDueDate, isOverdue, splitInstallments, toUsd, transferRate, withLiveUsd } from "./finance";

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

describe("installment schedule", () => {
  it("spaces due dates by the chosen frequency", () => {
    expect([0, 1, 2].map((i) => installmentDueDate("2026-11-15", i, "weekly"))).toEqual(["2026-11-15", "2026-11-22", "2026-11-29"]);
    expect([0, 1, 2].map((i) => installmentDueDate("2026-11-15", i, "biweekly"))).toEqual(["2026-11-15", "2026-11-30", "2026-12-15"]);
    expect([0, 1, 2].map((i) => installmentDueDate("2026-11-15", i, "monthly"))).toEqual(["2026-11-15", "2026-12-15", "2027-01-15"]);
  });
  it("keeps month ends inside the month", () => {
    expect([0, 1, 2].map((i) => installmentDueDate("2027-01-31", i, "monthly"))).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
  });
  it("splits the balance with the rounding on the last installment", () => {
    expect(splitInstallments(100, 3)).toEqual([33.33, 33.33, 33.34]);
    expect(splitInstallments(50, 1)).toEqual([50]);
  });
});

describe("installment reminders", () => {
  it("labels how far the due date is", () => {
    expect(dueLabel("2026-11-12", "2026-11-15")).toBe("Vencida hace 3 días");
    expect(dueLabel("2026-11-14", "2026-11-15")).toBe("Vencida ayer");
    expect(dueLabel("2026-11-15", "2026-11-15")).toBe("Vence hoy");
    expect(dueLabel("2026-11-16", "2026-11-15")).toBe("Vence mañana");
    expect(dueLabel("2026-12-01", "2026-11-15")).toBe("En 16 días");
  });
});
