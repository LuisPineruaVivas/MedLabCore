# MedLabCore — Improvement Plan (bugs · performance · security · maintainability)

Created **2026-10-25** from a full code review of branch `dev` at commit `716e3c9`.
This file is the **tracker**: update the status column and the "Log" at the bottom as work is done.

**Status legend:** ☐ To do · ◐ In progress · ☑ Done · ✖ Won't do (write why)
**Priority:** 🔴 High (wrong data, security or big user impact) · 🟠 Medium · 🟢 Low
**Effort:** S (< 2 h) · M (half day – 1 day) · L (several days)

---

## 0. How to work through this plan

1. Work on **`dev`**, one item (or one small group) per commit, with the item ID in the message (e.g. `fix(billing): B-01 …`).
2. Every item lists its **tests**. An item is ☑ only when its tests pass **and** the checks below are green.
3. Checks before each commit:
   ```bash
   npm run lint
   npx tsc -p tsconfig.app.json --noEmit
   npm test
   npm run build
   ```
   SQL changes: run the suites in `supabase/tests/` against the local DB (see T-02).
4. Database changes are **new migrations** (never edit deployed ones). Production: backup → `supabase db push --dry-run` → `supabase db push` → verify.
5. Test on the Vercel `dev` preview (it uses the **production database** — use Lab Instumed), then release `dev` → `main`.

### Baseline (2026-10-25, `716e3c9`)

| Metric | Value |
|---|---|
| Source files / lines (`src/`) | 232 files · ~34,800 lines |
| Unit tests | 26 files · 123 tests (all pass) |
| TypeScript errors (`tsc --noEmit`) | **52** (the build does not type-check, so they never block) |
| ESLint | 37 errors · 30 warnings (≈ half come from generated `dev-dist/`) |
| JS downloaded on first page load | ~2 MB incl. **react-pdf 1.5 MB** (should be 0 on login) |
| Total JS bundle | ~4.6 MB |
| Largest files | TemplateBuilderPage 1157 · OrderDetailPage 775 · OrderDetailSections 770 · unifiedTestReportPDF 750 · CreateOrderDialog 737 · UnifiedTestReportPalermo 723 · UnifiedTestReportRivalta 722 |
| CI | none (`.github/workflows` does not exist) |

---

## Summary tracker

| ID | Title | Area | Prio | Effort | Status |
|---|---|---|---|---|---|
| B-01 | Billing totals wrong for labs with > 1,000 orders | Bug | 🔴 | M | ☐ |
| B-02 | Affiliate pending balance / order list truncated at 1,000 | Bug | 🔴 | M | ☐ |
| B-03 | "Guardar todo" (results) reports failure after partial save | Bug | 🔴 | S | ☐ |
| B-04 | Global retry rule never detects Supabase permission errors | Bug | 🟠 | S | ☑ |
| B-05 | One malformed `results_data` crashes the whole PDF | Bug | 🟠 | S | ☐ |
| B-06 | 52 TypeScript errors (missing fields in types hide real bugs) | Bug | 🟠 | M | ☐ |
| B-07 | Report viewer regenerates the PDF on every render (mobile) | Bug | 🟠 | S | ☑ |
| B-08 | Searching with commas / parentheses breaks the query | Bug | 🟠 | S | ☑ |
| B-09 | Other forms may show empty selects when editing | Bug | 🟢 | S | ☐ |
| B-10 | ERP smoke test fails every evening (UTC vs Caracas date) | Bug | 🟢 | S | ☑ |
| P-01 | PDF library (1.5 MB) downloaded on the login page | Perf | 🔴 | S | ☑ |
| P-02 | PDF / Word generators bundled into pages instead of loaded on click | Perf | 🟠 | M | ☐ |
| P-03 | Money totals computed in the browser over all rows | Perf | 🟠 | M | ☐ (with B-01/B-02) |
| P-04 | "Guardar todo" fires N requests and N refetches | Perf | 🟠 | S | ☐ (with B-03) |
| P-05 | Lists use `select("*")` / unbounded fetches | Perf | 🟢 | S | ☐ |
| P-06 | Main entry chunk 471 KB | Perf | 🟢 | M | ☐ |
| S-01 | No security headers (CSP, frame-ancestors, …) on the site | Sec | 🔴 | M | ☐ |
| S-02 | Patient ID number + PIN sent to Sentry in URLs | Sec | 🔴 | S | ☑ |
| S-03 | Portal PIN guessable at scale (no server throttle) and in URLs | Sec | 🟠 | M | ☐ |
| S-04 | Edge functions: CORS `*`, raw errors, Gemini key in URL | Sec | 🟠 | S | ☐ |
| S-05 | Remove temporary anon branding grant after `main` release | Sec | 🟠 | S | ☐ |
| S-06 | Public `thermal-debug.html` shipped to production | Sec | 🟢 | S | ☑ |
| S-07 | Database hardening batch (audit hardening notes) | Sec | 🟠 | M | ☐ |
| S-08 | Weak password policy (min 6) | Sec | 🟠 | S | ☐ |
| S-09 | Two sources of truth for roles (`profiles.role` vs `user_roles`) | Sec | 🟠 | L | ☐ |
| S-10 | ERP uses an untyped DB client (`erpDb`) | Sec/Maint | 🟠 | M | ☐ |
| S-11 | Second security audit (covers skipped Wildcard/Injection) | Sec | 🟠 | L | ☐ |
| M-01 | Report generators duplicated 3× (≈ 3,200 lines) | Maint | 🔴 | L | ☐ |
| M-02 | Very large components (TemplateBuilder, OrderDetail, CreateOrder) | Maint | 🟠 | L | ☐ |
| M-03 | TypeScript not strict + build never type-checks | Maint | 🟠 | M→L | ☐ |
| M-04 | ESLint: lints generated files; `any`; fast-refresh warnings | Maint | 🟢 | S | ☐ |
| M-05 | Query keys defined outside `queryKeys.ts` | Maint | 🟢 | S | ☑ |
| M-06 | Shared helpers: safe JSON parse, PostgREST filter escaping, form init | Maint | 🟠 | S | ◐ |
| M-07 | Dead code & stale config | Maint | 🟢 | S | ☐ |
| M-08 | Docs out of date (CLAUDE.md, ERP.md, user guide) | Maint | 🟢 | S | ☐ |
| T-01 | Continuous integration (lint, types, tests, build) | Tests | 🔴 | M | ☐ |
| T-02 | One command to run the SQL test suites | Tests | 🟠 | S | ☐ |
| T-03 | Component tests for critical flows | Tests | 🟢 | M | ☐ |

