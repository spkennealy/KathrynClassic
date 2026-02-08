-- Golf Leaderboard Schema
-- Stores tournament golf scores and team information

-- Golf Teams table - stores each team participating in the golf tournament
CREATE TABLE golf_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  team_name TEXT, -- Optional team name (e.g., "The Birdies")
  team_number INTEGER, -- Team identifier (1, 2, 3, etc.)
  total_score INTEGER, -- Total strokes
  score_to_par INTEGER, -- Score relative to par (negative is under par)
  position INTEGER, -- Ranking position (1, 2, 3, etc.)
  is_tied BOOLEAN DEFAULT false, -- Whether this position is tied with others
  status TEXT DEFAULT 'F', -- 'F' for finished, or hole number like '15', 'Thru 15'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Golf Team Players table - stores players on each team
CREATE TABLE golf_team_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES golf_teams(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES registrations(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL, -- Full name for display
  handicap DECIMAL(4, 1), -- Player's handicap
  player_order INTEGER DEFAULT 1, -- Order to display players (1, 2, 3, 4)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Golf Round Scores table - stores scores by round (if multiple rounds)
CREATE TABLE golf_round_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES golf_teams(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL, -- 1, 2, etc.
  score INTEGER, -- Score for this round
  score_to_par INTEGER, -- Score to par for this round
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE golf_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE golf_team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE golf_round_scores ENABLE ROW LEVEL SECURITY;

-- Public read access for leaderboard
CREATE POLICY "Allow public reads on golf_teams" ON golf_teams
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public reads on golf_team_players" ON golf_team_players
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public reads on golf_round_scores" ON golf_round_scores
  FOR SELECT TO anon USING (true);

-- Admin write access
CREATE POLICY "Allow authenticated users to manage golf_teams" ON golf_teams
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to manage golf_team_players" ON golf_team_players
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to manage golf_round_scores" ON golf_round_scores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create helpful view for leaderboard display
CREATE OR REPLACE VIEW leaderboard_view AS
SELECT
  gt.id as team_id,
  gt.tournament_id,
  t.year as tournament_year,
  gt.team_name,
  gt.team_number,
  gt.total_score,
  gt.score_to_par,
  gt.position,
  gt.is_tied,
  gt.status,
  ARRAY_AGG(
    json_build_object(
      'name', gtp.player_name,
      'handicap', gtp.handicap,
      'order', gtp.player_order
    ) ORDER BY gtp.player_order
  ) as players
FROM golf_teams gt
LEFT JOIN golf_team_players gtp ON gt.id = gtp.team_id
LEFT JOIN tournaments t ON gt.tournament_id = t.id
GROUP BY gt.id, gt.tournament_id, t.year, gt.team_name, gt.team_number,
         gt.total_score, gt.score_to_par, gt.position, gt.is_tied, gt.status
ORDER BY gt.position ASC;

-- Grant access to the view
GRANT SELECT ON leaderboard_view TO anon, authenticated;

-- Example data for 2025 tournament (optional - you can add real data later)
-- Uncomment and modify with actual tournament_id
/*
-- Get tournament_id first
DO $$
DECLARE
  tournament_2025_id UUID;
BEGIN
  SELECT id INTO tournament_2025_id FROM tournaments WHERE year = 2025;

  -- Insert sample teams
  INSERT INTO golf_teams (tournament_id, team_name, team_number, total_score, score_to_par, position, is_tied, status)
  VALUES
    (tournament_2025_id, 'The Birdies', 1, 68, -4, 1, false, 'F'),
    (tournament_2025_id, 'Par Excellence', 2, 72, 0, 2, false, 'F'),
    (tournament_2025_id, 'Fore!', 3, 75, 3, 3, false, 'F');
END $$;
*/
