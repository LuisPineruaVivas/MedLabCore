// @vitest-environment jsdom
// Safety net for splitting CreateOrderDialog (improvement plan M-02): patient search and
// selection, exams/profiles in the cart, totals (USD/Bs, exempted), and the order sent.
import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateOrderDialog } from "./CreateOrderDialog";

const state = vi.hoisted(() => ({
  role: "secretary" as string,
  createOrder: vi.fn(),
  // Stable objects, like React Query.
  patients: {
    data: [{ id: "patient-1", first_name: "Ana", last_name: "Perez", id_number: "V-123", date_of_birth: "1990-05-10", gender: "femenino" }],
    isFetching: false,
  },
  templates: {
    data: [{ id: "tpl-1", name: "Hemograma", category: "Hematologia", base_price: "12.5", schema: { sections: [] as unknown[] } }],
  },
  profiles: {
    data: [
      {
        id: "profile-1",
        name: "Perfil Basico",
        description: "Rutina",
        total_price: "20",
        profile_templates_junction: [
          { test_templates: { id: "tpl-2", name: "Glucosa", category: "Quimica", base_price: "8", schema: { sections: [] as unknown[] } } },
          { test_templates: { id: "tpl-3", name: "Urea", category: "Quimica", base_price: "7", schema: { sections: [] as unknown[] } } },
        ],
      },
    ],
  },
  rate: { data: { rate: 40 } },
  contexts: {} as Record<string, unknown>,
}));

vi.mock("@/hooks/useCurrentOrgContext", () => ({
  useCurrentOrgContext: () => (state.contexts[state.role] ??= { orgId: "org-1", user: { id: "user-1" }, role: state.role }),
}));
vi.mock("@/hooks/useErpModule", () => ({ useErpModule: () => ({ isErpEnabled: false, canRegisterPayments: false }) }));
vi.mock("@/hooks/useExchangeRate", () => ({ useExchangeRate: () => state.rate }));
vi.mock("@/hooks/useDebounce", () => ({ useDebounce: <T,>(value: T) => value }));
vi.mock("../patients/usePatients", () => ({
  usePatientSearch: () => state.patients,
  useCreatePatient: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("../tests/useTestTemplates", () => ({
  useOrderTemplates: () => state.templates,
  useOrderProfiles: () => state.profiles,
}));
vi.mock("./useOrders", () => ({ useCreateOrder: () => ({ mutateAsync: state.createOrder, isPending: false }) }));
vi.mock("@/features/erp/components/OrderPaymentDialog", () => ({ OrderPaymentDialog: (): null => null }));
vi.mock("@react-pdf/renderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@react-pdf/renderer")>()),
  PDFViewer: (): unknown => <div data-testid="pdf-viewer" />,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Query the current document: with vitest isolate:false, Testing Library's `screen`
// stays bound to the first test file's document.
const view = () => within(document.body);

function renderDialog(role = "secretary") {
  state.role = role;
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CreateOrderDialog open onOpenChange={onOpenChange} labData={{ name: "Lab Prueba" }} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

function pickPatient() {
  fireEvent.change(view().getByPlaceholderText(/Buscar paciente/), { target: { value: "Ana" } });
  fireEvent.click(view().getByText(/Ana Perez/));
}

function addItem(name: RegExp) {
  fireEvent.click(view().getAllByRole("button").find((button) => name.test(button.textContent ?? ""))!);
}

describe("CreateOrderDialog", () => {
  beforeEach(() => {
    state.createOrder.mockReset();
    state.createOrder.mockResolvedValue({ orderId: "order-1", order_seq: 5, access_pin: "7KQ2M9XH4P", invoiceId: null });
  });

  it("selects a patient, adds an exam and a profile, and shows USD and Bs totals", () => {
    renderDialog();
    pickPatient();
    expect(view().getByText(/V-123/)).toBeInTheDocument();

    addItem(/Hemograma/);
    addItem(/Perfil Basico/);

    // profile header + its 2 exams + the single exam
    expect(view().getAllByText("Glucosa").length).toBeGreaterThan(0);
    expect(view().getAllByText("Urea").length).toBeGreaterThan(0);
    expect(view().getByText("$32,50", { selector: ".text-primary" })).toBeInTheDocument();
    expect(view().getByText("Bs 1.300,00")).toBeInTheDocument();
  });

  it("creates the order with the cart, the rate and the Bs total", async () => {
    renderDialog();
    pickPatient();
    addItem(/Hemograma/);
    fireEvent.click(view().getByRole("button", { name: "Crear Orden" }));

    await waitFor(() => expect(state.createOrder).toHaveBeenCalledTimes(1));
    expect(state.createOrder.mock.calls[0][0]).toMatchObject({
      orgId: "org-1",
      patientId: "patient-1",
      createdBy: "user-1",
      exchangeRate: 40,
      totalBs: 500,
      isExempted: false,
      items: [expect.objectContaining({ template_id: "tpl-1", test_name: "Hemograma", price: 12.5 })],
    });
  });

  it("an exempted order is sent with total 0 and isExempted", async () => {
    renderDialog();
    pickPatient();
    addItem(/Hemograma/);
    fireEvent.click(view().getByRole("switch", { name: /Exonerar/ }));
    expect(view().getByText("Exonerado")).toBeInTheDocument();
    fireEvent.click(view().getByRole("button", { name: "Crear Orden" }));

    await waitFor(() => expect(state.createOrder).toHaveBeenCalled());
    expect(state.createOrder.mock.calls[0][0]).toMatchObject({ isExempted: true, totalBs: 0 });
  });

  it("affiliates cannot exempt and the dialog closes after creating", async () => {
    const { onOpenChange } = renderDialog("lab_affiliate");
    expect(view().queryByRole("switch", { name: /Exonerar/ })).not.toBeInTheDocument();
    pickPatient();
    addItem(/Hemograma/);
    fireEvent.click(view().getByRole("button", { name: "Crear Orden" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("staff see the delivery note after creating", async () => {
    renderDialog();
    pickPatient();
    addItem(/Hemograma/);
    fireEvent.click(view().getByRole("button", { name: "Crear Orden" }));
    expect(await view().findByText("Nota de Entrega")).toBeInTheDocument();
    expect(view().getByTestId("pdf-viewer")).toBeInTheDocument();
  });
});
