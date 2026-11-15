// @vitest-environment jsdom
// Safety net for splitting TemplateBuilderPage (improvement plan M-02): what the
// builder sends to useSaveTemplate after editing sections, fields and microbiology fields.
import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TemplateBuilderPage from "./TemplateBuilderPage";

const state = vi.hoisted(() => {
  const standard = {
    id: "3f6b2c1a-9d4e-4f7a-8b2c-1d0e9f8a7b61",
    org_id: "org-1",
    name: "Hemograma",
    category: "Hematologia",
    base_price: 12.5,
    result_type: "STANDARD",
    schema: {
      sections: [
        {
          id: "s1",
          name: "Serie Roja",
          fields: [
            { id: "f1", label: "Hemoglobina", type: "number", unit: "g/dL" },
            { id: "f2", label: "Hematocrito", type: "number", unit: "%" },
          ],
        },
      ],
    },
  };
  const microbiology = {
    ...standard,
    id: "3f6b2c1a-9d4e-4f7a-8b2c-1d0e9f8a7b62",
    name: "Urocultivo",
    result_type: "MICROBIOLOGY",
    schema: { sections: [] as unknown[] },
  };
  return {
    mutate: vi.fn(),
    templates: { "3f6b2c1a-9d4e-4f7a-8b2c-1d0e9f8a7b61": { data: standard, isLoading: false }, "3f6b2c1a-9d4e-4f7a-8b2c-1d0e9f8a7b62": { data: microbiology, isLoading: false } } as Record<string, unknown>,
    context: { orgId: "org-1", organization: { name: "Lab Prueba", report_template: "default" } },
    role: { isSuperAdmin: false },
  };
});

vi.mock("@/features/admin/useTemplateBuilder", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/admin/useTemplateBuilder")>()),
  useTemplateById: (id: string | undefined) => (id ? state.templates[id] : { data: undefined, isLoading: false }),
  useSaveTemplate: () => ({ mutate: state.mutate, isPending: false }),
}));
vi.mock("@/hooks/useCurrentOrgContext", () => ({ useCurrentOrgContext: () => state.context }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => state.role }));
vi.mock("@react-pdf/renderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@react-pdf/renderer")>()),
  PDFViewer: (): null => null,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Query the current document: with vitest isolate:false, Testing Library's `screen`
// stays bound to the first test file's document.
const view = () => within(document.body);

function renderBuilder(path: string) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/tests/templates/:id/edit" element={<TemplateBuilderPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function save() {
  fireEvent.click(view().getAllByRole("button", { name: /Guardar Plantilla/ })[0]);
  await waitFor(() => expect(state.mutate).toHaveBeenCalled());
  return state.mutate.mock.calls[0][0];
}

const fieldLabels = () => view().getAllByPlaceholderText("e.g. Hemoglobina").map((input) => (input as HTMLInputElement).value);

