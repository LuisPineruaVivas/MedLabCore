import { dialogTitled, findVisible } from "../guidedTask";
import { SHARE_CHAT_TITLE, SHARE_VIEWER_TITLE } from "../DemoShareSimulator";
import type { Helpers, Scene, Target } from "./scriptRunner";
import { NARRATION, type LineId } from "./narration";

const PATIENT = {
  idNumber: "27456123",
  firstName: "Valentina",
  lastName: "Rojas",
  birthDate: "14/06/1992",
  phone: "0414 555 1234",
};
const RESULT_VALUES = ["13.5", "41", "7.2", "250", "92"]; // Hematología completa (4 fields) + Glicemia

const navLink = (path: string) => `a[href="${path}"]`;
// The patient form opens on top of the order dialog: look only inside it.
const inPatientForm =
  (selector: string): Target =>
  () =>
    dialogTitled("Nuevo Paciente")?.querySelector(selector) ?? null;

/** Clicks the menu link when it is on screen (desktop sidebar or mobile bottom bar), else navigates. */
const openPage = (h: Helpers, path: string) => (findVisible(navLink(path)) ? h.click(navLink(path)) : h.navigate(path));

/** First visible button whose text contains `text`, optionally inside `scope`. */
const button =
  (text: string, scope = ""): Target =>
  () =>
    [...document.querySelectorAll(`${scope} button`)].find(
      (b) => b.getClientRects().length > 0 && b.textContent?.includes(text) && !(b as HTMLButtonElement).disabled
    ) ?? null;

/**
 * The dialog titled `title` once its PDF has rendered: react-pdf's viewer sets a blob: iframe, and the shared
 * report page does the same inside its own iframe (or turns into the blob on phones).
 */
const pdfShown =
  (title: string): Target =>
  () => {
    const dialog = dialogTitled(title);
    const frame = dialog?.querySelector("iframe");
    if (!frame) return null;
    if (frame.src.startsWith("blob:")) return dialog;
    try {
      const inner = frame.contentDocument?.querySelector("iframe");
      if (inner?.src.startsWith("blob:") || frame.contentWindow?.location.href.startsWith("blob:")) return dialog;
    } catch {
      // Cross-origin blob document: it is already showing the PDF.
      return dialog;
    }
    return null;
  };

/** Closes whatever dialog is open (Radix closes on Escape), so the next scene starts on a clean page. */
async function closeDialogs(h: Helpers) {
  for (let i = 0; i < 3 && document.querySelector('[role="dialog"]:not([data-state="closed"])'); i++) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await h.pause(400);
  }
}

/** A beat's narration: its text and the id of its recording. */
const line = (id: LineId) => ({ voice: id, say: NARRATION[id] });

