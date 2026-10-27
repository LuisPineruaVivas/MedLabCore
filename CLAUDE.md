# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MedLabCore (a.k.a. Lab-Harmony) is a multi-tenant SaaS for clinical laboratories: patients, orders, test templates, results entry, billing, PDF result reports, and a public patient portal. It is a React SPA on Supabase (Postgres + RLS + RPCs + Edge Functions), deployed on Vercel as a PWA. UI copy, docs and many identifiers are in Spanish.

## Commands

npm is the canonical package manager (do not use bun or deno for the frontend).

```bash
npm run dev            # Vite dev server on port 8080 (uses .env: the production Supabase)
npm run dev:local      # same, against the local Supabase (.env.localdb, git-ignored)
npm run preview:local  # production build + vite preview on 4173 with vercel.json headers, CSP enforced
npm run build          # production build
npm run lint           # eslint . (0 errors expected)
npm run typecheck      # tsc -p tsconfig.app.json --noEmit (0 errors expected; the build does not type-check)
npm test               # vitest run (all tests)
npm run test:db        # every SQL suite in supabase/tests against the local DB (npm run test:db -- <name> for one)
npx vitest run src/features/orders/useOrders.test.ts   # single test file
npx vitest run -t "name of test"                       # single test by name
npm run update-types   # regenerate src/integrations/supabase/types.ts from the remote project
supabase migration up --local   # apply new migrations to the local DB
supabase db push --dry-run      # always before `supabase db push` (safe from dev; not from main until it has the new baseline)
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, build, and `test:db` on a throwaway `supabase start`.

Tests run in a `node` environment (not jsdom) with globals, a single forked worker, and `isolate: false` (see `vitest.config.ts`); tests live next to the code as `*.test.ts`. Tests mostly cover pure helpers (`*Utils.ts`, payload builders, permission builders), not rendered components.

Env vars (`.env`, see `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`; optional `VITE_SENTRY_DSN` (Sentry is only enabled in production builds, see `src/lib/env.ts`).

## Architecture

**Path alias:** `@/` → `src/`. UI primitives are shadcn/ui in `src/components/ui` (config in `components.json`).

**Layering:** `src/pages/*` are route-level screens (lazy-loaded in `src/App.tsx`); `src/features/<domain>/` hold the domain logic — React Query hooks (`useX.ts`) that talk directly to Supabase, zod `schemas.ts`, dialogs/forms, and pure `*Utils.ts` helpers. There is no separate API layer: hooks call `supabase.from(...)` or `supabase.rpc(...)` via the client in `src/integrations/supabase/client.ts`. Multi-step writes (e.g. `create_lab_order`, `upsert_exam_profile`, `bulk_upsert_org_prices`, ERP `register_payment`, `open_cash_session`) are Postgres RPCs, not client-side sequences.

**Query keys:** all React Query keys are centralized in `src/lib/queryKeys.ts` and are scoped by `orgId`. Add new keys there and invalidate through them.

**Shared helpers (use them instead of re-implementing):** `src/lib/postgrest.ts` (`matchAllWords`/`ilikeAny`/`pgrstValue`: user text inside `.or()` filters must be quoted), `src/lib/json.ts` (`parseJsonObject` for stored JSON such as `results_data`), `src/lib/errors.ts` (`isNonRetryableError`, used by the React Query retry rule), `src/lib/passwordPolicy.ts` (≥10 chars, letters + digits), `src/lib/sentryScrub.ts` (keeps `dni`/`pin` out of Sentry), `src/features/patientPortal/portalLink.ts` (portal links put `dni`/`pin` in the `#fragment`). Totals over many rows are computed in SQL (RPCs such as `get_billing_totals`), never by summing a PostgREST response, which is capped at 1,000 rows.

**Forms that edit a record:** build `defaultValues` from the record and mount the form with `key={record?.id ?? "new"}` (see `BankAccountForm`/`ItemForm`) instead of `form.reset(record)` in a `useEffect`; with Radix `Select` bound through `FormField` that pattern can leave the select empty.

**Tenancy & roles:** every tenant row carries `org_id`; isolation is enforced in the DB by RLS and `SECURITY DEFINER` functions. Roles: `super_admin`, `lab_admin`, `bioanalyst`, `secretary`, `lab_affiliate`. Lab roles live only in `profiles.role` (one per user); super admins are granted by a `user_roles` row (that table holds nothing else), and `has_role()` reads the right source for each. `useCurrentOrgContext` (`src/hooks/useCurrentOrgContext.ts`) loads profile + organization and derives a `Permissions` object via `buildPermissions(role)`; `usePermissions`/`useUserRole` build on it. Routes are gated in `App.tsx` with `RoleGuard` (by permission key), `AllowedRolesGuard` (by role list), `SuperAdminGuard`, and `ErpGuard`. When adding a capability, update `buildPermissions` and the guard in `App.tsx`, and the nav in `components/layout/AppSidebar.tsx` and `BottomNav.tsx` (mobile).

**Super admin impersonation:** `src/contexts/ImpersonationContext.tsx` swaps the Supabase session using the `superadmin-impersonate` edge function and stores the original session to restore it. `BrandContext` applies per-org branding (colors/logo).

**ERP module (feature-flagged, piloted in Lab Instumed 2026-10-25):** gated by `organizations.has_erp_module`; `useErpModule` (`buildErpPermissions`) + `ErpGuard` control access, routes live under `/erp/*`, code under `src/features/erp` and `src/pages/erp`. ERP hooks use the typed `supabase` client; JSON columns and RPC results (cash totals, BOM preview, reports) are cast once, at the hook, to the hand-written types in `src/features/erp/types.ts`. Regenerate types after adding migrations: `npm run update-types` (production) or, before a release, `supabase gen types typescript --local` (keep the `__InternalSupabase` block). ERP RPCs raise error codes (e.g. `ERP_PERMISSION_DENIED`) that `getErpErrorMessage` (`utils/erpErrors.ts`) maps to Spanish messages, and every ERP RPC starts with `erp_assert_access(org_id, roles)`. `supabase/tests/erp_rpcs_smoke.sql` is a rolled-back integration test of the ERP RPCs; run it with `npm run test:db -- erp_rpcs_smoke`. `ERP.md` is the phased implementation plan and status tracker — consult and update it when working on ERP. `create_lab_order` creates an invoice only for ERP-enabled orgs.

**PDF generation:** all documents are `@react-pdf/renderer` components in `src/lib/` (result reports, receipts, budgets, letterhead, blood group card, account statements; LETTER page size). Result reports are selected per organization via `organizations.report_template` through `src/lib/orderReportDispatcher.tsx` (`REPORT_TEMPLATES` / `TEST_TEMPLATE_REPORT_TEMPLATES`, keys `default`, `rivalta` and `palermo`, falling back to `default`). A new report layout must be registered in both maps. **The layouts differ on purpose (each lab asked for its own changes): never unify or "clean up" differences between them; change one lab's layout only for that lab.** Thermal receipt printing uses Web Serial (`thermalPrinter.tsx`, `src/types/web-serial.d.ts`).

**Public routes:** `/login`, `/portal-paciente` (patient portal: document ID + per-order PIN, verified by `portal_authenticate`, which locks an ID for an hour after 10 wrong PINs), and `/informe-pdf` (report viewer) are outside `ProtectedRoute`.

**Security headers:** `vercel.json` sets the CSP (report-only until the release check), `Permissions-Policy`, etc. A new external origin (API, CDN, fonts) must be added to the CSP; check it with `npm run preview:local`.

**Improvement plan:** `docs/IMPROVEMENT_PLAN.md` tracks the code-review items (B-/P-/S-/M-/T- IDs) and the release steps; use the item ID in commit messages and update its status and Log.

## Supabase

- `supabase/migrations/` is the active migration history (baselined at `20260920000000_schema_remoto.sql`; `20260920000001` is an intentionally empty placeholder). `migrations-old/` and `functions-old-2/` are archived and not deployed. `supabase/seed.sql` holds real data, is git-ignored and local only.
- Every migration gets a rolled-back test in `supabase/tests/` that prints `... passed` (copy the `expect_error` helper from an existing suite) and fails without the migration.
- Migrations are additive and include RLS policies (with `WITH CHECK` on writes) for any new tenant table. RPCs that are `SECURITY DEFINER` must verify the caller belongs to the target `org_id`.
- `src/integrations/supabase/types.ts` is generated — regenerate rather than hand-edit.
- Edge Functions (`supabase/functions/*`) are Deno (`Deno.serve`, `esm.sh` imports) and use the service-role key for privileged ops such as user creation, org provisioning, impersonation, and AI parsing (`analyze-lab-report`, `parse-price-list`). They use `_shared/http.ts` (CORS only for the app's origins; `internalError` logs details and returns a generic message) and `_shared/password.ts`. Test locally with `supabase functions serve`; note the local Kong adds its own `*` CORS, hosted Supabase does not.
