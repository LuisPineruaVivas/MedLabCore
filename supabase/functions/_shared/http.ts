// Shared HTTP helpers for the edge functions: CORS limited to the app's own origins,
// and error responses that never expose internal details to the browser.

const DEFAULT_ALLOWED_ORIGINS = [
  "https://med-lab-core.vercel.app",
  "http://localhost:8080",
  "http://localhost:4173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:4173",
];

// Vercel previews of this project only, e.g. med-lab-core-git-dev-luis-pineruas-projects.vercel.app
const PREVIEW_ORIGIN = /^https:\/\/med-lab-core-[a-z0-9-]+-luis-pineruas-projects\.vercel\.app$/;

// ALLOWED_ORIGINS (comma-separated secret) adds origins, e.g. a future custom domain.
const extraOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...DEFAULT_ALLOWED_ORIGINS, ...extraOrigins]);

export function isAllowedOrigin(origin: string | null): boolean {
  return !!origin && (allowedOrigins.has(origin) || PREVIEW_ORIGIN.test(origin));
}

/** CORS headers for this request: the caller's origin only when it is one of ours. */
export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : DEFAULT_ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

/** 500 with a generic message; the real error goes to the function logs only. */
export function internalError(
  corsHeaders: Record<string, string>,
  context: string,
  error: unknown,
  publicMessage = "Ocurrio un error interno. Intenta nuevamente.",
): Response {
  console.error(`${context}:`, error instanceof Error ? error.message : error);
  return new Response(JSON.stringify({ error: publicMessage }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
