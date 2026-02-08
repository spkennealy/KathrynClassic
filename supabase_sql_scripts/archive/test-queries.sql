-- =====================================================
-- TEST QUERIES FOR CONTACTS MIGRATION
-- Run these queries to verify each phase of migration
-- =====================================================

-- =====================================================
-- PHASE 1 VERIFICATION
-- =====================================================

-- Check contacts table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'contacts'
) AS contacts_table_exists;

-- Check foreign key columns exist
SELECT
  EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'registrations' AND column_name = 'contact_id'
  ) AS registrations_has_contact_id,
  EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'donations' AND column_name = 'contact_id'
  ) AS donations_has_contact_id,
  EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'tournament_awards' AND column_name = 'contact_id'
  ) AS awards_has_contact_id;

-- Check indexes were created
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('contacts', 'registrations', 'donations', 'tournament_awards')
  AND indexname LIKE '%contact%'
ORDER BY tablename, indexname;

-- Check RLS is enabled
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'contacts';

-- Check RLS policies exist
SELECT
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'contacts'
ORDER BY policyname;

-- =====================================================
-- PHASE 2 VERIFICATION
-- =====================================================

-- Count contacts created
SELECT COUNT(*) AS total_contacts FROM contacts;

-- Count unique emails in contacts (should match total_contacts)
SELECT COUNT(DISTINCT email) AS unique_emails FROM contacts;

-- Check all registrations have contact_id
SELECT
  COUNT(*) AS total_registrations,
  COUNT(contact_id) AS linked_registrations,
  COUNT(*) - COUNT(contact_id) AS unlinked_registrations
FROM registrations;

-- Check all donations have contact_id
SELECT
  COUNT(*) AS total_donations,
  COUNT(contact_id) AS linked_donations,
  COUNT(*) - COUNT(contact_id) AS unlinked_donations
FROM donations;

-- Check awards with contact links
SELECT
  COUNT(*) AS total_awards,
  COUNT(contact_id) AS linked_awards,
  COUNT(*) - COUNT(contact_id) AS unlinked_awards
FROM tournament_awards;

-- Find any duplicate contacts by email (should return 0 rows)
SELECT
  email,
  COUNT(*) AS duplicate_count,
  ARRAY_AGG(id) AS contact_ids,
  ARRAY_AGG(first_name || ' ' || last_name) AS names
FROM contacts
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Verify contact data looks correct (sample)
SELECT
  c.id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.created_at,
  c.updated_at,
  COUNT(DISTINCT r.id) AS registration_count,
  COUNT(DISTINCT d.id) AS donation_count
FROM contacts c
LEFT JOIN registrations r ON c.id = r.contact_id
LEFT JOIN donations d ON c.id = d.contact_id
GROUP BY c.id
ORDER BY c.created_at DESC
LIMIT 10;

-- Check for orphaned registrations (contact_id points to non-existent contact)
SELECT COUNT(*) AS orphaned_registrations
FROM registrations r
LEFT JOIN contacts c ON r.contact_id = c.id
WHERE r.contact_id IS NOT NULL
  AND c.id IS NULL;

-- Check for orphaned donations (contact_id points to non-existent contact)
SELECT COUNT(*) AS orphaned_donations
FROM donations d
LEFT JOIN contacts c ON d.contact_id = c.id
WHERE d.contact_id IS NOT NULL
  AND c.id IS NULL;

-- =====================================================
-- PHASE 3 VERIFICATION
-- =====================================================

-- Check contact_id is NOT NULL on registrations
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'registrations'
  AND column_name = 'contact_id';
-- is_nullable should be 'NO'

-- Verify old columns were dropped from registrations
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'registrations'
  AND column_name IN (
    'first_name', 'last_name', 'email', 'phone',
    'emergency_contact_name', 'emergency_contact_phone',
    'dietary_restrictions', 'total_amount', 'is_child', 'age'
  );
-- Should return 0 rows

-- Verify old columns were dropped from donations
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'donations'
  AND column_name IN ('first_name', 'last_name', 'email', 'phone');
-- Should return 0 rows

-- Verify old indexes were dropped
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_registrations_email', 'idx_donations_email');
-- Should return 0 rows

-- Check views exist and work
SELECT * FROM registration_summary LIMIT 5;
SELECT * FROM donation_summary LIMIT 5;
SELECT * FROM contact_activity_summary LIMIT 5;

-- =====================================================
-- DATA QUALITY CHECKS (All Phases)
-- =====================================================

-- Find contacts with missing required fields
SELECT
  id,
  first_name,
  last_name,
  email,
  CASE
    WHEN first_name IS NULL OR first_name = '' THEN 'Missing first name'
    WHEN last_name IS NULL OR last_name = '' THEN 'Missing last name'
    WHEN email IS NULL OR email = '' THEN 'Missing email'
    WHEN email NOT LIKE '%@%' THEN 'Invalid email format'
  END AS issue
FROM contacts
WHERE first_name IS NULL OR first_name = ''
   OR last_name IS NULL OR last_name = ''
   OR email IS NULL OR email = ''
   OR email NOT LIKE '%@%';

