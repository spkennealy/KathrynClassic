-- =====================================================
-- HELPER: Add Emails to Contacts
-- Use this when you're ready to add emails to contacts
-- that currently have NULL email addresses
-- =====================================================

-- =====================================================
-- STEP 1: View contacts without emails
-- =====================================================
SELECT
  c.id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  COUNT(r.id) as registration_count,
  STRING_AGG(DISTINCT t.year::text, ', ') as tournament_years
FROM contacts c
LEFT JOIN registrations r ON r.contact_id = c.id
LEFT JOIN tournaments t ON r.tournament_id = t.id
WHERE c.email IS NULL
GROUP BY c.id
ORDER BY c.last_name, c.first_name;

-- =====================================================
-- STEP 2: Add email to a specific contact by ID
-- =====================================================
-- Replace the UUID and email with actual values

-- UPDATE contacts
-- SET email = 'user@example.com', updated_at = NOW()
-- WHERE id = 'contact-uuid-here';

-- =====================================================
-- STEP 3: Add email to a contact by name
-- =====================================================
-- Update by first and last name (be careful with common names!)

-- UPDATE contacts
-- SET email = 'user@example.com', updated_at = NOW()
-- WHERE first_name = 'John' AND last_name = 'Doe'
--   AND email IS NULL;

-- =====================================================
-- STEP 4: Bulk email updates from spreadsheet
-- =====================================================
-- If you have a CSV with contact IDs and emails:

-- CREATE TEMP TABLE temp_contact_emails (
--   contact_id UUID,
--   email TEXT
-- );

-- Insert your data:
-- INSERT INTO temp_contact_emails (contact_id, email) VALUES
-- ('uuid-1', 'person1@example.com'),
-- ('uuid-2', 'person2@example.com'),
-- ('uuid-3', 'person3@example.com');

-- Update all at once:
-- UPDATE contacts c
-- SET email = tce.email, updated_at = NOW()
-- FROM temp_contact_emails tce
-- WHERE c.id = tce.contact_id;

-- Clean up:
-- DROP TABLE temp_contact_emails;

-- =====================================================
-- STEP 5: Verify email was added
-- =====================================================
-- Check a specific contact
-- SELECT id, first_name, last_name, email, updated_at
-- FROM contacts
-- WHERE id = 'contact-uuid-here';

-- =====================================================
-- STEP 6: Check progress
-- =====================================================
SELECT
  COUNT(*) as total_contacts,
  COUNT(*) FILTER (WHERE email IS NOT NULL) as contacts_with_email,
  COUNT(*) FILTER (WHERE email IS NULL) as contacts_without_email,
  ROUND(100.0 * COUNT(*) FILTER (WHERE email IS NOT NULL) / COUNT(*), 1) as percent_complete
FROM contacts;

-- =====================================================
-- OPTIONAL: Re-enable email requirement (later)
-- =====================================================
-- Once all contacts have emails, you can make email required:

-- Check if any contacts still have NULL email:
-- SELECT COUNT(*) FROM contacts WHERE email IS NULL;
-- If 0, proceed:

-- Make email required again:
-- ALTER TABLE contacts
-- ALTER COLUMN email SET NOT NULL;

-- Recreate the unique index without the WHERE clause:
-- DROP INDEX IF EXISTS idx_contacts_email;
-- CREATE UNIQUE INDEX idx_contacts_email ON contacts(email);
