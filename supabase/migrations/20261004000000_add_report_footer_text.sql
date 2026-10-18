-- Add report_footer_text column to organizations
-- This allows each laboratory to customize the footer text shown at the bottom of PDF reports.
-- If the value is NULL or empty, no footer is rendered.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS report_footer_text text;
