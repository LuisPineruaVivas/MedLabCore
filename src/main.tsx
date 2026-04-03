import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { Buffer } from 'buffer';
import { env } from "@/lib/env";
(window as any).Buffer = Buffer;

registerSW({
  immediate: true,
});

if (env.enableSentry) {
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.mode,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: env.sentryTraceSampleRate,
    replaysSessionSampleRate: env.sentryReplaySessionSampleRate,
    replaysOnErrorSampleRate: env.sentryReplayOnErrorSampleRate,
  });
}

createRoot(document.getElementById("root")!).render(<App />);
