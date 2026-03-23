
ALTER TABLE public.organizations
  ADD COLUMN country text,
  ADD COLUMN state text,
  ADD COLUMN city text,
  ADD COLUMN address text,
  ADD COLUMN subscription_active boolean NOT NULL DEFAULT true;
