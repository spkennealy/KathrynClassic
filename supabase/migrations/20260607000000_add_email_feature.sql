-- Bulk email feature: lets the admin compose rich HTML emails to a filtered
-- audience, save reusable templates, and keep a history of everything sent.
--
--   email_templates           - saved, editable email templates
--   email_campaigns           - one row per send (subject/body/cc/bcc/status)
--   email_campaign_recipients - the resolved audience + per-recipient outcome
--
-- All authenticated users are admins (the app only has admin auth), so the
-- templates + campaigns tables are fully accessible to the `authenticated` role.
-- Recipient rows are written by the `send-bulk-email` edge function using the
-- service role, so authenticated users only need read access there.
--
-- Apply via the Supabase dashboard SQL editor, or `supabase db push`.

-- Templates -----------------------------------------------------------------
create table if not exists public.email_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  subject     text not null default '',
  body_html   text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz                       -- soft delete, matches app convention
);

create index if not exists email_templates_deleted_at_idx on public.email_templates (deleted_at);

-- Campaigns -----------------------------------------------------------------
create table if not exists public.email_campaigns (
  id               uuid primary key default gen_random_uuid(),
  subject          text not null default '',
  body_html        text not null default '',
  cc               text[] not null default '{}',
  bcc              text[] not null default '{}',
  recipient_count  integer not null default 0,
  status           text not null default 'sending',  -- sending | sent | partial | failed
  sent_by          uuid references auth.users(id) on delete set null,
  error            text,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);

create index if not exists email_campaigns_created_at_idx on public.email_campaigns (created_at desc);

-- Per-recipient log ---------------------------------------------------------
create table if not exists public.email_campaign_recipients (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.email_campaigns(id) on delete cascade,
  email        text not null,
  name         text,
  status       text not null default 'sent',   -- sent | failed
  error        text,
  created_at   timestamptz not null default now()
);

create index if not exists email_campaign_recipients_campaign_id_idx
  on public.email_campaign_recipients (campaign_id);

-- RLS -----------------------------------------------------------------------
alter table public.email_templates enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_campaign_recipients enable row level security;

-- Templates: authenticated admins have full CRUD.
drop policy if exists "Authenticated manage email_templates" on public.email_templates;
create policy "Authenticated manage email_templates" on public.email_templates
  for all to authenticated using (true) with check (true);

-- Campaigns: authenticated admins can read history and create the initial row
-- (the edge function later updates status via the service role).
drop policy if exists "Authenticated read email_campaigns" on public.email_campaigns;
create policy "Authenticated read email_campaigns" on public.email_campaigns
  for select to authenticated using (true);

drop policy if exists "Authenticated insert email_campaigns" on public.email_campaigns;
create policy "Authenticated insert email_campaigns" on public.email_campaigns
  for insert to authenticated with check (true);

-- Recipient rows are inserted by the service role; authenticated only reads them.
drop policy if exists "Authenticated read email_campaign_recipients" on public.email_campaign_recipients;
create policy "Authenticated read email_campaign_recipients" on public.email_campaign_recipients
  for select to authenticated using (true);

-- Grants ---------------------------------------------------------------------
-- RLS controls which ROWS a role can touch, but the role still needs table-level
-- privileges. Tables created in the dashboard get these automatically; tables
-- created from raw SQL do not, so grant them explicitly. (The service role used
-- by the edge function bypasses both grants and RLS.)
grant select, insert, update, delete on public.email_templates to authenticated;
grant select, insert on public.email_campaigns to authenticated;
grant select on public.email_campaign_recipients to authenticated;
