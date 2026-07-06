-- Fix: the send-bulk-email edge function (running as the `service_role`) was
-- getting "permission denied for schema public" (SQLSTATE 42501) when writing
-- campaign status + recipient logs. The email tables were created from raw SQL
-- and only granted to `authenticated`, so `service_role` never received the
-- table privileges it needs. Grant them explicitly.
--
-- Safe/idempotent to re-run. Apply via `supabase db push` or the SQL editor.

grant usage on schema public to service_role;

grant all on public.contacts                    to service_role;
grant all on public.email_campaigns             to service_role;
grant all on public.email_campaign_recipients   to service_role;
grant all on public.email_templates             to service_role;
grant all on public.email_unsubscribes          to service_role;
