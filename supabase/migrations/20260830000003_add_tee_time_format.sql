-- Tee time format (standard vs shotgun) lives on the tournament_event rather
-- than the tournament itself: it's a property of how that specific round's
-- tee times are organized, not the tournament year as a whole.
--
-- standard: everyone starts from hole 1, staggered tee times (2025 format).
-- shotgun:  everyone starts simultaneously from a different hole (2026+).
alter table tournament_events
  add column if not exists tee_time_format text not null default 'standard'
    check (tee_time_format in ('standard', 'shotgun'));

comment on column tournament_events.tee_time_format is
  'How this event''s tee times are organized: standard (staggered times, everyone on hole 1) or shotgun (simultaneous start, different holes).';
