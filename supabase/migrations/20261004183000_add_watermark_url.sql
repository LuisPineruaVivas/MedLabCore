-- Add watermark_url column to organizations
-- This allows each laboratory to upload a background image for their PDF reports.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS watermark_url text;