### Suggested order (phases)

| Phase | Items | Why first |
|---|---|---|
| **1 · Quick wins** (≈ 1–2 days) | P-01, S-02, B-04, B-07, B-08 (+M-06 helpers), B-10, S-06, M-04, M-05 | Small, safe, big effect (load time, privacy) |
| **2 · Money correctness** | B-01, B-02, P-03, B-03, P-04 | Wrong totals are the most harmful bugs |
| **3 · Release `dev` → `main`**, then S-05 | — | Ship phases 1–2 together with the ERP |
| **4 · Safety net** | T-01, T-02, M-03 (step 1: fix the 52 errors, typecheck in CI), B-06 | Prevents regressions in the big refactors |
| **5 · Security hardening** | S-01, S-04, S-03, S-07, S-08 | Needs testing on preview with real flows |
| **6 · Reports consolidation** | M-01 (+B-05), P-02 | Largest refactor; needs golden tests |
| **7 · Structure & typing** | M-02, S-10, B-09, M-03 (strict steps), M-07, M-08, T-03 | Ongoing |
| **8 · Verify** | S-09, S-11 | Architecture change + independent re-audit |

---

## 1. Bug fixes

### B-01 🔴 Billing totals wrong for labs with more than 1,000 orders
- **Where:** `src/features/billing/useBilling.ts:52-63`
- **Problem:** the billing page downloads **every order of the lab** to add up totals in the browser.
- **Why it happens:** Supabase (PostgREST) returns **at most 1,000 rows** per request by default, without any error. Once a lab has more than 1,000 orders, the totals silently cover only some of them. It also downloads more data every month (slow).
- **Before:**
  ```ts
  const [{ data: ordersPage, error: pageError, count }, { data: allOrders, error: allError }] = await Promise.all([
    query.range(offset, offset + pageSize - 1),
    supabase.from("orders").select("total_amount,status,created_at").eq("org_id", orgId),
  ]);
  const filteredOrders = monthFilterStart && monthFilterEnd
    ? allOrderList.filter((o) => o.created_at >= monthFilterStart! && o.created_at < monthFilterEnd!)
    : allOrderList;
  ```
- **After:** compute the totals in the database with one RPC (new migration) and keep only the paginated page in the browser.
  ```sql
  -- supabase/migrations/<ts>_billing_summary.sql
  create or replace function public.get_billing_summary(p_org_id uuid, p_from timestamptz default null, p_to timestamptz default null)
  returns jsonb language sql stable security definer set search_path = public as $$
    select jsonb_build_object(
      'total',   coalesce(sum(total_amount), 0),
      'paid',    coalesce(sum(total_amount) filter (where payment_status = 'paid'), 0),
      'pending', coalesce(sum(total_amount) filter (where payment_status in ('unpaid','pending','partial')), 0),
      'count',   count(*))
    from public.orders
    where org_id = p_org_id
      and (p_org_id = public.get_my_org_id() or public.has_role(auth.uid(), 'super_admin'))
      and (p_from is null or created_at >= p_from) and (p_to is null or created_at < p_to);
  $$;
  revoke execute on function public.get_billing_summary(uuid, timestamptz, timestamptz) from public, anon;
  grant execute on function public.get_billing_summary(uuid, timestamptz, timestamptz) to authenticated;
  ```
  ```ts
  const [{ data: ordersPage, error: pageError, count }, { data: summary, error: summaryError }] = await Promise.all([
    query.range(offset, offset + pageSize - 1),
    supabase.rpc("get_billing_summary", { p_org_id: orgId, p_from: monthFilterStart ?? null, p_to: monthFilterEnd ?? null }),
  ]);
  ```
  *(Match the exact status rules the page uses today before writing the SQL.)*
- **Why it works:** the database adds up all rows, with no row limit, and returns one small object. The caller's lab is checked inside the function.
- **Tests:** SQL test in a rolled-back transaction. Insert 1,200 dummy orders, then check that `get_billing_summary` returns count 1,200 and the exact sum. A user from another lab must get 0. Unit test: the hook maps the RPC result to the existing UI fields.

### B-02 🔴 Affiliate pending balance and order list truncated at 1,000
- **Where:** `src/features/billing/useAffiliateAccounts.ts:70-105` (`useAffiliatePendingBalance`, `useAffiliateOrders`)
- **Problem / why:** same 1,000-row cap as B-01. The **pending balance an affiliate owes** is summed in the browser, so it's wrong above 1,000 pending orders. The order list has no pagination.
- **Before:**
  ```ts
  const { data } = await supabase.from("orders").select("total_amount")
    .eq("created_by", affiliateId!).eq("payment_status", "pending");
  return (data ?? []).reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);
  ```
