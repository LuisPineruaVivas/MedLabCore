import { describe, expect, it } from "vitest";
import { buildReceiptHTML, escapeHtml } from "@/lib/thermalPrinter";
import type { ThermalReceiptData } from "@/lib/thermalReceiptTypes";

const payload = `<img src=x onerror="alert('x')">`;

function receipt(overrides: Partial<ThermalReceiptData> = {}): ThermalReceiptData {
  return {
    orderId: 7,
    orderDate: "01/01/2026",
    patientName: payload,
    patientId: payload,
    age: 30,
    gender: "F",
    items: [{ test_name: `<svg onload="alert(1)">`, price: 10 }],
    total: 10,
    accessPin: "ab12cd34",
    labData: { name: payload, address: payload, phone: payload },
    ...overrides,
  };
}

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
    expect(escapeHtml(null)).toBe("");
  });
});

describe("buildReceiptHTML", () => {
  it("never emits tenant-controlled markup", () => {
    const html = buildReceiptHTML(receipt());
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<svg");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;");
    expect(html).toContain("&lt;svg onload=&quot;alert(1)&quot;&gt;");
  });

  it("blocks scripts in the popup with a CSP", () => {
    expect(buildReceiptHTML(receipt())).toContain(`http-equiv="Content-Security-Policy" content="default-src 'none'`);
  });

  it("keeps the PIN readable", () => {
    expect(buildReceiptHTML(receipt())).toContain("a b 1 2 c d 3 4");
  });
});
