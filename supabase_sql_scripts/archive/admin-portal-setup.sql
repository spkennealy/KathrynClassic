-- =====================================================
-- ADMIN PORTAL DATABASE SETUP
-- Sets up RLS policies and views for admin portal
-- =====================================================

-- =====================================================
-- RLS POLICIES FOR ADMIN (AUTHENTICATED USERS)
-- =====================================================

-- TOURNAMENTS
-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Allow authenticated users to insert tournaments" ON tournaments;
CREATE POLICY "Allow authenticated users to insert tournaments"
ON tournaments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update tournaments" ON tournaments;
CREATE POLICY "Allow authenticated users to update tournaments"
ON tournaments FOR UPDATE TO authenticated USING (true);

-- TOURNAMENT_EVENTS
DROP POLICY IF EXISTS "Allow authenticated users to insert tournament_events" ON tournament_events;
CREATE POLICY "Allow authenticated users to insert tournament_events"
ON tournament_events FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update tournament_events" ON tournament_events;
CREATE POLICY "Allow authenticated users to update tournament_events"
ON tournament_events FOR UPDATE TO authenticated USING (true);

-- REGISTRATIONS
DROP POLICY IF EXISTS "Allow authenticated users to update registrations" ON registrations;
CREATE POLICY "Allow authenticated users to update registrations"
ON registrations FOR UPDATE TO authenticated USING (true);

-- TOURNAMENT_AWARDS
DROP POLICY IF EXISTS "Allow authenticated users to insert tournament_awards" ON tournament_awards;
CREATE POLICY "Allow authenticated users to insert tournament_awards"
ON tournament_awards FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update tournament_awards" ON tournament_awards;
CREATE POLICY "Allow authenticated users to update tournament_awards"
ON tournament_awards FOR UPDATE TO authenticated USING (true);

-- CONTACTS
-- Already has policies, verify they're correct
-- Should have: authenticated can view, update
-- (Already created in earlier migrations)

-- REGISTRATION_EVENTS
-- Already has policies from Phase 4

-- =====================================================
-- ADMIN DASHBOARD VIEWS
-- =====================================================

-- View: Tournament Statistics
CREATE OR REPLACE VIEW admin_tournament_stats AS
SELECT
  t.id as tournament_id,
  t.year,
  t.start_date,
  t.end_date,
  t.total_raised,
  t.total_attendees as reported_attendees,
  -- Actual registration counts
  COUNT(DISTINCT r.id) as registration_count,
  COUNT(DISTINCT r.contact_id) as unique_contacts,
  -- Payment statistics
  COUNT(DISTINCT r.id) FILTER (WHERE r.payment_status = 'paid') as paid_count,
  COUNT(DISTINCT r.id) FILTER (WHERE r.payment_status = 'pending') as pending_count,
  -- Event statistics
  COUNT(DISTINCT re.tournament_event_id) as events_with_registrations,
  -- Total attendees (adults + children)
  COUNT(DISTINCT r.id) + COALESCE(SUM(re.child_count), 0) as actual_total_attendees,
  SUM(re.child_count) as total_children
FROM tournaments t
LEFT JOIN registrations r ON r.tournament_id = t.id
LEFT JOIN registration_events re ON re.registration_id = r.id
GROUP BY t.id, t.year, t.start_date, t.end_date, t.total_raised, t.total_attendees
ORDER BY t.year DESC;

-- View: Event Attendance Details
CREATE OR REPLACE VIEW admin_event_attendance AS
SELECT
  t.year as tournament_year,
  t.id as tournament_id,
  te.id as event_id,
  te.event_name,
  te.event_type,
  te.event_date,
  te.start_time,
  te.location,
  te.adult_price,
  te.child_price,
  -- Attendance counts
  COUNT(DISTINCT re.registration_id) as adult_count,
  SUM(re.child_count) as child_count,
  COUNT(DISTINCT re.registration_id) + COALESCE(SUM(re.child_count), 0) as total_attendees,
  -- Revenue calculations
  (COUNT(DISTINCT re.registration_id) * te.adult_price) as adult_revenue,
  (COALESCE(SUM(re.child_count), 0) * te.child_price) as child_revenue,
  (COUNT(DISTINCT re.registration_id) * te.adult_price) +
    (COALESCE(SUM(re.child_count), 0) * te.child_price) as total_revenue
FROM tournaments t
JOIN tournament_events te ON te.tournament_id = t.id
LEFT JOIN registration_events re ON re.tournament_event_id = te.id
GROUP BY
  t.id, t.year, te.id, te.event_name, te.event_type, te.event_date,
  te.start_time, te.location, te.adult_price, te.child_price
ORDER BY t.year DESC, te.event_date, te.start_time;

-- View: Registration Details (Full Join)
CREATE OR REPLACE VIEW admin_registration_details AS
SELECT
  r.id as registration_id,
  r.created_at as registration_date,
  r.payment_status,
  -- Contact information
  c.id as contact_id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  -- Tournament information
  t.year as tournament_year,
  t.id as tournament_id,
  -- Golf information
  r.golf_handicap,
  r.preferred_teammates,
  r.team_group_id,
  -- Events registered for
  ARRAY_AGG(DISTINCT te.event_name) as events,
  ARRAY_AGG(DISTINCT te.event_type) as event_types,
  -- Children counts
  SUM(re.child_count) as total_children,
  JSONB_OBJECT_AGG(te.event_type, re.child_count) FILTER (WHERE te.event_type IS NOT NULL) as children_by_event
