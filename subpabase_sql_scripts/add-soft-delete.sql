-- Add soft delete columns to all main tables
-- Using deleted_at timestamp approach (NULL = active, timestamp = deleted)

-- Registrations
ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Contacts
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Tournaments
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Tournament Events
ALTER TABLE tournament_events
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Golf Teams
ALTER TABLE golf_teams
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Tournament Awards
ALTER TABLE tournament_awards
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Waitlist
ALTER TABLE waitlist
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comments explaining the soft delete
COMMENT ON COLUMN registrations.deleted_at IS 'Soft delete: NULL = active, timestamp = deleted';
COMMENT ON COLUMN contacts.deleted_at IS 'Soft delete: NULL = active, timestamp = deleted';
COMMENT ON COLUMN tournaments.deleted_at IS 'Soft delete: NULL = active, timestamp = deleted';
COMMENT ON COLUMN tournament_events.deleted_at IS 'Soft delete: NULL = active, timestamp = deleted';
COMMENT ON COLUMN golf_teams.deleted_at IS 'Soft delete: NULL = active, timestamp = deleted';
COMMENT ON COLUMN tournament_awards.deleted_at IS 'Soft delete: NULL = active, timestamp = deleted';
COMMENT ON COLUMN waitlist.deleted_at IS 'Soft delete: NULL = active, timestamp = deleted';

-- Create indexes for better query performance on deleted_at
CREATE INDEX IF NOT EXISTS idx_registrations_deleted_at ON registrations(deleted_at);
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON contacts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tournaments_deleted_at ON tournaments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tournament_events_deleted_at ON tournament_events(deleted_at);
CREATE INDEX IF NOT EXISTS idx_golf_teams_deleted_at ON golf_teams(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tournament_awards_deleted_at ON tournament_awards(deleted_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_deleted_at ON waitlist(deleted_at);

-- Update views to exclude soft-deleted records by default
DROP VIEW IF EXISTS admin_registration_details CASCADE;
CREATE VIEW admin_registration_details AS
SELECT
  r.id as registration_id,
  r.created_at as registration_date,
  r.payment_status,
  r.deleted_at,
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
WHERE r.deleted_at IS NULL  -- Only show active registrations
  AND c.deleted_at IS NULL  -- Only show active contacts
  AND t.deleted_at IS NULL  -- Only show active tournaments
GROUP BY
  r.id, r.created_at, r.payment_status, r.deleted_at, c.id, c.first_name, c.last_name,
  c.email, c.phone, t.year, t.id, r.golf_handicap, r.preferred_teammates,
  r.team_group_id
ORDER BY r.created_at DESC;
