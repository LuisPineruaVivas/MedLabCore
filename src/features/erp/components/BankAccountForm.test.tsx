// @vitest-environment jsdom
import { fireEvent, render, within, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BankAccountForm } from "./BankAccountForm";
import type { BankAccount } from "../types";

const zelleAccount: BankAccount = {
  id: "acc-1",
  org_id: "org-1",
  name: "Zelle Banesco",
  method_type: "zelle",
  currency: "VES",
  description: null,
  bank_name: "Banesco",
  account_number: "0134-0000",
  account_holder: null,
  phone_number: null,
  email: "pagos@lab.test",
  is_active: true,
  sort_order: 1,
  opening_balance: 250,
  opening_date: "2026-11-01",
  created_at: "2026-10-25T00:00:00Z",
  updated_at: "2026-10-25T00:00:00Z",
};

// Query the current document: with vitest isolate:false, Testing Library's `screen`
// stays bound to the first test file's document.
const view = () => within(document.body);

describe("BankAccountForm", () => {
  it("shows the saved method and currency when editing (ERP pilot bug B2)", () => {
    render(<BankAccountForm account={zelleAccount} onSubmit={vi.fn()} pending={false} />);
    const [method, currency] = view().getAllByRole("combobox");
    expect(method).toHaveTextContent("Zelle");
    expect(currency).toHaveTextContent("Bolívares (Bs)");
    expect(view().getByDisplayValue("Zelle Banesco")).toBeInTheDocument();
    expect(view().getByDisplayValue("Banesco")).toBeInTheDocument();
  });

  it("submits the edited values with the saved method and currency", async () => {
    const onSubmit = vi.fn();
    render(<BankAccountForm account={zelleAccount} onSubmit={onSubmit} pending={false} />);
    fireEvent.change(view().getByDisplayValue("Zelle Banesco"), { target: { value: "Zelle principal" } });
    fireEvent.click(view().getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ name: "Zelle principal", method_type: "zelle", currency: "VES", opening_balance: 250, opening_date: "2026-11-01" });
  });

  it("starts empty with sensible defaults for a new method", () => {
    render(<BankAccountForm account={null} onSubmit={vi.fn()} pending={false} />);
    const [method, currency] = view().getAllByRole("combobox");
    expect(method.textContent?.trim()).not.toBe("");
    expect(currency.textContent?.trim()).not.toBe("");
  });
});
