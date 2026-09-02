-- How many mulligans a team bought this year (see Rules → Buying Mulligans).
-- Tracked per team, entered by admins on the Leaderboard Management screen
-- alongside the score.
alter table public.golf_teams
  add column if not exists mulligans_purchased integer not null default 0;

comment on column public.golf_teams.mulligans_purchased is
  'Number of mulligans this team purchased for the round.';

-- Appending a column to the end of an existing view's select list is fine for
-- CREATE OR REPLACE VIEW (only removing/reordering existing columns isn't).
create or replace view public.leaderboard_view with (security_invoker='on') as
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
  tm.name as team_identity_name,
  gt.mulligans_purchased
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
  gt.is_tied, gt.updated_at, th_year.handicap_applied, thc.handicap, gt.mulligans_purchased;
