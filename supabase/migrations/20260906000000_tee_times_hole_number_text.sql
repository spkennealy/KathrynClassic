-- Starting hole needs to hold shotgun-start labels like "1A"/"1B" (a hole
-- split into two simultaneous groups), not just a plain hole number, so
-- tee_times.hole_number becomes free text instead of integer.
--
-- tee_times_view selects the column, and Postgres won't let a column's type
-- change out from under a view that depends on it, so drop and recreate that
-- view around the alter. (leaderboard_view doesn't touch tee_times, so it's
-- untouched.)

drop view if exists public.tee_times_view;

-- Drop any check constraint on hole_number (e.g. a numeric range check) before
-- widening it to text. The table lives outside these migrations, so its
-- constraint name is unknown — find it dynamically instead of hardcoding one.
do $$
declare
  found_con record;
begin
  for found_con in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'tee_times'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%hole_number%'
  loop
    execute format('alter table public.tee_times drop constraint %I', found_con.conname);
  end loop;
end $$;

alter table public.tee_times
  alter column hole_number type text using hole_number::text;

create view public.tee_times_view with (security_invoker='on') as
select
  tt.id as tee_time_id,
  tt.tournament_id,
  tt.tournament_event_id,
  tt.team_id,
  tt.tee_time,
  tt.hole_number,
  tt.notes,
  tt.updated_at,
  coalesce(gt.display_name, tm.name) as team_name,
  te.event_name,
  te.event_date,
  coalesce(
    json_agg(
      json_build_object('player_name', gtp.player_name, 'player_order', gtp.player_order)
      order by gtp.player_order
    ) filter (where gtp.id is not null),
    '[]'::json
  ) as players
from public.tee_times tt
  left join public.golf_teams gt on gt.id = tt.team_id and gt.deleted_at is null
  left join public.teams tm on tm.id = gt.team_id
  left join public.tournament_events te on te.id = tt.tournament_event_id
  left join public.golf_team_players gtp on gtp.team_id = gt.id
group by
  tt.id, tt.tournament_id, tt.tournament_event_id, tt.team_id, tt.tee_time,
  tt.hole_number, tt.notes, tt.updated_at, gt.display_name, tm.name,
  te.event_name, te.event_date;

-- DROP VIEW removes the previous grants along with it — reinstate them.
grant select on public.tee_times_view to anon, authenticated, service_role;
