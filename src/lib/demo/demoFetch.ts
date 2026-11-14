import { DEMO_AUTH_KEY, DEMO_DB_KEY } from "./isDemo";
import { RELATIONS, TABLE_ALIASES, TABLE_DEFAULTS } from "./relations";
import { buildSeed, DEMO_ORG_ID, DEMO_USER } from "./seed";

// Fake host: if anything ever bypassed demoFetch, the request would fail instead of hitting the real project.
export const DEMO_SUPABASE_URL = "https://demo.medlab.invalid";

type Row = Record<string, unknown>;
type Store = Record<string, Row[]>;

// ── Store ─────────────────────────────────────────────────────────

let store: Store | null = null;

function getStore(): Store {
  if (store) return store;
  try {
    const saved = sessionStorage.getItem(DEMO_DB_KEY);
    if (saved) store = JSON.parse(saved) as Store;
  } catch {
    store = null;
  }
  store ??= buildSeed();
  return store;
}

function persist() {
  try {
    sessionStorage.setItem(DEMO_DB_KEY, JSON.stringify(store));
  } catch {
    // Quota or blocked storage: the demo keeps working in memory for this page load.
  }
}

export const DEMO_EVENT = "medlab-demo-write";
export interface DemoWriteEvent {
  table: string;
  action: "insert" | "update" | "delete" | "create_order";
  rows: Row[];
}

function emitWrite(detail: DemoWriteEvent) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(DEMO_EVENT, { detail }));
}

/** Most recent order, so the guide can deep-link to it. */
export function latestDemoOrderId(): string | null {
  const orders = applyOrder(tableRows("orders"), "created_at.desc");
  return (orders.find((o) => o.status !== "completada") ?? orders[0])?.id as string | null;
}

/** First name of the most recently registered patient, so the guide can suggest what to search. */
export function latestDemoPatientName(): string | null {
  const [patient] = applyOrder(tableRows("patients"), "created_at.desc");
  return patient ? String(patient.first_name) : null;
}

/** Test helper: replace the store (null = reseed on next access). */
export function resetDemoStore(next: Store | null = null) {
  store = next;
}

function tableRows(table: string): Row[] {
  const name = TABLE_ALIASES[table] ?? table;
  const db = getStore();
  db[name] ??= [];
  return db[name];
}

// ── Auth session ──────────────────────────────────────────────────

function base64Url(value: object) {
  return btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function buildSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
  const payload = { sub: DEMO_USER.id, email: DEMO_USER.email, role: "authenticated", exp: expiresAt };
  return {
    access_token: `${base64Url({ alg: "HS256", typ: "JWT" })}.${base64Url(payload)}.demo`,
    refresh_token: "demo-refresh-token",
    token_type: "bearer",
    expires_in: 60 * 60 * 24 * 365,
    expires_at: expiresAt,
    user: DEMO_USER,
  };
}

/** Writes a long-lived fake session so supabase-js boots already "logged in" without any request. */
export function ensureDemoSession() {
  if (!sessionStorage.getItem(DEMO_AUTH_KEY)) {
    sessionStorage.setItem(DEMO_AUTH_KEY, JSON.stringify(buildSession()));
  }
}

// ── Select parsing ────────────────────────────────────────────────

type SelectNode =
  | { kind: "star" }
  | { kind: "count"; alias?: string }
  | { kind: "col"; name: string; alias?: string }
  | { kind: "rel"; name: string; alias?: string; inner: boolean; children: SelectNode[] };

/** Splits on `sep` only at parenthesis depth 0, ignoring separators inside double quotes. */
export function splitTop(input: string, sep = ","): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (const ch of input) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === "(") depth++;
    if (!quoted && ch === ")") depth--;
    if (!quoted && depth === 0 && ch === sep) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

