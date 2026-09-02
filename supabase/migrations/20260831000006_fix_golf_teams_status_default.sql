-- golf_teams.status defaulted to 'F' (Finished), so a newly-created team with
-- no score ever entered would still show "Finished" in the admin. Drop the
-- default so a team's status starts genuinely unset, and back-fill existing
-- rows that never actually played (no gross score) back to null.
alter table public.golf_teams
  alter column status drop default;

update public.golf_teams
  set status = null
  where status = 'F' and total_score is null;
