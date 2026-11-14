import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { demoFetch, DEMO_SUPABASE_URL, resetDemoStore } from "./demoFetch";
import { DEMO_ORG_ID } from "./seed";

const client = createClient(DEMO_SUPABASE_URL, "demo-anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: demoFetch },
});

describe("demoFetch", () => {
  beforeEach(() => resetDemoStore());

  it("embeds many-to-one and one-to-many relations", async () => {
    const { data, error } = await client
      .from("orders")
      .select("id, status, patients(first_name), order_items(test_name)")
      .eq("org_id", DEMO_ORG_ID)
      .order("created_at", { ascending: true });
    expect(error).toBeNull();
    expect(data).toHaveLength(6);
    expect(data![0].patients).toEqual({ first_name: "María" });
    expect(data![0].order_items.map((i: { test_name: string }) => i.test_name)).toEqual(["Perfil lipídico", "TSH"]);
  });

  it("supports in, or/ilike, range and count=exact", async () => {
    const pending = await client.from("orders").select("id").in("status", ["pendiente", "por_aprobar"]);
    expect(pending.data).toHaveLength(3);

    const search = await client
      .from("patients")
      .select("first_name", { count: "exact" })
      .or("first_name.ilike.%mar%,last_name.ilike.%mar%")
      .range(0, 0);
    expect(search.count).toBe(2);
    expect(search.data).toHaveLength(1);

    const head = await client.from("patients").select("id", { count: "exact", head: true }).eq("org_id", DEMO_ORG_ID);
    expect(head.count).toBe(8);
  });

  it("filters parents through an !inner embed with a referenced-table or", async () => {
    const { data } = await client
      .from("orders")
      .select("id, patients!inner(first_name)")
      .or("first_name.ilike.%luisa%", { foreignTable: "patients" });
    expect(data).toHaveLength(1);
    expect(data![0].patients).toEqual({ first_name: "Luisa" });
  });

  it("counts embedded rows with an embedded filter", async () => {
    const { data } = await client
      .from("patients")
      .select("first_name, pending_exams:orders(count)")
      .neq("orders.status", "completada")
      .eq("first_name", "María");
    expect(data![0].pending_exams).toEqual([{ count: 0 }]);
  });

  it("round-trips insert, update and single()", async () => {
    const inserted = await client
      .from("patients")
      .insert({ org_id: DEMO_ORG_ID, first_name: "Test", last_name: "Demo", id_number: "1", date_of_birth: "2000-01-01", gender: "femenino" })
      .select("id")
      .single();
    expect(inserted.error).toBeNull();

    await client.from("patients").update({ phone: "123" }).eq("id", inserted.data!.id);
    const read = await client.from("patients").select("phone").eq("id", inserted.data!.id).single();
    expect(read.data).toEqual({ phone: "123" });

    const missing = await client.from("patients").select("id").eq("id", "nope").single();
    expect(missing.error?.code).toBe("PGRST116");
  });

  it("creates an order through the create_lab_order rpc", async () => {
    const { data } = await client.rpc("create_lab_order", {
      p_org_id: DEMO_ORG_ID,
      p_patient_id: "00000000-0000-4000-b000-000000000200",
      p_items: [{ template_id: "t1", test_name: "Glicemia", price: 4, schema: { sections: [] } }],
    });
    expect(data.success).toBe(true);
    const items = await client.from("order_items").select("test_name, price_at_order").eq("order_id", data.orderId);
    expect(items.data).toEqual([{ test_name: "Glicemia", price_at_order: 4 }]);
  });

  it("opens a shared report through the portal rpcs", async () => {
    const { data: order } = await client
      .from("orders")
      .select("access_pin, patients(id, id_number)")
      .eq("org_id", DEMO_ORG_ID)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
    const patient = order!.patients as unknown as { id: string; id_number: string };

    const wrong = await client.rpc("portal_authenticate", { p_dni: "000", p_pin: order!.access_pin });
    expect(wrong.data).toEqual([]);

    const auth = await client.rpc("portal_authenticate", { p_dni: patient.id_number, p_pin: order!.access_pin });
    expect(auth.data[0]).toMatchObject({ patient_id: patient.id, first_name: "María" });

    const { data: orders } = await client.rpc("portal_get_patient_orders", { p_patient_id: patient.id, p_pin: order!.access_pin });
    expect(orders[0]).toMatchObject({ access_pin: order!.access_pin, org_name: "Laboratorio Demo" });
    expect(orders[0].items.map((i: { test_name: string }) => i.test_name)).toEqual(expect.arrayContaining(["Perfil lipídico", "TSH"]));
  });

  it("refuses requests to any other host", async () => {
    await expect(demoFetch("https://example.supabase.co/rest/v1/patients")).rejects.toThrow("blocked");
  });
});
