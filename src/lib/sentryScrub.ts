import type { Breadcrumb } from "@sentry/react";

/** The parts of a Sentry error/transaction event that can contain the page URL. */
interface UrlCarryingEvent {
  request?: { url?: string; query_string?: unknown };
  transaction?: string;
}

/**
 * Parameters that identify a patient or unlock their results. Portal and report
 * links carry them in the fragment (`/informe-pdf?org=…#dni=…&pin=…`), and links
 * sent before 2026-10 in the query (`?dni=…&pin=…`), so they must never reach
 * Sentry in event URLs, breadcrumbs or transaction names.
 */
export const SENSITIVE_QUERY_PARAMS = ["dni", "pin"] as const;
const FILTERED = "[filtered]";

export function scrubUrl(url: string): string;
export function scrubUrl(url: string | undefined): string | undefined;
export function scrubUrl(url: string | undefined): string | undefined {
  if (!url || !SENSITIVE_QUERY_PARAMS.some((param) => url.includes(`${param}=`))) return url;
  try {
    const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(url);
    const parsed = new URL(url, "http://scrub.local");
    for (const param of SENSITIVE_QUERY_PARAMS) {
      if (parsed.searchParams.has(param)) parsed.searchParams.set(param, FILTERED);
    }
    const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    if (SENSITIVE_QUERY_PARAMS.some((param) => fragment.has(param))) {
      for (const param of SENSITIVE_QUERY_PARAMS) {
        if (fragment.has(param)) fragment.set(param, FILTERED);
      }
      parsed.hash = fragment.toString();
    }
    if (isAbsolute) return parsed.toString();
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url.replace(new RegExp(`([?&#](?:${SENSITIVE_QUERY_PARAMS.join("|")})=)[^&#]*`, "gi"), `$1${FILTERED}`);
  }
}

function scrubQueryString(query: string): string {
  const params = new URLSearchParams(query);
  let changed = false;
  for (const param of SENSITIVE_QUERY_PARAMS) {
    if (params.has(param)) {
      params.set(param, FILTERED);
      changed = true;
    }
  }
  return changed ? params.toString() : query;
}

export function scrubEvent<T extends UrlCarryingEvent>(event: T): T {
  if (event.request?.url) event.request.url = scrubUrl(event.request.url);
  if (typeof event.request?.query_string === "string") {
    event.request.query_string = scrubQueryString(event.request.query_string);
  }
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const data = breadcrumb.data;
  if (data) {
    for (const key of ["url", "to", "from"] as const) {
      if (typeof data[key] === "string") data[key] = scrubUrl(data[key] as string);
    }
  }
  if (breadcrumb.message) breadcrumb.message = scrubUrl(breadcrumb.message);
  return breadcrumb;
}
