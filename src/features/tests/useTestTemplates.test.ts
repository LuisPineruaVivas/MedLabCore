import { describe, expect, it } from "vitest";
import { buildExamOrderUpserts, buildUpsertExamProfilePayload } from "./useTestTemplates";

describe("exam profile payload helpers", () => {
  it("builds the RPC payload for new profiles", () => {
    expect(
      buildUpsertExamProfilePayload("org-1", {
        name: "Perfil 20",
        description: "Perfil promocional",
        total_price: 25,
        template_ids: ["tpl-1", "tpl-2"],
      })
    ).toEqual({
      p_profile_id: null,
      p_org_id: "org-1",
      p_name: "Perfil 20",
      p_description: "Perfil promocional",
      p_total_price: 25,
      p_template_ids: ["tpl-1", "tpl-2"],
    });
  });

  it("keeps existing profile ids when editing", () => {
    expect(
      buildUpsertExamProfilePayload("org-1", {
        id: "profile-1",
        name: "Perfil VIP",
        description: "",
        total_price: 40,
        template_ids: ["tpl-3"],
      })
    ).toEqual({
      p_profile_id: "profile-1",
      p_org_id: "org-1",
      p_name: "Perfil VIP",
      p_description: null,
      p_total_price: 40,
      p_template_ids: ["tpl-3"],
    });
  });

  it("builds stable upserts for exam order settings", () => {
    expect(
      buildExamOrderUpserts("org-1", [
        { id: "tpl-1" },
        { id: "tpl-2" },
      ])
    ).toEqual([
      { org_id: "org-1", template_id: "tpl-1", custom_sort_order: 1 },
      { org_id: "org-1", template_id: "tpl-2", custom_sort_order: 2 },
    ]);
  });
});
