import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { Buffer } from 'buffer';
import { initSentry } from "@/lib/sentry";
import { reloadForNewVersion } from "@/lib/reloadForNewVersion";
(window as any).Buffer = Buffer;

initSentry();

// Vite fires this when a lazy page's chunk (or its CSS) fails to load, e.g. in a tab opened before a deploy.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

registerSW({
  immediate: true,
});

createRoot(document.getElementById("root")!).render(<App />);
