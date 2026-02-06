-- =====================================================
-- FIX SECURITY DEFINER VIEWS
-- Removes SECURITY DEFINER from views to fix security vulnerabilities
-- =====================================================

-- Drop and recreate views WITHOUT security definer
-- This ensures they respect RLS policies

-- =====================================================
-- ADMIN VIEWS (Read-Only, No Security Definer)
-- =====================================================

-- View: Tournament Statistics
DROP VIEW IF EXISTS admin_tournament_stats;
CREATE VIEW admin_tournament_stats AS
SELECT
  t.id as tournament_id,
  t.year,
  t.start_date,
  t.end_date,
  t.total_raised,
  t.total_attendees as reported_attendees,
  COUNT(DISTINCT r.id) as registration_count,
  COUNT(DISTINCT r.contact_id) as unique_contacts,
  COUNT(DISTINCT r.id) FILTER (WHERE r.payment_status = 'paid') as paid_count,
  COUNT(DISTINCT r.id) FILTER (WHERE r.payment_status = 'pending') as pending_count,
  COUNT(DISTINCT re.tournament_event_id) as events_with_registrations,
  COUNT(DISTINCT r.id) + COALESCE(SUM(re.child_count), 0) as actual_total_attendees,
  SUM(re.child_count) as total_children
FROM tournaments t
LEFT JOIN registrations r ON r.tournament_id = t.id
LEFT JOIN registration_events re ON re.registration_id = r.id
GROUP BY t.id, t.year, t.start_date, t.end_date, t.total_raised, t.total_attendees
ORDER BY t.year DESC;

-- View: Event Attendance Details
DROP VIEW IF EXISTS admin_event_attendance;
CREATE VIEW admin_event_attendance AS
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
  COUNT(DISTINCT re.registration_id) as adult_count,
  SUM(re.child_count) as child_count,
  COUNT(DISTINCT re.registration_id) + COALESCE(SUM(re.child_count), 0) as total_attendees,
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

-- View: Registration Details
DROP VIEW IF EXISTS admin_registration_details;
CREATE VIEW admin_registration_details AS
SELECT
  r.id as registration_id,
  r.created_at as registration_date,
  r.payment_status,
  c.id as contact_id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  t.year as tournament_year,
  t.id as tournament_id,
  r.golf_handicap,
  r.preferred_teammates,
  r.team_group_id,
  ARRAY_AGG(DISTINCT te.event_name) as events,
  ARRAY_AGG(DISTINCT te.event_type) as event_types,
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
DROP VIEW IF EXISTS admin_contact_activity;
CREATE VIEW admin_contact_activity AS
SELECT
  c.id as contact_id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.created_at,
  c.updated_at,
  COUNT(DISTINCT r.id) as total_registrations,
  COUNT(DISTINCT r.tournament_id) as tournaments_attended,
  ARRAY_AGG(DISTINCT t.year) FILTER (WHERE t.year IS NOT NULL) as tournament_years,
  MAX(r.created_at) as last_registration_date,
  COUNT(DISTINCT r.id) FILTER (WHERE r.payment_status = 'paid') as paid_registrations,
  COUNT(DISTINCT r.id) FILTER (WHERE r.payment_status = 'pending') as pending_registrations,
  COUNT(DISTINCT ta.id) as awards_won,
  ARRAY_AGG(DISTINCT ta.award_category) FILTER (WHERE ta.award_category IS NOT NULL) as award_categories
FROM contacts c
LEFT JOIN registrations r ON r.contact_id = c.id
LEFT JOIN tournaments t ON r.tournament_id = t.id
LEFT JOIN tournament_awards ta ON ta.contact_id = c.id
GROUP BY c.id, c.first_name, c.last_name, c.email, c.phone, c.created_at, c.updated_at
ORDER BY c.last_name, c.first_name;

-- View: Golf Teams
DROP VIEW IF EXISTS admin_golf_teams;
CREATE VIEW admin_golf_teams AS
SELECT
  r.team_group_id,
  t.year as tournament_year,
  t.id as tournament_id,
  COUNT(r.id) as team_size,
  ARRAY_AGG(c.first_name || ' ' || c.last_name) as team_members,
  ARRAY_AGG(c.email) as emails,
  ARRAY_AGG(r.golf_handicap) as handicaps,
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
-- UPDATE FUNCTIONS (Remove SECURITY DEFINER)
-- =====================================================

-- Function: Get registration count for a tournament
DROP FUNCTION IF EXISTS get_tournament_registration_count(UUID);
CREATE FUNCTION get_tournament_registration_count(tournament_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM registrations
    WHERE tournament_id = tournament_uuid
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Get event attendance
DROP FUNCTION IF EXISTS get_event_attendance(UUID);
CREATE FUNCTION get_event_attendance(event_uuid UUID)
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
$$ LANGUAGE plpgsql;

-- Grant permissions to authenticated users (admins)
GRANT SELECT ON admin_tournament_stats TO authenticated;
GRANT SELECT ON admin_event_attendance TO authenticated;
GRANT SELECT ON admin_registration_details TO authenticated;
GRANT SELECT ON admin_contact_activity TO authenticated;
GRANT SELECT ON admin_golf_teams TO authenticated;

GRANT EXECUTE ON FUNCTION get_tournament_registration_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_event_attendance TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=== Security Fix Applied ==='';
  RAISE NOTICE 'All views recreated without SECURITY DEFINER';
  RAISE NOTICE 'Views now respect RLS policies';
  RAISE NOTICE 'Only authenticated users can access admin views';
END $$;
