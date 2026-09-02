-- Optional "scratch to lowest" adjustment on top of the team handicap formula.
--
-- Some years, rather than using each team's formula handicap as-is, the field is
-- compared to its strongest team: the lowest team handicap in the tournament is
-- set to 0 (scratch), and that same number of strokes is subtracted from every
-- other team's handicap. This is a separate per-year toggle from the formula
-- itself — tournament_rules.handicap_formula -> 'scratch_to_lowest' (boolean,
-- default/missing = off) — so it can be turned on or off without touching the
-- weights. See src/utils/handicap.js for the JS-side documentation.
--
-- It only makes sense computed across every team in a tournament at once, so it
-- can't live in the per-team computeTeamHandicap() helper (mirrored below in
-- team_handicap_raw) the way the rest of the formula does. It's applied here
-- instead, where all of a tournament's teams are already gathered: a window
-- function finds the field's minimum handicap and every team's is reduced by it.
-- net_score / net_to_par / standings_to_par all read the adjusted number, so the
-- adjustment feeds straight into scoring and position, not just display.
--
-- Also adds team_handicap_raw (the formula number before the adjustment) and a
-- scratch_to_lowest flag, purely for display, so the leaderboard can show
-- "raw -> adjusted" instead of just the adjusted result.
--
-- Builds on top of the view as of 20260831000001 (drop_team_number +
-- add_mulligans_purchased) — no team_number, name resolved via display_name,
-- team_identity_name and mulligans_purchased included. Uses DROP + CREATE
-- (like 20260831000000 did) rather than CREATE OR REPLACE, so this doesn't
-- depend on knowing the live view's exact current column order.

drop view if exists public.leaderboard_view;

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
team_handicap_raw as (
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
-- Scratch adjustment: when a tournament's formula turns it on, every team's
-- handicap is reduced by the field's lowest handicap, so the lowest team lands
-- on 0. Off (the default) leaves team_handicap_raw untouched.
team_handicap as (
  select
    thr.team_id,
    case
      when coalesce((trl.handicap_formula ->> 'scratch_to_lowest')::boolean, false)
        then thr.handicap - min(thr.handicap) over (partition by gt.tournament_id)
      else thr.handicap
    end as handicap
  from team_handicap_raw thr
  join public.golf_teams gt on gt.id = thr.team_id
  join public.tournament_rules trl on trl.tournament_id = gt.tournament_id
),
tournament_handicap as (
  select
    trl.tournament_id,
    coalesce((trl.handicap_formula ->> 'enabled')::boolean, false) as handicap_applied,
    coalesce((trl.handicap_formula ->> 'scratch_to_lowest')::boolean, false) as scratch_to_lowest
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
  -- Whether this year is played with a team handicap at all. Drives whether the
  -- public leaderboard shows one score column or two.
  coalesce(th_year.handicap_applied, false) as handicap_applied,
  -- The team's allowance in strokes; NULL when the year has no handicap or no
  -- player on the team has one. Already reflects the scratch-to-lowest
  -- adjustment below when that's turned on — this is the number net_score,
  -- net_to_par and standings_to_par are actually scored off of.
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
  ) as standings_to_par,
  -- The identity's own name, for admin screens that show both.
  tm.name as team_identity_name,
  gt.mulligans_purchased,
  -- Whether this year additionally scratches the field's lowest team to 0.
  -- Drives whether the leaderboard shows team_handicap_raw alongside
  -- team_handicap or just the one number.
  coalesce(th_year.scratch_to_lowest, false) as scratch_to_lowest,
  -- The team's allowance before the scratch-to-lowest adjustment above. Equal
  -- to team_handicap whenever scratch_to_lowest is off. Display only — not
  -- used for scoring.
  thr2.handicap as team_handicap_raw
from public.golf_teams gt
  join public.teams tm on tm.id = gt.team_id
  join public.tournaments tr on tr.id = gt.tournament_id and tr.deleted_at is null
  left join public.golf_team_players gtp on gtp.team_id = gt.id
  left join team_handicap thc on thc.team_id = gt.id
  left join team_handicap_raw thr2 on thr2.team_id = gt.id
  left join tournament_handicap th_year on th_year.tournament_id = gt.tournament_id
where gt.deleted_at is null
group by
  gt.id, gt.tournament_id, tm.id, tm.name, gt.display_name, tr.year, tr.teams_published_at,
  gt.total_score, gt.score_to_par, gt.status, gt."position",
  gt.is_tied, gt.updated_at, th_year.handicap_applied, th_year.scratch_to_lowest,
  thc.handicap, thr2.handicap, gt.mulligans_purchased;

-- DROP VIEW removes the previous grants along with it — reinstate them.
grant select on public.leaderboard_view to anon, authenticated, service_role;
