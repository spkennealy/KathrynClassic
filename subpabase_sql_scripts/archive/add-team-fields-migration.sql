-- Add fields for golf team preferences and team grouping
-- Run this SQL in your Supabase SQL Editor

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS preferred_teammates TEXT,
  ADD COLUMN IF NOT EXISTS team_group_id UUID;

-- Create index on team_group_id for faster lookups of team members
CREATE INDEX IF NOT EXISTS idx_registrations_team_group_id ON registrations(team_group_id);

COMMENT ON COLUMN registrations.preferred_teammates IS 'Comma-separated list of preferred teammates for golf tournament';
COMMENT ON COLUMN registrations.team_group_id IS 'UUID linking registrations that were submitted together as a team';