describe("TemplateBuilderPage", () => {
  beforeEach(() => state.mutate.mockReset());

  it("loads an existing template for editing", () => {
    renderBuilder("/tests/templates/3f6b2c1a-9d4e-4f7a-8b2c-1d0e9f8a7b61/edit");
    expect(view().getByText("Editar Plantilla")).toBeInTheDocument();
    expect(view().getByDisplayValue("Hemograma")).toBeInTheDocument();
    expect(view().getByDisplayValue("Serie Roja")).toBeInTheDocument();
    expect(fieldLabels()).toEqual(["Hemoglobina", "Hematocrito"]);
  });

  it("saves edited sections and fields", async () => {
    renderBuilder("/tests/templates/3f6b2c1a-9d4e-4f7a-8b2c-1d0e9f8a7b61/edit");
    fireEvent.change(view().getByDisplayValue("Serie Roja"), { target: { value: "Eritrocitos" } });
    fireEvent.click(view().getAllByTitle("Mover abajo")[0]);
    expect(fieldLabels()).toEqual(["Hematocrito", "Hemoglobina"]);
    fireEvent.click(view().getByRole("button", { name: /Agregar Campo/ }));
    fireEvent.change(view().getAllByPlaceholderText("e.g. Hemoglobina")[2], { target: { value: "VCM" } });
    fireEvent.click(view().getByRole("button", { name: /Agregar Secci/ }));
    fireEvent.change(view().getAllByPlaceholderText(/Nombre de la secci/)[1], { target: { value: "Serie Blanca" } });
    fireEvent.change(view().getAllByPlaceholderText("e.g. Hemoglobina")[3], { target: { value: "Leucocitos" } });

    const payload = await save();
    expect(payload).toMatchObject({ id: "3f6b2c1a-9d4e-4f7a-8b2c-1d0e9f8a7b61", orgId: "org-1", isFork: false, isSuperAdmin: false });
    const sections = payload.formData.schema.sections;
    expect(sections.map((section: { name: string }) => section.name)).toEqual(["Eritrocitos", "Serie Blanca"]);
    expect(sections[0].fields.map((field: { label: string }) => field.label)).toEqual(["Hematocrito", "Hemoglobina", "VCM"]);
    expect(sections[1].fields.map((field: { label: string }) => field.label)).toEqual(["Leucocitos"]);
    expect(payload.formData).toMatchObject({ name: "Hemograma", category: "Hematologia", result_type: "STANDARD" });
  });

  it("does not save a field without a name", async () => {
    renderBuilder("/tests/templates/3f6b2c1a-9d4e-4f7a-8b2c-1d0e9f8a7b61/edit");
    fireEvent.click(view().getByRole("button", { name: /Agregar Campo/ }));
    fireEvent.click(view().getAllByRole("button", { name: /Guardar Plantilla/ })[0]);
    expect(await view().findByText(/campos inválidos/)).toBeInTheDocument();
    expect(state.mutate).not.toHaveBeenCalled();
  });

  it("saves microbiology templates with their field definitions and no sections", async () => {
    renderBuilder("/tests/templates/3f6b2c1a-9d4e-4f7a-8b2c-1d0e9f8a7b62/edit");
    expect(view().getByText("Muestra y examen directo")).toBeInTheDocument();
    fireEvent.click(view().getByRole("button", { name: /Agregar Campo Extra/ }));
    fireEvent.change(view().getByPlaceholderText("Ej. Observaciones, Notas..."), { target: { value: "Recuento de colonias" } });

    const payload = await save();
    expect(payload.formData.schema.sections).toEqual([]);
    const labels = payload.formData.schema.microbiology_fields.map((field: { label: string }) => field.label);
    expect(labels).toContain("Recuento de colonias");
    expect(payload.formData.schema.microbiology_fields.some((field: { key: string }) => field.key === "culture_result")).toBe(true);
  });

  it("saves fields placed after the antibiogram with position 'after'", async () => {
    renderBuilder("/tests/templates/3f6b2c1a-9d4e-4f7a-8b2c-1d0e9f8a7b62/edit");
    fireEvent.click(view().getByRole("button", { name: /Agregar Campo Extra/ }));
    fireEvent.click(view().getByRole("button", { name: /Agregar campo al final/ }));
    const [before, after] = view().getAllByPlaceholderText("Ej. Observaciones, Notas...");
    fireEvent.change(before, { target: { value: "Recuento de colonias" } });
    fireEvent.change(after, { target: { value: "Observaciones" } });

    const fields = (await save()).formData.schema.microbiology_fields as { label: string; position?: string }[];
    expect(fields.find((field) => field.label === "Recuento de colonias")?.position).toBeUndefined();
    expect(fields.find((field) => field.label === "Observaciones")?.position).toBe("after");
  });

  it("personalizing (fork) creates a new template instead of editing", async () => {
    renderBuilder("/tests/templates/3f6b2c1a-9d4e-4f7a-8b2c-1d0e9f8a7b61/edit?fork=1");
    expect(view().getByText("Personalizar Plantilla")).toBeInTheDocument();
    const payload = await save();
    expect(payload).toMatchObject({ isFork: true });
    expect(payload.formData.id).toBeUndefined();
  });
});