FROM registrations r
JOIN contacts c ON r.contact_id = c.id
JOIN tournaments t ON r.tournament_id = t.id
LEFT JOIN registration_events re ON re.registration_id = r.id
LEFT JOIN tournament_events te ON re.tournament_event_id = te.id
GROUP BY
  r.id, r.created_at, r.payment_status, c.id, c.first_name, c.last_name,
  c.email, c.phone, t.year, t.id, r.golf_handicap, r.preferred_teammates,
  r.team_group_id
ORDER BY r.created_at DESC;

-- View: Contact Activity Summary
CREATE OR REPLACE VIEW admin_contact_activity AS
SELECT
  c.id as contact_id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.created_at,
  c.updated_at,
  -- Registration statistics
  COUNT(DISTINCT r.id) as total_registrations,
  COUNT(DISTINCT r.tournament_id) as tournaments_attended,
  ARRAY_AGG(DISTINCT t.year ORDER BY t.year DESC) FILTER (WHERE t.year IS NOT NULL) as tournament_years,
  -- Latest registration
  MAX(r.created_at) as last_registration_date,
  -- Payment status
  COUNT(DISTINCT r.id) FILTER (WHERE r.payment_status = 'paid') as paid_registrations,
  COUNT(DISTINCT r.id) FILTER (WHERE r.payment_status = 'pending') as pending_registrations,
  -- Awards
  COUNT(DISTINCT ta.id) as awards_won,
  ARRAY_AGG(DISTINCT ta.award_category) FILTER (WHERE ta.award_category IS NOT NULL) as award_categories
FROM contacts c
LEFT JOIN registrations r ON r.contact_id = c.id
LEFT JOIN tournaments t ON r.tournament_id = t.id
LEFT JOIN tournament_awards ta ON ta.contact_id = c.id
GROUP BY c.id, c.first_name, c.last_name, c.email, c.phone, c.created_at, c.updated_at
ORDER BY c.last_name, c.first_name;

-- View: Golf Teams
CREATE OR REPLACE VIEW admin_golf_teams AS
SELECT
  r.team_group_id,
  t.year as tournament_year,
  t.id as tournament_id,
  COUNT(r.id) as team_size,
  ARRAY_AGG(c.first_name || ' ' || c.last_name ORDER BY c.last_name) as team_members,
  ARRAY_AGG(c.email ORDER BY c.last_name) as emails,
  ARRAY_AGG(r.golf_handicap ORDER BY c.last_name) as handicaps,
  AVG(r.golf_handicap) as avg_handicap,
  MIN(r.created_at) as registered_at
FROM registrations r
JOIN contacts c ON r.contact_id = c.id
JOIN tournaments t ON r.tournament_id = t.id
WHERE r.team_group_id IS NOT NULL
GROUP BY r.team_group_id, t.year, t.id
HAVING COUNT(r.id) > 1
ORDER BY t.year DESC, MIN(r.created_at) DESC;

-- =====================================================
-- GRANT PERMISSIONS ON VIEWS
-- =====================================================
GRANT SELECT ON admin_tournament_stats TO authenticated;
GRANT SELECT ON admin_event_attendance TO authenticated;
GRANT SELECT ON admin_registration_details TO authenticated;
GRANT SELECT ON admin_contact_activity TO authenticated;
GRANT SELECT ON admin_golf_teams TO authenticated;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function: Get registration count for a tournament
CREATE OR REPLACE FUNCTION get_tournament_registration_count(tournament_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM registrations
    WHERE tournament_id = tournament_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get event attendance
CREATE OR REPLACE FUNCTION get_event_attendance(event_uuid UUID)
RETURNS TABLE (
  adults BIGINT,
  children BIGINT,
  total BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT re.registration_id) as adults,
    COALESCE(SUM(re.child_count), 0) as children,
    COUNT(DISTINCT re.registration_id) + COALESCE(SUM(re.child_count), 0) as total
  FROM registration_events re
  WHERE re.tournament_event_id = event_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_tournament_registration_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_event_attendance TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Test the views
DO $$
BEGIN
  RAISE NOTICE '=== Admin Portal Setup Complete ===';
  RAISE NOTICE 'Created views:';
  RAISE NOTICE '- admin_tournament_stats';
  RAISE NOTICE '- admin_event_attendance';
  RAISE NOTICE '- admin_registration_details';
  RAISE NOTICE '- admin_contact_activity';
  RAISE NOTICE '- admin_golf_teams';
  RAISE NOTICE '';
  RAISE NOTICE 'Created functions:';
  RAISE NOTICE '- get_tournament_registration_count(uuid)';
  RAISE NOTICE '- get_event_attendance(uuid)';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS policies updated for admin access';
END $$;

-- Show sample data from key views
SELECT 'Tournament Stats Sample:' as info;
SELECT * FROM admin_tournament_stats LIMIT 3;

SELECT 'Event Attendance Sample:' as info;
SELECT * FROM admin_event_attendance LIMIT 5;

SELECT 'Contact Activity Sample:' as info;
SELECT * FROM admin_contact_activity LIMIT 5;
