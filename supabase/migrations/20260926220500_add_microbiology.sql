-- Add result_type to test_templates
ALTER TABLE test_templates 
  ADD COLUMN IF NOT EXISTS result_type TEXT NOT NULL DEFAULT 'STANDARD';

ALTER TABLE test_templates 
  DROP CONSTRAINT IF EXISTS test_templates_result_type_check;
  
ALTER TABLE test_templates 
  ADD CONSTRAINT test_templates_result_type_check 
  CHECK (result_type IN ('STANDARD', 'MICROBIOLOGY'));

-- Create antibiotics table (org_id is NULLable for global base antibiotics)
CREATE TABLE IF NOT EXISTS antibiotics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE antibiotics ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Read global (org_id IS NULL) or organization-specific antibiotics
DROP POLICY IF EXISTS "org_members_can_read_antibiotics" ON antibiotics;
CREATE POLICY "org_members_can_read_antibiotics" ON antibiotics
  FOR SELECT USING (org_id IS NULL OR org_id = get_my_org_id());

DROP POLICY IF EXISTS "lab_staff_can_manage_antibiotics" ON antibiotics;
CREATE POLICY "lab_staff_can_manage_antibiotics" ON antibiotics
  FOR ALL USING (org_id = get_my_org_id());
