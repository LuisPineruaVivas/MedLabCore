// shortcut: temporary page to check error reporting in production; delete once Sentry shows the event.
export default function DebugSentryPage() {
  throw new Error("Prueba de Sentry: error provocado desde /debug-sentry");
}
