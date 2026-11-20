// Source checks for security-audit run-1 leads that live in Deno edge functions
// or need a build to observe (no Deno test runner in this repo).
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const fn = (name: string) => read(`supabase/functions/${name}/index.ts`);

describe("edge function authorization", () => {
  it("provision-lab (unauthenticated org provisioning) is removed", () => {
    expect(existsSync(resolve(root, "supabase/functions/provision-lab"))).toBe(false);
  });

  it("lab-create-user requires a lab_admin or super_admin caller before creating users", () => {
    const src = fn("lab-create-user");
    expect(src).not.toMatch(/\/\/\s*const \{ data: is(LabAdmin|SuperAdmin) \}/);
    const gate = src.indexOf(`callerProfile?.role !== "lab_admin" && !isSuperAdmin`);
    expect(gate).toBeGreaterThan(-1);
    expect(src.indexOf("status: 403", gate)).toBeGreaterThan(gate);
    expect(gate).toBeLessThan(src.indexOf("auth.admin.createUser"));
  });

  it.each(["admin-create-user", "lab-create-user", "create-organization"])(
    "%s passes role/org_id in app_metadata, not user_metadata",
    (name) => {
      const src = fn(name);
      expect(src).not.toMatch(/user_metadata:\s*\{[^}]*\b(role|org_id)\b/);
      expect(src).toMatch(/app_metadata:\s*\{[^}]*\brole\b[^}]*\borg_id\b/);
    }
  );

  it("analyze-lab-report requires lab staff, caps input and keeps the Gemini key out of the URL", () => {
    const src = fn("analyze-lab-report");
    expect(src).not.toMatch(/\?key=/);
    expect(src).toMatch(/'x-goog-api-key': apiKey/);
    expect(src).toMatch(/const OCR_ROLES = \['lab_admin', 'bioanalyst', 'secretary'\]/);
    expect(src).toMatch(/!profile\?\.org_id \|\| !OCR_ROLES\.includes\(profile\.role\)/);
    expect(src).toMatch(/fields\.length > MAX_FIELDS/);
    expect(src).toMatch(/> MAX_FIELD_LENGTH/);
    expect(src).toMatch(/> MAX_IMAGE_BYTES/);
  });
});

describe("client supply chain", () => {
  it("BulkPriceUploadDialog bundles mammoth instead of importing it from esm.sh", () => {
    const src = read("src/features/admin/BulkPriceUploadDialog.tsx");
    expect(src).not.toMatch(/import\(\s*["']https?:/);
    expect(JSON.parse(read("package.json")).dependencies.mammoth).toBeTruthy();
    expect(JSON.parse(read("package-lock.json")).packages["node_modules/mammoth"]?.integrity).toBeTruthy();
  });
});
