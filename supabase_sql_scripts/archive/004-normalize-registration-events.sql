-- =====================================================
-- PHASE 4: Normalize Registration Events
-- This migration creates a join table for registration-event
-- relationships, moving away from events array and child_counts JSONB
-- =====================================================

-- ⚠️ Run this after Phase 1, 2, and 3 are complete and stable
-- ⚠️ Deploy updated application code before running this migration

-- =====================================================
-- CREATE REGISTRATION_EVENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS registration_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id UUID REFERENCES registrations(id) ON DELETE CASCADE NOT NULL,
  tournament_event_id UUID REFERENCES tournament_events(id) ON DELETE CASCADE NOT NULL,
  child_count INTEGER DEFAULT 0 CHECK (child_count >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate entries for same registration + event
  UNIQUE(registration_id, tournament_event_id)
);

-- =====================================================
-- CREATE INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_registration_events_registration_id
  ON registration_events(registration_id);

CREATE INDEX IF NOT EXISTS idx_registration_events_tournament_event_id
  ON registration_events(tournament_event_id);

CREATE INDEX IF NOT EXISTS idx_registration_events_created_at
  ON registration_events(created_at DESC);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE registration_events ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================
-- Allow public to insert (for registration submissions)
CREATE POLICY "Allow public to insert registration_events"
ON registration_events
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow authenticated users to view all
CREATE POLICY "Allow authenticated users to view registration_events"
ON registration_events
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update
CREATE POLICY "Allow authenticated users to update registration_events"
ON registration_events
FOR UPDATE
TO authenticated
USING (true);

-- Allow authenticated users to delete
CREATE POLICY "Allow authenticated users to delete registration_events"
ON registration_events
FOR DELETE
TO authenticated
USING (true);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT INSERT ON registration_events TO anon;
GRANT SELECT, UPDATE, DELETE ON registration_events TO authenticated;

-- =====================================================
-- MIGRATE EXISTING DATA
-- =====================================================

-- Step 1: Migrate data from events array and child_counts JSONB
-- This assumes registrations have both 'events' and 'child_counts' fields

DO $$
DECLARE
  reg_record RECORD;
  event_type_val TEXT;
  event_id UUID;
  child_count_val INTEGER;
BEGIN
  -- Loop through each registration
  FOR reg_record IN
    SELECT id, events, child_counts, tournament_id
    FROM registrations
    WHERE events IS NOT NULL
      AND array_length(events, 1) > 0
  LOOP
    -- Loop through each event in the events array
    FOREACH event_type_val IN ARRAY reg_record.events
    LOOP
      -- Look up the tournament_event_id based on event_type and tournament_id
      SELECT te.id INTO event_id
      FROM tournament_events te
      WHERE te.event_type = event_type_val
        AND te.tournament_id = reg_record.tournament_id
      LIMIT 1;

      IF event_id IS NOT NULL THEN
        -- Get child count from JSONB (default to 0 if not present)
        child_count_val := COALESCE(
          (reg_record.child_counts->event_type_val)::INTEGER,
          0
        );

        -- Insert into registration_events
        INSERT INTO registration_events (
          registration_id,
          tournament_event_id,
          child_count
        )
        VALUES (
          reg_record.id,
          event_id,
          child_count_val
        )
        ON CONFLICT (registration_id, tournament_event_id) DO NOTHING;

      ELSE
        RAISE NOTICE 'Could not find tournament_event for registration % with event_type % and tournament_id %',
          reg_record.id, event_type_val, reg_record.tournament_id;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Migration complete!';
END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check all registrations have corresponding registration_events
DO $$
DECLARE
  total_registrations INTEGER;
  registrations_with_events INTEGER;
  registrations_without_events INTEGER;
BEGIN
  -- Count total registrations with events
  SELECT COUNT(*) INTO total_registrations
  FROM registrations
  WHERE events IS NOT NULL AND array_length(events, 1) > 0;

  -- Count registrations that have registration_events
  SELECT COUNT(DISTINCT registration_id) INTO registrations_with_events
  FROM registration_events;

  registrations_without_events := total_registrations - registrations_with_events;

  RAISE NOTICE 'Registrations with events array: %', total_registrations;
  RAISE NOTICE 'Registrations with registration_events: %', registrations_with_events;
  RAISE NOTICE 'Missing registration_events: %', registrations_without_events;

  IF registrations_without_events > 0 THEN
    RAISE WARNING 'Some registrations were not migrated to registration_events!';
  ELSE
    RAISE NOTICE 'All registrations successfully migrated to registration_events';
  END IF;