- **After:** RPC `get_affiliate_balance(p_affiliate_id)` returning `sum(total_amount)` (checks caller is lab_admin of the affiliate's lab), and paginate `useAffiliateOrders` with `.range()` + `count: "exact"` like `useInvoices` already does.
- **Tests:** SQL test with 1,100 pending orders → exact sum. UI: the list shows pages and the total matches.

### B-03 🔴 "Guardar todo" reports failure after a partial save
- **Where:** `src/pages/OrderDetailPage.tsx:137-163`
- **Problem:** if 1 of N result saves fails, the others **were saved**. But the user sees "No se pudieron guardar los resultados" and *every* test stays marked unsaved, which invites re-entering data.
- **Why:** `Promise.all` rejects on the first failure and the code treats that as all-or-nothing.
- **Before:**
  ```ts
  await Promise.all(Array.from(modifiedIds).map((itemId) => saveResults.mutateAsync({ itemId, /* … */ })));
  toast.success("Resultados guardados correctamente");
  resetModified();
  ```
- **After:**
  ```ts
  const ids = Array.from(modifiedIds);
  const results = await Promise.allSettled(ids.map((itemId) => saveResults.mutateAsync({ itemId, /* … */ })));
  const savedIds = ids.filter((_, i) => results[i].status === "fulfilled");
  const failed = results.length - savedIds.length;
  markSaved(savedIds);                      // new: clears only the saved ones
  if (failed === 0) toast.success("Resultados guardados correctamente");
  else toast.error(`${failed} de ${ids.length} exámenes no se guardaron. Revisa los marcados e intenta de nuevo.`);
  ```
  Better still, combine with **P-04**: save everything in one RPC transaction.
- **Tests:** unit test of a pure helper `summarizeSaveResults(ids, settled)`. Manual check: make one item fail (e.g. a completed order with the result-lock trigger) and confirm only that item stays marked.

### B-04 🟠 Global "don't retry 4xx" rule never matches Supabase errors
- **Where:** `src/App.tsx:46-62`
- **Problem:** permission-denied and not-found errors are retried twice before the user sees the error (slower, extra load).
- **Why:** the rule reads `error.status`. Supabase **PostgrestError** objects have `code` (e.g. `42501`, `PGRST116`) but no `status`, so `status` is always `0` and the rule always retries.
- **Before:**
  ```ts
  retry: (failureCount, error: unknown) => {
    const status = (error as { status?: number })?.status ?? 0;
    if (status >= 400 && status < 500) return false;
    return failureCount < 2;
  },
  ```
- **After** (put the helper in `src/lib/errors.ts` and unit test it):
  ```ts
  export function isNonRetryableError(error: unknown): boolean {
    const e = error as { status?: number; code?: string } | null;
    if (e?.status && e.status >= 400 && e.status < 500) return true;        // fetch/Auth errors
    const code = e?.code ?? "";
    return code === "42501" || code.startsWith("PGRST") || /^(22|23)/.test(code) // denied, PostgREST, data/constraint errors
      || /^[A-Z_]+$/.test(code);                                                  // app error codes raised by RPCs (ERP_*)
  }
  retry: (failureCount, error) => !isNonRetryableError(error) && failureCount < 2,
  ```
- **Tests:** `isNonRetryableError({ code: "42501" }) === true`, `({ code: "PGRST116" })`, `({ status: 403 })`, `({ code: "ERP_PERMISSION_DENIED" })` → true. Network error `TypeError("Failed to fetch")` → false.

### B-05 🟠 One malformed `results_data` crashes the whole PDF
- **Where:** `src/lib/unifiedTestReportPDF.tsx`, `UnifiedTestReportRivalta.tsx:~395`, `UnifiedTestReportPalermo.tsx:~398` (+ `testReport*Generator.tsx`)
- **Problem:** if one exam's stored result or template schema is not valid JSON, `JSON.parse` throws and **the patient's entire report fails** (portal, PDF download).
- **Before:**
  ```ts
  const resultsData = typeof item.results_data === "string" ? JSON.parse(item.results_data || "{}") : (item.results_data || {});
  ```
- **After:** a shared helper (M-06), used in all generators:
  ```ts
  // src/lib/json.ts
  export function parseJsonObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
    if (typeof value !== "string" || !value.trim()) return {};
    try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; }
    catch { return {}; }
  }
  const resultsData = parseJsonObject(item.results_data);
  ```
  (The Word generator already throws a friendly error. Decide one behaviour for all: skip the broken exam and show "Resultado no disponible".)
- **Tests:** `parseJsonObject("{bad")` → `{}`; object passthrough; `"[]"` → `{}`. The report builder with one broken item still renders the others (covered by M-01 golden tests).

### B-06 🟠 52 TypeScript errors hide real problems
- **Where (non-test):** `lib/UnifiedTestReportRivalta.tsx` (11), `lib/UnifiedTestReportPalermo.tsx` (11), `lib/UnifiedTestReportWord.tsx` (9), `pages/OrderDetailPage.tsx` (5), `lib/unifiedTestReportPDF.tsx` (3), `features/orders/OrderDetailSections.tsx:440`, `lib/testReport*Generator.tsx`, `lib/MicrobiologyReportSection.tsx:124`. Test files: `microbiology.test.ts` (6), `createOrderUtils.test.ts`, `orderReportDispatcher.test.ts`.
- **Problem / why:** the build (`vite build`) doesn't run the type checker, so errors pile up unnoticed. Examples that are real gaps:
  - `template_schema` is read from `OrderItem` / `ReportOrderItem` but isn't in those types, so microbiology blocks depend on a field the type says doesn't exist.
  - `labData.watermark` is used by the default PDF but missing from its prop type (works by accident).
  - Report items are typed `Record<string, unknown>`, so `sort`/`localeCompare`/arithmetic run on `unknown` without any checking.
  - `MicrobiologyReportSection.tsx:124`: `sens !== ""` can never be false for type `"I" | "S" | "R"`. Either the type is wrong (empty strings do arrive from the database) or the check is dead code.
  - `UnifiedTestReportWord.tsx`: wrong argument counts and types for the `docx` API (`Error(msg, { cause })` needs `lib: ES2022`; `ImageRun` options changed in `docx` v9 and now need `type: "png"`).
- **After:** add the missing fields to the types (`template_schema?: unknown`, `watermark?: string`). Type report rows with one shared `ReportItem` interface (M-01). Use the `docx` v9 `ImageRun({ type: "png", data, transformation })`. Fix tests to the current types. Then add `"typecheck": "tsc -p tsconfig.app.json --noEmit"` to `package.json` and run it in CI (T-01).
- **Tests:** `npm run typecheck` → **0 errors**. Generate a report with microbiology and a watermark (preview) → unchanged output.

### B-07 🟠 Report viewer regenerates the PDF on every render (mobile)
- **Where:** `src/pages/ReportViewerPage.tsx` (`patientInfo` built inline, then used in a `useEffect` dependency array; ESLint flags lines 41, 43)
- **Problem:** on phones the effect that renders the PDF blob and redirects runs **again on every re-render**, because `patientInfo` is a new object each time. This wastes CPU and battery and can cause repeated downloads or redirects.
- **Before:**
  ```tsx
  const patientInfo = session ? { /* … */ } : null;
  useEffect(() => { if (isMobile && targetOrder && patientInfo) { /* render PDF, set location.href */ } },
    [targetOrder, patientInfo, ReportComponent, brand]);
  ```
- **After:**
  ```tsx
  const patientInfo = useMemo(() => (session ? { /* … */ } : null), [session]);
  const generatedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isMobile || !targetOrder || !patientInfo || generatedFor.current === targetOrder.order_id) return;
    generatedFor.current = targetOrder.order_id;
    /* render once */
  }, [targetOrder, patientInfo, ReportComponent, brand]);
  ```
  Also fix the auto-login effect (`authenticate`/`session` deps) and `PatientPortalPage.tsx:52` the same way (explicit "run once" ref instead of a disabled dependency list).
- **Tests:** add a counter in dev or a unit test of the effect guard, and confirm the PDF renders once. Check on a phone that the report opens once.

### B-08 🟠 Searching with commas or parentheses breaks the query
- **Where:** `features/patients/usePatients.ts:43,136`, `features/billing/useBilling.ts:49`, `features/audit/useAuditLogs.ts:81`
- **Problem:** typing e.g. `Pérez, Juan` or `(04…)` in a search box gives an error instead of results.
- **Why:** user text is inserted raw into a PostgREST `or=(…)` filter string, where `,` `(` `)` are syntax characters. RLS still limits rows to the user's lab, so the security impact is low, but it is a classic injection pattern.
- **Before:**
  ```ts
  query = query.or(`first_name.ilike.${filter},last_name.ilike.${filter},id_number.ilike.${filter}`);
  ```
- **After:** a helper (M-06) that quotes the value the way PostgREST expects:
  ```ts
  // src/lib/postgrest.ts
  /** Wraps a user value for use inside .or()/.filter() strings. */
  export function pgrstValue(raw: string) {
    return `"${raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  export function ilikeAny(columns: string[], search: string) {
    const v = pgrstValue(`%${search.trim().replace(/[%_]/g, (c) => `\\${c}`)}%`);
    return columns.map((c) => `${c}.ilike.${v}`).join(",");
  }
  query = query.or(ilikeAny(["first_name", "last_name", "id_number"], search));
  ```
- **Tests:** unit tests for `ilikeAny("Pérez, Juan")` (quoted, comma inside quotes), `"a(b)"`, `'he said "x"'`, `"100%"` (escaped `%`). Manually search `Pérez, Juan` on Patients, Billing and Audit.

### B-09 🟢 Other forms may show empty selects when editing
- **Where:** `features/patients/EditPatientDialog.tsx`, `features/settings/OrganizationSettings.tsx`, `features/erp/components/AdjustmentDialog.tsx`
- **Problem / why:** the same pattern that broke B2/B4 in the ERP test: forms created with default values, then `form.reset(record)` inside `useEffect`. With Radix `Select` this can leave the select showing nothing until it's touched.
- **After:** use the pattern now in `BankAccountForm` / `ItemForm`: build `defaultValues` from the record, and mount the form with `key={record?.id ?? "new"}`, rendering it only when the dialog is open. Document it (M-06/M-08).
- **Tests:** edit a patient with a non-default gender and date, and an organization with a non-default report template. The saved values should show immediately.

### B-10 🟢 ERP smoke test fails every evening
- **Where:** `supabase/tests/erp_rpcs_smoke.sql` (financial summary block, `current_date`)
- **Problem / why:** the test passes the database's **UTC** date, but payments are counted by **Caracas** local date. Between 8 pm and midnight in Caracas the dates differ, so the test fails even though the code is correct.
- **After:** use the same helper as the report, `public.erp_local_date(now())`, instead of `current_date` in that block.
- **Tests:** run the suite with `set timezone = 'UTC'` and a clock between 00:00–04:00 UTC (or the two `set timezone` variants). It should pass in both.

---

## 2. Performance optimization

### P-01 🔴 PDF library (1.5 MB) downloaded on the login page
- **Where:** `src/App.tsx:18`
- **Problem:** every visitor, including the login and portal pages, downloads `react-pdf` (1.5 MB) plus all six report generators before anything is shown.
- **Why:** `ReportViewerPage` is imported **directly**, while every other page uses `lazy()`. That page imports `orderReportDispatcher`, which imports all PDF layouts.
- **Before:**
  ```tsx
  import ReportViewerPage from "./pages/ReportViewerPage";
  ```
- **After:**
  ```tsx
  const ReportViewerPage = lazy(() => import("@/pages/ReportViewerPage"));
  ```
  (It's already rendered inside the `Suspense` that wraps the routes. Confirm `/informe-pdf` is under it.)
- **Tests:** `npm run build`, then confirm `dist/index.html` no longer lists `react-pdf.browser-*.js` in its `modulepreload` links. In Chrome DevTools → Network, loading `/login` shouldn't fetch react-pdf. Check that `/informe-pdf` still works.

### P-02 🟠 Report generators bundled into pages instead of loaded on click
- **Where:** pages that import `@react-pdf/renderer` / `docx` at the top (28 files), e.g. `FinancialDashboardPage` (401 KB chunk), `OrderDetailPage`, `UnifiedTestReportWord` (432 KB).
- **Problem:** opening a page downloads PDF/Word code that's only needed if the user clicks "PDF" or "Word".
- **After:** load the generator inside the click handler:
  ```ts
  async function handleDownloadWord() {
    const { generateUnifiedWordReport } = await import("@/lib/UnifiedTestReportWord");
    const blob = await generateUnifiedWordReport(/* … */);
    downloadBlob(blob, fileName);
  }
  ```
  For `PDFDownloadLink`-style components, wrap them in a small lazy component that is only mounted after the user asks for the document.
- **Tests:** build and compare chunk sizes (record before and after in the Log). Every PDF and Word button still works on the preview.

### P-03 🟠 Money totals computed in the browser over all rows
Covered by **B-01** and **B-02**: totals move to SQL aggregates, so pages download one row instead of thousands.

### P-04 🟠 "Guardar todo" fires N requests and N refetches
- **Where:** `OrderDetailPage.tsx:handleSaveAll` + `useOrders.ts` save mutation (each success invalidates the order queries)
- **Problem:** saving 15 exams makes 15 update requests **and** up to 15 refetches of the order.
- **After:** one RPC `save_order_results(p_order_id, p_items jsonb)` that updates all items in one transaction (respecting the result-lock trigger). Invalidate the order once. That also gives B-03 all-or-nothing semantics for free.
- **Tests:** SQL test (rolled back): save 3 items → 3 updated; a completed order → refused with `ORDER_RESULTS_LOCKED` and nothing changed. In the browser's Network tab, one request per save.

### P-05 🟢 `select("*")` and unbounded list fetches
- **Where:** 9 `select("*")` (e.g. `useAuditLogs.ts:38`, ERP hooks), plus `useInvoices` (non-paged variant), `usePayments`.
- **After:** select only the columns each screen uses. Use the paginated invoice hook everywhere a list can grow.
- **Tests:** screens unchanged. Response sizes smaller in the Network tab.

### P-06 🟢 Main entry chunk 471 KB
- **After:** after P-01/P-02, re-measure. If still large, add `build.rollupOptions.output.manualChunks` for stable vendor chunks (react, radix, supabase) so they cache across deploys. Check whether icon or locale imports pull in whole packages.
- **Tests:** the bundle report (record sizes). The first load on a slow 3G profile in DevTools improves.

---

## 3. Security hardening

### S-01 🔴 No security headers on the site
- **Where:** `vercel.json`
- **Problem:** without a Content-Security-Policy, any injected script (e.g. a future XSS bug) could run freely and read the session from `localStorage`. Without `frame-ancestors`, the app can also be embedded in other sites (clickjacking).
- **After** (start in **report-only** mode on the preview, then enforce):
  ```json
  {
    "headers": [{
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy-Report-Only", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://ve.dolarapi.com https://*.ingest.sentry.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), serial=(self)" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains" }
      ]
    }]
  }
  ```
  Check that react-pdf, Workbox and Web Serial work under the policy (react-pdf may need `worker-src 'self' blob:`). Remove the stale `/sw-push.js` rule (that file doesn't exist).
- **Tests:** open the preview with DevTools → Console and look for CSP violations while using every main screen, PDFs and the portal. `curl -I` on the preview shows the headers. Then switch `-Report-Only` to the enforcing header.

### S-02 🔴 Patient ID number + PIN sent to Sentry in URLs
- **Where:** `src/main.tsx` (`Sentry.init`); the portal and report links contain `?dni=…&pin=…` (`PatientPortalPage`, `ReportViewerPage`, WhatsApp links in `OrderDetailPage.tsx:449-471`)
- **Problem:** any error or page view on `/informe-pdf?org=…&dni=…&pin=…` sends the full URL to Sentry (a third party), including the **patient's ID number and the PIN that opens their results**. Session replay is also on.
- **After:**
  ```ts
  const SENSITIVE_PARAMS = ["dni", "pin"];
  function scrubUrl(url?: string) {
    if (!url) return url;
    try { const u = new URL(url, window.location.origin); SENSITIVE_PARAMS.forEach((p) => u.searchParams.has(p) && u.searchParams.set(p, "[filtered]")); return u.toString(); }
    catch { return url; }
  }
  Sentry.init({
    /* … */
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true })],
    beforeSend(event) { if (event.request?.url) event.request.url = scrubUrl(event.request.url); return event; },
    beforeBreadcrumb(b) { if (b.data?.url) b.data.url = scrubUrl(b.data.url); if (b.data?.to) b.data.to = scrubUrl(b.data.to); if (b.data?.from) b.data.from = scrubUrl(b.data.from); return b; },
    beforeSendTransaction(event) { if (event.request?.url) event.request.url = scrubUrl(event.request.url); return event; },
  });
  ```
  Also remove `dni`/`pin` from the address bar right after reading them (`setSearchParams(…, { replace: true })`), as `PatientPortalPage` already partly does, so they don't stay in browser history.
- **Tests:** unit test `scrubUrl` (pin and dni filtered, other params kept). In Sentry, trigger a test error on `/informe-pdf?dni=X&pin=Y`; the event shows `[filtered]`.

### S-03 🟠 Portal PIN guessable at scale and carried in URLs
- **Where:** `generate_order_access_pin` (8 hex chars ≈ 32 bits), `portal_authenticate` (no attempt limit), links with `?dni&pin`.
- **Problem:** there's no server-side limit on wrong PINs. The browser lockout in `PatientPortalPage` is bypassed by calling the RPC directly.
- **After:**
  1. Table `portal_attempts(id_number_hash, window_start, count)` plus a check in `portal_authenticate`: refuse after e.g. 10 failures per ID number per hour (`PORTAL_LOCKED`).
  2. New orders get longer PINs (e.g. 10–12 characters from an unambiguous alphabet). Old PINs keep working.
  3. *(Moved here from S-02.)* After reading `dni`/`pin` from the URL, keep them in state and remove them from the address bar (`setSearchParams(…, { replace: true })`) in both `PatientPortalPage` and `ReportViewerPage`, so they don't stay in browser history.
  4. Share links use the URL **fragment** (`#dni=…&pin=…`), which is never sent to servers or Referer headers, or a short-lived token.
