-- error_logs: captures client-side failures (e.g. registration submit errors)
-- so the organizer has server-side visibility into problems users hit.
--
-- Apply this via the Supabase dashboard SQL editor, or `supabase db push`.

create table if not exists public.error_logs (
  id            uuid primary key default gen_random_uuid(),
  reference_id  text not null,            -- short code shown to the user (e.g. "K7P2QX")
  context       text,                     -- where it happened, e.g. 'registration_submit'
  message       text,                     -- err.message
  error_code    text,                     -- supabase/postgres error code if present
  details       text,                     -- supabase error details
  hint          text,                     -- supabase error hint
  stack         text,                     -- JS stack trace
  payload       jsonb,                    -- sanitized context (no secrets)
  user_agent    text,
  url           text,
  created_at    timestamptz not null default now()
);

create index if not exists error_logs_created_at_idx on public.error_logs (created_at desc);
create index if not exists error_logs_reference_id_idx on public.error_logs (reference_id);

-- Lock the table down. Inserts happen ONLY through the `report-error` edge
-- function using the service role (which bypasses RLS), so we deliberately add
-- no anon/authenticated policies — the public form can't write here directly,
-- which prevents the public registration page from being a spam vector.
alter table public.error_logs enable row level security;
