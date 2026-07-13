-- Tournament Rules: admin-editable rich-text rules, stored PER TOURNAMENT YEAR so
-- each year's rules are preserved as history. Shown publicly at /rules.
--
-- Follows the email_templates access pattern: authenticated users (admins) get full
-- CRUD; the public (anon) gets read-only so the public /rules page can fetch with
-- the anon key.
--
-- This migration is idempotent and also upgrades an earlier single-row version of
-- this table (adds tournament_id, back-fills, and enforces one row per tournament).

create table if not exists public.tournament_rules (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  body_html     text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Upgrade path: if the table pre-existed without tournament_id, add it.
alter table public.tournament_rules
  add column if not exists tournament_id uuid references public.tournaments(id) on delete cascade;

-- Attach any pre-existing global (year-less) row to the most recent tournament so
-- previously entered content isn't lost.
update public.tournament_rules tr
set tournament_id = (select id from public.tournaments order by year desc limit 1)
where tr.tournament_id is null
  and exists (select 1 from public.tournaments);

-- One rules row per tournament.
create unique index if not exists tournament_rules_tournament_id_key
  on public.tournament_rules (tournament_id);

alter table public.tournament_rules enable row level security;

drop policy if exists "Authenticated manage tournament_rules" on public.tournament_rules;
create policy "Authenticated manage tournament_rules" on public.tournament_rules
  for all to authenticated using (true) with check (true);

drop policy if exists "Public read tournament_rules" on public.tournament_rules;
create policy "Public read tournament_rules" on public.tournament_rules
  for select to anon using (true);

grant select on public.tournament_rules to anon;
grant select, insert, update, delete on public.tournament_rules to authenticated;

-- Set the 2026 rules: the general format plus the course-specific scramble and tee
-- rules (2026 is at the same course). This upserts, so re-running the file refreshes
-- the 2026 content. Once you're happy, manage it in Admin → Rules (re-running the file
-- would overwrite admin edits to 2026).
insert into public.tournament_rules (tournament_id, body_html)
select t.id, $html$
<h2>Format</h2>
<p>The Kathryn Classic is a 4-person scramble. Each golfer tees off on every hole, the team
selects the best shot, and all players then play their next shot from that spot. Repeat until
the ball is holed. The team records one score per hole.</p>

<h2>Scramble Rules</h2>
<ul>
  <li>The team must use at least one tee shot from each member per 9 holes (each player must have 2 tee shots used in the full 18).</li>
  <li>For shots off of the green, each player must play within a club length of where the ball came to rest.</li>
  <li>For shots on the green, each player must play within a putter's head of where the ball came to rest.</li>
  <li>All other rules will abide by <a href="https://www.usga.org/rules-hub.html">standard USGA rules</a>.</li>
</ul>

<h2>Applying Handicaps</h2>
<p>To keep things fair across skill levels, each team receives a handicap allowance based on the
combined handicaps of its players. The team handicap is deducted from the team's gross score to
determine the net score used for standings. If you don't have an official handicap, enter 20 on
your registration and we'll work with you.</p>

<h2>Award Holes</h2>
<p>Two special contests run during the round:</p>
<ul>
  <li><strong>Closest to the Pin:</strong> On designated par-3 holes, the player whose tee shot
  finishes closest to the hole wins.</li>
  <li><strong>Long Drive:</strong> On a designated hole, the longest drive that comes to rest in
  the fairway wins.</li>
</ul>

<h2>Buying Mulligans</h2>
<p>Mulligans (do-over shots) are available for purchase before your round, with all proceeds
supporting the CJD Foundation. Each player may buy a limited number of mulligans. Use a mulligan
to replay any shot — just let your team know before you take it.</p>

<h2>Tees</h2>
<ul>
  <li>Men under 60 will play from the gold tees.</li>
  <li>Women &amp; men over 60 can play from the green tees if preferred.</li>
</ul>
$html$
from public.tournaments t
where t.year = 2026
on conflict (tournament_id) do update
  set body_html = excluded.body_html,
      updated_at = now();

-- Preserve the 2025 rules as history (course-specific scramble + tee rules). The two
-- general scramble bullets from 2025 are intentionally omitted since they're covered
-- by the Format section. Admins can refine these (and add the tee-distances link) in
-- Admin → Rules → 2025.
insert into public.tournament_rules (tournament_id, body_html)
select t.id, $html$
<h2>Scramble Rules</h2>
<ul>
  <li>The team must use at least one tee shot from each member per 9 holes (each player must have 2 tee shots used in the full 18).</li>
  <li>For shots off of the green, each player must play within a club length of where the ball came to rest.</li>
  <li>For shots on the green, each player must play within a putter's head of where the ball came to rest.</li>
  <li>All other rules will abide by <a href="https://www.usga.org/rules-hub.html">standard USGA rules</a>.</li>
</ul>

<h2>Tees</h2>
<ul>
  <li>Men under 60 will play from the gold tees.</li>
  <li>Women &amp; men over 60 can play from the green tees if preferred.</li>
</ul>
$html$
from public.tournaments t
where t.year = 2025
  and not exists (select 1 from public.tournament_rules r where r.tournament_id = t.id);
