import { driver } from "driver.js";

export interface GuideStep {
  /** CSS selector (first visible match wins) or a finder for the element to spotlight. */
  target: string | (() => Element | null);
  title: string;
  text: string | (() => string);
  /** Advances when this returns true. Without it the popover shows a "Siguiente" button. */
  doneWhen?: () => boolean;
  /** If the target is gone for a moment (e.g. the visitor closed a dialog), go back to this step. */
  fallbackTo?: number;
  /** If the target never shows up, skip the step instead of waiting forever. */
  optional?: boolean;
  side?: "top" | "bottom" | "left" | "right";
  /** Text fields: doneWhen is only checked on arrival (to skip filled fields) and when the visitor presses Enter. */
  advanceOnEnter?: boolean;
}

export const PASSIVE_CLASS = "medlab-tour-passive";
const PASSIVE_POPOVER = "medlab-tour-popover-passive";
const MISSING_GRACE_MS = 1200;

// driver.js blocks clicks on everything but the highlighted element, and Radix dialogs close on any click
// outside them. During guided tasks the visitor must use the whole form, so both behaviours are switched off.
const PASSIVE_CSS = `
html.${PASSIVE_CLASS} .driver-active *,
html.${PASSIVE_CLASS} .driver-active .driver-overlay { pointer-events: revert-layer; }
html.${PASSIVE_CLASS} .driver-overlay, html.${PASSIVE_CLASS} .driver-overlay * { pointer-events: none !important; }
html.${PASSIVE_CLASS} :not(body):has(> .driver-active-element) { overflow: revert-layer !important; }
.${PASSIVE_POPOVER}, .${PASSIVE_POPOVER} * { pointer-events: none !important; }
`;

export function ensureStyles() {
  if (document.getElementById("medlab-tour-styles")) return;
  const style = document.createElement("style");
  style.id = "medlab-tour-styles";
  style.textContent = PASSIVE_CSS;
  document.head.appendChild(style);
}

export function findVisible(selector: string): Element | null {
  return [...document.querySelectorAll(selector)].find((el) => el.getClientRects().length > 0) ?? null;
}

/** The open dialog whose title contains `title`. Dialogs playing their exit animation count as closed. */
export function dialogTitled(title: string): Element | null {
  return (
    [...document.querySelectorAll('[role="dialog"]:not([data-state="closed"])')].find((d) =>
      d.querySelector("h2")?.textContent?.includes(title)
    ) ?? null
  );
}

/** Runs the steps in order, advancing on what the visitor does. Returns a function that stops the guide. */
export function runGuidedTask(steps: GuideStep[], onFinish: () => void): () => void {
  ensureStyles();
  document.documentElement.classList.add(PASSIVE_CLASS);
  const tour = driver({ allowKeyboardControl: false, allowClose: false, overlayOpacity: 0.45, stagePadding: 6, stageRadius: 8 });

  let index = 0;
  let shown: Element | null = null;
  let missingSince = 0;
  let stopped = false;
  let arrived = true;

  const goTo = (next: number) => {
    index = next;
    shown = null;
    missingSince = 0;
    arrived = true;
  };

  // Enter in a form field would submit the form; on Enter steps it moves to the next field instead.
  const onKeyDown = (event: KeyboardEvent) => {
    const step = steps[index];
    const form = shown?.closest("form");
    if (event.key !== "Enter" || !step?.advanceOnEnter || !form?.contains(event.target as Node)) return;
    event.preventDefault();
    event.stopPropagation();
    if (step.doneWhen?.()) {
      goTo(index + 1);
      tick(); // move focus now, so keys typed right after Enter land in the next field
    }
  };
  document.addEventListener("keydown", onKeyDown, true);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    document.removeEventListener("keydown", onKeyDown, true);
    tour.destroy();
    document.documentElement.classList.remove(PASSIVE_CLASS);
  };

  const tick = () => {
    const step = steps[index];
    if (!step) {
      stop();
      onFinish();
      return;
    }
    const checkDone = !step.advanceOnEnter || arrived;
    arrived = false;
    if (checkDone && step.doneWhen?.()) {
      goTo(index + 1);
      return;
    }

    const el = typeof step.target === "string" ? findVisible(step.target) : step.target();
    if (!el) {
      missingSince ||= Date.now();
      if (Date.now() - missingSince < MISSING_GRACE_MS) return;
      if (shown) {
        tour.destroy();
        shown = null;
      }
      if (step.fallbackTo !== undefined && step.fallbackTo !== index) goTo(step.fallbackTo);
      else if (step.optional) goTo(index + 1);
      return;
    }
    missingSince = 0;

    if (el !== shown) {
      shown = el;
      if (step.advanceOnEnter && el instanceof HTMLElement) el.focus();
      const manual = !step.doneWhen;
      tour.highlight({
        element: el,
        popover: {
          title: step.title,
          description: typeof step.text === "function" ? step.text() : step.text,
          side: step.side,
          showButtons: manual ? ["next"] : [],
          nextBtnText: index === steps.length - 1 ? "Terminar" : "Siguiente",
          popoverClass: manual ? undefined : PASSIVE_POPOVER,
          onNextClick: () => goTo(index + 1),
        },
      });
    } else {
      // Dialog animations and async lists move things around; keep the spotlight on target.
      tour.refresh();
    }
  };

  const timer = setInterval(tick, 200);
  tick();
  return stop;
}
