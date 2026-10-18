# Handoff: security fixes + ERP production deploy

Written 2026-10-18 at the end of a Claude Code session. Branch `ERP`. **Nothing is committed and nothing has touched production.**

## Goal

1. Ship two security fixes to the production Supabase project (`mgeateznuhmhgqemaphj`) without breaking the app current users run (`main`).
2. Push the 8 pending ERP migrations in the same rollout so the `ERP`/`dev` branch can be tested online. ERP stays off for every lab (`organizations.has_erp_module = false`) except the one(s) chosen for testing.

## What was found and fixed (all verified locally)

| # | Problem | Severity | Fix |
|---|---|---|---|
| 1 | `profiles` "Users can update own profile" policy only checks `id = auth.uid()`; `org_id` is unguarded (only `role` has a trigger). Any signed-in user can move their profile into another lab, keep their role, and read that lab's patients. Reproduced locally: a secretary read 51 patients of another lab. | **Critical**, almost certainly live in prod (comes from the baseline schema) | `20261018000005`: trigger `trg_prevent_org_self_update` (super admins and service-role/no-session writes still allowed) |
| 2 | `create_lab_order` (SECURITY DEFINER) skips the `p_created_by` check when `auth.uid()` is null, and `anon` has EXECUTE. Anonymous callers can create orders/invoices in any lab as any of its users. Prod's *current* version is worse: it doesn't even check that the creator belongs to `p_org_id`. | **High**, live in prod | `20261018000005`: `revoke execute ... from public, anon`; keep `authenticated`, `service_role` |
| 3 | `exchange_rate_history.created_by` was sent by the client and not checked (an admin could attribute a rate to someone else) | Low, ERP only | `20261018000006` (default + BEFORE INSERT trigger stamping `auth.uid()`); client no longer sends it (`useExchangeRateHistory.ts`, `ExchangeRateHistoryPanel.tsx`) |
| 4 | `invoice_sequences` created without RLS in `20261017000000` (already fixed later by `20261018000004`) | Window during push only | RLS enable + revoke added to `20261017000000` itself (idempotent with `...04`) |

`20261018000005` has **no ERP dependency** (safe to run on prod even before ERP). `20261018000006` **requires** the ERP tables.

Compatibility checked: `origin/main` and `origin/dev` only update `profiles` signature fields (`firma_url`, `sello_url`, `signature_footer_text`) and only call `create_lab_order` while signed in, so neither fix affects them. ERP migrations only add tables, 3 nullable `orders` columns (`invoice_id`, `consumption_confirmed_at`, `consumption_confirmed_by`), and replace `create_lab_order` with the same signature; for non-ERP labs the new version behaves the same (stricter checks, extra `invoiceId: null` in the response). `20261018000004` may schedule a `pg_cron` job (`erp-mark-overdue-invoices`).

Other changes this session: `doctor.config.json` (React Doctor skips `dev-dist`, `dist`, `.unlighthouse`, `supabase/functions-old-2`, `supabase/migrations-old`); `dev-dist/` added to `.gitignore` and untracked (`git rm --cached`, staged).

## State right now

- **Local DB**: all migrations through `20261018000006` applied. Backup taken before applying: `C:\Users\piner\AppData\Local\Temp\claude\C--Users-piner-Desktop-MedLabCore\f937fc1d-5de4-4119-acae-c0c72c160cfe\scratchpad\local_before_authz_fix_2026-10-18.dump` (pg_dump `-Fc`; contains real data, keep out of git).
- **Tests passing locally**: `supabase/tests/authz_fields_audit.sql` (new; fails before the fix, passes after), `erp_rls_audit.sql`, `erp_rpcs_smoke.sql`. Run each with
  `docker exec -i supabase_db_GitMed psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/tests/<file>.sql`
- `npm test`: 1 pre-existing, unrelated failure (`OrderDetailSections.test.ts` › `buildLabData` returns 10 fields, test expects 9; from the uncommitted report-footer work). `tsc` has 27 pre-existing errors, none in files touched here.
- React Doctor: 217 issues; the 5 remaining "Client writes Supabase authorization field" sites in `src/` were validated as false positives (RLS `WITH CHECK` re-verifies `org_id`) and intentionally left unsuppressed.
- **Manual app testing by the user: pending** (see checklist below).

## BLOCKER before any production push: migration history

The local migration history was re-baselined (uncommitted): it starts at `20260920000000_schema_remoto.sql` (full schema dump) and `20260920000001_datos_remotos.sql`, then `20260926220500`, `20261004000000`, `20261004183000`, `20261005000000`, `20261005000001`, then ERP `20261017000000`…`20261018000004`, then `...05`, `...06`. `main` only has `20260325213935_remote_commit.sql` and `20260329233000_production_remediation.sql`. **Production's `supabase_migrations.schema_migrations` is unknown.** If it doesn't match, `supabase db push` will refuse, or (if forced) try to re-run the baseline on prod. Do not push until this is reconciled.

## Next steps

1. **Read production state (read-only).** Use the Supabase connector/MCP if available (check with ToolSearch "supabase"); otherwise ask the user to run `supabase/tests/prod_preflight.sql` in the Supabase SQL Editor and paste the output. It reports the migration history, which post-baseline objects already exist, whether holes 1 and 2 are open, `pg_cron` availability, and org counts.
2. **Decide the reconciliation** from that output. Likely `supabase migration repair --status applied <versions already reflected in prod>` and `--status reverted <old versions not in the local folder>`. Repair only edits the history table, but show the user the exact commands and get approval first.
3. **Answer the user's open questions**: (a) which Supabase project Vercel Preview deployments of `ERP`/`dev` use (probably prod, so online ERP testing means a dedicated test lab with `has_erp_module = true`); (b) `origin/dev` has 7 commits not in `ERP` (DOCX report generation), so they need merging if ERP is deployed via `dev`.
4. **Production backup** (confirm in dashboard or pg_dump) before writing anything.
5. **Push**: `supabase db push --dry-run` first, show the list, then `supabase db push` (ERP migrations + `...05` + `...06`, in order). Get explicit approval for each production write.
6. **Verify prod**: re-run `prod_preflight.sql` (expect `anon can run create_lab_order = false`, guard trigger = true); smoke test with the current `main` app (log in, edit a signature, create an order, open `/portal-paciente`). Then `npm run update-types`.
7. **Commit** (only when the user asks), and update `ERP.md` (section 12.2 checklist / status at the top) to record what was deployed.

Fallback if the full rollout must wait: run only `20261018000005` in the SQL Editor as a hotfix (idempotent, so a later `db push` re-running it is harmless).

Emergency undo for `...05` (re-opens the holes):
```sql
drop trigger if exists trg_prevent_org_self_update on public.profiles;
drop function if exists public.prevent_org_self_update();
grant execute on function public.create_lab_order(uuid, uuid, text, numeric, numeric, boolean, jsonb, uuid) to anon;
```

## Manual test checklist (local app, `npm run dev`)

- Secretary/bioanalyst: upload signature and stamp, edit footer text, delete a signature
- Create orders as secretary, lab_admin and lab_affiliate (affiliate → payment status "pending")
- Super admin: impersonate a lab, create an organization, create users, change a user's role
- `/portal-paciente` and `/informe-pdf` (no login)
- ERP lab: save an exchange rate; history shows the current user as creator

## Working rules for this task

Explain each change in plain language with its real-world impact (the user asked to be taught as we go). Never write to production without explicit approval of that specific step. Don't commit unless asked.
