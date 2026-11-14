import { useEffect, useRef, useState } from "react";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: { sitekey: string; language?: string; callback: (token: string) => void; "expired-callback": () => void }) => string;
      reset: (widgetId: string) => void;
    };
  }
}

/**
 * Cloudflare Turnstile captcha. Supabase Auth checks the token on sign-in and sign-up once captcha
 * protection is on, and each token works once: call `reset` after every attempt.
 * Without a site key (local dev) it renders nothing and `required` is false.
 */
export function useTurnstile(container: React.RefObject<HTMLDivElement>) {
  const [token, setToken] = useState<string | null>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !container.current) return;
    const render = () => {
      if (!window.turnstile || !container.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(container.current, {
        sitekey: TURNSTILE_SITE_KEY,
        language: "es",
        callback: setToken,
        "expired-callback": () => setToken(null),
      });
    };
    if (window.turnstile) return render();
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [container]);

  const reset = () => {
    setToken(null);
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  };

  return { token, required: Boolean(TURNSTILE_SITE_KEY), reset };
}
