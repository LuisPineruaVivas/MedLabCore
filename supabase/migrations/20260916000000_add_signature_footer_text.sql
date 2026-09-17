ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature_footer_text text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS signature_footer_text text;
