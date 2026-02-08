-- =====================================================
-- Link Registrations to Contacts by First/Last Name
-- This script links registrations to contacts when:
-- 1. Email matches (exact match)
-- 2. First name + Last name match (case-insensitive)
-- =====================================================

-- =====================================================
-- STEP 1: Preview - Email Matches
-- =====================================================
-- Show registrations that can be linked by exact email match
SELECT
  r.id as registration_id,
  r.first_name as reg_first_name,
  r.last_name as reg_last_name,
  r.email as reg_email,
  c.id as contact_id,
  c.first_name as contact_first_name,
  c.last_name as contact_last_name,
  c.email as contact_email,
  'Email Match' as match_type
FROM registrations r
JOIN contacts c ON LOWER(TRIM(r.email)) = LOWER(TRIM(c.email))
WHERE r.contact_id IS NULL
  AND r.email IS NOT NULL
  AND r.email != '';

-- =====================================================
-- STEP 2: Preview - Name Matches (No Email Match)
-- =====================================================
-- Show registrations that can be linked by name match
-- Excludes those already matched by email
SELECT
  r.id as registration_id,
  r.first_name as reg_first_name,
  r.last_name as reg_last_name,
  r.email as reg_email,
  c.id as contact_id,
  c.first_name as contact_first_name,
  c.last_name as contact_last_name,
  c.email as contact_email,
  'Name Match' as match_type,
  -- Flag if there are multiple contacts with same name
  COUNT(*) OVER (PARTITION BY r.id) as contact_matches
FROM registrations r
JOIN contacts c ON
  LOWER(TRIM(r.first_name)) = LOWER(TRIM(c.first_name))
  AND LOWER(TRIM(r.last_name)) = LOWER(TRIM(c.last_name))
WHERE r.contact_id IS NULL
  AND r.email IS NOT NULL
  AND r.email != ''
  -- Exclude if email already matches
  AND LOWER(TRIM(r.email)) != LOWER(TRIM(c.email));

-- =====================================================
-- STEP 3: Check for Ambiguous Name Matches
-- =====================================================
-- Show registrations where multiple contacts have the same name
-- These need manual review
SELECT
  r.id as registration_id,
  r.first_name,
  r.last_name,
  r.email as registration_email,
  COUNT(c.id) as matching_contacts,
  STRING_AGG(c.email, ', ') as contact_emails
FROM registrations r
JOIN contacts c ON
  LOWER(TRIM(r.first_name)) = LOWER(TRIM(c.first_name))
  AND LOWER(TRIM(r.last_name)) = LOWER(TRIM(c.last_name))
WHERE r.contact_id IS NULL
GROUP BY r.id, r.first_name, r.last_name, r.email
HAVING COUNT(c.id) > 1
ORDER BY r.last_name, r.first_name;

-- =====================================================
-- STEP 4: Link by Email Match (Safe)
-- =====================================================
-- Link registrations to contacts where email matches
UPDATE registrations r
SET contact_id = c.id
FROM contacts c
WHERE LOWER(TRIM(r.email)) = LOWER(TRIM(c.email))
  AND r.contact_id IS NULL
  AND r.email IS NOT NULL
  AND r.email != '';

-- Show results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✓ Linked % registrations by email match', updated_count;
END $$;

-- =====================================================
-- STEP 5: Link by Name Match (Single Match Only)
-- =====================================================
-- Only link registrations where there's exactly ONE contact with matching name
-- This avoids linking to the wrong person if multiple contacts share a name

UPDATE registrations r
SET contact_id = c.id
FROM contacts c
WHERE LOWER(TRIM(r.first_name)) = LOWER(TRIM(c.first_name))
  AND LOWER(TRIM(r.last_name)) = LOWER(TRIM(c.last_name))
  AND r.contact_id IS NULL
  -- Only update if there's exactly one matching contact
  AND (
    SELECT COUNT(*)
    FROM contacts c2
    WHERE LOWER(TRIM(c2.first_name)) = LOWER(TRIM(r.first_name))
      AND LOWER(TRIM(c2.last_name)) = LOWER(TRIM(r.last_name))
  ) = 1;

