-- =====================================================
-- HELPER: Add Emails to Registrations Without Contacts
-- Use this script when you're ready to add emails to
-- registrations that don't have contact_id yet
-- =====================================================

-- =====================================================
-- STEP 1: View registrations without contacts
-- =====================================================
SELECT
  id,
  first_name,
  last_name,
  email,
  created_at
FROM registrations
WHERE contact_id IS NULL
ORDER BY last_name, first_name;

-- =====================================================
-- STEP 2: Add email to a specific registration
-- =====================================================
-- Example: Add email for a specific person
-- Replace the UUID and email address with actual values

-- UPDATE registrations
-- SET email = 'dave.lonsdale@example.com'
-- WHERE id = '687ac39d-3ab8-4345-9e6e-4e1d56a56372';

-- =====================================================
-- STEP 3: Create contact and link registration
-- =====================================================
-- After adding the email, create a contact and link it

-- 3a. Create the contact (or it will be created automatically on next registration)
-- INSERT INTO contacts (first_name, last_name, email, phone)
-- VALUES ('Dave', 'Lonsdale', 'dave.lonsdale@example.com', NULL)
-- ON CONFLICT (email) DO NOTHING
-- RETURNING id;

-- 3b. Link the registration to the contact
-- UPDATE registrations r
-- SET contact_id = c.id
-- FROM contacts c
-- WHERE r.email = c.email
--   AND r.contact_id IS NULL
--   AND r.email IS NOT NULL;

-- =====================================================
-- STEP 4: Bulk email update (if you have a spreadsheet)
-- =====================================================
-- If you have a CSV/spreadsheet with emails, you can do bulk updates:

-- Temporary table approach:
-- CREATE TEMP TABLE temp_emails (
--   registration_id UUID,
--   email TEXT
-- );

-- Load your data:
-- INSERT INTO temp_emails (registration_id, email) VALUES
-- ('687ac39d-3ab8-4345-9e6e-4e1d56a56372', 'dave.lonsdale@example.com'),
-- ('64202b7d-cd75-40e7-84ad-dba113f409bc', 'kim.hoang@example.com');
-- ... more rows

-- Update registrations:
-- UPDATE registrations r
-- SET email = te.email
-- FROM temp_emails te
-- WHERE r.id = te.registration_id;

-- Create contacts for new emails:
-- INSERT INTO contacts (first_name, last_name, email)
-- SELECT DISTINCT r.first_name, r.last_name, r.email
-- FROM registrations r
-- WHERE r.email IS NOT NULL
--   AND r.contact_id IS NULL
-- ON CONFLICT (email) DO NOTHING;

-- Link registrations to contacts:
-- UPDATE registrations r
-- SET contact_id = c.id
-- FROM contacts c
-- WHERE r.email = c.email
--   AND r.contact_id IS NULL;

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Check how many registrations still need emails
SELECT
  COUNT(*) as registrations_without_contacts,
  COUNT(*) FILTER (WHERE email IS NULL) as registrations_without_email
FROM registrations
WHERE contact_id IS NULL;

-- Show progress
SELECT
  COUNT(*) as total_registrations,
  COUNT(contact_id) as linked_registrations,
  COUNT(*) - COUNT(contact_id) as unlinked_registrations,
  ROUND(100.0 * COUNT(contact_id) / COUNT(*), 1) as percent_linked
FROM registrations;
