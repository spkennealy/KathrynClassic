-- Tee Times Schema
-- Manages golf tournament tee times and team/player assignments

-- First, update golf_team_players to link with contacts
-- Add contact_id column (nullable for guests/external players)
ALTER TABLE golf_team_players
ADD COLUMN contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_golf_team_players_contact_id ON golf_team_players(contact_id);

-- Tee Times table - stores scheduled tee times for golf tournament
CREATE TABLE tee_times (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  tournament_event_id UUID REFERENCES tournament_events(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES golf_teams(id) ON DELETE SET NULL,
  tee_time TIMESTAMP WITH TIME ZONE NOT NULL,
  hole_number INTEGER DEFAULT 1, -- Starting hole (1 for hole 1, 10 for back nine start)
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_tee_times_tournament ON tee_times(tournament_id);
CREATE INDEX idx_tee_times_event ON tee_times(tournament_event_id);
CREATE INDEX idx_tee_times_team ON tee_times(team_id);
CREATE INDEX idx_tee_times_time ON tee_times(tee_time);

-- Enable Row Level Security
ALTER TABLE tee_times ENABLE ROW LEVEL SECURITY;

-- Public read access for tee times
CREATE POLICY "Allow public reads on tee_times" ON tee_times
  FOR SELECT TO anon USING (true);

-- Admin write access
CREATE POLICY "Allow authenticated users to manage tee_times" ON tee_times
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create helpful view for tee times with player details
CREATE OR REPLACE VIEW tee_times_view AS
SELECT
  tt.id as tee_time_id,
  tt.tournament_id,
  t.year as tournament_year,
  te.event_name,
  tt.tee_time,
  tt.hole_number,
  tt.notes,
  gt.id as team_id,
  gt.team_name,
  gt.team_number,
  ARRAY_AGG(
    json_build_object(
      'player_name', gtp.player_name,
      'handicap', gtp.handicap,
      'contact_id', gtp.contact_id,
      'contact_email', c.email,
      'contact_phone', c.phone,
      'order', gtp.player_order
    ) ORDER BY gtp.player_order
  ) as players
FROM tee_times tt
LEFT JOIN tournaments t ON tt.tournament_id = t.id
LEFT JOIN tournament_events te ON tt.tournament_event_id = te.id
LEFT JOIN golf_teams gt ON tt.team_id = gt.id
LEFT JOIN golf_team_players gtp ON gt.id = gtp.team_id
LEFT JOIN contacts c ON gtp.contact_id = c.id
GROUP BY tt.id, tt.tournament_id, t.year, te.event_name, tt.tee_time,
         tt.hole_number, tt.notes, gt.id, gt.team_name, gt.team_number
ORDER BY tt.tee_time ASC;

-- Grant access to the view
GRANT SELECT ON tee_times_view TO anon, authenticated;

-- Add comment for documentation
COMMENT ON TABLE tee_times IS 'Stores golf tournament tee times and team assignments';
COMMENT ON COLUMN tee_times.hole_number IS 'Starting hole number (1-18)';
COMMENT ON VIEW tee_times_view IS 'Complete view of tee times with team and player details';
