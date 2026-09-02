-- The hole's handicap/difficulty ranking (a.k.a. stroke index): 1 = hardest
-- hole, 18 = easiest. This is what the Rules page means by "hole handicap on
-- the scorecard" when describing how a team's strokes get allocated. Stored
-- alongside par so the course layout table is a real scorecard, not just pars.
-- Nullable: existing tournament_holes rows (par only) don't need backfilling,
-- and this isn't wired into the net-score engine yet — it's reference data
-- entered and shown on the scorecard for now.
alter table public.tournament_holes
  add column if not exists stroke_index integer check (stroke_index between 1 and 18);

comment on column public.tournament_holes.stroke_index is
  'Hole difficulty ranking (1 = hardest, 18 = easiest), used to allocate handicap strokes.';
