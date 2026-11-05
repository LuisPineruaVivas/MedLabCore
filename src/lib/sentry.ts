import * as Sentry from "@sentry/react";
import { env } from "@/lib/env";
import { isDemo } from "@/lib/demo/isDemo";

const MAX_SAME_ERROR_PER_SESSION = 3;
const seenErrors = new Map<string, number>();

/**
 * Error monitoring only: no session replay and no tracing. The app handles patient data, so events
 * carry no PII, request bodies or form values, only the error, the page and who (by id) hit it.
 */
export function initSentry() {
  if (!env.enableSentry) return;

  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.sentryEnvironment,
    sendDefaultPii: false,
    // Errors thrown by browser extensions or injected scripts are not ours to fix.
    denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-extension:\/\//],
    ignoreErrors: ["ResizeObserver loop limit exceeded", "ResizeObserver loop completed with undelivered notifications"],
    beforeBreadcrumb(breadcrumb) {
      // Clicked elements' text and console messages can contain patient names or results.
      if (breadcrumb.category === "ui.input" || breadcrumb.category === "console") return null;
      if (breadcrumb.category === "ui.click") breadcrumb.message = breadcrumb.message?.replace(/\[.*?\]/g, "");
      return breadcrumb;
    },
    beforeSend(event, hint) {
      // A component that crashes on every render would otherwise burn the monthly quota from one tab.
      const error = hint.originalException;
      const key = error instanceof Error ? `${error.name}:${error.message}` : String(event.message ?? event.event_id);
      const count = (seenErrors.get(key) ?? 0) + 1;
      seenErrors.set(key, count);
      if (count > MAX_SAME_ERROR_PER_SESSION) return null;

      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        // Shared report links carry the patient's cédula and PIN in the query string.
        if (event.request.url) event.request.url = event.request.url.split("?")[0];
        delete event.request.query_string;
      }
      return event;
    },
  });

  Sentry.setTag("demo", isDemo);
}

/** Who hit the error, by id only. Call with null on sign-out. */
export function setSentryUser(user: { id: string; role?: string | null; orgId?: string | null } | null) {
  if (!env.enableSentry) return;
  Sentry.setUser(user ? { id: user.id } : null);
  Sentry.setTag("role", user?.role ?? undefined);
  Sentry.setTag("org_id", user?.orgId ?? undefined);
}
