// Naming a team across years.
//
// A team is one identity (`teams.name`) that can play under a different name each
// year (`golf_teams.display_name`, NULL = follow the identity). Two rules hold it
// together:
//
//   1. The identity equals the team's CURRENT name — rename the most recent year
//      and the team is known by that name from then on.
//   2. Renaming never changes what an earlier year shows. Before the identity
//      moves, every earlier year that was relying on it has its name of the day
//      stamped onto its own row, so past leaderboards keep the name that was
//      actually played under.
//
// Renaming an older year is a correction to that year alone and leaves the
// identity where it is.
//
// applyTeamName() is the single way to set a team's name — Team Builder (saving or
// editing a year's entry) and Admin → Teams (renaming the team itself) all go
// through it, so the two rules can't drift apart between screens.

import { supabase } from '../supabaseClient';

/**
 * Set the name for one year's entry, moving the identity when that entry is the
 * team's most recent year.
 *
 * @param {Object}  params
 * @param {string}  params.teamsId     - teams.id, the identity being named
 * @param {?string} params.golfTeamId  - golf_teams.id of the year being renamed;
 *                                       null means "rename the identity itself",
 *                                       which behaves as if the newest year was
 *                                       renamed (used by the Teams page).
 * @param {string}  params.newName
 * @returns {Promise<{movedIdentity: boolean, frozenYears: number[]}>} what changed,
 *          so callers can describe it in the audit log.
 */
export async function applyTeamName({ teamsId, golfTeamId = null, newName }) {
  const name = (newName || '').trim();
  if (!teamsId || !name) return { movedIdentity: false, frozenYears: [] };

  const { data: teamRow, error: teamErr } = await supabase
    .from('teams')
    .select('name')
    .eq('id', teamsId)
    .single();
  if (teamErr) throw teamErr;
  const identityName = teamRow?.name || '';

  const { data: entries, error: entriesErr } = await supabase
    .from('golf_teams')
    .select('id, display_name, tournaments ( year )')
    .eq('team_id', teamsId)
    .is('deleted_at', null);
  if (entriesErr) throw entriesErr;

  const participations = (entries || []).sort(
    (a, b) => (b.tournaments?.year || 0) - (a.tournaments?.year || 0)
  );
  const newest = participations[0] || null;
  const target = golfTeamId ? participations.find(p => p.id === golfTeamId) : newest;

  // Renaming a year that isn't the team's latest is a correction to that year:
  // record it there and leave the identity (and every other year) alone.
  const isLatest = !golfTeamId || (newest && target && target.id === newest.id);
  if (!isLatest) {
    const { error } = await supabase
      .from('golf_teams')
      .update({ display_name: name === identityName ? null : name })
      .eq('id', target.id);
    if (error) throw error;
    return { movedIdentity: false, frozenYears: [] };
  }

  if (name === identityName) {
    // Already the identity's name — just make sure this year follows it rather
    // than carrying a redundant copy.
    if (target?.display_name) {
      const { error } = await supabase
        .from('golf_teams')
        .update({ display_name: null })
        .eq('id', target.id);
      if (error) throw error;
    }
    return { movedIdentity: false, frozenYears: [] };
  }

  // Pin every earlier year that was showing the identity's name, so moving the
  // identity doesn't rewrite what those years played under.
  const toFreeze = participations.filter(
    p => p.id !== target?.id && !p.display_name
  );
  if (toFreeze.length > 0) {
    const { error } = await supabase
      .from('golf_teams')
      .update({ display_name: identityName })
      .in('id', toFreeze.map(p => p.id));
    if (error) throw error;
  }

  const { error: renameErr } = await supabase
    .from('teams')
    .update({ name })
    .eq('id', teamsId);
  if (renameErr) throw renameErr;

  // The renamed year now matches the identity, so it needs no override.
  if (target?.display_name) {
    const { error } = await supabase
      .from('golf_teams')
      .update({ display_name: null })
      .eq('id', target.id);
    if (error) throw error;
  }

  return {
    movedIdentity: true,
    frozenYears: toFreeze.map(p => p.tournaments?.year).filter(Boolean),
  };
}
