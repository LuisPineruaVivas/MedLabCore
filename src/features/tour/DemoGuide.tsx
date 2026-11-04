import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Circle, Compass, LogOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DEMO_DB_KEY, DEMO_TOUR_KEY, exitDemo } from "@/lib/demo/isDemo";
import { DEMO_EVENT, latestDemoOrderId, latestDemoPatientName, type DemoWriteEvent } from "@/lib/demo/demoFetch";
import { DEMO_SHOWCASE_PATIENT_ID } from "@/lib/demo/seed";
import { dialogTitled, findVisible, runGuidedTask, type GuideStep } from "./guidedTask";
import { DemoShareSimulator, SHARE_CHAT_TITLE, SHARE_VIEWER_TITLE } from "./DemoShareSimulator";

type TaskId = "patient" | "order" | "results" | "report" | "share";
type ExploreId = "dashboard" | "patients" | "tests" | "billing" | "settings";

interface Task {
  id: TaskId;
  title: string;
  hint: string;
  /** Page to open before the first step; null keeps the visitor where they are. */
  start: () => string | null;
  steps: (isDone: (id: TaskId) => boolean) => GuideStep[];
}

interface ExploreItem {
  id: ExploreId;
  title: string;
  route: () => string;
  steps: Array<{ selector: string; title: string; text: string }>;
}

const navLink = (path: string) => `a[href="${path}"]`;
const inDialog = (selector: string) => `[role="dialog"] ${selector}`;
const filled = (selector: string) => Boolean((findVisible(selector) as HTMLInputElement | null)?.value?.trim());
const birthDateEntered = () =>
  /^\d{2}\/\d{2}\/\d{4}$/.test((findVisible(inDialog('input[placeholder="Seleccionar fecha"]')) as HTMLInputElement | null)?.value ?? "");

/** True once the dialog has been seen and then closed again. */
function closedAfterOpen(title: string) {
  let seen = false;
  return () => {
    const open = Boolean(dialogTitled(title));
    seen ||= open;
    return seen && !open;
  };
}

