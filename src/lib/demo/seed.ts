type Row = Record<string, unknown>;

export const DEMO_ORG_ID = "00000000-0000-4000-a000-000000000001";
/** Seeded patient with order history, used by the guide to showcase the patient file. */
export const DEMO_SHOWCASE_PATIENT_ID = "00000000-0000-4000-b000-000000000200";
const DEMO_USER_ID = "00000000-0000-4000-a000-000000000002";

export const DEMO_USER = {
  id: DEMO_USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "demo@laboratorio-demo.com",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Usuario Demo" },
  created_at: "2026-01-01T00:00:00.000Z",
};

const id = (n: number) => `00000000-0000-4000-b000-${String(n).padStart(12, "0")}`;

function daysAgo(days: number, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

type FieldSeed = [label: string, unit: string, range: string];

function numericSchema(sectionName: string, fields: FieldSeed[]) {
  return {
    sections: [
      {
        id: `${sectionName}-s1`,
        name: sectionName,
        fields: fields.map(([label, unit, range], i) => ({ id: `${sectionName}-f${i}`, label, type: "number", unit, range, value: "" })),
      },
    ],
  };
}

function selectSchema(sectionName: string, label: string, options: string[]) {
  return {
    sections: [{ id: `${sectionName}-s1`, name: sectionName, fields: [{ id: `${sectionName}-f0`, label, type: "select", options, value: "" }] }],
  };
}

const TEMPLATES: Array<[name: string, category: string, price: number, schema: object]> = [
  ["Hematología completa", "Hematología", 8, numericSchema("Hematología completa", [
    ["Hemoglobina", "g/dL", "12 - 16"],
    ["Hematocrito", "%", "36 - 46"],
    ["Leucocitos", "x10³/µL", "4.5 - 11"],
    ["Plaquetas", "x10³/µL", "150 - 450"],
  ])],
  ["Glicemia", "Química sanguínea", 4, numericSchema("Glicemia", [["Glicemia en ayunas", "mg/dL", "70 - 110"]])],
  ["Urea", "Química sanguínea", 4, numericSchema("Urea", [["Urea", "mg/dL", "15 - 45"]])],
  ["Creatinina", "Química sanguínea", 4, numericSchema("Creatinina", [["Creatinina", "mg/dL", "0.6 - 1.2"]])],
  ["Perfil lipídico", "Química sanguínea", 12, numericSchema("Perfil lipídico", [
    ["Colesterol total", "mg/dL", "0 - 200"],
    ["Triglicéridos", "mg/dL", "0 - 150"],
    ["HDL", "mg/dL", "40 - 60"],
    ["LDL", "mg/dL", "0 - 130"],
  ])],
  ["Ácido úrico", "Química sanguínea", 5, numericSchema("Ácido úrico", [["Ácido úrico", "mg/dL", "2.4 - 6.0"]])],
  ["TSH", "Hormonas", 10, numericSchema("TSH", [["TSH", "µUI/mL", "0.4 - 4.0"]])],
  ["VDRL", "Serología", 5, selectSchema("VDRL", "VDRL", ["No reactivo", "Reactivo"])],
  ["HIV", "Serología", 8, selectSchema("HIV", "HIV 1 y 2", ["No reactivo", "Reactivo"])],
  ["Uroanálisis", "Orina", 5, numericSchema("Uroanálisis", [
    ["pH", "", "5 - 8"],
    ["Densidad", "", "1.005 - 1.030"],
  ])],
];

const PATIENTS: Array<[first: string, last: string, idNumber: string, dob: string, gender: string]> = [
  ["María", "González", "14523987", "1985-03-12", "femenino"],
  ["José", "Rodríguez", "18765432", "1990-07-25", "masculino"],
  ["Ana", "Martínez", "20123456", "1995-11-02", "femenino"],
  ["Carlos", "Pérez", "12098765", "1978-01-30", "masculino"],
  ["Luisa", "Hernández", "22345678", "2000-05-18", "femenino"],
  ["Pedro", "Ramírez", "9876543", "1965-09-09", "masculino"],
  ["Gabriela", "Torres", "25678901", "2003-12-21", "femenino"],
  ["Andrés", "Silva", "16543210", "1988-04-14", "masculino"],
];

function withValues(schema: object, values: string[]) {
  const copy = structuredClone(schema) as { sections: Array<{ fields: Array<{ value: string }> }> };
  let i = 0;
  copy.sections.forEach((section) => section.fields.forEach((field) => (field.value = values[i++] ?? "")));
  return copy;
}

export function buildSeed(): Record<string, Row[]> {
  const now = new Date().toISOString();
  const inAYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  // Absolute URL: the PDF renderer fetches images by full URL.
  const logoUrl = typeof window !== "undefined" ? `${window.location.origin}/demo/logo.png` : null;

  const testTemplates: Row[] = TEMPLATES.map(([name, category, price, schema], i) => ({
    id: id(100 + i),
    org_id: null,
    name,
    category,
    base_price: price,
    schema,
    is_active: true,
    sort_order: i,
    result_type: "standard",
    id_global_ref: null,
    created_at: now,
  }));

  const patients: Row[] = PATIENTS.map(([first, last, idNumber, dob, gender], i) => ({
    id: id(200 + i),
    org_id: DEMO_ORG_ID,
    id_number: idNumber,
    first_name: first,
    last_name: last,
    date_of_birth: dob,
    gender,
    phone: `0414-55${String(10000 + i * 137).slice(0, 5)}`,
    email: null,
    address: "Caracas",
    occupation: null,
    created_at: daysAgo(20 - i * 2),
  }));

  const orders: Row[] = [];
  const orderItems: Row[] = [];
  // [patient index, template indexes, days ago, status, values per template]
  const ORDER_SEEDS: Array<[number, number[], number, string, string[][]]> = [
    [0, [4, 6], 40, "completada", [["215", "170", "42", "140"], ["2.1"]]],
    [0, [0, 1], 6, "completada", [["13.5", "41", "7.2", "250"], ["92"]]],
    [1, [4], 4, "completada", [["185", "140", "48", "110"]]],
    [2, [1, 2, 3], 1, "por_aprobar", [["105"], ["30"], ["0.9"]]],
    [3, [0, 6], 0, "pendiente", [[], []]],
    [4, [7, 8], 0, "pendiente", [[], []]],
  ];
  ORDER_SEEDS.forEach(([patientIdx, templateIdxs, ago, status, values], i) => {
    const orderId = id(300 + i);
    const total = templateIdxs.reduce((sum, t) => sum + TEMPLATES[t][2], 0);
    const createdAt = daysAgo(ago, 8 + i);
    orders.push({
      id: orderId,
      org_id: DEMO_ORG_ID,
      patient_id: patients[patientIdx].id,
      created_by: DEMO_USER_ID,
      status,
      payment_status: status === "completada" ? "paid" : "unpaid",
      total_amount: total,
      is_exempted: false,
      exchange_rate: 40,
      total_bs: total * 40,
      notes: null,
      access_pin: String(482910 + i),
      order_seq: i + 1,
      created_at: createdAt,
      updated_at: createdAt,
      completed_at: status === "completada" ? createdAt : null,
      firma_url: null,
      firma_name: null,
      sello_url: null,
      signature_footer_text: null,
    });
    templateIdxs.forEach((t, j) => {
      const template = testTemplates[t];
      orderItems.push({
        id: id(400 + i * 10 + j),
        order_id: orderId,
        template_id: template.id,
        test_name: template.name,
        price_at_order: template.base_price,
        results_data: withValues(template.schema as object, values[j] ?? []),
        test_method_id: null,
        method_name: null,
        parent_profile_id: null,
        is_profile_header: false,
        created_at: createdAt,
      });
    });
  });

  const profileId = id(500);

  return {
    organizations: [
      {
        id: DEMO_ORG_ID,
        name: "Laboratorio Demo",
        address: "Av. Principal, Caracas",
        phone: "0212-555-0000",
        email: "contacto@laboratorio-demo.com",
        logo_url: logoUrl,
        watermark_url: null,
        primary_color: "#0ea5e9",
        secondary_color: "#0f172a",
        report_template: "default",
        report_footer_text: "Este es un informe de demostración.",
        city: "Caracas",
        state: "Distrito Capital",
        country: "Venezuela",
        rif: "J-00000000-0",
        is_active: true,
        subscription_active: true,
        subscription_expires_at: inAYear,
        subscription_grace_until: null,
        subscription_plan_price: 0,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    profiles: [
      {
        id: DEMO_USER_ID,
        org_id: DEMO_ORG_ID,
        role: "lab_admin",
        full_name: "Usuario Demo",
        email: DEMO_USER.email,
        created_at: "2026-01-01T00:00:00.000Z",
        firma_url: null,
        sello_url: null,
        signature_footer_text: null,
      },
    ],
    patients,
    test_templates: testTemplates,
    exam_profiles: [
      { id: profileId, org_id: DEMO_ORG_ID, name: "Perfil básico", description: "Hematología, glicemia, urea y creatinina", total_price: 15, is_active: true, created_at: now },
    ],
    profile_templates_junction: [0, 1, 2, 3].map((t, i) => ({ id: id(600 + i), profile_id: profileId, template_id: testTemplates[t].id })),
    orders,
    order_items: orderItems,
    exchange_rates: [{ id: id(700), org_id: DEMO_ORG_ID, rate: 40, updated_at: now }],
  };
}
