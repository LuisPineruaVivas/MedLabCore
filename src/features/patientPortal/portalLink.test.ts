import {
  buildPortalLink,
  forgetPortalCredentials,
  hasCredentialsInUrl,
  readPortalCredentials,
  resolvePortalCredentials,
  withoutCredentials,
} from "./portalLink";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string): void => void values.set(key, value),
    removeItem: (key: string): void => void values.delete(key),
  };
}

describe("portal links", () => {
  it("puts the document ID and PIN in the fragment, the lab in the query", () => {
    const link = buildPortalLink("https://med-lab-core.vercel.app", "/informe-pdf", { orgId: "org-1", dni: "V-12 345", pin: "7KQ2M9XH4P" });
    expect(link).toBe("https://med-lab-core.vercel.app/informe-pdf?org=org-1#dni=V-12+345&pin=7KQ2M9XH4P");
    const url = new URL(link);
    expect(url.search).not.toMatch(/dni|pin/);
    expect(readPortalCredentials(url.search, url.hash)).toEqual({ dni: "V-12 345", pin: "7KQ2M9XH4P" });
  });

  it("still reads links sent with the old query format", () => {
    expect(readPortalCredentials("?org=org-1&pin=A1B2C3D4&dni=14789455", "")).toEqual({ dni: "14789455", pin: "A1B2C3D4" });
    expect(readPortalCredentials("?org=org-1", "")).toEqual({ dni: "", pin: "" });
  });

  it("detects and removes the credentials from the address bar", () => {
    expect(hasCredentialsInUrl("?org=1&dni=2", "")).toBe(true);
    expect(hasCredentialsInUrl("?org=1", "#pin=3")).toBe(true);
    expect(hasCredentialsInUrl("?org=1", "")).toBe(false);
    expect(withoutCredentials("?org=1&dni=2&pin=3&pdf=1").toString()).toBe("org=1&pdf=1");
  });

  it("remembers the link's credentials for the tab, so a refresh still works", () => {
    const storage = memoryStorage();
    expect(resolvePortalCredentials("?org=1", "#dni=V1&pin=P1", storage)).toEqual({ dni: "V1", pin: "P1" });
    // after the address bar was cleaned, a refresh finds them again
    expect(resolvePortalCredentials("?org=1", "", storage)).toEqual({ dni: "V1", pin: "P1" });
    // a new link in the same tab replaces them
    expect(resolvePortalCredentials("?org=1&dni=V2&pin=P2", "", storage)).toEqual({ dni: "V2", pin: "P2" });
    forgetPortalCredentials(storage);
    expect(resolvePortalCredentials("?org=1", "", storage)).toEqual({ dni: "", pin: "" });
    expect(resolvePortalCredentials("?org=1", "#dni=V3&pin=P3", null)).toEqual({ dni: "V3", pin: "P3" });
  });
});
