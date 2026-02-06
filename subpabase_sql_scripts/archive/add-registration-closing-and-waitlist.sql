-- Add registration_closed column to tournaments table
ALTER TABLE tournaments
ADD COLUMN registration_closed BOOLEAN DEFAULT FALSE;

-- Create waitlist table
CREATE TABLE waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  UNIQUE(contact_id, tournament_id)
);

-- Create indexes for efficient queries
CREATE INDEX idx_waitlist_tournament ON waitlist(tournament_id);
CREATE INDEX idx_waitlist_contact ON waitlist(contact_id);
CREATE INDEX idx_waitlist_created ON waitlist(created_at);

-- Enable Row Level Security
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Public can insert into waitlist (for registration form)
CREATE POLICY "Allow public inserts to waitlist" ON waitlist
  FOR INSERT TO anon WITH CHECK (true);

-- Public can read waitlist (to check if already on waitlist)
CREATE POLICY "Allow public reads on waitlist" ON waitlist
  FOR SELECT TO anon USING (true);

-- Admin full access
CREATE POLICY "Allow authenticated users to manage waitlist" ON waitlist
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create view for waitlist with contact details
CREATE OR REPLACE VIEW waitlist_view AS
SELECT
  w.id,
  w.tournament_id,
  t.year as tournament_year,
  w.contact_id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  w.created_at,
  w.notes
FROM waitlist w
LEFT JOIN tournaments t ON w.tournament_id = t.id
LEFT JOIN contacts c ON w.contact_id = c.id
ORDER BY w.created_at ASC;

-- Grant access to the view
GRANT SELECT ON waitlist_view TO anon, authenticated;

-- Add comments for documentation
COMMENT ON TABLE waitlist IS 'Stores waitlist entries when tournament registration is full';
COMMENT ON COLUMN tournaments.registration_closed IS 'Whether registration is closed for this tournament (waitlist only)';
COMMENT ON VIEW waitlist_view IS 'Complete view of waitlist with contact and tournament details';
