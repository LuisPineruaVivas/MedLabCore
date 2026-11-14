type Row = Record<string, unknown>;

export interface Relation {
  table: string;
  /** true = one-to-many (array), false = many-to-one (object or null). */
  many: boolean;
  local: string;
  foreign: string;
}

/** Views that read from a base table in the demo store. */
export const TABLE_ALIASES: Record<string, string> = {
  v_test_templates_filtered: "test_templates",
};

const one = (table: string, local: string): Relation => ({ table, many: false, local, foreign: "id" });
const many = (table: string, foreign: string): Relation => ({ table, many: true, local: "id", foreign });

/** Hand-written FK map: key is `<parent table>.<embedded name>`. */
export const RELATIONS: Record<string, Relation> = {
  "orders.patients": one("patients", "patient_id"),
  "orders.order_items": many("order_items", "order_id"),
  "orders.organizations": one("organizations", "org_id"),
  "patients.orders": many("orders", "patient_id"),
  "order_items.orders": one("orders", "order_id"),
  "order_items.test_templates": one("test_templates", "template_id"),
  "test_templates.organization_exam_settings": many("organization_exam_settings", "template_id"),
  "organizations.profiles": many("profiles", "org_id"),
  "profiles.organizations": one("organizations", "org_id"),
  "exam_profiles.profile_templates_junction": many("profile_templates_junction", "profile_id"),
  "profile_templates_junction.test_templates": one("test_templates", "template_id"),
};

function randomPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Column defaults the real database would fill in on insert. */
export const TABLE_DEFAULTS: Record<string, (rows: Row[]) => Row> = {
  orders: (rows) => ({
    status: "pendiente",
    payment_status: "unpaid",
    is_exempted: false,
    completed_at: null,
    access_pin: randomPin(),
    order_seq: rows.reduce((max, row) => Math.max(max, Number(row.order_seq ?? 0)), 0) + 1,
    firma_url: null,
    firma_name: null,
    sello_url: null,
    signature_footer_text: null,
  }),
  patients: () => ({ phone: null, email: null, address: null, occupation: null }),
  order_items: () => ({ is_profile_header: false, parent_profile_id: null }),
};