- **Tests:** SQL test: 10 wrong PINs → locked; the right PIN afterwards → still locked until the window ends; a different patient is unaffected. Portal links from WhatsApp still open.

### S-04 🟠 Edge functions: CORS `*`, raw errors, Gemini key in URL
- **Where:** all 6 functions in `supabase/functions/*/index.ts`. Raw upstream errors are returned in `analyze-lab-report` and `parse-price-list`. `parse-price-list/index.ts:120` still puts `GEMINI_API_KEY` in the URL.
- **After:**
  ```ts
  const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://med-lab-core.vercel.app").split(",");
  function corsHeaders(req: Request) {
    const origin = req.headers.get("Origin") ?? "";
    return { "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0], "Vary": "Origin",
             "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
  }
  // Gemini: send the key as a header, not a query parameter
  fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY }, body });
  // Errors: log details server-side, return a generic message
  console.error("gemini error", status, text); return json({ error: "No se pudo procesar el archivo." }, 502);
  ```
  Put shared code in `supabase/functions/_shared/` (CORS, auth check, JSON responses). Include preview domains in `ALLOWED_ORIGINS` for `dev`.
- **Tests:** a request from `https://evil.example` gets no CORS allow for it. The app on production and preview works. A forced Gemini error shows the generic message.

### S-05 🟠 Remove the temporary anon branding grant after the `main` release
- **Where:** `supabase/migrations/20261019000000_audit_authz_fixes.sql` section 7b (`grant select (… branding columns) on organizations to anon` + policy "Anon can read organization branding columns")
- **Why:** it was kept only because the old `main` app reads branding straight from the table. Once `main` uses `get_public_org_brand`, it's no longer needed.
- **After:**
  ```sql
  drop policy if exists "Anon can read organization branding columns" on public.organizations;
  revoke select (id, name, logo_url, primary_color, secondary_color, email, phone, address, report_template) on public.organizations from anon;
  ```
