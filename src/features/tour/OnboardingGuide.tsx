import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Circle, Compass } from "lucide-react";
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
import { APP_ACTION_EVENT, type AppAction } from "@/lib/appActions";
import { dialogTitled, findVisible, runGuidedTask, type GuideStep } from "./guidedTask";

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

/** What the user created last, so later steps can point at their own patient and order. */
const latest: { orderId: string | null; patientName: string | null } = { orderId: null, patientName: null };
const orderPage = () => (location.pathname.startsWith("/orders/") ? null : latest.orderId ? `/orders/${latest.orderId}` : "/orders");

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
          const name = latest.patientName;
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
    start: orderPage,
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
    hint: "Envíale el informe por WhatsApp con un enlace que abre al instante.",
    start: orderPage,
    steps: (isDone) => [
      {
        target: '[data-tour="share-pdf"]',
        title: "Envíaselo por WhatsApp",
        text: "Pulsa «Compartir pdf»: se abre WhatsApp con un mensaje listo para tu paciente y el enlace a su informe. Él lo toca y lo ve al instante, sin descargar nada ni crear cuentas.",
        doneWhen: () => isDone("share"),
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
    route: () => "/patients",
    steps: [
      {
        selector: "main tbody tr",
        title: "Ficha e historial",
        text: "Haz clic en cualquier paciente para ver su ficha, editar sus datos y ver el historial de todas sus órdenes con su estado y monto.",
      },
      {
        selector: '[data-tour="new-patient"]',
        title: "Registra pacientes",
        text: "También puedes registrarlos directamente desde una orden nueva, si aún no existen.",
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
  orderId: string | null;
  patientName: string | null;
}

// Progress lives in this browser; the profile only records that the guide is finished.
const stateKey = (userId: string) => `medlab_onboarding_${userId}`;

function loadState(userId: string): GuideState {
  const fresh: GuideState = { welcomed: false, minimized: false, done: [], explored: [], orderId: null, patientName: null };
  try {
    const saved = localStorage.getItem(stateKey(userId));
    if (saved) return { ...fresh, ...(JSON.parse(saved) as Partial<GuideState>) };
  } catch {
    // Fall through to a fresh guide.
  }
  return fresh;
}

function saveState(userId: string, state: GuideState) {
  try {
    localStorage.setItem(stateKey(userId), JSON.stringify(state));
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

/**
 * Interactive first-steps guide for a new lab admin: they do each task on their own lab while the guide
 * points at what to press. `onFinish` records it as finished so it never shows again.
 */
export default function OnboardingGuide({ userId, onFinish }: { userId: string; onFinish: () => void }) {
  const navigate = useNavigate();
  const [state, setState] = useState<GuideState>(() => loadState(userId));
  latest.orderId = state.orderId;
  latest.patientName = state.patientName;

  const update = useCallback(
    (patch: Partial<GuideState>) => {
      setState((prev) => saveState(userId, { ...prev, ...patch }));
    },
    [userId]
  );

  // Steps poll completion from a ref so a running guide sees progress without re-rendering.
  const doneRef = useRef<TaskId[]>(state.done);
  const stopGuideRef = useRef<(() => void) | null>(null);
  const [runningTask, setRunningTask] = useState<TaskId | null>(null);

  const markDone = useCallback(
    (id: TaskId) => {
      if (!doneRef.current.includes(id)) doneRef.current = [...doneRef.current, id];
      setState((prev) => (prev.done.includes(id) ? prev : saveState(userId, { ...prev, done: [...prev.done, id] })));
    },
    [userId]
  );

  const stopGuide = useCallback(() => {
    stopGuideRef.current?.();
    stopGuideRef.current = null;
    setRunningTask(null);
  }, []);

  useEffect(() => stopGuide, [stopGuide]);

  const markExplored = useCallback(
    (id: ExploreId) => {
      setState((prev) => (prev.explored.includes(id) ? prev : saveState(userId, { ...prev, explored: [...prev.explored, id] })));
    },
    [userId]
  );

  // Tasks tick themselves off from what the user actually does, not from clicking "next".
  useEffect(() => {
    const onAction = (event: Event) => {
      const action = (event as CustomEvent<AppAction>).detail;
      if (action.type === "patient_created") {
        update({ patientName: action.firstName });
        markDone("patient");
      }
      if (action.type === "order_created") {
        update({ orderId: action.orderId });
        markDone("order");
      }
      if (action.type === "results_saved") markDone("results");
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.('[data-tour="view-report"]')) markDone("report");
      if (target?.closest?.('[data-tour="share-pdf"]')) markDone("share");
    };
    window.addEventListener(APP_ACTION_EVENT, onAction);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener(APP_ACTION_EVENT, onAction);
      document.removeEventListener("click", onClick, true);
    };
  }, [markDone, update]);

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

  const finish = () => {
    stopGuide();
    onFinish();
  };

  return (
    <>
      <Dialog open={!state.welcomed} onOpenChange={(open) => !open && update({ welcomed: true, minimized: true })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¡Bienvenido a MedLabCore!</DialogTitle>
            <DialogDescription>
              Te acompañamos paso a paso a registrar tu primer paciente, crear su orden, cargar sus resultados y enviárselos.
              Toma unos 5 minutos.
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
            Lo que registres queda guardado en tu laboratorio. Después puedes recorrer el resto del sistema: exámenes,
            ventas y configuración.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => update({ welcomed: true, minimized: true })}>
              Ahora no
            </Button>
            <Button
              onClick={() => {
                update({ welcomed: true, minimized: false });
                showTask(TASKS[0]);
              }}
            >
              Comenzar
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
                  <div className="space-y-2 rounded-md bg-emerald-50 p-2 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    <p>¡Completaste el flujo principal! Conoce el resto del sistema abajo, o cierra la guía.</p>
                    <Button size="sm" variant="outline" className="w-full bg-card" onClick={finish}>
                      Terminar la guía
                    </Button>
                  </div>
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

              {nextTask && (
                <button type="button" onClick={finish} className="text-xs text-muted-foreground underline underline-offset-2">
                  No volver a mostrar la guía
                </button>
              )}
            </div>
          )}
        </aside>
      )}
    </>
  );
}
