import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { Buffer } from 'buffer';
import { env } from "@/lib/env";
import { scrubBreadcrumb, scrubEvent } from "@/lib/sentryScrub";
(window as Window & { Buffer?: typeof Buffer }).Buffer = Buffer;

registerSW({
  immediate: true,
});

if (env.enableSentry) {
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.mode,
    sendDefaultPii: false,
    integrations: [
      Sentry.browserTracingIntegration(),
      // Patient data is on screen: keep replays masked even if defaults change.
      Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }),
    ],
    tracesSampleRate: env.sentryTraceSampleRate,
    replaysSessionSampleRate: env.sentryReplaySessionSampleRate,
    replaysOnErrorSampleRate: env.sentryReplayOnErrorSampleRate,
    // Portal/report links carry the patient's id number and PIN in the query string.
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}

createRoot(document.getElementById("root")!).render(<App />);
