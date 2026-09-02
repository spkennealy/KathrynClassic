-- Mulligan usage per hole is now a count (a team can burn more than one
-- mulligan on the same hole), not just a flag. This feature shipped only
-- this session and never reached prod with real data, so replace outright
-- rather than migrate the boolean forward.
alter table public.golf_hole_scores drop column if exists mulligan_used;

alter table public.golf_hole_scores
  add column if not exists mulligans_used integer not null default 0 check (mulligans_used >= 0);

comment on column public.golf_hole_scores.mulligans_used is
  'How many mulligans the team used on this hole.';
