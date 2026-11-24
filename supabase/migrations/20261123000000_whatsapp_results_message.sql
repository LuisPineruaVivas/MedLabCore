-- Each lab can write the WhatsApp message sent with the results link.
-- Null/empty keeps the default text; the link is always appended by the app.
alter table public.organizations
  add column if not exists whatsapp_results_message text
  constraint organizations_whatsapp_results_message_length check (char_length(whatsapp_results_message) <= 500);