const TASKS: Task[] = [
  {
    id: "patient",
    title: "Registra un paciente",
    hint: "Desde el menú «Pacientes», registra uno nuevo con sus datos.",
    start: () => "/dashboard",
    steps: (isDone) => [
      {
        target: navLink("/patients"),
        title: "Todo empieza con el paciente",
        text: "Este es tu panel de control. Entra a «Pacientes» en el menú para ver a todos los pacientes de tu laboratorio.",
        doneWhen: () => location.pathname === "/patients",
      },
      {
        target: '[data-tour="new-patient"]',
        title: "Registra un paciente nuevo",
        text: "Aquí está la lista de pacientes, con su cédula, contacto y exámenes pendientes, y puedes buscarlos por nombre, cédula o teléfono. Pulsa «Nuevo Paciente».",
        doneWhen: () => Boolean(dialogTitled("Nuevo Paciente")),
        fallbackTo: 0,
      },
      {
        target: inDialog('input[name="id_number"]'),
        title: "1. Cédula",
        text: "Escribe la cédula del paciente. Con ella lo encuentras rápido en cualquier búsqueda. Al terminar, pulsa Enter.",
        doneWhen: () => filled(inDialog('input[name="id_number"]')),
        advanceOnEnter: true,
        fallbackTo: 1,
      },
      {
        target: inDialog('input[name="first_name"]'),
        title: "2. Nombre",
        text: "Escribe el nombre del paciente. Al terminar, pulsa Enter.",
        doneWhen: () => filled(inDialog('input[name="first_name"]')),
        advanceOnEnter: true,
        fallbackTo: 1,
      },
      {
        target: inDialog('input[name="last_name"]'),
        title: "3. Apellido",
        text: "Ahora su apellido. Al terminar, pulsa Enter.",
        doneWhen: () => filled(inDialog('input[name="last_name"]')),
        advanceOnEnter: true,
        fallbackTo: 1,
      },
      {
        target: inDialog('input[placeholder="Seleccionar fecha"]'),
        title: "4. Fecha de nacimiento y género",
        text: "Elige la fecha en el calendario o escríbela (dd/mm/aaaa) y pulsa Enter. La edad se calcula sola. Revisa también el género: ambos salen en sus informes.",
        // Waits for the calendar to close, so typing a date doesn't jump ahead before Enter or a click on a day.
        doneWhen: () => birthDateEntered() && !findVisible(".react-datepicker-popper"),
        fallbackTo: 1,
      },
      {
        // Hidden while a required field is empty, so the guide falls back to the fields and walks to the missing one.
        target: () =>
          ["first_name", "last_name"].every((name) => filled(inDialog(`input[name="${name}"]`))) && birthDateEntered()
            ? findVisible(inDialog('button[type="submit"]'))
            : null,
        title: "5. Guarda el paciente",
        text: "Teléfono, correo y dirección son opcionales. Cuando termines, pulsa «Guardar Paciente».",
        doneWhen: () => isDone("patient"),
        fallbackTo: 3,
      },
      {
        target: "main tbody tr",
        title: "¡Paciente registrado!",
        text: "Ya aparece de primero en tu lista. Haciendo clic en un paciente ves su ficha y todo su historial de órdenes.",
        optional: true,
      },
    ],
  },
  {
    id: "order",
    title: "Crea una orden",
    hint: "Desde «Órdenes», elige al paciente, agrega sus exámenes y crea la orden.",
    start: () => null,
    steps: (isDone) => [
      {
        target: navLink("/orders"),
        title: "Las órdenes",
        text: "Cada vez que un paciente viene a hacerse exámenes, creas una orden. Entra a «Órdenes» en el menú.",
        doneWhen: () => location.pathname === "/orders",
      },
      {
        target: '[data-tour="new-order"]',
        title: "Crea una orden nueva",
        text: "Aquí ves todas las órdenes con su estado y monto. Pulsa «Nueva Orden».",
        doneWhen: () => Boolean(dialogTitled("Nueva Orden")),
        fallbackTo: 0,
      },
      {
        target: '[data-tour="order-patient-search"]',
        title: "1. Busca al paciente",
        text: () => {
          const name = latestDemoPatientName();
          return `Escribe el nombre o la cédula del paciente${name ? ` (por ejemplo, «${name}»)` : ""} y selecciónalo en la lista que aparece.`;
        },
        doneWhen: () => Boolean(findVisible('[data-tour="order-patient-selected"]')),
        fallbackTo: 1,
      },
      {
        target: '[data-tour="order-tests"]',
        title: "2. Agrega los exámenes",
        text: "Busca cada examen por su nombre y pulsa sobre él para agregarlo. Los perfiles agregan un paquete de exámenes de una vez, con precio especial.",
        doneWhen: () => Boolean(findVisible('[data-tour="order-summary"] tbody tr')),
        fallbackTo: 1,
      },
      {
        target: '[data-tour="order-summary"]',
        title: "3. Revisa y crea la orden",
        text: "Verifica los exámenes y el total en dólares y bolívares (a la tasa del día). Puedes quitar un examen con la X, seguir agregando o exonerar la orden. Si quieres, anota el diagnóstico abajo. Cuando esté todo bien, pulsa «Crear Orden».",
        doneWhen: () => isDone("order"),
        fallbackTo: 1,
      },
      {
        target: () => dialogTitled("Nota de Entrega"),
        title: "¡Orden creada!",
        text: "Se generó la nota de entrega con el total y el PIN con el que el paciente consulta sus resultados en línea. Puedes imprimirla o cerrarla para continuar.",
        doneWhen: closedAfterOpen("Nota de Entrega"),
        optional: true,
      },
    ],
  },
  {
    id: "results",
    title: "Carga los resultados",
    hint: "Abre la orden, escribe los valores de cada examen y guárdalos.",
    start: () => (location.pathname === "/orders" ? null : "/orders"),
    steps: (isDone) => [
      {
        target: '[data-tour="order-row"]',
        title: "Abre la orden",
        text: "La orden nueva aparece de primera, en estado «Pendiente». Haz clic en ella para abrirla.",
        doneWhen: () => location.pathname.startsWith("/orders/"),
      },
      {
        target: '[data-tour="results"]',
        title: "Escribe los resultados",
        text: "Los exámenes de la orden aparecen agrupados por departamento. Escribe cada valor; a la derecha ves el valor de referencia de cada uno.",
        doneWhen: () => Boolean(document.querySelector('[data-tour="save-results"]:not([disabled])')),
        fallbackTo: 0,
      },
      {
        target: '[data-tour="save-results"]',
        title: "Guarda los resultados",
        text: "Pulsa «Guardar Todos». Puedes volver y corregirlos las veces que necesites.",
        doneWhen: () => isDone("results"),
        fallbackTo: 0,
      },
      {
        target: '[data-tour="status-action"]',
        title: "Avanza el estado de la orden",
        text: "Cuando los resultados estén listos, usa este botón para pasar la orden al siguiente estado (por ejemplo, «por aprobar» y luego «completada»).",
        optional: true,
      },
    ],
  },
  {
    id: "report",
    title: "Mira el informe en PDF",
    hint: "Genera el informe de resultados listo para entregar al paciente.",
    start: () => (location.pathname.startsWith("/orders/") ? null : `/orders/${latestDemoOrderId() ?? ""}`),
    steps: () => [
      {
        target: '[data-tour="view-report"]',
        title: "Genera el informe",
        text: "Pulsa «Ver Informe» para crear el PDF con los resultados de la orden.",
        doneWhen: () => Boolean(dialogTitled("Seleccionar exámenes") || dialogTitled("Informe de Resultados")),
      },
      {
        target: () => dialogTitled("Seleccionar exámenes"),
        title: "Elige qué incluir",
        text: "Marca los exámenes que quieres en el informe (por ejemplo, solo los que ya están listos) y pulsa «Continuar».",
        doneWhen: () => Boolean(dialogTitled("Informe de Resultados")),
        fallbackTo: 0,
      },
      {
        target: () => dialogTitled("Informe de Resultados"),
        title: "¡Tu informe está listo!",
        text: "Así queda: con el logo y los datos de tu laboratorio, y cada resultado con su valor de referencia. Desde aquí puedes imprimirlo o descargarlo. Ciérralo para terminar.",
        doneWhen: closedAfterOpen("Informe de Resultados"),
        optional: true,
      },
    ],
  },
  {
    id: "share",
    title: "Compártelo con tu paciente",
    hint: "Envía el informe por WhatsApp y míralo como lo recibe tu paciente.",
    start: () => (location.pathname.startsWith("/orders/") ? null : `/orders/${latestDemoOrderId() ?? ""}`),
    steps: (isDone) => [
      {
        target: '[data-tour="share-pdf"]',
        title: "Envíaselo por WhatsApp",
        text: "Con «Compartir pdf» le mandas a tu paciente un enlace a su informe por WhatsApp, sin imprimir ni adjuntar archivos. Púlsalo.",
        doneWhen: () => Boolean(dialogTitled(SHARE_CHAT_TITLE)),
      },
      {
        target: '[data-tour="demo-share-link"]',
        title: "Así le llega el mensaje",
        text: "Este es el mensaje que recibe tu paciente. Ponte en su lugar: toca el enlace.",
        doneWhen: () => isDone("share"),
        fallbackTo: 0,
      },
      {
        target: () => dialogTitled(SHARE_VIEWER_TITLE),
        title: "¡Así lo ve tu paciente!",
        text: "Su informe se abre al instante, con el logo de tu laboratorio, listo para ver, descargar o imprimir. Ciérralo para terminar.",
        doneWhen: closedAfterOpen(SHARE_VIEWER_TITLE),
        optional: true,
      },
    ],
  },
];