- **Tests:** in `audit_authz_fixes.sql`, flip the "legacy anon branding select still works" checks to expect `permission denied`. The portal on production still shows the logo and colors (via the RPC).

### S-06 🟢 Public `thermal-debug.html` shipped to production
- **Where:** `public/thermal-debug.html`
- **After:** move it to `tools/` (not served), or exclude it from production builds. It writes device strings into `innerHTML` and isn't needed by users.
- **Tests:** `/thermal-debug.html` returns 404 (SPA fallback) on the preview.

### S-07 🟠 Database hardening batch (audit "hardening notes")
One migration with the low-risk items from the audit report (`security-audit-skill/MedLabCore/run-1/REPORT.md` §5):
- `antibiotics` and `organization_exam_settings`: restrict writes to `lab_admin` / `bioanalyst` (today any member, including `lab_affiliate`).
- `exchange_rates`: drop `USING (true)` anon read, or limit it to the caller's org.
- `v_test_templates_filtered`: `security_invoker = true`, or revoke from anon.
- Profiles visible to `lab_affiliate`: limit to their own profile plus names needed for display.
- `get_my_org_id`: add `set search_path = public`.
- `confirm_order_consumption`: take the signature from the caller's profile, not from `p_signature`.
- Audit trigger on `order_items` (result edits currently leave no audit trail).
- **Tests:** one rolled-back SQL test per item, each "denied for X, allowed for Y", using the corrected `expect_error` helper.

