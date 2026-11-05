import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { Buffer } from 'buffer';
import { initSentry } from "@/lib/sentry";
(window as any).Buffer = Buffer;

initSentry();

registerSW({
  immediate: true,
});

createRoot(document.getElementById("root")!).render(<App />);