// Read-only walkthroughs: pages without dialogs, so step-by-step popovers are safe here.
const EXPLORE: ExploreItem[] = [
  {
    id: "dashboard",
    title: "Panel de control",
    route: () => "/dashboard",
    steps: [
      {
        selector: '[data-tour="dashboard-stats"]',
        title: "Tu laboratorio de un vistazo",
        text: "Pacientes registrados, pruebas del día, órdenes pendientes e ingresos de hoy, siempre al día.",
      },
      {
        selector: '[data-tour="dashboard-pending"]',
        title: "Pruebas pendientes",
        text: "Las órdenes que esperan resultados o aprobación. Haz clic en una para ir directo a ella.",
      },
    ],
  },
  {
    id: "patients",
    title: "Pacientes e historial",
    route: () => `/patients/${DEMO_SHOWCASE_PATIENT_ID}`,
    steps: [
      {
        selector: '[data-tour="patient-info"]',
        title: "Ficha del paciente",
        text: "Sus datos personales y de contacto. Desde aquí puedes editarlos o generar su tarjeta de grupo sanguíneo.",
      },
      {
        selector: '[data-tour="patient-orders"]',
        title: "Historial de órdenes",
        text: "Todas las órdenes que se le han hecho en tu laboratorio, con su estado y monto. Haz clic en una para ver sus resultados.",
      },
    ],
  },
  {
    id: "tests",
    title: "Catálogo de exámenes",
    route: () => "/tests",
    steps: [
      {
        selector: '[data-tour="tests-table"]',
        title: "Tus exámenes",
        text: "Cada examen con su departamento y precio. Puedes editarlos, activarlos o desactivarlos.",
      },
      {
        selector: '[data-tour="new-test"]',
        title: "Crea tus propios exámenes",
        text: "Diseña el formulario de resultados: campos, unidades y valores de referencia.",
      },
      {
        selector: '[data-tour="tests-tabs"]',
        title: "Perfiles y orden del informe",
        text: "Arma perfiles (paquetes de exámenes con precio especial), registra métodos y decide en qué orden salen en el informe.",
      },
    ],
  },
  {
    id: "billing",
    title: "Ventas e ingresos",
    route: () => "/billing",
    steps: [
      {
        selector: '[data-tour="billing-stats"]',
        title: "Tus ingresos",
        text: "Total recaudado, ingresos del mes y órdenes pendientes.",
      },
      {
        selector: '[data-tour="billing-table"]',
        title: "Detalle por orden",
        text: "Cada orden con su paciente, estado y monto en dólares y en bolívares.",
      },
    ],
  },
  {
    id: "settings",
    title: "Configura tu laboratorio",
    route: () => "/settings",
    steps: [
      {
        selector: '[data-tour="settings-org"]',
        title: "Datos del laboratorio",
        text: "Nombre, logo, dirección y contacto: así aparecen en tus informes y notas de entrega.",
      },
      {
        selector: '[data-tour="settings-users"]',
        title: "Tu equipo",
        text: "Da acceso a bioanalistas y secretarias, cada uno con los permisos de su rol.",
      },
      {
        selector: '[data-tour="settings-subscription"]',
        title: "Tu suscripción",
        text: "Consulta el estado de tu plan y reporta tus pagos.",
      },
    ],
  },
];