### S-08 🟠 Weak password policy
- **Where:** Supabase Auth settings (local `config.toml` has `minimum_password_length = 6`; check the dashboard).
- **After:** minimum 10 characters, enable **leaked password protection**, and require the current password for password changes. Mirror the rule in the app's user-creation forms and `admin-create-user`/`lab-create-user` (zod `min(10)`).
- **Tests:** creating a user with a 6-character password is refused with a clear message.

### S-09 🟠 Two sources of truth for roles
- **Problem:** many RLS policies and the UI read `profiles.role`, while `has_role()` and some ERP policies read `user_roles`. They can disagree (e.g. a lab admin without a `user_roles` row is denied in some places). The audit found real bugs from this drift.
- **After (L):** pick one source, `profiles.role` (one role per user):
  1. A trigger keeps `user_roles` in sync (or `has_role` reads `profiles`).
  2. Run a one-time SQL that reports and fixes mismatches.
  3. Migrate policies gradually.
  Keep `super_admin` behind its own check.
- **Tests:** a SQL test that creates users by every path (`create-organization`, `lab-create-user`, `admin-create-user`) and asserts both sources agree. All existing suites stay green.

### S-10 🟠 ERP uses an untyped database client
- **Where:** `src/features/erp/utils/erpDb.ts`, used in 11 files.
- **Problem:** ERP reads and writes aren't type-checked (typos in columns or RPC args only fail at runtime). The types were regenerated in October, but the replacement is pending.
- **After:** `npm run update-types`, replace `erpDb` with the typed `supabase` client, delete `erpDb.ts`, and move hand-written ERP types to generated `Tables<"…">` where possible.
- **Tests:** `npm run typecheck` has 0 errors. The ERP checklist rows R1–R10 and C1–C8 still pass on the preview.

