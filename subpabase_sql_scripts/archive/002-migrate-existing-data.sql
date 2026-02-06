-- =====================================================
-- PHASE 2: Migrate Existing Data
-- This migration populates contacts from existing records
-- and links all records to contacts
-- =====================================================

-- =====================================================
-- STEP 1: Create contacts from registrations
-- =====================================================
-- Insert unique contacts from registrations
-- Using DISTINCT ON to handle duplicate emails with different names
-- (Takes the first occurrence based on created_at)
INSERT INTO contacts (email, first_name, last_name, phone, created_at)
SELECT DISTINCT ON (email)
  email,
  first_name,
  last_name,
  phone,
  created_at
FROM registrations
WHERE email IS NOT NULL
ORDER BY email, created_at ASC
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- STEP 2: Link registrations to contacts
-- =====================================================
UPDATE registrations r
SET contact_id = c.id
FROM contacts c
WHERE r.email = c.email
  AND r.contact_id IS NULL;

-- =====================================================
-- STEP 3: Create contacts from donations (if not already exists)
-- =====================================================
INSERT INTO contacts (email, first_name, last_name, phone, created_at)
SELECT DISTINCT ON (email)
  email,
  first_name,
  last_name,
  phone,
  created_at
FROM donations
WHERE email IS NOT NULL
  AND email NOT IN (SELECT email FROM contacts)
ORDER BY email, created_at ASC
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- STEP 4: Link donations to contacts
-- =====================================================
UPDATE donations d
SET contact_id = c.id
FROM contacts c
WHERE d.email = c.email
  AND d.contact_id IS NULL;

-- =====================================================
-- STEP 5: Link awards to contacts (best-effort match by name)
-- =====================================================
-- This matches award winner_name to contact full name
-- Only updates awards that don't already have a contact_id
UPDATE tournament_awards ta
SET contact_id = c.id
FROM contacts c
WHERE ta.contact_id IS NULL
  AND LOWER(TRIM(ta.winner_name)) = LOWER(TRIM(CONCAT(c.first_name, ' ', c.last_name)));

-- =====================================================
-- VERIFICATION QUERIES
-- Run these to verify migration success
-- =====================================================

-- Check all registrations are linked to contacts
DO $$
DECLARE
  total_registrations INTEGER;
  linked_registrations INTEGER;
  unlinked_registrations INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_registrations FROM registrations;
  SELECT COUNT(*) INTO linked_registrations FROM registrations WHERE contact_id IS NOT NULL;
  unlinked_registrations := total_registrations - linked_registrations;

  RAISE NOTICE 'Registrations - Total: %, Linked: %, Unlinked: %',
    total_registrations, linked_registrations, unlinked_registrations;

  IF unlinked_registrations > 0 THEN
    RAISE WARNING 'Some registrations are not linked to contacts!';
  ELSE
    RAISE NOTICE 'All registrations successfully linked to contacts';
  END IF;
END $$;

-- Check all donations are linked to contacts
DO $$
DECLARE
  total_donations INTEGER;
  linked_donations INTEGER;
  unlinked_donations INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_donations FROM donations;
  SELECT COUNT(*) INTO linked_donations FROM donations WHERE contact_id IS NOT NULL;
  unlinked_donations := total_donations - linked_donations;

  RAISE NOTICE 'Donations - Total: %, Linked: %, Unlinked: %',
    total_donations, linked_donations, unlinked_donations;

  IF unlinked_donations > 0 THEN
    RAISE WARNING 'Some donations are not linked to contacts!';
  ELSE
    RAISE NOTICE 'All donations successfully linked to contacts';
  END IF;
END $$;

-- Check for duplicate contacts by email
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT email, COUNT(*) as count
    FROM contacts
    GROUP BY email
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE WARNING 'Found % emails with duplicate contacts!', duplicate_count;
  ELSE
    RAISE NOTICE 'No duplicate contacts found';
  END IF;
END $$;

-- Show sample of linked awards
DO $$
DECLARE
  linked_awards INTEGER;
  total_awards INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_awards FROM tournament_awards;
  SELECT COUNT(*) INTO linked_awards FROM tournament_awards WHERE contact_id IS NOT NULL;

  RAISE NOTICE 'Awards - Total: %, Linked to contacts: %', total_awards, linked_awards;
END $$;

-- =====================================================
-- IDENTIFY POTENTIAL DATA QUALITY ISSUES
-- =====================================================

-- Find registrations with null emails (if any)
DO $$
DECLARE
  null_email_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_email_count
  FROM registrations
  WHERE email IS NULL;

  IF null_email_count > 0 THEN
    RAISE WARNING 'Found % registrations with NULL email addresses', null_email_count;
  END IF;
END $$;

-- Find donations with null emails (if any)
DO $$
DECLARE
  null_email_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_email_count
  FROM donations
  WHERE email IS NULL;

  IF null_email_count > 0 THEN
    RAISE WARNING 'Found % donations with NULL email addresses', null_email_count;
  END IF;
END $$;
