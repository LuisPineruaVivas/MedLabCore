import type { Breadcrumb, ErrorEvent } from "@sentry/react";
import { scrubBreadcrumb, scrubEvent, scrubUrl } from "./sentryScrub";

describe("Sentry URL scrubbing", () => {
  it("filters the patient id number and PIN from absolute URLs", () => {
    expect(scrubUrl("https://med-lab-core.vercel.app/informe-pdf?org=abc&dni=V12345678&pin=A1B2C3D4")).toBe(
      "https://med-lab-core.vercel.app/informe-pdf?org=abc&dni=%5Bfiltered%5D&pin=%5Bfiltered%5D"
    );
  });

  it("keeps relative URLs relative and leaves other params alone", () => {
    expect(scrubUrl("/portal-paciente?org=abc&pin=XYZ")).toBe("/portal-paciente?org=abc&pin=%5Bfiltered%5D");
    expect(scrubUrl("/orders/123?tab=results")).toBe("/orders/123?tab=results");
    expect(scrubUrl(undefined)).toBeUndefined();
  });

  it("scrubs error events and navigation breadcrumbs", () => {
    const event = { request: { url: "https://x.test/informe-pdf?dni=1&pin=2", query_string: "dni=1&pin=2" }, transaction: "/informe-pdf?dni=1" } as ErrorEvent;
    const scrubbed = scrubEvent(event);
    expect(scrubbed.request?.url).not.toMatch(/dni=1|pin=2/);
    expect(scrubbed.request?.query_string).toBe("dni=%5Bfiltered%5D&pin=%5Bfiltered%5D");
    expect(scrubbed.transaction).toBe("/informe-pdf?dni=%5Bfiltered%5D");

    const crumb = scrubBreadcrumb({ category: "navigation", data: { from: "/login", to: "/informe-pdf?dni=1&pin=2" } } as Breadcrumb);
    expect(crumb.data?.to).toBe("/informe-pdf?dni=%5Bfiltered%5D&pin=%5Bfiltered%5D");
    expect(crumb.data?.from).toBe("/login");
  });
});