export const DEMO_SCRIPT: Scene[] = [
  {
    title: "Bienvenida",
    beats: [
      { ...line("intro"), focus: '[data-tour="dashboard-stats"]' },
      { ...line("dashboard"), focus: '[data-tour="dashboard-pending"]' },
    ],
  },
  {
    title: "Nueva orden y paciente",
    beats: [
      {
        ...line("orderOpen"),
        run: async (h) => {
          await openPage(h, "/orders");
          await h.click('[data-tour="new-order"]');
        },
      },
      {
        // She isn't registered yet, so the search offers to register her without leaving the order.
        ...line("orderSearch"),
        run: async (h) => {
          await h.type('[data-tour="order-patient-search"]', PATIENT.firstName);
          await h.pause(900); // the search is debounced: let it finish before reading its result
          await h.click(button("Registrar paciente", '[role="dialog"]'));
          await h.waitFor(() => dialogTitled("Nuevo Paciente"));
        },
      },
      {
        ...line("patientFill"),
        run: async (h) => {
          await h.type(inPatientForm('input[name="id_number"]'), PATIENT.idNumber);
          await h.type(inPatientForm('input[name="first_name"]'), PATIENT.firstName);
          await h.type(inPatientForm('input[name="last_name"]'), PATIENT.lastName);
          await h.type(inPatientForm('input[placeholder="Seleccionar fecha"]'), PATIENT.birthDate);
          // Closes the calendar the date field opened (react-datepicker closes on a mousedown outside it),
          // so it doesn't cover the next fields.
          dialogTitled("Nuevo Paciente")?.querySelector("h2")?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
          await h.pickSelect(inPatientForm("button[role='combobox']"), "Femenino");
          await h.type(inPatientForm('input[name="phone"]'), PATIENT.phone);
        },
      },
      {
        ...line("patientSave"),
        run: async (h) => {
          await h.click(inPatientForm('button[type="submit"]'));
          await h.waitFor(() => (dialogTitled("Nuevo Paciente") ? null : document.body));
          // The search under the order refreshes and now finds her.
          await h.click(button(`${PATIENT.firstName} ${PATIENT.lastName}`, '[role="dialog"]'));
          await h.waitFor('[data-tour="order-patient-selected"]');
        },
      },
    ],
  },
  {
    title: "Exámenes y orden",
    beats: [
      {
        ...line("orderTests"),
        run: async (h) => {
          const search = '[data-tour="order-tests"] input[placeholder="Buscar examen..."]';
          await h.type(search, "Hemato");
          await h.click(button("Hematología completa", '[data-tour="order-tests"]'));
          await h.type(search, "Glice");
          await h.click(button("Glicemia", '[data-tour="order-tests"]'));
        },
      },
      { ...line("orderTotal"), focus: '[data-tour="order-summary"]' },
      {
        ...line("orderCreate"),
        run: async (h) => {
          await h.click(button("Crear Orden", '[role="dialog"]'));
          await h.waitFor(pdfShown("Nota de Entrega"), 15000);
        },
      },
    ],
  },
  {
    title: "Cargar resultados",
    beats: [
      {
        ...line("resultsOpen"),
        run: async (h) => {
          await closeDialogs(h);
          // Wait for the refreshed list: the first row may still be an older order right after creating hers.
          await h.click(() => [...document.querySelectorAll('[data-tour="order-row"]')].find((row) => row.getClientRects().length > 0 && row.textContent?.includes(PATIENT.lastName)) ?? null);
          await h.waitFor('[data-tour="results"]');
        },
      },
      {
        ...line("resultsFill"),
        run: async (h) => {
          for (let i = 0; i < RESULT_VALUES.length; i++) {
            await h.type(
              () => document.querySelectorAll('[data-tour="results"] input[placeholder="Ingresar resultado"]')[i] ?? null,
              RESULT_VALUES[i]
            );
          }
          await h.click('[data-tour="save-results"]');
          await h.waitFor('[data-tour="save-results"][disabled]');
        },
      },
    ],
  },
  {
    title: "El informe",
    beats: [
      {
        ...line("reportOpen"),
        run: async (h) => {
          await h.click('[data-tour="view-report"]');
          await h.click(button("Continuar", '[role="dialog"]'));
          await h.waitFor(() => dialogTitled("Informe de Resultados"), 10000);
        },
      },
      {
        ...line("reportShow"),
        focus: () => dialogTitled("Informe de Resultados"),
        run: (h) => h.waitFor(pdfShown("Informe de Resultados"), 15000).then(() => undefined),
      },
    ],
  },
  {
    title: "Compartir con el paciente",
    beats: [
      {
        ...line("shareSend"),
        run: async (h) => {
          await closeDialogs(h);
          await h.click('[data-tour="share-pdf"]');
          await h.waitFor(() => dialogTitled(SHARE_CHAT_TITLE));
        },
      },
      {
        ...line("shareOpen"),
        run: async (h) => {
          await h.click('[data-tour="demo-share-link"]');
          await h.waitFor(pdfShown(SHARE_VIEWER_TITLE), 15000);
        },
      },
    ],
  },
  {
    title: "Cierre",
    beats: [
      {
        ...line("outro"),
        run: async (h) => {
          await closeDialogs(h);
          await h.navigate("/dashboard");
          await h.waitFor('[data-tour="dashboard-stats"]');
        },
      },
    ],
  },
];