-- Show results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✓ Linked % registrations by name match (unique names only)', updated_count;
END $$;

-- =====================================================
-- STEP 6: Update Contact Emails from Registrations
-- =====================================================
-- If a registration has a newer email than the contact, update the contact
-- This happens when you added emails to registrations but contacts have old/missing emails

UPDATE contacts c
SET
  email = r.email,
  updated_at = NOW()
FROM registrations r
WHERE r.contact_id = c.id
  AND r.email IS NOT NULL
  AND r.email != ''
  AND (c.email IS NULL OR c.email = '' OR LOWER(TRIM(c.email)) != LOWER(TRIM(r.email)))
  -- Only update if registration is more recent
  AND r.created_at > c.created_at;

-- Show results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✓ Updated % contact emails from newer registrations', updated_count;
END $$;

-- =====================================================
-- STEP 7: Create Contacts for Unlinked Registrations
-- =====================================================
-- For registrations that still don't have contacts, create new contacts
-- Only for registrations with complete data (email, first_name, last_name)

INSERT INTO contacts (first_name, last_name, email, phone, created_at)
SELECT DISTINCT
  r.first_name,
  r.last_name,
  r.email,
  r.phone,
  r.created_at
FROM registrations r
WHERE r.contact_id IS NULL
  AND r.email IS NOT NULL
  AND r.email != ''
  AND r.first_name IS NOT NULL
  AND r.last_name IS NOT NULL
  -- Don't create if contact with this email already exists
  AND NOT EXISTS (
    SELECT 1 FROM contacts c
    WHERE LOWER(TRIM(c.email)) = LOWER(TRIM(r.email))
  )
ON CONFLICT (email) DO NOTHING;

-- Show results
DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE '✓ Created % new contacts from unlinked registrations', inserted_count;
END $$;

-- =====================================================
-- STEP 8: Final Link After Creating New Contacts
-- =====================================================
-- Link any remaining registrations to the contacts we just created

UPDATE registrations r
SET contact_id = c.id
FROM contacts c
WHERE LOWER(TRIM(r.email)) = LOWER(TRIM(c.email))
  AND r.contact_id IS NULL
  AND r.email IS NOT NULL
  AND r.email != '';

-- Show results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✓ Linked % registrations to newly created contacts', updated_count;
END $$;

-- =====================================================
-- FINAL VERIFICATION
-- =====================================================

-- Summary of registration linking status
SELECT
  COUNT(*) as total_registrations,
  COUNT(contact_id) as linked_registrations,
  COUNT(*) - COUNT(contact_id) as unlinked_registrations,
  ROUND(100.0 * COUNT(contact_id) / COUNT(*), 1) as percent_linked
FROM registrations;

-- Show remaining unlinked registrations (if any)
SELECT
  id,
  first_name,
  last_name,
  email,
  CASE
    WHEN email IS NULL OR email = '' THEN 'Missing email'
    WHEN first_name IS NULL THEN 'Missing first name'
    WHEN last_name IS NULL THEN 'Missing last name'
    ELSE 'Check manually'
  END as reason
FROM registrations
WHERE contact_id IS NULL
ORDER BY last_name, first_name;

-- Show contact statistics
SELECT
  COUNT(*) as total_contacts,
  COUNT(*) FILTER (WHERE email IS NULL OR email = '') as contacts_without_email
FROM contacts;

-- =====================================================
-- MANUAL REVIEW NEEDED
-- =====================================================
-- If you saw any ambiguous matches in STEP 3, handle them manually:

-- Example: Link a specific registration to a specific contact
-- UPDATE registrations
-- SET contact_id = 'contact-uuid-here'
-- WHERE id = 'registration-uuid-here';

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Registration-Contact Linking Complete!';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Check the verification results above.';
  RAISE NOTICE 'If any registrations remain unlinked, review them manually.';
END $$;