-- Find contacts with suspicious data
SELECT
  id,
  first_name,
  last_name,
  email,
  phone,
  'Suspicious data' AS issue
FROM contacts
WHERE LENGTH(first_name) < 2
   OR LENGTH(last_name) < 2
   OR email LIKE '%test%'
   OR email LIKE '%example%';

-- Check for contacts with no associated records (orphans)
SELECT
  c.id,
  c.first_name,
  c.last_name,
  c.email,
  COUNT(r.id) AS registration_count,
  COUNT(d.id) AS donation_count,
  COUNT(ta.id) AS award_count
FROM contacts c
LEFT JOIN registrations r ON c.id = r.contact_id
LEFT JOIN donations d ON c.id = d.contact_id
LEFT JOIN tournament_awards ta ON c.id = ta.contact_id
GROUP BY c.id
HAVING COUNT(r.id) = 0
   AND COUNT(d.id) = 0
   AND COUNT(ta.id) = 0
ORDER BY c.created_at DESC;

-- =====================================================
-- PERFORMANCE CHECKS
-- =====================================================

-- Check index usage on contacts table
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'contacts'
ORDER BY idx_scan DESC;

-- Check table sizes
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('contacts', 'registrations', 'donations', 'tournament_awards')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- =====================================================
-- BUSINESS INTELLIGENCE QUERIES
-- =====================================================

-- Most active contacts (registrations + donations)
SELECT
  c.first_name,
  c.last_name,
  c.email,
  COUNT(DISTINCT r.id) AS total_registrations,
  COUNT(DISTINCT d.id) AS total_donations,
  COUNT(DISTINCT r.tournament_id) AS tournaments_attended
FROM contacts c
LEFT JOIN registrations r ON c.id = r.contact_id
LEFT JOIN donations d ON c.id = d.contact_id
GROUP BY c.id, c.first_name, c.last_name, c.email
HAVING COUNT(DISTINCT r.id) > 0 OR COUNT(DISTINCT d.id) > 0
ORDER BY total_registrations DESC, total_donations DESC
LIMIT 20;

-- Contacts who registered for multiple tournaments
SELECT
  c.first_name,
  c.last_name,
  c.email,
  COUNT(DISTINCT r.tournament_id) AS tournament_count,
  ARRAY_AGG(DISTINCT t.year ORDER BY t.year) AS years_attended
FROM contacts c
JOIN registrations r ON c.id = r.contact_id
JOIN tournaments t ON r.tournament_id = t.id
GROUP BY c.id, c.first_name, c.last_name, c.email
HAVING COUNT(DISTINCT r.tournament_id) > 1
ORDER BY tournament_count DESC;

-- Contacts who both registered and donated
SELECT
  c.first_name,
  c.last_name,
  c.email,
  COUNT(DISTINCT r.id) AS registrations,
  COUNT(DISTINCT d.id) AS donations,
  SUM(d.amount) AS total_donated
FROM contacts c
JOIN registrations r ON c.id = r.contact_id
JOIN donations d ON c.id = d.contact_id
GROUP BY c.id, c.first_name, c.last_name, c.email
ORDER BY total_donated DESC;

-- =====================================================
-- TOURNAMENT-SPECIFIC QUERIES
-- =====================================================

-- Latest tournament registrations with contact info
SELECT
  t.year,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  r.events,
  r.payment_status,
  r.created_at AS registration_date
FROM registrations r
JOIN contacts c ON r.contact_id = c.id
JOIN tournaments t ON r.tournament_id = t.id
WHERE t.year = (SELECT MAX(year) FROM tournaments)
ORDER BY r.created_at DESC
LIMIT 20;

-- Golf teams with full contact info
SELECT
  r.team_group_id,
  t.year,
  ARRAY_AGG(c.first_name || ' ' || c.last_name ORDER BY c.last_name) AS team_members,
  ARRAY_AGG(c.email ORDER BY c.last_name) AS emails,
  ARRAY_AGG(r.golf_handicap ORDER BY c.last_name) AS handicaps
FROM registrations r
JOIN contacts c ON r.contact_id = c.id
JOIN tournaments t ON r.tournament_id = t.id
WHERE r.team_group_id IS NOT NULL
GROUP BY r.team_group_id, t.year
ORDER BY t.year DESC, r.team_group_id;

-- Award winners with contact information
SELECT
  t.year,
  ta.award_category,
  ta.winner_name,
  CASE
    WHEN c.id IS NOT NULL THEN c.first_name || ' ' || c.last_name
    ELSE NULL
  END AS contact_name,
  c.email,
  c.phone,
  CASE
    WHEN c.id IS NOT NULL THEN 'Linked to contact'
    ELSE 'External winner'
  END AS link_status
FROM tournament_awards ta
JOIN tournaments t ON ta.tournament_id = t.id
LEFT JOIN contacts c ON ta.contact_id = c.id
ORDER BY t.year DESC, ta.award_category;
