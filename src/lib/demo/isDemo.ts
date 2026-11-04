export const DEMO_FLAG_KEY = "medlab_demo";
export const DEMO_DB_KEY = "medlab_demo_db";
export const DEMO_AUTH_KEY = "medlab-demo-auth";
export const DEMO_TOUR_KEY = "medlab_demo_tour";

function readFlag() {
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(DEMO_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

// Read once at import: the Supabase client is built from this value, so switching needs a full reload.
export const isDemo = readFlag();

export function enterDemo() {
  sessionStorage.setItem(DEMO_FLAG_KEY, "1");
}

export function exitDemo() {
  [DEMO_FLAG_KEY, DEMO_DB_KEY, DEMO_AUTH_KEY, DEMO_TOUR_KEY].forEach((key) => sessionStorage.removeItem(key));
}

/** In the demo, sharing by WhatsApp opens a simulated chat (DemoGuide) instead of wa.me. */
export const DEMO_SHARE_EVENT = "medlab-demo-share";
export type DemoShareDetail = { message: string; url: string };
