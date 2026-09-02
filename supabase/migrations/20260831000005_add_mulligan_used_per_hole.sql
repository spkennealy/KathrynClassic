-- Which specific hole(s) a team used a mulligan on — separate from the
-- purchased count on golf_teams.mulligans_purchased (a team can buy more
-- than it uses). Defaults false so existing rows need no backfill.
alter table public.golf_hole_scores
  add column if not exists mulligan_used boolean not null default false;

comment on column public.golf_hole_scores.mulligan_used is
  'Whether the team used a mulligan on this hole.';
