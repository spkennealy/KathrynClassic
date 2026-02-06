-- Function to recalculate all leaderboard positions and scores
-- Run this after importing CSV data or making manual database changes

-- Function to recalculate positions for a specific tournament
CREATE OR REPLACE FUNCTION recalculate_tournament_positions(p_tournament_id UUID)
RETURNS void AS $$
DECLARE
  team_record RECORD;
  current_position INTEGER := 1;
  previous_score INTEGER := NULL;
  teams_at_position INTEGER := 0;
  team_index INTEGER := 0;
BEGIN
  -- Loop through all teams for this tournament, ordered by score_to_par
  FOR team_record IN
    SELECT id, score_to_par
    FROM golf_teams
    WHERE tournament_id = p_tournament_id
    ORDER BY score_to_par ASC, total_score ASC
  LOOP
    team_index := team_index + 1;

    -- Check if this is a new score (different from previous)
    IF previous_score IS NULL OR team_record.score_to_par != previous_score THEN
      -- New score - update position
      current_position := team_index;
      teams_at_position := 1;
      previous_score := team_record.score_to_par;
    ELSE
      -- Same score as previous - it's a tie
      teams_at_position := teams_at_position + 1;
    END IF;

    -- Update the team's position and tie status
    UPDATE golf_teams
    SET
      position = current_position,
      is_tied = (teams_at_position > 1 OR
                 EXISTS (
                   SELECT 1 FROM golf_teams gt2
                   WHERE gt2.tournament_id = p_tournament_id
                   AND gt2.score_to_par = team_record.score_to_par
                   AND gt2.id != team_record.id
                 )),
      updated_at = NOW()
    WHERE id = team_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to recalculate score_to_par for all teams in a tournament
CREATE OR REPLACE FUNCTION recalculate_score_to_par(p_tournament_id UUID)
RETURNS void AS $$
DECLARE
  tournament_par INTEGER;
BEGIN
  -- Get the tournament par
  SELECT par INTO tournament_par
  FROM tournaments
  WHERE id = p_tournament_id;

  -- If no par found, use default of 72
  IF tournament_par IS NULL THEN
    tournament_par := 72;
  END IF;

  -- Update all teams' score_to_par
  UPDATE golf_teams
  SET
    score_to_par = total_score - tournament_par,
    updated_at = NOW()
  WHERE tournament_id = p_tournament_id;
END;
$$ LANGUAGE plpgsql;

-- Master function to recalculate everything for a tournament
CREATE OR REPLACE FUNCTION recalculate_tournament_leaderboard(p_tournament_id UUID)
RETURNS void AS $$
BEGIN
  -- First recalculate score_to_par
  PERFORM recalculate_score_to_par(p_tournament_id);

  -- Then recalculate positions
  PERFORM recalculate_tournament_positions(p_tournament_id);
END;
$$ LANGUAGE plpgsql;

-- Function to recalculate ALL tournaments (useful after bulk imports)
CREATE OR REPLACE FUNCTION recalculate_all_tournaments()
RETURNS void AS $$
DECLARE
  tournament_record RECORD;
BEGIN
  FOR tournament_record IN
    SELECT DISTINCT tournament_id
    FROM golf_teams
    WHERE tournament_id IS NOT NULL
  LOOP
    PERFORM recalculate_tournament_leaderboard(tournament_record.tournament_id);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION recalculate_tournament_positions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_score_to_par(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_tournament_leaderboard(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_all_tournaments() TO authenticated;

-- Usage examples:
--
-- Recalculate a specific tournament:
-- SELECT recalculate_tournament_leaderboard('tournament-uuid-here');
--
-- Recalculate all tournaments:
-- SELECT recalculate_all_tournaments();
--
-- Just recalculate positions (if score_to_par is already correct):
-- SELECT recalculate_tournament_positions('tournament-uuid-here');
--
-- Just recalculate score_to_par (if positions need recalc after):
-- SELECT recalculate_score_to_par('tournament-uuid-here');
