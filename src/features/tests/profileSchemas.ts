// ── Exam Profile types ──────────────────────────────────────

export interface ExamProfileRow {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  total_price: number;
  is_active: boolean;
  created_at: string;
}

export interface ProfileTemplateJunction {
  id: string;
  profile_id: string;
  template_id: string;
}

/** Profile with its linked template IDs (from junction) */
export interface ProfileWithTemplates extends ExamProfileRow {
  profile_templates_junction: {
    template_id: string;
    test_templates: {
      id: string;
      name: string;
      category: string;
      base_price: number;
      schema: any;
    };
  }[];
}