### S-11 🟠 Second security audit
After phases 1–5, run the security audit again as **run-2**. It reuses run-1's ledger and re-checks every fix. It also covers the two units skipped in run-1 (Wildcard and Injection).

---

## 4. Refactoring for maintainability

### M-01 🔴 Report generators duplicated three times (≈ 3,200 lines)
- **Where:** `src/lib/unifiedTestReportPDF.tsx` (750), `UnifiedTestReportRivalta.tsx` (722), `UnifiedTestReportPalermo.tsx` (723), `testReportGenerator.tsx` (273), `testReportRivaltaGenerator.tsx` (388), `testReportPalermoGenerator.tsx` (388), plus `UnifiedTestReportWord.tsx`.
- **Problem:** Rivalta and Palermo differ in **19 of 722 lines**. Their single-test generators differ in **2 of 388**. Every fix (e.g. B-05, microbiology, ranges) has to be made 3–4 times, and they've already drifted apart.
- **Why:** each layout was created by copying the previous one.
- **After:** split **data preparation** from **layout**.
  ```
  src/lib/reports/
    buildReportModel.ts   // pure: sort by department, parse results (parseJsonObject), ranges, out-of-range flags, microbiology blocks
    buildReportModel.test.ts
    layouts/
      DefaultLayout.tsx
      ClassicLayout.tsx   // Rivalta + Palermo as one component with a `variant` / theme config (the 19 lines that differ)
    UnifiedReport.tsx     // picks the layout from organizations.report_template
    word/UnifiedReportWord.ts // uses the same buildReportModel
  ```
  ```ts
  // before (in each of 3 files): ~120 lines of sort + parse + group per file
  // after:
  const model = buildReportModel({ orderItems, departmentOrder });
  return <ClassicLayout model={model} variant="rivalta" labData={labData} … />;
  ```
  Keep `REPORT_TEMPLATES` / `TEST_TEMPLATE_REPORT_TEMPLATES` keys the same, so the dispatcher and organization settings don't change.
- **Tests:**
  - **Golden tests** for `buildReportModel` with fixtures: normal values, out of range, select/text fields, microbiology with 2 germs, department ordering, a broken JSON item.
  - Before the refactor, generate PDFs for 3–4 real-looking dummy orders with each template and keep them. After the refactor, compare visually (or compare the text extracted with pdf-parse).
- **Plan the change in 3 steps:**
  1. Extract `buildReportModel` and use it in the default layout.
  2. Merge Rivalta and Palermo.
  3. Have the Word generator use the model too.