export function parseSelect(select: string): SelectNode[] {
  return splitTop(select.replace(/\s+/g, ""))
    .filter(Boolean)
    .map((token): SelectNode => {
      const paren = token.indexOf("(");
      let head = (paren >= 0 ? token.slice(0, paren) : token).replace(/::\w+$/, "");
      let alias: string | undefined;
      const colon = head.indexOf(":");
      if (colon >= 0) {
        alias = head.slice(0, colon);
        head = head.slice(colon + 1);
      }
      const [name, ...hints] = head.split("!");
      if (paren >= 0) {
        return { kind: "rel", name, alias, inner: hints.includes("inner"), children: parseSelect(token.slice(paren + 1, -1)) };
      }
      if (name === "*") return { kind: "star" };
      if (name === "count") return { kind: "count", alias };
      return { kind: "col", name, alias };
    });
}

// ── Filters ───────────────────────────────────────────────────────

type Predicate = (row: Row) => boolean;

function unquote(value: string) {
  return value.length > 1 && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}

function compare(cell: unknown, raw: string): number {
  const a = Number(cell);
  const b = Number(raw);
  if (cell !== null && cell !== "" && raw !== "" && Number.isFinite(a) && Number.isFinite(b)) return a - b;
  const da = Date.parse(String(cell));
  const db = Date.parse(raw);
  if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
  return String(cell).localeCompare(raw);
}

function likeToRegex(pattern: string, flags: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[%*]/g, ".*");
  return new RegExp(`^${escaped}$`, flags);
}

function parseList(raw: string): string[] {
  return splitTop(raw.replace(/^\(|\)$/g, "")).map(unquote);
}

function evalOp(cell: unknown, op: string, raw: string): boolean {
  switch (op) {
    case "eq":
      return cell !== null && cell !== undefined && String(cell) === raw;
    case "neq":
      return cell !== null && cell !== undefined && String(cell) !== raw;
    case "gt":
      return cell != null && compare(cell, raw) > 0;
    case "gte":
      return cell != null && compare(cell, raw) >= 0;
    case "lt":
      return cell != null && compare(cell, raw) < 0;
    case "lte":
      return cell != null && compare(cell, raw) <= 0;
    case "like":
      return cell != null && likeToRegex(raw, "").test(String(cell));
    case "ilike":
      return cell != null && likeToRegex(raw, "i").test(String(cell));
    case "is":
      return raw === "null" ? cell == null : String(cell) === raw;
    case "in":
      return cell != null && parseList(raw).includes(String(cell));
    case "cs": {
      const wanted = raw.startsWith("[") ? (JSON.parse(raw) as unknown[]).map(String) : parseList(raw.replace(/^\{|\}$/g, ""));
      return Array.isArray(cell) && wanted.every((w) => cell.map(String).includes(w));
    }
    default:
      console.warn(`[demo] filter operator "${op}" not supported, ignoring it`);
      return true;
  }
}

/** Parses `op.value` / `not.op.value` for column `col`. */
function columnPredicate(col: string, expr: string): Predicate {
  let negate = false;
  let rest = expr;
  if (rest.startsWith("not.")) {
    negate = true;
    rest = rest.slice(4);
  }
  const dot = rest.indexOf(".");
  const op = rest.slice(0, dot);
  const value = unquote(rest.slice(dot + 1));
  return (row) => evalOp(row[col], op, value) !== negate;
}

/** Parses the inside of `or=(...)` / `and=(...)`. */
function logicalPredicate(kind: "or" | "and", body: string): Predicate {
  const parts = splitTop(body.replace(/^\(|\)$/g, "")).map((part): Predicate => {
    const nested = part.match(/^(not\.)?(or|and)(\(.*\))$/);
    if (nested) {
      const inner = logicalPredicate(nested[2] as "or" | "and", nested[3]);
      return nested[1] ? (row) => !inner(row) : inner;
    }
    const dot = part.indexOf(".");
    return columnPredicate(part.slice(0, dot), part.slice(dot + 1));
  });
  return kind === "or" ? (row) => parts.some((p) => p(row)) : (row) => parts.every((p) => p(row));
}

const NON_FILTER_KEYS = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

