// @vitest-environment jsdom
import { fireEvent, render, within, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Item } from "../types";
import { PurchaseEntryDialog } from "./PurchaseEntryDialog";

const purchase = vi.hoisted(() => ({ mutate: vi.fn() }));

const role = vi.hoisted(() => ({ isAdmin: false }));

vi.mock("../hooks/useInventory", () => ({
  useRegisterPurchase: () => ({ mutate: purchase.mutate, isPending: false }),
}));
vi.mock("@/hooks/useErpModule", () => ({ useErpModule: () => ({ canManageFinances: role.isAdmin }) }));
vi.mock("@/hooks/useExchangeRate", () => ({ useExchangeRate: () => ({ data: { rate: 40 } }) }));
vi.mock("../hooks/useBankAccounts", () => ({
  useBankAccounts: () => ({ data: [{ id: "acc-ves", name: "Banco Bs", currency: "VES" }] }),
}));

const syringe: Item = {
  id: "6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b",
  org_id: "org-1",
  code: "INY",
  name: "Inyectadora 5 ml",
  description: null,
  category: "consumable",
  unit_of_measure: "units",
  units_per_package: 10,
  current_stock: 0,
  min_stock: 0,
  max_stock: null,
  unit_cost: 0,
  total_value: 0,
  lot_number: null,
  expiration_date: null,
  storage_condition: null,
  is_active: true,
  is_trackable: true,
  created_at: "2026-10-25T00:00:00Z",
  updated_at: "2026-10-25T00:00:00Z",
};

// Query the current document: with vitest isolate:false, Testing Library's `screen`
// stays bound to the first test file's document.
const view = () => within(document.body);

describe("PurchaseEntryDialog", () => {
  beforeEach(() => {
    purchase.mutate.mockReset();
    role.isAdmin = false;
  });

  it("buys by package: 2 packages of 10 at $5 are stored as 20 units at $0.50 (ERP pilot R5)", async () => {
    render(<PurchaseEntryDialog orgId="org-1" items={[syringe]} itemId="6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b" open onOpenChange={vi.fn()} />);

    fireEvent.click(view().getByRole("radio", { name: /Empaques de 10/ }));
    fireEvent.change(view().getByLabelText(/Cantidad/), { target: { value: "2" } });
    fireEvent.change(view().getByLabelText(/Costo por empaque/), { target: { value: "5" } });

    expect(await view().findByText(/2 empaques × 10 =/)).toBeInTheDocument();

    fireEvent.click(view().getByRole("button", { name: "Registrar compra" }));
    await waitFor(() => expect(purchase.mutate).toHaveBeenCalled());
    expect(purchase.mutate.mock.calls[0][0]).toMatchObject({ item_id: "6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b", quantity: 20, unit_cost: 0.5 });
  });

  it("buys by unit by default: quantity and cost are stored as entered", async () => {
    render(<PurchaseEntryDialog orgId="org-1" items={[syringe]} itemId="6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b" open onOpenChange={vi.fn()} />);

    fireEvent.change(view().getByLabelText(/Cantidad/), { target: { value: "3" } });
    fireEvent.change(view().getByLabelText(/Costo unitario/), { target: { value: "0.6" } });
    fireEvent.click(view().getByRole("button", { name: "Registrar compra" }));

    await waitFor(() => expect(purchase.mutate).toHaveBeenCalled());
    expect(purchase.mutate.mock.calls[0][0]).toMatchObject({ quantity: 3, unit_cost: 0.6, account_id: null });
  });

  it("lets an admin pay from a Bs account at the day's rate", async () => {
    role.isAdmin = true;
    render(<PurchaseEntryDialog orgId="org-1" items={[syringe]} itemId="6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b" open onOpenChange={vi.fn()} />);

    fireEvent.change(view().getByLabelText(/Cantidad/), { target: { value: "10" } });
    fireEvent.change(view().getByLabelText(/Costo unitario/), { target: { value: "1" } });
    expect(await view().findByText(/Sale de Banco Bs/)).toHaveTextContent("400");

    fireEvent.click(view().getByRole("button", { name: "Registrar compra" }));
    await waitFor(() => expect(purchase.mutate).toHaveBeenCalled());
    expect(purchase.mutate.mock.calls[0][0]).toMatchObject({ quantity: 10, unit_cost: 1, account_id: "acc-ves", exchange_rate: 40, due_date: null });
  });
});
