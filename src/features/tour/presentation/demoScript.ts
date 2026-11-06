import { dialogTitled, findVisible } from "../guidedTask";
import { SHARE_CHAT_TITLE, SHARE_VIEWER_TITLE } from "../DemoShareSimulator";
import type { Helpers, Scene, Target } from "./scriptRunner";

const PATIENT = {
  idNumber: "27456123",
  firstName: "Valentina",
  lastName: "Rojas",
  birthDate: "14/06/1992",
  phone: "0414 555 1234",
};
const RESULT_VALUES = ["13.5", "41", "7.2", "250", "92"]; // Hematología completa (4 fields) + Glicemia

const inDialog = (selector: string) => `[role="dialog"]:not([data-state="closed"]) ${selector}`;
const navLink = (path: string) => `a[href="${path}"]`;

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

export const DEMO_SCRIPT: Scene[] = [
  {
    title: "Bienvenida",
    beats: [
      {
        say: "Maneja tu laboratorio con MedLabCore: registra un paciente, crea su orden y comparte sus resultados en menos de dos minutos.",
        focus: '[data-tour="dashboard-stats"]',
      },
      {
        say: "Desde el panel ves de un vistazo tus pacientes, las pruebas del día, lo pendiente y lo que has facturado.",
        focus: '[data-tour="dashboard-pending"]',
      },
    ],
  },
  {
    title: "Registrar un paciente",
    beats: [
      {
        say: "Empecemos registrando a una paciente.",
        run: async (h) => {
          await openPage(h, "/patients");
          await h.click('[data-tour="new-patient"]');
        },
      },
      {
        say: "Escribes su cédula, su nombre y su apellido.",
        run: async (h) => {
          await h.type(inDialog('input[name="id_number"]'), PATIENT.idNumber);
          await h.type(inDialog('input[name="first_name"]'), PATIENT.firstName);
          await h.type(inDialog('input[name="last_name"]'), PATIENT.lastName);
        },
      },
      {
        say: "Su fecha de nacimiento, y la edad se calcula sola. Indicas el sexo y un teléfono para enviarle sus resultados.",
        run: async (h) => {
          await h.type(inDialog('input[placeholder="Seleccionar fecha"]'), PATIENT.birthDate);
          // Closes the calendar the date field opened (react-datepicker closes on a mousedown outside it),
          // so it doesn't cover the next fields.
          dialogTitled("Nuevo Paciente")?.querySelector("h2")?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
          await h.pickSelect(inDialog("button[role='combobox']"), "Femenino");
          await h.type(inDialog('input[name="phone"]'), PATIENT.phone);
        },
      },
      {
        say: "Guardas, y listo: la paciente queda registrada.",
        run: async (h) => {
          await h.click(inDialog('button[type="submit"]'));
          await h.waitFor(() => (dialogTitled("Nuevo Paciente") ? null : document.body));
          await h.pause(600);
        },
      },
    ],
  },
  {
    title: "Crear la orden",
    beats: [
      {
        say: "Ahora le creamos una orden con los exámenes que se va a hacer.",
        run: async (h) => {
          await openPage(h, "/orders");
          await h.click('[data-tour="new-order"]');
        },
      },
      {
        say: "La buscas por su nombre o cédula y la seleccionas.",
        run: async (h) => {
          await h.type('[data-tour="order-patient-search"]', PATIENT.firstName);
          await h.click(button(`${PATIENT.firstName} ${PATIENT.lastName}`, '[role="dialog"]'));
        },
      },
      {
        say: "Agregas sus exámenes buscándolos por nombre: una hematología completa y una glicemia.",
        run: async (h) => {
          const search = '[data-tour="order-tests"] input[placeholder="Buscar examen..."]';
          await h.type(search, "Hemato");
          await h.click(button("Hematología completa", '[data-tour="order-tests"]'));
          await h.type(search, "Glice");
          await h.click(button("Glicemia", '[data-tour="order-tests"]'));
        },
      },
      {
        say: "El total se calcula solo, en dólares y en bolívares con la tasa del día.",
        focus: '[data-tour="order-summary"]',
        run: (h) => h.pause(800),
      },
      {
        say: "Creas la orden y se genera la nota de entrega, con el PIN para que tu paciente consulte sus resultados.",
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
        say: "Cuando están listos los resultados, abres la orden.",
        run: async (h) => {
          await closeDialogs(h);
          await h.click('[data-tour="order-row"]');
          await h.waitFor('[data-tour="results"]');
        },
      },
      {
        say: "Escribes cada valor, y al lado ves su rango de referencia.",
        run: async (h) => {
          for (let i = 0; i < RESULT_VALUES.length; i++) {
            await h.type(
              () => document.querySelectorAll('[data-tour="results"] input[placeholder="Ingresar resultado"]')[i] ?? null,
              RESULT_VALUES[i]
            );
          }
        },
      },
      {
        say: "Y los guardas.",
        run: async (h) => {
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
        say: "Con un clic generas el informe en PDF.",
        run: async (h) => {
          await h.click('[data-tour="view-report"]');
          await h.click(button("Continuar", '[role="dialog"]'));
          await h.waitFor(() => dialogTitled("Informe de Resultados"), 10000);
        },
      },
      {
        say: "Con el logo y los datos de tu laboratorio, y cada resultado con su valor de referencia. Listo para imprimir o descargar.",
        focus: () => dialogTitled("Informe de Resultados"),
        run: async (h) => {
          await h.waitFor(pdfShown("Informe de Resultados"), 15000);
        },
      },
    ],
  },
  {
    title: "Compartir con el paciente",
    beats: [
      {
        say: "Y lo mejor: se lo envías a tu paciente por WhatsApp.",
        run: async (h) => {
          await closeDialogs(h);
          await h.click('[data-tour="share-pdf"]');
          await h.waitFor(() => dialogTitled(SHARE_CHAT_TITLE));
        },
      },
      {
        say: "Tu paciente recibe el enlace, lo toca…",
        focus: '[data-tour="demo-share-link"]',
        run: (h) => h.click('[data-tour="demo-share-link"]'),
      },
      {
        say: "…y ve su informe al instante, desde su teléfono, sin descargar nada ni crear cuentas.",
        focus: () => dialogTitled(SHARE_VIEWER_TITLE),
        run: async (h) => {
          await h.waitFor(pdfShown(SHARE_VIEWER_TITLE), 15000);
        },
      },
    ],
  },
  {
    title: "Cierre",
    beats: [
      {
        say: "Pacientes, órdenes, resultados, informes y cobros: todo tu laboratorio en un solo lugar.",
        run: async (h) => {
          await closeDialogs(h);
          await h.navigate("/dashboard");
          await h.waitFor('[data-tour="dashboard-stats"]');
        },
      },
      {
        say: "Pruébalo gratis durante siete días.",
      },
    ],
  },
];
