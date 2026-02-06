-- =====================================================
-- PHASE 5: Drop Old Event Columns (Breaking Change)
-- This migration removes the old events array and child_counts
-- JSONB columns after migration to registration_events table
-- =====================================================

-- ⚠️  WARNING: This is a BREAKING CHANGE
-- ⚠️  Ensure Phase 4 is complete and verified
-- ⚠️  Deploy updated application code before running this migration
-- ⚠️  Wait 1-2 weeks after Phase 4 before running this

-- =====================================================
-- FINAL VERIFICATION BEFORE DROPPING COLUMNS
-- =====================================================

-- Verify all registrations have registration_events
DO $$
DECLARE
  registrations_count INTEGER;
  registrations_with_events_count INTEGER;
  missing_count INTEGER;
BEGIN
  -- Count registrations
  SELECT COUNT(*) INTO registrations_count FROM registrations;

  -- Count registrations with registration_events
  SELECT COUNT(DISTINCT registration_id) INTO registrations_with_events_count
  FROM registration_events;

  missing_count := registrations_count - registrations_with_events_count;

  RAISE NOTICE 'Total registrations: %', registrations_count;
  RAISE NOTICE 'Registrations with events: %', registrations_with_events_count;
  RAISE NOTICE 'Registrations without events: %', missing_count;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Cannot proceed! % registrations do not have registration_events records', missing_count;
  END IF;

  RAISE NOTICE 'Verification passed! Safe to proceed with column drops.';
END $$;

-- =====================================================
-- DROP OLD COLUMNS FROM REGISTRATIONS
-- =====================================================

-- Drop events array column
ALTER TABLE registrations
DROP COLUMN IF EXISTS events;

-- Drop child_counts JSONB column
ALTER TABLE registrations
DROP COLUMN IF EXISTS child_counts;

-- =====================================================
-- DROP OLD INDEX
-- =====================================================
DROP INDEX IF EXISTS idx_registrations_child_counts;

-- =====================================================
-- VERIFY SCHEMA
-- =====================================================

-- Check columns were dropped
DO $$
DECLARE
  events_exists BOOLEAN;
  child_counts_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'registrations' AND column_name = 'events'
  ) INTO events_exists;

  SELECT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'registrations' AND column_name = 'child_counts'
  ) INTO child_counts_exists;

  IF events_exists OR child_counts_exists THEN
    RAISE WARNING 'Old columns still exist!';
  ELSE
    RAISE NOTICE 'Old columns successfully dropped';
  END IF;
END $$;

-- =====================================================
-- FINAL STATE CHECK
-- =====================================================

-- Show final registrations schema
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'registrations'
ORDER BY ordinal_position;

-- Show final registration_events schema
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'registration_events'
ORDER BY ordinal_position;

-- Show sample data with new structure
SELECT
  r.id as registration_id,
  c.first_name || ' ' || c.last_name as registrant,
  c.email,
  t.year as tournament_year,
  COUNT(re.id) as event_count,
  ARRAY_AGG(te.event_name ORDER BY te.event_date) as events,
  SUM(re.child_count) as total_children
FROM registrations r
JOIN contacts c ON r.contact_id = c.id
JOIN tournaments t ON r.tournament_id = t.id
LEFT JOIN registration_events re ON re.registration_id = r.id
LEFT JOIN tournament_events te ON re.tournament_event_id = te.id
GROUP BY r.id, c.first_name, c.last_name, c.email, t.year
ORDER BY r.created_at DESC
LIMIT 10;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=== Phase 5 Migration Complete ===';
  RAISE NOTICE 'Old columns dropped: events, child_counts';
  RAISE NOTICE 'Database is now fully normalized!';
  RAISE NOTICE '';
  RAISE NOTICE 'Final structure:';
  RAISE NOTICE '- contacts: Centralized contact information';
  RAISE NOTICE '- registrations: Tournament registration metadata (contact_id, tournament_id, golf info, payment)';
  RAISE NOTICE '- registration_events: Which events each registration is attending + child counts';
  RAISE NOTICE '';
  RAISE NOTICE 'Run application tests to verify everything works correctly.';
END $$;