### M-02 🟠 Very large components
- **Where:** `pages/admin/TemplateBuilderPage.tsx` (1157), `pages/OrderDetailPage.tsx` (775), `features/orders/OrderDetailSections.tsx` (770), `features/orders/CreateOrderDialog.tsx` (737), `pages/AuditLogPage.tsx` (583).
- **After:** for each one, move state and logic into a hook (`useTemplateBuilder`, `useOrderDetail`, `useCreateOrder`), move pure logic into `*Utils.ts` with unit tests (the project's existing pattern), and split the JSX into section components. Target: no component file over ~350 lines.
- **Tests:** the existing util tests stay green. New tests for the extracted pure functions. Manual check of the screen on the preview.

### M-03 🟠 TypeScript not strict, and the build never type-checks
- **Where:** `tsconfig.app.json` (`strict: false`, `noImplicitAny: false`), `tsconfig.json` (`strictNullChecks: false`), `package.json` (`"build": "vite build"`).
- **After, step by step:**
  1. Fix the 52 errors (B-06) and add a `typecheck` script plus CI (T-01).
  2. Turn on `noImplicitAny`, then fix.
  3. Turn on `strictNullChecks`, starting folder by folder with a stricter `tsconfig.strict.json` that `include`s finished folders (`src/lib`, `src/features/erp`, …).
  4. Turn on `strict: true` when all folders are done.
- **Tests:** `npm run typecheck` stays at 0 errors after each step.

### M-04 🟢 ESLint configuration and warnings
- **Where:** `eslint.config.js` (`ignores: ["dist"]` only).
- **After:**
  - `ignores: ["dist", "dev-dist", "supabase/functions-old*", "coverage"]`. This removes ~22 false errors from generated Workbox files.
  - Replace the 12 `any` (`orderReportDispatcher.tsx`, `pwa.ts`, `main.tsx`, `PatientPortalPage.tsx`, `ReportViewerPage.tsx`, schemas, `parse-price-list`) with proper types or `unknown` plus narrowing.
  - Fix the 4 `react-hooks/exhaustive-deps` warnings (B-07, `ReportPreviewModal.tsx:152`).
  - Move non-component exports out of `.tsx` component files (18 fast-refresh warnings).
  - `tailwind.config.ts:119`: use `import` instead of `require`.
- **Tests:** `npm run lint` → 0 errors, with warnings only where explicitly accepted.

### M-05 🟢 Query keys outside `queryKeys.ts`
- **Where:** `BulkPriceUploadDialog.tsx:52` (`"global-templates-for-bulk"`), `useAdminUsers.ts:32,59` (`"admin-users"`), `useAuditLogs.ts:106` (`"org-users-filter"`), `useInvoices.ts:65` (`"erp","backfill-preview"`), `useCashRegister.ts:56` (`"erp","cash-summary"`).
- **After:** add these to `src/lib/queryKeys.ts` (scoped by `orgId` where they hold tenant data) and invalidate through them, as `CLAUDE.md` requires.
- **Tests:** a unit test that the new keys include `orgId`. Screens refresh after mutations as before.

### M-06 🟠 Shared helpers
Create small, tested helpers so fixes are made once:
- `src/lib/json.ts`: `parseJsonObject` (B-05).
- `src/lib/postgrest.ts`: `pgrstValue`, `ilikeAny` (B-08).
- `src/lib/errors.ts`: `isNonRetryableError` (B-04).
- Form pattern: "build `defaultValues` from the record + `key` remount" (B-09). Document it in `CLAUDE.md`.
- `supabase/functions/_shared/`: CORS, auth and JSON responses (S-04).

### M-07 🟢 Dead code and stale config
- `src/features/erp/components/ExchangeRateHistoryPanel.tsx`: not rendered anywhere (the ERP uses the automatic DolarAPI rate). Delete it, or keep it only if a manual override is wanted.
- `vercel.json`: header rule for `/sw-push.js`, which doesn't exist.
- Snapshot dumps `supabase/full_backup.sql`, `supabase/schema.sql`, `supabase/roles.sql`: schema only, but stale and confusing next to `migrations/`. Move them out of the repo.
- `docs/HANDOFF-authz-fixes-and-erp-deploy.md`: archive once its content is in `ERP.md`.
- `PurchaseEntryDialog` still resets the form in `useEffect` (works, because it's keyed on `open`). Align it with the M-06 pattern when touching it.

### M-08 🟢 Docs out of date
- `CLAUDE.md`:
  - `dev` (and `main` after release) now carry the re-baselined migrations, so `supabase db push` is safe from them.
  - Add the form pattern and the SQL test command (T-02).
  - Mention `docs/IMPROVEMENT_PLAN.md`.
- `ERP.md`: mark the pilot as tested (Lab Instumed, 2026-10-25) and document units vs packages and optional cash sessions.
- `docs/ERP_GUIA_USUARIO.md`: explain "unidad de medida" vs "unidades por empaque" and purchases by package.

---

## 5. Tests and tooling

### T-01 🔴 Continuous integration
- **After:** `.github/workflows/ci.yml` running on push and pull requests to `dev`/`main`:
  ```yaml
  name: CI
  on: [push, pull_request]
  jobs:
    web:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: 24, cache: npm }
        - run: npm ci --legacy-peer-deps
        - run: npm run lint
        - run: npm run typecheck
        - run: npm test
          env: { VITE_SUPABASE_URL: http://127.0.0.1:54321, VITE_SUPABASE_PUBLISHABLE_KEY: test }
        - run: npm run build
          env: { VITE_SUPABASE_URL: http://127.0.0.1:54321, VITE_SUPABASE_PUBLISHABLE_KEY: test }
    database:          # optional second step: SQL suites against a throwaway local Supabase
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: supabase/setup-cli@v1
        - run: supabase start
        - run: ./scripts/test-db.sh   # from T-02
  ```
  Also fix the peer-dependency conflict (vite 8 vs `@vitejs/plugin-react-swc` 3.11) by upgrading the plugin, so `--legacy-peer-deps` can be dropped.
- **Tests:** a pull request shows green checks. A deliberate type error makes CI fail.

### T-02 🟠 One command for the SQL test suites
- **After:** `scripts/test-db.sh` (and `npm run test:db`) that, for each file in `supabase/tests/*.sql` with a `begin; … rollback;` structure:
  - prepends any migration not yet applied to the local DB,
  - runs it with `set timezone = 'America/Caracas'`,
  - prints PASS/FAIL per file.
- **Tests:** the script reports PASS for all 5 suites on a fresh `supabase start`, and FAIL when a fix migration is removed (negative control, as was done manually on 2026-10-25).

### T-03 🟢 Component tests for critical flows
- **After:** enable `jsdom` for selected test files (`// @vitest-environment jsdom`), add `@testing-library/react`, and cover:
  - the bank account form edit (shows the saved method and currency);
  - purchases by package (converts to units);
  - "Guardar todo" partial failure (B-03);
  - the portal login lockout message.
- **Tests:** these tests fail on the old code and pass after the fixes.

---

## Log (update as you go)

| Date | Item(s) | Commit | Notes |
|---|---|---|---|
| 2026-10-25 | — | `716e3c9` | Plan created from code review of `dev`. ERP pilot fixes (B2/B4/E1 from the ERP checklist) and the `expect_error` test-helper fix were already done in `716e3c9` / `95e1807`. |
| 2026-10-25 | P-01 | _pending_ | ReportViewerPage lazy-loaded. First-load JS ~2.4 MB → 819 KB; react-pdf no longer requested on /login (checked in browser on a production build). |
| 2026-10-25 | S-02 | _pending_ | beforeSend/beforeSendTransaction/beforeBreadcrumb replace dni/pin with [filtered]; replay explicitly masked; sendDefaultPii false (src/lib/sentryScrub.ts + 3 tests). Address-bar cleanup moved to S-03. |
| 2026-10-25 | B-04 | _pending_ | isNonRetryableError in src/lib/errors.ts (HTTP 4xx, PGRST*, P0001 = RPC raise exception, 42*/22*/23*); QueryClient retry uses it. 2 new tests. Note: RPC app codes arrive as code P0001, not their own name. |
| 2026-10-25 | B-07 | _pending_ | PDF built once per order; auth/auto-login effects guarded by refs; patient/lab data memoized |
| 2026-10-25 | B-08 | _pending_ | Searches quoted via ilikeAny (also useOrders.ts); checked on local PostgREST: comma no longer errors, % and _ literal |
| 2026-10-25 | M-06 | _pending_ | ◐ postgrest.ts + errors.ts done; json.ts goes with B-05 (Phase 6), form pattern with B-09 |
| 2026-10-25 | B-10 | _pending_ | Report ranges use erp_local_date(now()); passes with timezone UTC and America/Caracas (evening window not reproducible in daytime) |
| 2026-10-25 | S-06 | _pending_ | Moved to tools/thermal-debug.html (not served); open locally in Chrome for Web Serial debugging |
| 2026-10-25 | M-05 | _pending_ | All 21 ad-hoc keys (14 files) moved to queryKeys.ts with identical shapes; prefix keys for invalidation; queryKeys.test.ts |