/** Filters whose key has exactly `prefix` before the column (prefix "" = top level). */
function predicatesFor(params: URLSearchParams, prefix: string): Predicate[] {
  const out: Predicate[] = [];
  params.forEach((value, key) => {
    if (!key.startsWith(prefix)) return;
    const local = key.slice(prefix.length);
    if (local.includes(".") || NON_FILTER_KEYS.has(local)) return;
    out.push(local === "or" || local === "and" ? logicalPredicate(local, value) : columnPredicate(local, value));
  });
  return out;
}

function applyOrder(rows: Row[], order: string | null) {
  if (!order) return rows;
  const terms = order.split(",").map((term) => {
    const [col, ...mods] = term.split(".");
    return { col, desc: mods.includes("desc"), nullsFirst: mods.includes("nullsfirst") };
  });
  return [...rows].sort((a, b) => {
    for (const { col, desc, nullsFirst } of terms) {
      const av = a[col];
      const bv = b[col];
      if (av == null && bv == null) continue;
      if (av == null) return nullsFirst ? -1 : 1;
      if (bv == null) return nullsFirst ? 1 : -1;
      const diff = compare(av, String(bv));
      if (diff !== 0) return desc ? -diff : diff;
    }
    return 0;
  });
}

// ── Projection with embedded resources ────────────────────────────

/** Returns null when an `!inner` embed has no match (the parent row is dropped). */
function project(table: string, row: Row, nodes: SelectNode[], params: URLSearchParams, path: string): Row | null {
  const out: Row = {};
  for (const node of nodes) {
    if (node.kind === "star") Object.assign(out, row);
    else if (node.kind === "col") out[node.alias ?? node.name] = row[node.name] ?? null;
    else if (node.kind === "rel") {
      const key = node.alias ?? node.name;
      const relation = RELATIONS[`${TABLE_ALIASES[table] ?? table}.${node.name}`];
      if (!relation) {
        console.warn(`[demo] unknown relation ${table} -> ${node.name}`);
        out[key] = null;
        continue;
      }
      // PostgREST filters embeds by alias; this app sometimes uses the table name, so accept both.
      const prefixes = [...new Set([`${path}${key}.`, `${path}${node.name}.`])];
      const predicates = prefixes.flatMap((prefix) => predicatesFor(params, prefix));
      let children = tableRows(relation.table).filter(
        (child) => child[relation.foreign] === row[relation.local] && predicates.every((p) => p(child))
      );
      if (node.children.length === 1 && node.children[0].kind === "count") {
        out[key] = [{ count: children.length }];
        continue;
      }
      children = applyOrder(children, params.get(`${path}${key}.order`));
      const projected = children
        .map((child) => project(relation.table, child, node.children, params, `${path}${key}.`))
        .filter((child): child is Row => child !== null);
      out[key] = relation.many ? projected : projected[0] ?? null;
      if (node.inner && projected.length === 0) return null;
    }
  }
  return out;
}

// ── Responses ─────────────────────────────────────────────────────

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? "" : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function pgError(message: string, status = 400, code = "DEMO") {
  return json({ message, code, details: null, hint: null }, status);
}

function respondRows(rows: Row[], headers: Headers, method: string, extraHeaders: Record<string, string> = {}) {
  if (method === "HEAD") return new Response(null, { status: 200, headers: extraHeaders });
  if ((headers.get("Accept") ?? "").includes("vnd.pgrst.object+json")) {
    if (rows.length !== 1) {
      return json(
        {
          code: "PGRST116",
          message: "JSON object requested, multiple (or no) rows returned",
          details: `The result contains ${rows.length} rows`,
          hint: null,
        },
        406
      );
    }
    return json(rows[0], 200, extraHeaders);
  }
  return json(rows, 200, extraHeaders);
}

// ── REST handlers ─────────────────────────────────────────────────

