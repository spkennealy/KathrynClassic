-- Full hole-by-hole scorecards.
--
-- tournament_holes: this year's course layout (one row per hole, 1-18) — just
-- the par, so a strokes-vs-par mark (birdie/bogey/etc.) can be drawn on the
-- scorecard. Scoped per tournament since the course/tees can change year to
-- year, though in practice an admin will usually copy last year's forward.
--
-- golf_hole_scores: each team's actual strokes per hole. golf_teams.total_score
-- and score_to_par remain the aggregate fields every other view/page reads —
-- they're recomputed from these rows whenever a scorecard is saved, so the
-- public leaderboard and leaderboard_view need no changes at all.

create table if not exists public.tournament_holes (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 18),
  par integer not null check (par between 3 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, hole_number)
);

comment on table public.tournament_holes is
  'This tournament year''s course layout: one row per hole with its par.';

alter table public.tournament_holes enable row level security;

create policy "Allow public reads on tournament_holes"
  on public.tournament_holes for select
  to anon
  using (true);

create policy "Allow authenticated users to manage tournament_holes"
  on public.tournament_holes for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.golf_hole_scores (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.golf_teams(id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 18),
  strokes integer check (strokes between 1 and 15),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, hole_number)
);

comment on table public.golf_hole_scores is
  'A team''s strokes on each hole. Summed into golf_teams.total_score/score_to_par on save.';

create index if not exists idx_golf_hole_scores_team on public.golf_hole_scores(team_id);

alter table public.golf_hole_scores enable row level security;

create policy "Allow authenticated users to manage golf_hole_scores"
  on public.golf_hole_scores for all
  to authenticated
  using (true)
  with check (true);

-- Mirrors the existing tee_times policy shape: the public only sees hole
-- scores for a team once that team's tournament has published its teams.
create policy "Public reads published golf_hole_scores"
  on public.golf_hole_scores for select
  to anon
  using (
    exists (
      select 1
      from public.golf_teams gt
      join public.tournaments t on t.id = gt.tournament_id
      where gt.id = golf_hole_scores.team_id
        and gt.deleted_at is null
        and t.deleted_at is null
        and t.teams_published_at is not null
    )
  );
