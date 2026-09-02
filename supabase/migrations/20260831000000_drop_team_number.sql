-- Remove `golf_teams.team_number`. It predates per-year team display names:
-- every team now gets a real name (`golf_teams.display_name` falling back to
-- `teams.name`), and Team Builder has hardcoded team_number to 0 on every new
-- team for a while now, so the column has carried no real information. It only
-- ever surfaced as a "Team #N" fallback label, which the app no longer uses.
--
-- CREATE OR REPLACE VIEW can only append columns to the end of an existing
-- view's column list, not remove one from the middle — so the two views that
-- select it are dropped and recreated instead.

drop view if exists public.leaderboard_view;
drop view if exists public.tee_times_view;

alter table public.golf_teams drop column if exists team_number;

create view public.leaderboard_view with (security_invoker='on') as
with player_ranked as (
  select
    gtp.team_id,
    gtp.handicap,
    row_number() over (partition by gtp.team_id order by gtp.handicap) as rn,
    count(*) over (partition by gtp.team_id) as player_count
  from public.golf_team_players gtp
  where gtp.handicap is not null
),
team_tier as (
  select pr.team_id, pr.rn, pr.handicap, tier.elem as tier
  from player_ranked pr
  join public.golf_teams gt on gt.id = pr.team_id
  join public.tournament_rules trl on trl.tournament_id = gt.tournament_id
  cross join lateral (
    select e as elem
    from jsonb_array_elements(coalesce(trl.handicap_formula -> 'tiers', '[]'::jsonb)) e
    where (e ->> 'players')::int = pr.player_count
    limit 1
  ) tier
  where coalesce((trl.handicap_formula ->> 'enabled')::boolean, false)
),
team_handicap as (
  select
    team_id,
    floor(
      sum(handicap * coalesce((tier -> 'weights' ->> (rn - 1)::int)::numeric, 0))
      + max(coalesce((tier ->> 'flat')::numeric, 0))
      + 0.5
    )::int as handicap
  from team_tier
  group by team_id
),
tournament_handicap as (
  select
    trl.tournament_id,
    coalesce((trl.handicap_formula ->> 'enabled')::boolean, false) as handicap_applied
  from public.tournament_rules trl
)
select
  gt.id as team_id,
  gt.tournament_id,
  tm.id as teams_id,
  coalesce(gt.display_name, tm.name) as team_name,
  tr.year as tournament_year,
  tr.teams_published_at,
  gt.total_score,
  gt.score_to_par,
  gt.status,
  gt."position",
  gt.is_tied,
  gt.updated_at,
  coalesce(
    json_agg(
      json_build_object(
        'name', gtp.player_name,
        'handicap', gtp.handicap,
        'order', gtp.player_order,
        'contact_id', gtp.contact_id
      ) order by gtp.player_order
    ) filter (where gtp.id is not null),
    '[]'::json
  ) as players,
  coalesce(th_year.handicap_applied, false) as handicap_applied,
  thc.handicap as team_handicap,
  case when thc.handicap is not null and gt.total_score is not null
    then gt.total_score - thc.handicap end as net_score,
  case when thc.handicap is not null and gt.score_to_par is not null
    then gt.score_to_par - thc.handicap end as net_to_par,
  coalesce(
    case when thc.handicap is not null then gt.score_to_par - thc.handicap end,
    gt.score_to_par
  ) as standings_to_par,
  tm.name as team_identity_name
from public.golf_teams gt
  join public.teams tm on tm.id = gt.team_id
  join public.tournaments tr on tr.id = gt.tournament_id and tr.deleted_at is null
  left join public.golf_team_players gtp on gtp.team_id = gt.id
  left join team_handicap thc on thc.team_id = gt.id
  left join tournament_handicap th_year on th_year.tournament_id = gt.tournament_id
where gt.deleted_at is null
group by
  gt.id, gt.tournament_id, tm.id, tm.name, gt.display_name, tr.year, tr.teams_published_at,
  gt.total_score, gt.score_to_par, gt.status, gt."position",
  gt.is_tied, gt.updated_at, th_year.handicap_applied, thc.handicap;

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
grant select on public.leaderboard_view to anon, authenticated, service_role;
grant select on public.tee_times_view to anon, authenticated, service_role;
