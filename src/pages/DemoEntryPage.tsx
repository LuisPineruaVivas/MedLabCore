import { useEffect } from "react";
import { DEMO_AUTH_KEY, DEMO_DB_KEY, DEMO_TOUR_KEY, enterDemo, exitDemo } from "@/lib/demo/isDemo";

/** Rendered at /login and /registro while the tab is in demo mode: drop the demo and reload so the real Supabase client boots. */
export function DemoExitRedirect({ to = "/login" }: { to?: string }) {
  useEffect(() => {
    exitDemo();
    window.location.replace(to);
  }, [to]);

  return null;
}

/** Public link for prospects: starts a fresh, in-browser demo and reloads so the Supabase client boots in demo mode. */
export default function DemoEntryPage() {
  useEffect(() => {
    [DEMO_DB_KEY, DEMO_TOUR_KEY, DEMO_AUTH_KEY].forEach((key) => sessionStorage.removeItem(key));
    enterDemo();
    window.location.replace("/dashboard");
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
