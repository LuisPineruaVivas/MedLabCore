/** What the onboarding guide listens for to tick off its tasks; fired after each successful write. */
export const APP_ACTION_EVENT = "medlab:action";

export type AppAction =
  | { type: "patient_created"; firstName: string }
  | { type: "order_created"; orderId: string }
  | { type: "results_saved"; orderId: string };

export function emitAppAction(action: AppAction) {
  window.dispatchEvent(new CustomEvent<AppAction>(APP_ACTION_EVENT, { detail: action }));
}
