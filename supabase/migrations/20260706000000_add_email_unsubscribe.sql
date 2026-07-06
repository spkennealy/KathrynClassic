-- Email unsubscribe support.
--
-- Every bulk email sent from the admin Communications page now includes an
-- unsubscribe link. The link carries a per-contact secret token; the public
-- unsubscribe page lets the recipient opt out of EITHER a single tournament
-- year's emails OR all future emails. Recording the choice updates the contact
-- so the send function (and the recipient picker) suppress them going forward.
--
-- Adds:
--   contacts.unsubscribe_token   - stable per-contact secret used in email links
--   contacts.unsubscribed_all    - true  => never email again
--   contacts.unsubscribed_years  - int[] => years the contact opted out of
--   email_campaigns.tournament_year - the year a campaign is "about"
--   email_unsubscribes           - audit log of opt-out events
--   unsubscribe_by_token()       - SECURITY DEFINER RPC the public page calls
--
-- Apply via the Supabase dashboard SQL editor, or `supabase db push`.

-- Contacts: token + opt-out state --------------------------------------------
alter table public.contacts
  add column if not exists unsubscribe_token  uuid,
  add column if not exists unsubscribed_all   boolean not null default false,
  add column if not exists unsubscribed_years integer[] not null default '{}';

-- Backfill a unique token for every existing contact, then lock the column
-- down (default fills new rows; gen_random_uuid() is volatile so each row gets
-- its own value).
update public.contacts set unsubscribe_token = gen_random_uuid() where unsubscribe_token is null;

alter table public.contacts
  alter column unsubscribe_token set default gen_random_uuid(),
  alter column unsubscribe_token set not null;

create unique index if not exists contacts_unsubscribe_token_idx
  on public.contacts (unsubscribe_token);

-- Campaigns: which tournament year the email is about -------------------------
alter table public.email_campaigns
  add column if not exists tournament_year integer;

-- Audit log of opt-out events ------------------------------------------------
create table if not exists public.email_unsubscribes (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  scope       text not null default 'all',   -- 'all' | 'year'
  year        integer,                        -- set when scope = 'year'
  created_at  timestamptz not null default now()
);

create index if not exists email_unsubscribes_contact_id_idx
  on public.email_unsubscribes (contact_id);

alter table public.email_unsubscribes enable row level security;

drop policy if exists "Authenticated read email_unsubscribes" on public.email_unsubscribes;
create policy "Authenticated read email_unsubscribes" on public.email_unsubscribes
  for select to authenticated using (true);

grant select on public.email_unsubscribes to authenticated;

-- Public unsubscribe RPC -----------------------------------------------------
-- Called by the public /unsubscribe page (anon role) with the contact's secret
-- token. SECURITY DEFINER so it can update the contact without exposing the
-- contacts table to anon. Returns a small JSON result the page can display.
create or replace function public.unsubscribe_by_token(
  p_token uuid,
  p_scope text default 'all',
  p_year  integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact public.contacts%rowtype;
begin
  select * into v_contact
    from public.contacts
   where unsubscribe_token = p_token
     and deleted_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if p_scope = 'all' then
    update public.contacts
       set unsubscribed_all = true, updated_at = now()
     where id = v_contact.id;
  elsif p_scope = 'year' then
    if p_year is null then
      return jsonb_build_object('ok', false, 'error', 'year_required');
    end if;
    update public.contacts
       set unsubscribed_years = (
             select array_agg(distinct y)
               from unnest(unsubscribed_years || array[p_year]) as y
           ),
           updated_at = now()
     where id = v_contact.id;
  else
    return jsonb_build_object('ok', false, 'error', 'invalid_scope');
  end if;

  insert into public.email_unsubscribes (contact_id, scope, year)
    values (v_contact.id, p_scope, case when p_scope = 'year' then p_year else null end);

  return jsonb_build_object(
    'ok', true,
    'scope', p_scope,
    'year', p_year,
    'email', v_contact.email
  );
end;
$$;

grant execute on function public.unsubscribe_by_token(uuid, text, integer) to anon, authenticated;
