// Helpers for keeping saved golf teams in sync with registration data.
//
// `golf_team_players.handicap` is a snapshot taken when a team is built, so it
// drifts whenever an admin later edits the player's handicap on their
// registration. syncTeamPlayerHandicap() pushes that edit through to any team
// the player is already on for the same tournament, so the Team Builder, team
// list and leaderboard all show the current number.

import { supabase } from '../supabaseClient';

// Update the handicap on every saved golf team player row for `contactId` in
// `tournamentId`. Rows are matched by contact_id, so players added to a team
// without a linked contact are left alone. No-ops when the tournament has no
// teams yet.
export async function syncTeamPlayerHandicap({ tournamentId, contactId, handicap }) {
  if (!tournamentId || !contactId) return;

  const { data: teams, error: teamsError } = await supabase
    .from('golf_teams')
    .select('id')
    .eq('tournament_id', tournamentId);
  if (teamsError) throw teamsError;

  const teamIds = (teams || []).map(t => t.id);
  if (teamIds.length === 0) return;

  const { error: updateError } = await supabase
    .from('golf_team_players')
    .update({ handicap: handicap === '' || handicap == null ? null : parseFloat(handicap) })
    .in('team_id', teamIds)
    .eq('contact_id', contactId);
  if (updateError) throw updateError;
}
