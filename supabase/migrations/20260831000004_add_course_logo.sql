-- Course logo shown on the scorecard, alongside the existing golf_course
-- name text field. Uploaded to the same public event-photos bucket other
-- admin image uploads already use.
alter table public.tournaments
  add column if not exists golf_course_logo_url text;

comment on column public.tournaments.golf_course_logo_url is
  'Public URL of the golf course logo, shown on the scorecard.';