function handleSelect(table: string, params: URLSearchParams, headers: Headers, method: string) {
  const nodes = parseSelect(params.get("select") ?? "*");
  const predicates = predicatesFor(params, "");
  const filtered = tableRows(table).filter((row) => predicates.every((p) => p(row)));
  // Ordering runs on raw rows so it can use columns that the select list leaves out.
  const ordered = applyOrder(filtered, params.get("order"));
  const projected = ordered
    .map((row) => project(table, row, nodes, params, ""))
    .filter((row): row is Row => row !== null);

  const offset = Number(params.get("offset") ?? 0);
  const limit = params.has("limit") ? Number(params.get("limit")) : projected.length;
  const page = projected.slice(offset, offset + limit);

  const extra: Record<string, string> = {};
  if ((headers.get("Prefer") ?? "").includes("count=")) {
    extra["Content-Range"] = page.length ? `${offset}-${offset + page.length - 1}/${projected.length}` : `*/${projected.length}`;
  }
  return respondRows(page, headers, method, extra);
}

function withDefaults(table: string, input: Row): Row {
  const now = new Date().toISOString();
  const defaults = TABLE_DEFAULTS[table]?.(tableRows(table)) ?? {};
  return { id: crypto.randomUUID(), created_at: now, updated_at: now, ...defaults, ...input };
}

function returnRepresentation(table: string, rows: Row[], params: URLSearchParams, headers: Headers, status: number) {
  if (!(headers.get("Prefer") ?? "").includes("return=representation")) return new Response(null, { status });
  const nodes = parseSelect(params.get("select") ?? "*");
  const projected = rows.map((row) => project(table, row, nodes, params, "")).filter((row): row is Row => row !== null);
  const res = respondRows(projected, headers, "GET");
  return res.status === 200 ? new Response(res.body, { status, headers: res.headers }) : res;
}

function handleInsert(table: string, params: URLSearchParams, headers: Headers, body: unknown) {
  const inputs = (Array.isArray(body) ? body : [body]) as Row[];
  const rows = tableRows(table);
  const upsert = (headers.get("Prefer") ?? "").includes("resolution=merge-duplicates");
  const conflictCols = (params.get("on_conflict") ?? "id").split(",");
  const written: Row[] = [];

  for (const input of inputs) {
    const existing = upsert
      ? rows.find((row) => conflictCols.every((col) => input[col] !== undefined && row[col] === input[col]))
      : undefined;
    if (existing) {
      Object.assign(existing, input, { updated_at: new Date().toISOString() });
      written.push(existing);
    } else {
      const row = withDefaults(table, input);
      rows.push(row);
      written.push(row);
    }
  }
  persist();
  emitWrite({ table, action: "insert", rows: written });
  return returnRepresentation(table, written, params, headers, 201);
}

function handleUpdate(table: string, params: URLSearchParams, headers: Headers, body: unknown) {
  const predicates = predicatesFor(params, "");
  const matched = tableRows(table).filter((row) => predicates.every((p) => p(row)));
  matched.forEach((row) => Object.assign(row, body as Row, { updated_at: new Date().toISOString() }));
  persist();
  emitWrite({ table, action: "update", rows: matched });
  return returnRepresentation(table, matched, params, headers, 200);
}

function handleDelete(table: string, params: URLSearchParams, headers: Headers) {
  const predicates = predicatesFor(params, "");
  const rows = tableRows(table);
  const removed = rows.filter((row) => predicates.every((p) => p(row)));
  const name = TABLE_ALIASES[table] ?? table;
  getStore()[name] = rows.filter((row) => !removed.includes(row));
  persist();
  return returnRepresentation(table, removed, params, headers, 200);
}

// ── RPC ───────────────────────────────────────────────────────────

function startOfToday(offsetDays = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.getTime();
}

