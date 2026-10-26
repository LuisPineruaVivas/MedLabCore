export interface PortalCredentials {
  dni: string;
  pin: string;
}

const CREDENTIAL_PARAMS = ["dni", "pin"] as const;

/**
 * Reads the patient's document ID and PIN from a portal/report link.
 * New links carry them in the fragment (`#dni=…&pin=…`); links sent before
 * 2026-10 carry them in the query (`?dni=…&pin=…`) and must keep working.
 */
export function readPortalCredentials(search: string, hash: string): PortalCredentials {
  const fromHash = new URLSearchParams(hash.replace(/^#/, ""));
  const fromQuery = new URLSearchParams(search);
  return {
    dni: fromHash.get("dni") ?? fromQuery.get("dni") ?? "",
    pin: fromHash.get("pin") ?? fromQuery.get("pin") ?? "",
  };
}

/** True when the address bar still shows the document ID or PIN. */
export function hasCredentialsInUrl(search: string, hash: string): boolean {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  return CREDENTIAL_PARAMS.some((param) => query.has(param) || fragment.has(param));
}

/** The query without the document ID and PIN, to clean the address bar after reading them. */
export function withoutCredentials(search: string): URLSearchParams {
  const params = new URLSearchParams(search);
  for (const param of CREDENTIAL_PARAMS) params.delete(param);
  return params;
}

/**
 * Link sent to the patient (e.g. by WhatsApp). The lab id stays in the query
 * (branding); the document ID and PIN go in the fragment, which browsers never
 * send to servers or in Referer headers.
 */
export function buildPortalLink(
  origin: string,
  path: "/portal-paciente" | "/informe-pdf",
  { orgId, dni, pin }: { orgId: string; dni: string; pin: string },
): string {
  return `${origin}${path}?org=${encodeURIComponent(orgId)}#${new URLSearchParams({ dni, pin }).toString()}`;
}

const STORAGE_KEY = "portal-link-credentials";
type CredentialStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function tabStorage(): CredentialStorage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null; // storage blocked (private mode, site data disabled)
  }
}

/**
 * Credentials from the link, remembered for this browser tab only (sessionStorage,
 * cleared when the tab closes), so refreshing the page still works after they were
 * removed from the address bar.
 */
export function resolvePortalCredentials(
  search: string,
  hash: string,
  storage: CredentialStorage | null = tabStorage(),
): PortalCredentials {
  const fromUrl = readPortalCredentials(search, hash);
  if (fromUrl.dni && fromUrl.pin) {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(fromUrl));
    } catch {
      // not remembered; the link itself still works
    }
    return fromUrl;
  }
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null") as Partial<PortalCredentials> | null;
    if (saved?.dni && saved?.pin) return { dni: String(saved.dni), pin: String(saved.pin) };
  } catch {
    // ignore unreadable storage
  }
  return fromUrl;
}

/** Forgets the remembered credentials (patient logged out). */
export function forgetPortalCredentials(storage: CredentialStorage | null = tabStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // nothing to forget
  }
}
