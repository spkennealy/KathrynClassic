-- =====================================================
-- Create Contacts for Registrations Without Emails
-- This allows all registrations to be linked to contacts
-- Emails can be added to contacts manually later
-- =====================================================

-- =====================================================
-- STEP 1: Make email nullable in contacts table
-- =====================================================
-- Temporarily allow NULL emails so we can create contacts
-- for registrations that don't have emails yet

-- Drop the NOT NULL constraint on email
ALTER TABLE contacts
ALTER COLUMN email DROP NOT NULL;

-- Make email index conditional (only index non-null emails)
-- First drop the existing unique index
DROP INDEX IF EXISTS idx_contacts_email;

-- Create a new unique index that allows multiple NULL emails
-- but enforces uniqueness for non-NULL emails
CREATE UNIQUE INDEX idx_contacts_email
ON contacts(email)
WHERE email IS NOT NULL;

-- =====================================================
-- STEP 2: Show registrations without contacts
-- =====================================================
SELECT
  id,
  first_name,
  last_name,
  email,
  phone,
  created_at
FROM registrations
WHERE contact_id IS NULL
ORDER BY last_name, first_name;

-- =====================================================
-- STEP 3: Create contacts for unlinked registrations
-- =====================================================
-- Create contacts from registration data
-- Email will be NULL for now, can be added later

INSERT INTO contacts (first_name, last_name, email, phone, created_at)
SELECT
  r.first_name,
  r.last_name,
  CASE
    WHEN r.email IS NOT NULL AND r.email != '' THEN r.email
    ELSE NULL
  END as email,
  r.phone,
  r.created_at
FROM registrations r
WHERE r.contact_id IS NULL
  AND r.first_name IS NOT NULL
  AND r.last_name IS NOT NULL
ON CONFLICT DO NOTHING
RETURNING id, first_name, last_name, email;

-- Show how many were created
DO $$
DECLARE
  created_count INTEGER;
BEGIN
  GET DIAGNOSTICS created_count = ROW_COUNT;
  RAISE NOTICE '✓ Created % new contacts', created_count;
END $$;

-- =====================================================
-- STEP 4: Link registrations to contacts by name
-- =====================================================
-- Link registrations to contacts by matching first + last name
-- Use the most recent contact if multiple matches exist

UPDATE registrations r
SET contact_id = (
  SELECT c.id
  FROM contacts c
  WHERE LOWER(TRIM(r.first_name)) = LOWER(TRIM(c.first_name))
    AND LOWER(TRIM(r.last_name)) = LOWER(TRIM(c.last_name))
  ORDER BY c.created_at DESC
  LIMIT 1
)
WHERE r.contact_id IS NULL
  AND r.first_name IS NOT NULL
  AND r.last_name IS NOT NULL;

-- Show results
DO $$
DECLARE
  linked_count INTEGER;
BEGIN
  GET DIAGNOSTICS linked_count = ROW_COUNT;
  RAISE NOTICE '✓ Linked % registrations to contacts', linked_count;
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check registration linking status
SELECT
  COUNT(*) as total_registrations,
  COUNT(contact_id) as linked_registrations,
  COUNT(*) - COUNT(contact_id) as unlinked_registrations,
  ROUND(100.0 * COUNT(contact_id) / COUNT(*), 1) as percent_linked
FROM registrations;

-- Show contacts without emails (these need emails added)
SELECT
  c.id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  COUNT(r.id) as registration_count
FROM contacts c
LEFT JOIN registrations r ON r.contact_id = c.id
WHERE c.email IS NULL
GROUP BY c.id
ORDER BY c.last_name, c.first_name;

-- Show total contacts breakdown
SELECT
  COUNT(*) as total_contacts,
  COUNT(*) FILTER (WHERE email IS NOT NULL) as contacts_with_email,
  COUNT(*) FILTER (WHERE email IS NULL) as contacts_without_email
FROM contacts;

-- =====================================================
-- IMPORTANT NOTES
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Contacts Created Successfully!';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'All registrations should now be linked to contacts.';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Add emails to contacts that have NULL email';
  RAISE NOTICE '2. You can update contacts directly in Supabase dashboard';
  RAISE NOTICE '3. Or use SQL: UPDATE contacts SET email = ''user@example.com'' WHERE id = ''uuid'';';
  RAISE NOTICE '';
  RAISE NOTICE 'The contacts.email field now allows NULL values.';
  RAISE NOTICE 'This is intentional to support your workflow.';
  RAISE NOTICE 'Add emails as you get them!';
END $$;

-- =====================================================
-- HELPER: Add email to a contact
-- =====================================================
-- Use this template to add emails later:
--
-- UPDATE contacts
-- SET email = 'user@example.com'
-- WHERE id = 'contact-uuid-here';
--
-- Or update by name:
-- UPDATE contacts
-- SET email = 'user@example.com'
-- WHERE first_name = 'John' AND last_name = 'Doe';
