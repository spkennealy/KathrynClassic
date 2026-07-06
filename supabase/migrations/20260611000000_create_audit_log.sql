-- audit_log: append-only record of admin mutations made in the portal, so the
-- organizer can see who changed what and when. Written client-side by
-- authenticated admins via the logAudit() helper (src/utils/audit.js) after each
-- successful mutation. Stores a full before/after diff (changes) plus the actor,
-- action, affected entity, and timestamp.
--
-- Unlike error_logs (service-role-written, no policies), this table is written by
-- authenticated admins, so it needs authenticated SELECT + INSERT policies. There
-- is deliberately no UPDATE/DELETE policy, which makes the table append-only by
-- construction.
--
-- Apply this via the Supabase dashboard SQL editor, or `supabase db push`.

create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid,                     -- auth.users.id of the admin who acted
  actor_email   text,                     -- denormalized for easy display
  action        text not null,            -- e.g. 'contact.updated' (see naming convention)
  entity_type   text not null,            -- e.g. 'contact', 'registration'
  entity_id     text,                     -- pk of the affected row (text: ids are uuid but text avoids casts)
  entity_label  text,                     -- human label, e.g. 'Jane Doe'
  changes       jsonb,                    -- { field: { from, to } } for updates; snapshot for create/delete
  metadata      jsonb,                    -- extra context (recipient_count, restored table, etc.)
  created_at    timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_entity_idx     on public.audit_log (entity_type, entity_id);
create index if not exists audit_log_actor_idx      on public.audit_log (actor_id);

alter table public.audit_log enable row level security;

-- All authenticated users are admins (no roles table). Let them read the full log
-- and append new entries. No UPDATE/DELETE policy => append-only by construction.
create policy "audit_log_authenticated_select"
  on public.audit_log for select
  to authenticated
  using (true);

create policy "audit_log_authenticated_insert"
  on public.audit_log for insert
  to authenticated
  with check (true);

grant select, insert on public.audit_log to authenticated;
