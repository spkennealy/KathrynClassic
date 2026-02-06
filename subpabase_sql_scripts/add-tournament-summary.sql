-- Add tournament summary and finalization fields to tournaments table
-- This will store AI-generated summaries and control public visibility

-- Add tournament summary field
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS tournament_summary TEXT;

-- Add finalization flag to control when tournament appears in public history
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT FALSE;

-- Add golfer count field
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS golfer_count INTEGER;

COMMENT ON COLUMN tournaments.tournament_summary IS 'AI-generated summary of the tournament including success, winners, money raised, and participation stats (1-2 paragraphs)';
COMMENT ON COLUMN tournaments.is_finalized IS 'When true, tournament will appear in public history page. Set this after all scores are entered and summary is written.';
COMMENT ON COLUMN tournaments.golfer_count IS 'Number of golfers who participated in the tournament';
