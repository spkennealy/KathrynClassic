-- Extend tournament_awards with the fields the admin "Add Award" form collects:
--   award_date  - the date the award was given out
--   event_id    - optional link to a specific event from that year's tournament
--   photo_url    - optional photo of the award / winner
-- The award's description is stored in the existing `details` column, and the
-- winner in the existing contact_id / winner_name columns.
--
-- Award photos are uploaded to the existing public `event-photos` storage bucket
-- (filenames are prefixed `award-`), so no new bucket or policies are needed.
--
-- Apply via the Supabase dashboard SQL editor, or `supabase db push`.

alter table public.tournament_awards
  add column if not exists award_date date,
  add column if not exists event_id   uuid references public.tournament_events(id) on delete set null,
  add column if not exists photo_url   text;

create index if not exists tournament_awards_event_id_idx on public.tournament_awards (event_id);
