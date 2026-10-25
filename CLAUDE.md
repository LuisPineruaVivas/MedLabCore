# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MedLabCore (a.k.a. Lab-Harmony) is a multi-tenant SaaS for clinical laboratories: patients, orders, test templates, results entry, billing, PDF result reports, and a public patient portal. It is a React SPA on Supabase (Postgres + RLS + RPCs + Edge Functions), deployed on Vercel as a PWA. UI copy, docs and many identifiers are in Spanish.

## Commands

npm is the canonical package manager (do not use bun or deno for the frontend).

```bash
npm run dev            # Vite dev server on port 8080
npm run build          # production build
npm run lint           # eslint .
npm test               # vitest run (all tests)
npx vitest run src/features/orders/useOrders.test.ts   # single test file
npx vitest run -t "name of test"                       # single test by name
npm run update-types   # regenerate src/integrations/supabase/types.ts from the remote project
supabase db push       # apply supabase/migrations to the linked project
```

Tests run in a `node` environment (not jsdom) with globals, a single forked worker, and `isolate: false` (see `vitest.config.ts`); tests live next to the code as `*.test.ts`. Tests mostly cover pure helpers (`*Utils.ts`, payload builders, permission builders), not rendered components.

Env vars (`.env`, see `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`; optional `VITE_SENTRY_DSN` (Sentry is only enabled in production builds, see `src/lib/env.ts`).

## Architecture

**Path alias:** `@/` → `src/`. UI primitives are shadcn/ui in `src/components/ui` (config in `components.json`).

**Layering:** `src/pages/*` are route-level screens (lazy-loaded in `src/App.tsx`); `src/features/<domain>/` hold the domain logic — React Query hooks (`useX.ts`) that talk directly to Supabase, zod `schemas.ts`, dialogs/forms, and pure `*Utils.ts` helpers. There is no separate API layer: hooks call `supabase.from(...)` or `supabase.rpc(...)` via the client in `src/integrations/supabase/client.ts`. Multi-step writes (e.g. `create_lab_order`, `upsert_exam_profile`, `bulk_upsert_org_prices`, ERP `register_payment`, `open_cash_session`) are Postgres RPCs, not client-side sequences.

**Query keys:** all React Query keys are centralized in `src/lib/queryKeys.ts` and are scoped by `orgId`. Add new keys there and invalidate through them.

**Tenancy & roles:** every tenant row carries `org_id`; isolation is enforced in the DB by RLS and `SECURITY DEFINER` functions. Roles: `super_admin`, `lab_admin`, `bioanalyst`, `secretary`, `lab_affiliate`. `useCurrentOrgContext` (`src/hooks/useCurrentOrgContext.ts`) loads profile + organization and derives a `Permissions` object via `buildPermissions(role)`; `usePermissions`/`useUserRole` build on it. Routes are gated in `App.tsx` with `RoleGuard` (by permission key), `AllowedRolesGuard` (by role list), `SuperAdminGuard`, and `ErpGuard`. When adding a capability, update `buildPermissions` and the guard in `App.tsx`, and the nav in `components/layout/AppSidebar.tsx` and `BottomNav.tsx` (mobile).

**Super admin impersonation:** `src/contexts/ImpersonationContext.tsx` swaps the Supabase session using the `superadmin-impersonate` edge function and stores the original session to restore it. `BrandContext` applies per-org branding (colors/logo).

**ERP module (feature-flagged, in progress):** gated by `organizations.has_erp_module`; `useErpModule` (`buildErpPermissions`) + `ErpGuard` control access, routes live under `/erp/*`, code under `src/features/erp` and `src/pages/erp`. The ERP tables are not yet in the generated Supabase types, so ERP hooks use the untyped client `erpDb` (`src/features/erp/utils/erpDb.ts`) and hand-written domain types in `src/features/erp/types.ts`; once migrations are deployed and `npm run update-types` is run, these can move to generated types. ERP RPCs raise error codes (e.g. `ERP_PERMISSION_DENIED`) that `getErpErrorMessage` (`utils/erpErrors.ts`) maps to Spanish messages, and every ERP RPC starts with `erp_assert_access(org_id, roles)`. `supabase/tests/erp_rpcs_smoke.sql` is a rolled-back integration test of the ERP RPCs; run it against the local stack with `docker exec -i supabase_db_GitMed psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/erp_rpcs_smoke.sql` (prepend unapplied migrations). `ERP.md` is the phased implementation plan and status tracker — consult and update it when working on ERP. `create_lab_order` creates an invoice only for ERP-enabled orgs.

**PDF generation:** all documents are `@react-pdf/renderer` components in `src/lib/` (result reports, receipts, budgets, letterhead, blood group card, account statements; LETTER page size). Result reports are selected per organization via `organizations.report_template` through `src/lib/orderReportDispatcher.tsx` (`REPORT_TEMPLATES` / `TEST_TEMPLATE_REPORT_TEMPLATES`, keys `default` and `rivalta`, falling back to `default`). A new report layout must be registered in both maps. Thermal receipt printing uses Web Serial (`thermalPrinter.tsx`, `src/types/web-serial.d.ts`).

**Public routes:** `/login`, `/portal-paciente` (patient portal: document ID + per-order PIN, verified by RPC), and `/informe-pdf` (report viewer) are outside `ProtectedRoute`.

## Supabase

- `supabase/migrations/` is the active migration history (baselined at `20260920000000_schema_remoto.sql`); `migrations-old/` and `functions-old-2/` are archived and not deployed. Root-level `backup_*.sql` and `supabase/*.sql` dumps are snapshots, not sources of truth.
- Migrations are additive and include RLS policies (with `WITH CHECK` on writes) for any new tenant table. RPCs that are `SECURITY DEFINER` must verify the caller belongs to the target `org_id`.
- `src/integrations/supabase/types.ts` is generated — regenerate rather than hand-edit.
- Edge Functions (`supabase/functions/*`) are Deno (`Deno.serve`, `esm.sh` imports) and use the service-role key for privileged ops such as user creation, org provisioning, impersonation, and AI parsing (`analyze-lab-report`, `parse-price-list`).
