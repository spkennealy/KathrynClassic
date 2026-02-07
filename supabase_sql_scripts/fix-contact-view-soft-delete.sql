-- Fix admin_contact_activity view to exclude soft-deleted contacts
-- This ensures deleted contacts don't appear in the contact list

DROP VIEW IF EXISTS admin_contact_activity;

CREATE VIEW admin_contact_activity AS
SELECT
  c.id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.created_at,
  c.updated_at,
  c.deleted_at,
  COUNT(DISTINCT r.id) as registration_count,
  MAX(r.created_at) as last_registration_date,
  ARRAY_AGG(DISTINCT t.year ORDER BY t.year DESC) FILTER (WHERE t.year IS NOT NULL) as tournament_years
FROM contacts c
LEFT JOIN registrations r ON c.id = r.contact_id AND r.deleted_at IS NULL
LEFT JOIN tournaments t ON r.tournament_id = t.id AND t.deleted_at IS NULL
WHERE c.deleted_at IS NULL  -- Exclude soft-deleted contacts
GROUP BY c.id, c.first_name, c.last_name, c.email, c.phone, c.created_at, c.updated_at, c.deleted_at;

COMMENT ON VIEW admin_contact_activity IS 'Contact list with activity stats, excluding soft-deleted records';