const TOTAL = TASKS.length + EXPLORE.length;

interface GuideState {
  welcomed: boolean;
  minimized: boolean;
  done: TaskId[];
  explored: ExploreId[];
}

function loadState(): GuideState {
  const fresh: GuideState = { welcomed: false, minimized: false, done: [], explored: [] };
  try {
    const saved = sessionStorage.getItem(DEMO_TOUR_KEY);
    if (saved) return { ...fresh, ...(JSON.parse(saved) as Partial<GuideState>) };
  } catch {
    // Fall through to a fresh guide.
  }
  return fresh;
}

function saveState(state: GuideState) {
  try {
    sessionStorage.setItem(DEMO_TOUR_KEY, JSON.stringify(state));
  } catch {
    // Progress is a convenience; losing it only re-shows unchecked tasks.
  }
  return state;
}

function waitForElement(selector: string, timeoutMs = 6000): Promise<Element | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const el = document.querySelector(selector);
      if (el || Date.now() - started > timeoutMs) resolve(el);
      else setTimeout(tick, 100);
    };
    tick();
  });
}

function StatusIcon({ done, current }: { done: boolean; current?: boolean }) {
  return done ? (
    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Completado" />
  ) : (
    <Circle className={cn("mt-0.5 h-4 w-4 shrink-0", current ? "text-primary" : "text-muted-foreground")} />
  );
}

