-- Add child_counts field to store number of children per event
-- Run this SQL in your Supabase SQL Editor

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS child_counts JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN registrations.child_counts IS 'JSON object mapping event_type to number of children, e.g., {"welcome_dinner": 2, "beach_day": 1}';

-- Create index for querying child counts
CREATE INDEX IF NOT EXISTS idx_registrations_child_counts ON registrations USING gin(child_counts);
