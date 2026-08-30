-- Net scoring on the leaderboard.
--
-- When a year applies a team handicap (see tournament_rules.handicap_formula,
-- added in 20260830000000), standings are decided by net score — gross minus the
-- team's handicap — and both numbers are shown. Years without a handicap are
-- unaffected: the new columns come back NULL and gross remains the standings score.
--
-- The handicap is COMPUTED here rather than stored on golf_teams on purpose. It's
-- a pure function of the roster's handicaps and that year's formula, both of which
-- an admin can edit at any time, so deriving it means the leaderboard can never
-- disagree with the team sheet or go stale after a handicap correction.
--
-- This mirrors src/utils/handicap.js exactly: weights pair with the team's
-- handicaps sorted lowest to highest, `flat` is added afterwards, and only the
-- final total is rounded with half-strokes up. Players with no handicap are
-- skipped, so a foursome where one player has no number is treated as a
-- three-player team — same as the builder shows.
--
-- Columns are appended after `players` so `create or replace` keeps the existing
-- shape (and the view's grants and RLS behaviour) intact.

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
  tm.name as team_name,
  tr.year as tournament_year,
  tr.teams_published_at,
  gt.team_number,
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
  -- Whether this year is played with a team handicap at all. Drives whether the
  -- public leaderboard shows one score column or two.
  coalesce(th_year.handicap_applied, false) as handicap_applied,
  -- The team's allowance in strokes; NULL when the year has no handicap or no
  -- player on the team has one.
  thc.handicap as team_handicap,
  case when thc.handicap is not null and gt.total_score is not null
    then gt.total_score - thc.handicap end as net_score,
  case when thc.handicap is not null and gt.score_to_par is not null
    then gt.score_to_par - thc.handicap end as net_to_par,
  -- The number standings are ranked by: net where a handicap applies, gross
  -- otherwise. Position calculation orders on this.
  coalesce(
    case when thc.handicap is not null then gt.score_to_par - thc.handicap end,
    gt.score_to_par
  ) as standings_to_par
from public.golf_teams gt
  join public.teams tm on tm.id = gt.team_id
  join public.tournaments tr on tr.id = gt.tournament_id and tr.deleted_at is null
  left join public.golf_team_players gtp on gtp.team_id = gt.id
  left join team_handicap thc on thc.team_id = gt.id
  left join tournament_handicap th_year on th_year.tournament_id = gt.tournament_id
where gt.deleted_at is null
group by
  gt.id, gt.tournament_id, tm.id, tm.name, tr.year, tr.teams_published_at,
  gt.team_number, gt.total_score, gt.score_to_par, gt.status, gt."position",
  gt.is_tied, gt.updated_at, th_year.handicap_applied, thc.handicap;
