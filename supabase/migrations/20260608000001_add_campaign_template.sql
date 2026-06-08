-- Record which saved template (if any) a campaign was sent from, so the email
-- history can show it. template_name is a snapshot taken at send time so the
-- history stays meaningful even if the template is later renamed or deleted.
--
-- Apply via the Supabase dashboard SQL editor, or `supabase db push`.

alter table public.email_campaigns
  add column if not exists template_id   uuid references public.email_templates(id) on delete set null,
  add column if not exists template_name text;
