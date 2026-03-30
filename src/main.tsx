import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;

registerSW({
  immediate: true,
});

// Initialize Sentry for production error tracking
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, 
  // Session Replay
  replaysSessionSampleRate: 0.1, 
  replaysOnErrorSampleRate: 1.0,
});

createRoot(document.getElementById("root")!).render(<App />);
