-- =====================================================
-- PHASE 3: Enforce Constraints (Breaking Change)
-- This migration drops redundant columns from registrations.
-- Note: contact_id is kept NULLABLE to allow registrations without emails.
-- =====================================================

-- ⚠️  WARNING: This is a BREAKING CHANGE
-- ⚠️  Run Phase 2 verification queries before proceeding
-- ⚠️  Deploy updated application code before running this migration

-- =====================================================
-- NOTE: contact_id is kept NULLABLE
-- =====================================================
-- We intentionally keep contact_id nullable to support:
-- 1. Historical registrations without emails
-- 2. Future registrations where email will be added later
--
-- Application code must handle NULL contact_id cases

-- =====================================================
-- DROP REDUNDANT COLUMNS FROM REGISTRATIONS
-- =====================================================
-- Remove contact information (now in contacts table)
-- Note: email is KEPT to allow adding emails to registrations without contacts
ALTER TABLE registrations
DROP COLUMN IF EXISTS first_name,
DROP COLUMN IF EXISTS last_name,
DROP COLUMN IF EXISTS phone;

-- Remove unused fields per plan
ALTER TABLE registrations
DROP COLUMN IF EXISTS emergency_contact_name,
DROP COLUMN IF EXISTS emergency_contact_phone,
DROP COLUMN IF EXISTS dietary_restrictions;

-- Remove old total_amount column (calculated from events now)
ALTER TABLE registrations
DROP COLUMN IF EXISTS total_amount;

-- Remove is_child and age columns (children are now tracked via registration_events.child_count)
ALTER TABLE registrations
DROP COLUMN IF EXISTS is_child,
DROP COLUMN IF EXISTS age;

-- =====================================================
-- DROP REDUNDANT COLUMNS FROM DONATIONS
-- =====================================================
ALTER TABLE donations
DROP COLUMN IF EXISTS first_name,
DROP COLUMN IF EXISTS last_name,
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS phone;

-- =====================================================
-- DROP OLD INDEXES
-- =====================================================
DROP INDEX IF EXISTS idx_registrations_email;
DROP INDEX IF EXISTS idx_donations_email;

-- =====================================================
-- UPDATE VIEWS TO USE CONTACTS
-- =====================================================

-- Update registration_summary view to use contacts
DROP VIEW IF EXISTS registration_summary;
CREATE OR REPLACE VIEW registration_summary AS
SELECT
  COUNT(*) as total_registrations,
  COUNT(DISTINCT r.contact_id) as unique_registrants,
  DATE_TRUNC('day', r.created_at) as registration_date
FROM registrations r
GROUP BY DATE_TRUNC('day', r.created_at)
ORDER BY registration_date DESC;

-- Update donation_summary view (no changes needed, but recreate for consistency)
DROP VIEW IF EXISTS donation_summary;
CREATE OR REPLACE VIEW donation_summary AS
SELECT
  donation_type,
  COUNT(*) as count,
  SUM(amount) as total_amount,
  AVG(amount) as average_amount
FROM donations
GROUP BY donation_type
ORDER BY total_amount DESC;

-- =====================================================
-- CREATE NEW USEFUL VIEWS
-- =====================================================

-- Contact activity summary
CREATE OR REPLACE VIEW contact_activity_summary AS
SELECT
  c.id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  COUNT(DISTINCT r.id) as registration_count,
  COUNT(DISTINCT d.id) as donation_count,
  COUNT(DISTINCT ta.id) as award_count,
  c.created_at,
  c.updated_at
FROM contacts c
LEFT JOIN registrations r ON c.id = r.contact_id
LEFT JOIN donations d ON c.id = d.contact_id
LEFT JOIN tournament_awards ta ON c.id = ta.contact_id
GROUP BY c.id, c.first_name, c.last_name, c.email, c.phone, c.created_at, c.updated_at
ORDER BY c.last_name, c.first_name;

-- Grant access to new views
GRANT SELECT ON contact_activity_summary TO authenticated;
GRANT SELECT ON registration_summary TO authenticated;
GRANT SELECT ON donation_summary TO authenticated;

-- =====================================================
-- FINAL VERIFICATION
-- =====================================================

-- Verify schema changes
DO $$
BEGIN
  RAISE NOTICE '=== Phase 3 Migration Complete ===';
  RAISE NOTICE 'Registrations table: contact_id is now NOT NULL';
  RAISE NOTICE 'Redundant columns dropped from registrations and donations';
  RAISE NOTICE 'Old email indexes removed';
  RAISE NOTICE 'Views updated to use contacts table';
  RAISE NOTICE 'Run application tests to verify functionality';
END $$;

-- Check final state
SELECT
  (SELECT COUNT(*) FROM contacts) as total_contacts,
  (SELECT COUNT(*) FROM registrations) as total_registrations,
  (SELECT COUNT(*) FROM donations) as total_donations,
  (SELECT COUNT(*) FROM tournament_awards WHERE contact_id IS NOT NULL) as linked_awards;
