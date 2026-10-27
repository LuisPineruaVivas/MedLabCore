// @vitest-environment jsdom
// Safety net for splitting OrderDetailPage (improvement plan M-02): patient data,
// who can edit results, and "Guardar Todos" (one request, all-or-nothing; B-03/P-04).
import { fireEvent, render, within, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPermissions } from "@/hooks/useCurrentOrgContext";
import OrderDetailPage from "./OrderDetailPage";

type Role = "lab_admin" | "bioanalyst" | "secretary";

const state = vi.hoisted(() => ({
  role: "lab_admin" as "lab_admin" | "bioanalyst" | "secretary",
  status: "pendiente" as string,
  mutateAsync: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: state.toastSuccess, error: state.toastError, info: vi.fn() } }));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));

vi.mock("@/hooks/useCurrentOrgContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useCurrentOrgContext")>();
  const contexts: Record<string, unknown> = {};
  return {
    ...actual,
    useCurrentOrgContext: () =>
      (contexts[state.role] ??= {
        organization: { id: "org-1", name: "Lab Prueba", has_erp_module: false, primary_color: "#0ea5e9" },
        role: state.role,
        profile: { id: "user-1", role: state.role, full_name: "Usuario Prueba", firma_url: null, sello_url: null },
        permissions: actual.buildPermissions(state.role),
        orgId: "org-1",
      }),
  };
});

vi.mock("@/hooks/useErpModule", () => ({ useErpModule: () => ({ isErpEnabled: false }) }));
const empty = vi.hoisted(() => ({ result: { data: [] as unknown[] } }));
vi.mock("@/features/tests/useTestTemplates", () => ({ useDepartmentOrder: () => empty.result }));
vi.mock("@/features/tests/useTestMethods", () => ({ useTestMethods: () => empty.result }));

// Stable objects, like React Query: a new array on every render would make the
// results editor re-initialize forever.
const data = vi.hoisted(() => {
  const field = (label: string, value = "") => ({
    sections: [{ name: "General", fields: [{ id: label.toLowerCase(), label, type: "number", value, unit: "mg/dL" }] }],
  });
  const patient = { id: "patient-1", first_name: "Ana", last_name: "Perez", id_number: "V-12345678", date_of_birth: "1990-05-10", gender: "femenino", phone: "4141234567", email: null as string | null, address: null as string | null };
  const items = [
    { id: "item-urea", order_id: "order-1", test_name: "Urea", category: "Quimica", resolved_sort_order: 1, results_data: field("Urea"), test_templates: { result_type: "STANDARD" } },
    { id: "item-crea", order_id: "order-1", test_name: "Creatinina", category: "Quimica", resolved_sort_order: 2, results_data: field("Creatinina"), test_templates: { result_type: "STANDARD" } },
  ];
  const orders: Record<string, unknown> = {};
  const orderFor = (status: string) =>
    (orders[status] ??= { id: "order-1", org_id: "org-1", order_seq: 7, status, payment_status: "paid", total_amount: 15, access_pin: "7KQ2M9XH4P", created_at: "2026-10-26T10:00:00Z", patients: patient });
  return { items, orderFor, itemsResult: { data: items, isLoading: false }, orderResults: {} as Record<string, unknown> };
});

vi.mock("@/features/orders/useOrders", () => ({
  useOrder: () => (data.orderResults[state.status] ??= { data: data.orderFor(state.status), isLoading: false }),
  useOrderItems: () => data.itemsResult,
  useSaveResults: () => ({ mutateAsync: state.mutateAsync, isPending: false }),
  useUpdateOrderStatus: () => ({ mutate: vi.fn(), isPending: false }),
}));

function renderPage(role: Role = "lab_admin", status = "pendiente") {
  state.role = role;
  state.status = status;
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/orders/order-1"]}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const resultInputs = () => view().getAllByPlaceholderText("Ingresar resultado") as HTMLInputElement[];

// Query the current document: with vitest isolate:false, Testing Library's `screen`
// stays bound to the first test file's document.
const view = () => within(document.body);

describe("OrderDetailPage", () => {
  beforeEach(() => {
    state.mutateAsync.mockReset();
    state.toastSuccess.mockReset();
    state.toastError.mockReset();
  });

  it("shows the patient, the order and its exams", () => {
    renderPage();
    expect(view().getAllByText(/ANA PEREZ/i).length).toBeGreaterThan(0);
    expect(view().getAllByText(/V-12345678/).length).toBeGreaterThan(0);
    expect(view().getAllByText(/Urea/).length).toBeGreaterThan(0);
    expect(view().getAllByText(/Creatinina/).length).toBeGreaterThan(0);
    expect(resultInputs()).toHaveLength(2);
  });

  it("saves every modified exam in one request", async () => {
    state.mutateAsync.mockResolvedValue(undefined);
    renderPage();
    const [urea, creatinina] = resultInputs();
    fireEvent.change(urea, { target: { value: "32" } });
    fireEvent.change(creatinina, { target: { value: "0.9" } });
    fireEvent.click(view().getAllByRole("button", { name: /Guardar Todos/i })[0]);

    await waitFor(() => expect(state.toastSuccess).toHaveBeenCalled());
    expect(state.mutateAsync).toHaveBeenCalledTimes(1);
    const { orderId, items } = state.mutateAsync.mock.calls[0][0];
    expect(orderId).toBe("order-1");
    expect(items.map((item: { itemId: string }) => item.itemId).sort()).toEqual(["item-crea", "item-urea"]);
    const values = Object.fromEntries(items.map((item: { itemId: string; resultsData: { sections: Array<{ fields: Array<{ value: string }> }> } }) =>
      [item.itemId, item.resultsData.sections[0].fields[0].value]));
    expect(values).toEqual({ "item-urea": "32", "item-crea": "0.9" });
  });

  it("explains a refused save in Spanish and keeps the changes marked", async () => {
    state.mutateAsync.mockRejectedValue(new Error("ORDER_RESULTS_LOCKED"));
    renderPage();
    fireEvent.change(resultInputs()[0], { target: { value: "40" } });
    const saveButton = view().getAllByRole("button", { name: /Guardar Todos/i })[0];
    fireEvent.click(saveButton);

    await waitFor(() => expect(state.toastError).toHaveBeenCalledWith(expect.stringMatching(/completada o cancelada/)));
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    expect(resultInputs()[0].value).toBe("40");
  });

  it("is read-only for a completed order", () => {
    renderPage("lab_admin", "completada");
    expect(resultInputs().every((input) => input.disabled)).toBe(true);
    expect(view().queryByRole("button", { name: /Guardar Todos/i })).not.toBeInTheDocument();
  });

  it("lets the bioanalyst, not the secretary, edit an order awaiting approval", () => {
    const { unmount } = renderPage("bioanalyst", "por_aprobar");
    expect(resultInputs().every((input) => !input.disabled)).toBe(true);
    unmount();
    renderPage("secretary", "por_aprobar");
    expect(resultInputs().every((input) => input.disabled)).toBe(true);
  });
});

// Keeps buildPermissions in use so the role matrix above stays tied to the real one.
void buildPermissions;