function createLabOrder(args: Row) {
  const items = (args.p_items ?? []) as Row[];
  if (!Array.isArray(items) || items.length === 0) return pgError("ORDER_ITEMS_REQUIRED");

  const exempted = Boolean(args.p_is_exempted);
  const total = items.reduce((sum, item) => sum + Number(item.price ?? 0), 0);
  const totalBs = args.p_total_bs == null ? null : exempted ? 0 : Number(args.p_total_bs);
  const notes = String(args.p_notes ?? "").trim() || null;

  const order = withDefaults("orders", {
    org_id: args.p_org_id,
    patient_id: args.p_patient_id,
    created_by: args.p_created_by ?? null,
    total_amount: exempted ? 0 : total,
    notes,
    exchange_rate: args.p_exchange_rate ?? null,
    total_bs: totalBs,
    is_exempted: exempted,
  });
  tableRows("orders").push(order);

  const orderItems = tableRows("order_items");
  const headerIds: Record<string, string> = {};
  const addItem = (fields: Row) => {
    const row = withDefaults("order_items", { order_id: order.id, test_method_id: null, method_name: null, ...fields });
    orderItems.push(row);
    return row;
  };

  // Same three passes as the SQL function: profile headers, profile children, then standalone tests.
  items.filter((item) => item.isProfileHeader).forEach((item) => {
    const header = addItem({ template_id: null, test_name: item.test_name, price_at_order: Number(item.price ?? 0), results_data: null, is_profile_header: true, parent_profile_id: null });
    if (item.profileId) headerIds[String(item.profileId)] = String(header.id);
  });
  items.filter((item) => item.parentProfileId).forEach((item) => {
    addItem({ template_id: item.template_id || null, test_name: item.test_name, price_at_order: 0, results_data: item.schema ?? { sections: [] }, parent_profile_id: headerIds[String(item.parentProfileId)] ?? null, is_profile_header: false });
  });
  items.filter((item) => !item.isProfileHeader && !item.parentProfileId).forEach((item) => {
    addItem({ template_id: item.template_id || null, test_name: item.test_name, price_at_order: Number(item.price ?? 0), results_data: item.schema ?? { sections: [] }, parent_profile_id: null, is_profile_header: false });
  });

  persist();
  emitWrite({ table: "orders", action: "create_order", rows: [order] });
  return json({
    success: true,
    orderId: order.id,
    access_pin: order.access_pin,
    order_seq: order.order_seq,
    userSafeMessage: "Orden creada correctamente",
    technicalCode: "OK",
  });
}

function handleRpc(name: string, args: Row) {
  switch (name) {
    case "create_lab_order":
      return createLabOrder(args);
    case "get_my_org_id":
      return json(DEMO_ORG_ID);
    case "get_dashboard_summary": {
      const orgId = args.p_org_id;
      const patients = tableRows("patients").filter((p) => p.org_id === orgId);
      const orders = tableRows("orders").filter((o) => o.org_id === orgId);
      const ts = (row: Row) => Date.parse(String(row.created_at));
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      const today = orders.filter((o) => ts(o) >= startOfToday());
      return json({
        totalPatients: patients.length,
        thisMonthPatients: patients.filter((p) => ts(p) >= monthStart).length,
        ordersToday: today.length,
        ordersYesterday: orders.filter((o) => ts(o) >= startOfToday(-1) && ts(o) < startOfToday()).length,
        pendingOrders: orders.filter((o) => o.status === "pendiente" || o.status === "por_aprobar").length,
        todayRevenue: today.reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0),
      });
    }
    case "get_dashboard_top_tests": {
      const orderIds = new Set(tableRows("orders").filter((o) => o.org_id === args.p_org_id).map((o) => o.id));
      const counts = new Map<string, number>();
      tableRows("order_items")
        .filter((item) => orderIds.has(item.order_id) && !item.is_profile_header)
        .forEach((item) => counts.set(String(item.test_name), (counts.get(String(item.test_name)) ?? 0) + 1));
      const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
      return json(
        [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, Number(args.p_limit ?? 5))
          .map(([testName, count]) => ({ name: testName, count, pct: Math.round((count / total) * 100) }))
      );
    }
    // The shared report link (/informe-pdf) logs the patient in with cédula + PIN, like the real portal.
    case "portal_authenticate": {
      const norm = (v: unknown) => String(v ?? "").trim().toUpperCase();
      const order = tableRows("orders").find((o) => norm(o.access_pin) === norm(args.p_pin));
      const patient = order && tableRows("patients").find((p) => p.id === order.patient_id && norm(p.id_number) === norm(args.p_dni));
      if (!patient) return json([]);
      const { id, first_name, last_name, id_number, date_of_birth, gender, phone, email } = patient;
      return json([{ patient_id: id, first_name, last_name, id_number, date_of_birth, gender, phone, email }]);
    }
    case "portal_get_patient_orders": {
      const norm = (v: unknown) => String(v ?? "").trim().toUpperCase();
      const own = tableRows("orders").filter((o) => o.patient_id === args.p_patient_id);
      const shared = own.find((o) => norm(o.access_pin) === norm(args.p_pin));
      if (!shared) return json([]);
      const org = tableRows("organizations").find((o) => o.id === shared.org_id);
      const templates = new Map(tableRows("test_templates").map((t) => [t.id, t]));
      // The real RPC only returns completed orders; the demo also returns the shared one, so the visitor
      // can see their report without changing the order status first.
      const orders = own.filter((o) => o === shared || (o.status === "completada" && String(o.created_at) <= String(shared.created_at)));
      return json(
        orders
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
          .map((o) => ({
            order_id: o.id,
            created_at: o.created_at,
            status: o.status,
            total_amount: o.total_amount,
            access_pin: o.access_pin,
            order_seq: o.order_seq,
            org_name: org?.name ?? "Laboratorio",
            org_logo_url: org?.logo_url ?? null,
            firma_url: o.firma_url ?? null,
            sello_url: o.sello_url ?? null,
            report_template: org?.report_template ?? "default",
            department_order: [],
            items: tableRows("order_items")
              .filter((item) => item.order_id === o.id)
              .map((item) => {
                const template = templates.get(item.template_id);
                return {
                  ...item,
                  category: template?.category ?? "General",
                  resolved_sort_order: template?.sort_order ?? 9999,
                };
              })
              .sort((a, b) => String(a.category).localeCompare(String(b.category)) || Number(a.resolved_sort_order) - Number(b.resolved_sort_order)),
          }))
      );
    }
    default:
      console.warn(`[demo] rpc "${name}" not available in demo, returning null`);
      return json(null);
  }
}