END $$;

-- Verify event counts match
DO $$
DECLARE
  events_array_count INTEGER;
  registration_events_count INTEGER;
BEGIN
  -- Count total events from events array
  SELECT SUM(array_length(events, 1)) INTO events_array_count
  FROM registrations
  WHERE events IS NOT NULL;

  -- Count registration_events records
  SELECT COUNT(*) INTO registration_events_count
  FROM registration_events;

  RAISE NOTICE 'Total events in arrays: %', events_array_count;
  RAISE NOTICE 'Total registration_events records: %', registration_events_count;

  IF events_array_count != registration_events_count THEN
    RAISE WARNING 'Event counts do not match! Difference: %',
      ABS(events_array_count - registration_events_count);
  ELSE
    RAISE NOTICE 'Event counts match perfectly!';
  END IF;
END $$;

-- Sample comparison of old vs new structure
SELECT
  r.id as registration_id,
  c.email,
  c.first_name,
  c.last_name,
  r.events as old_events_array,
  r.child_counts as old_child_counts_json,
  ARRAY_AGG(te.event_type) as new_events_from_join,
  JSONB_OBJECT_AGG(te.event_type, re.child_count) as new_child_counts_from_join
FROM registrations r
JOIN contacts c ON r.contact_id = c.id
LEFT JOIN registration_events re ON re.registration_id = r.id
LEFT JOIN tournament_events te ON re.tournament_event_id = te.id
WHERE r.events IS NOT NULL
GROUP BY r.id, c.email, c.first_name, c.last_name, r.events, r.child_counts
LIMIT 10;

-- =====================================================
-- CREATE USEFUL VIEWS
-- =====================================================

-- View for registration details with events
CREATE OR REPLACE VIEW registration_details AS
SELECT
  r.id as registration_id,
  r.tournament_id,
  c.id as contact_id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  re.id as registration_event_id,
  te.id as tournament_event_id,
  te.event_name,
  te.event_type,
  te.event_date,
  re.child_count,
  r.golf_handicap,
  r.preferred_teammates,
  r.team_group_id,
  r.payment_status,
  r.created_at as registration_date
FROM registrations r
JOIN contacts c ON r.contact_id = c.id
LEFT JOIN registration_events re ON re.registration_id = r.id
LEFT JOIN tournament_events te ON re.tournament_event_id = te.id
ORDER BY r.created_at DESC, te.event_date;

-- View for event attendance summary
CREATE OR REPLACE VIEW event_attendance_summary AS
SELECT
  t.year as tournament_year,
  te.event_name,
  te.event_type,
  te.event_date,
  COUNT(DISTINCT re.registration_id) as adult_count,
  SUM(re.child_count) as child_count,
  COUNT(DISTINCT re.registration_id) + SUM(re.child_count) as total_attendees,
  te.adult_price,
  te.child_price,
  (COUNT(DISTINCT re.registration_id) * te.adult_price) +
    (SUM(re.child_count) * te.child_price) as estimated_revenue
FROM tournament_events te
JOIN tournaments t ON te.tournament_id = t.id
LEFT JOIN registration_events re ON re.tournament_event_id = te.id
GROUP BY t.id, t.year, te.id, te.event_name, te.event_type, te.event_date, te.adult_price, te.child_price
ORDER BY t.year DESC, te.event_date;

-- Grant access to views
GRANT SELECT ON registration_details TO authenticated;
GRANT SELECT ON event_attendance_summary TO authenticated, anon;

-- =====================================================
-- POST-MIGRATION NOTES
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=== Phase 4 Migration Complete ===';
  RAISE NOTICE 'Created registration_events table';
  RAISE NOTICE 'Migrated data from events array and child_counts JSONB';
  RAISE NOTICE 'Created registration_details and event_attendance_summary views';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Verify all data migrated correctly (run verification queries above)';
  RAISE NOTICE '2. Test application with new structure';
  RAISE NOTICE '3. After 1-2 weeks, run Phase 5 to drop old columns (events, child_counts)';
END $$;