export default function DemoGuide() {
  const navigate = useNavigate();
  const [state, setState] = useState<GuideState>(loadState);

  const update = useCallback((patch: Partial<GuideState>) => {
    setState((prev) => saveState({ ...prev, ...patch }));
  }, []);

  // Steps poll completion from a ref so a running guide sees progress without re-rendering.
  const doneRef = useRef<TaskId[]>(state.done);
  const stopGuideRef = useRef<(() => void) | null>(null);
  const [runningTask, setRunningTask] = useState<TaskId | null>(null);

  const markDone = useCallback((id: TaskId) => {
    if (!doneRef.current.includes(id)) doneRef.current = [...doneRef.current, id];
    setState((prev) => (prev.done.includes(id) ? prev : saveState({ ...prev, done: [...prev.done, id] })));
  }, []);

  const stopGuide = useCallback(() => {
    stopGuideRef.current?.();
    stopGuideRef.current = null;
    setRunningTask(null);
  }, []);

  useEffect(() => stopGuide, [stopGuide]);

  const markExplored = useCallback((id: ExploreId) => {
    setState((prev) => (prev.explored.includes(id) ? prev : saveState({ ...prev, explored: [...prev.explored, id] })));
  }, []);

  // Tasks tick themselves off from what the visitor actually does, not from clicking "next".
  useEffect(() => {
    const onWrite = (event: Event) => {
      const { table, action, rows } = (event as CustomEvent<DemoWriteEvent>).detail;
      if (table === "patients" && action === "insert") markDone("patient");
      if (action === "create_order") markDone("order");
      if (table === "order_items" && action === "update" && rows.some((row) => row.results_data)) markDone("results");
    };
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest?.('[data-tour="view-report"]')) markDone("report");
    };
    window.addEventListener(DEMO_EVENT, onWrite);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener(DEMO_EVENT, onWrite);
      document.removeEventListener("click", onClick, true);
    };
  }, [markDone]);

  const showTask = useCallback(
    (task: Task) => {
      stopGuide();
      const route = task.start();
      if (route) navigate(route);
      // Collapse the panel while guiding so it never covers the highlighted area.
      update({ minimized: true });
      setRunningTask(task.id);
      stopGuideRef.current = runGuidedTask(task.steps((id) => doneRef.current.includes(id)), () => {
        stopGuideRef.current = null;
        setRunningTask(null);
        update({ minimized: false });
      });
    },
    [navigate, update, stopGuide]
  );

  const showExplore = useCallback(
    async (item: ExploreItem) => {
      stopGuide();
      navigate(item.route());
      if (!(await waitForElement(item.steps[0].selector))) return;
      update({ minimized: true });
      const tour = driver({
        showProgress: true,
        progressText: "{{current}} de {{total}}",
        nextBtnText: "Siguiente",
        prevBtnText: "Anterior",
        doneBtnText: "Entendido",
        overlayOpacity: 0.55,
        stagePadding: 6,
        steps: item.steps.map((step) => ({
          element: step.selector,
          popover: { title: step.title, description: step.text },
        })),
        onDestroyed: () => {
          markExplored(item.id);
          update({ minimized: false });
        },
      });
      tour.drive();
    },
    [navigate, markExplored, update, stopGuide]
  );

  const nextTask = TASKS.find((task) => !state.done.includes(task.id));
  const progress = state.done.length + state.explored.length;

  const restart = () => {
    sessionStorage.removeItem(DEMO_DB_KEY);
    sessionStorage.removeItem(DEMO_TOUR_KEY);
    window.location.replace("/dashboard");
  };

  const leave = () => {
    exitDemo();
    window.location.replace("/login");
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-sky-600 px-4 py-1.5 text-xs text-white sm:text-sm">
        <span>
          <strong>Modo demo:</strong> los datos son ficticios y nada de lo que hagas se guarda.
        </span>
        <button type="button" onClick={restart} className="inline-flex items-center gap-1 underline underline-offset-2">
          <RotateCcw className="h-3 w-3" /> Reiniciar
        </button>
        <button type="button" onClick={leave} className="inline-flex items-center gap-1 underline underline-offset-2">
          <LogOut className="h-3 w-3" /> Salir
        </button>
      </div>

      <DemoShareSimulator onOpenLink={() => markDone("share")} />

      <Dialog open={!state.welcomed} onOpenChange={(open) => !open && update({ welcomed: true })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bienvenido a MedLabCore</DialogTitle>
            <DialogDescription>
              Te guiaremos por el flujo principal de un laboratorio, de punta a punta, en unos 3 minutos.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-2 text-sm">
            {TASKS.map((task, i) => (
              <li key={task.id} className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                {task.title}
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">
            Después puedes recorrer el resto del sistema: historial de pacientes, catálogo de exámenes, ventas y configuración.
          </p>
          <p className="text-xs text-muted-foreground">
            Es un laboratorio de prueba: puedes tocar todo sin miedo. Al cerrar la pestaña, todo se borra.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => update({ welcomed: true, minimized: false })}>
              Explorar por mi cuenta
            </Button>
            <Button
              onClick={() => {
                update({ welcomed: true, minimized: false });
                showTask(TASKS[0]);
              }}
            >
              Comenzar recorrido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {state.welcomed && (
        <aside
          aria-label="Ruta guiada"
          className="fixed bottom-20 right-3 z-40 w-[calc(100%-1.5rem)] max-w-xs rounded-xl border bg-card shadow-lg md:bottom-4"
        >
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => update({ minimized: !state.minimized })}
              aria-expanded={!state.minimized}
              className="flex flex-1 items-center gap-2 px-4 py-3 text-left text-sm font-semibold"
            >
              <Compass className="h-4 w-4 text-primary" />
              <span className="flex-1">Ruta guiada · {progress}/{TOTAL}</span>
              {state.minimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {runningTask && (
              <button
                type="button"
                onClick={() => {
                  stopGuide();
                  update({ minimized: false });
                }}
                className="mr-3 rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
              >
                Detener guía
              </button>
            )}
          </div>

          {!state.minimized && (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto border-t px-4 py-3">
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Flujo principal</h3>
                <ul className="space-y-2">
                  {TASKS.map((task) => {
                    const done = state.done.includes(task.id);
                    const current = task.id === nextTask?.id;
                    return (
                      <li key={task.id} className="flex gap-2 text-sm">
                        <StatusIcon done={done} current={current} />
                        <div className="min-w-0">
                          <p className={cn(done && "text-muted-foreground line-through", current && "font-medium")}>{task.title}</p>
                          {current && <p className="text-xs text-muted-foreground">{task.hint}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {nextTask ? (
                  <Button size="sm" className="w-full" onClick={() => showTask(nextTask)}>
                    {runningTask === nextTask.id ? "Reiniciar este paso" : "Guíame paso a paso"}
                  </Button>
                ) : (
                  <p className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    ¡Completaste el flujo principal! Ahora conoce el resto del sistema.
                  </p>
                )}
              </section>

              <section className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conoce el sistema</h3>
                <ul>
                  {EXPLORE.map((item) => {
                    const done = state.explored.includes(item.id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => void showExplore(item)}
                          className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          <StatusIcon done={done} />
                          <span className={cn("flex-1", done && "text-muted-foreground")}>{item.title}</span>
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