// ── Entry point ───────────────────────────────────────────────────

async function readBody(init?: RequestInit): Promise<unknown> {
  if (!init?.body || typeof init.body !== "string") return undefined;
  try {
    return JSON.parse(init.body);
  } catch {
    return init.body;
  }
}

export const demoFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  const path = url.pathname;
  const body = await readBody(init);

  if (url.origin !== DEMO_SUPABASE_URL) {
    throw new Error(`[demo] blocked request to ${url.origin}`);
  }

  if (path.startsWith("/auth/v1/")) {
    const endpoint = path.slice("/auth/v1/".length);
    if (endpoint === "user") return json(DEMO_USER);
    if (endpoint === "logout") return new Response(null, { status: 204 });
    if (endpoint === "token") return json(buildSession());
    return json({ error: "demo", error_description: "No disponible en el modo demo", msg: "No disponible en el modo demo" }, 400);
  }

  if (path.startsWith("/rest/v1/rpc/")) {
    return handleRpc(path.slice("/rest/v1/rpc/".length), (body ?? Object.fromEntries(url.searchParams)) as Row);
  }

  if (path.startsWith("/rest/v1/")) {
    const table = decodeURIComponent(path.slice("/rest/v1/".length));
    const params = url.searchParams;
    switch (method) {
      case "GET":
      case "HEAD":
        return handleSelect(table, params, headers, method);
      case "POST":
        return handleInsert(table, params, headers, body);
      case "PATCH":
        return handleUpdate(table, params, headers, body);
      case "DELETE":
        return handleDelete(table, params, headers);
    }
  }

  if (path.startsWith("/functions/v1/")) {
    return json({ error: "Esta función no está disponible en el modo demo" }, 400);
  }

  if (path.startsWith("/storage/v1/")) {
    if (method === "POST" || method === "PUT") return json({ Key: path, Id: crypto.randomUUID() });
    if (method === "DELETE") return json([]);
    return json({ message: "Not found" }, 404);
  }

  return pgError(`[demo] unsupported: ${method} ${path}`, 501);
};
