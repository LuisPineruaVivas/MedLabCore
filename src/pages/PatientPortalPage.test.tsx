// @vitest-environment jsdom
import { fireEvent, render, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PatientPortalPage from "./PatientPortalPage";

const portal = vi.hoisted(() => ({
  authenticate: vi.fn(),
}));

vi.mock("@/features/patients/usePatientPortal", () => ({
  usePatientSession: () => ({ session: null as unknown, authenticate: portal.authenticate, logout: vi.fn() }),
  usePatientOrders: () => ({ data: [] as unknown[], isLoading: false }),
}));

vi.mock("@/features/patientPortal/useOrgPatientPortal", () => ({
  usePublicOrgBrand: () => ({ data: null as unknown, isLoading: false }),
}));

function renderPortal(url = "/portal-paciente?org=org-1") {
  window.history.replaceState(null, "", url);
  return render(
    <MemoryRouter initialEntries={[url]}>
      <PatientPortalPage />
    </MemoryRouter>,
  );
}

function submit(dni: string, pin: string) {
  fireEvent.change(view().getByLabelText(/C[ée]dula/i), { target: { value: dni } });
  fireEvent.change(view().getByLabelText(/PIN de Acceso/i), { target: { value: pin } });
  fireEvent.click(view().getByRole("button", { name: /Consultar Resultados/i }));
}

// Query the current document: with vitest isolate:false, Testing Library's `screen`
// stays bound to the first test file's document.
const view = () => within(document.body);

describe("PatientPortalPage", () => {
  beforeEach(() => {
    portal.authenticate.mockReset();
    sessionStorage.clear();
  });

  it("accepts 10-character PINs (the field used to stop at 6)", () => {
    renderPortal();
    expect(Number(view().getByLabelText(/PIN de Acceso/i).getAttribute("maxLength"))).toBeGreaterThanOrEqual(10);
  });

  it("shows the server lockout message without counting it as another attempt (S-03)", async () => {
    portal.authenticate.mockResolvedValue({
      success: false,
      locked: true,
      error: "Por seguridad, este documento quedo bloqueado por una hora despues de varios intentos fallidos.",
    });
    renderPortal();
    submit("V12345678", "7KQ2M9XH4P");
    expect(await view().findByText(/quedo bloqueado por una hora/)).toBeInTheDocument();
    expect(view().queryByText(/Intento \d\/\d/)).not.toBeInTheDocument();
    expect(portal.authenticate).toHaveBeenCalledWith("V12345678", "7KQ2M9XH4P");
  });

  it("counts ordinary wrong PINs", async () => {
    portal.authenticate.mockResolvedValue({ success: false, error: "No se encontró ninguna orden con esos datos." });
    renderPortal();
    submit("V12345678", "WRONGPIN11");
    expect(await view().findByText(/Intento 1\/5/)).toBeInTheDocument();
  });

  it("logs in automatically from a #fragment link", async () => {
    portal.authenticate.mockResolvedValue({ success: true });
    renderPortal("/portal-paciente?org=org-1#dni=V1&pin=P1");
    await waitFor(() => expect(portal.authenticate).toHaveBeenCalledWith("V1", "P1"));
  });
});
