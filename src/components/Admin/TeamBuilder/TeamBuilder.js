import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { logAudit } from '../../../utils/audit';
import Select from '../Select';
import { buildTeamSuggestions } from './teamBuilderAlgorithm';
import ConfirmDialog from '../ConfirmDialog';
import {
  computeTeamHandicap,
  describeTeamHandicap,
  isHandicapEnabled,
  isScratchToLowestEnabled,
} from '../../../utils/handicap';
import { applyTeamName } from '../../../utils/teamNames';

export default function TeamBuilder() {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Saved data
  const [golfers, setGolfers] = useState([]);
  const [existingTeamContactIds, setExistingTeamContactIds] = useState(new Set());
  const [existingTeams, setExistingTeams] = useState([]);
  // Every team name on record, with the years it has played. A team is an identity
  // that recurs across years (a family, a sponsor) while its roster changes, so the
  // builder lets you re-enter one for this year and fill it with different players.
  const [teamCatalog, setTeamCatalog] = useState([]);
  // This year's team handicap rules, or null when the year is played straight up.
  const [handicapFormula, setHandicapFormula] = useState(null);

  // Pending (unsaved) teams — includes manually created and algorithm-suggested
  const [pendingTeams, setPendingTeams] = useState([]);

  // Drag state
  const [draggedGolfer, setDraggedGolfer] = useState(null);
  const [dragOver, setDragOver] = useState(null); // 'unassigned' | 'existing-{id}' | 'pending-{idx}'

  // Edit mode for existing teams
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamData, setEditingTeamData] = useState(null); // { name, members }

  // UI
  const [teamToDelete, setTeamToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showConfirmAll, setShowConfirmAll] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const currentTournament = tournaments.find(t => t.id === selectedTournament) || null;
  const isPublished = Boolean(currentTournament?.teams_published_at);

  // Publishing is all-or-nothing per tournament: it flips every saved team for
  // this year onto the public leaderboard at once. Until then the teams exist
  // and are editable, but RLS keeps them off the public site.
  const handleTogglePublish = async () => {
    if (!currentTournament) return;
    setPublishing(true);
    setError(null);
    try {
      const publishedAt = isPublished ? null : new Date().toISOString();
      const { error: err } = await supabase
        .from('tournaments')
        .update({ teams_published_at: publishedAt })
        .eq('id', currentTournament.id);
      if (err) throw err;

      await logAudit({
        action: isPublished ? 'tournament.teams_unpublished' : 'tournament.teams_published',
        entityType: 'tournament',
        entityId: currentTournament.id,
        entityLabel: `${currentTournament.year} teams`,
        changes: {
          teams_published_at: { from: currentTournament.teams_published_at ?? null, to: publishedAt },
        },
        metadata: { team_count: existingTeams.length },
      });

      setTournaments(prev =>
        prev.map(t => (t.id === currentTournament.id ? { ...t, teams_published_at: publishedAt } : t))
      );
      setShowPublishConfirm(false);
    } catch (err) {
      console.error('Error updating publish state:', err);
      setError(err.message || 'Failed to update publish state');
      setShowPublishConfirm(false);
    } finally {
      setPublishing(false);
    }
  };

  // Team handicap for a card's current line-up. Saved members carry `handicap`,
  // pool/pending members carry `golf_handicap` — either way it's the registration
  // number, so a card recalculates as players are dragged in and out.
  const handicapEnabled = isHandicapEnabled(handicapFormula);
  const scratchToLowest = isScratchToLowestEnabled(handicapFormula);
  const teamHandicapFor = (members) =>
    handicapEnabled
      ? computeTeamHandicap((members || []).map(m => m.golf_handicap ?? m.handicap), handicapFormula)
      : null;

  // Computed unassigned: golfers not saved to a team and not in any pending team
  const pendingMemberIds = new Set(
    pendingTeams.flatMap(t => t.members.map(m => m.contact_id).filter(Boolean))
  );
  // While editing an existing team, its removed members become available in the pool
  const editingMemberIds = new Set(
    (editingTeamData?.members || []).map(m => m.contact_id).filter(Boolean)
  );
  const unassignedGolfers = golfers.filter(g => {
    if (pendingMemberIds.has(g.contact_id)) return false;
    if (editingTeamId) {
      // Exclude members of OTHER saved teams; include if removed from editing team
      const inOtherSavedTeam = existingTeamContactIds.has(g.contact_id) && !editingMemberIds.has(g.contact_id);
      // Also exclude if still in the editing team's current member list (not removed)
      const stillInEditingTeam = editingMemberIds.has(g.contact_id);
      return !inOtherSavedTeam && !stillInEditingTeam;
    }
    return !existingTeamContactIds.has(g.contact_id);
  });

  // Teams that could be re-entered for this year: everything on record that isn't
  // already saved or queued for this tournament. `lastPlayed` and the count of
  // last roster's players who have registered again are what make a returning
  // team recognisable in the picker.
  const claimedTeamsIds = new Set(
    [...existingTeams.map(t => t.teams_id), ...pendingTeams.map(t => t.teams_id)].filter(Boolean)
  );
  const availableReturningIds = (lastRoster = []) =>
    lastRoster.filter(
      contactId =>
        golfers.some(g => g.contact_id === contactId) &&
        !existingTeamContactIds.has(contactId) &&
        !pendingMemberIds.has(contactId)
    );
  const reusableTeams = teamCatalog
    .filter(t => !claimedTeamsIds.has(t.id))
    .map(t => ({ ...t, returningCount: availableReturningIds(t.lastRoster).length }));

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, year, teams_published_at')
        .order('year', { ascending: false });
      if (error) throw error;
      setTournaments(data || []);
      if (data && data.length > 0) setSelectedTournament(data[0].id);
    } catch (err) {
      console.error('Error fetching tournaments:', err);
    }
  };

  const fetchData = useCallback(async () => {
    if (!selectedTournament) return;
    try {
      setLoading(true);
      setError(null);
      setPendingTeams([]);

      // The handicap formula lives with the year's rules. Read defensively: the
      // column is added by migration, and a year with no rules row simply has no
      // handicap, which shouldn't take the whole builder down.
      try {
        const { data: rules, error: rulesError } = await supabase
          .from('tournament_rules')
          .select('handicap_formula')
          .eq('tournament_id', selectedTournament)
          .maybeSingle();
        if (rulesError) throw rulesError;
        setHandicapFormula(rules?.handicap_formula || null);
      } catch (rulesErr) {
        console.warn('No handicap formula available for this tournament:', rulesErr.message);
        setHandicapFormula(null);
      }

      const { data: catalog, error: catalogError } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          golf_teams (
            deleted_at,
            tournament_id,
            tournaments ( year ),
            golf_team_players ( contact_id, player_order )
          )
        `)
        .is('golf_teams.deleted_at', null)
        .order('name');
      if (catalogError) throw catalogError;
      setTeamCatalog(
        (catalog || []).map(t => {
          const participations = (t.golf_teams || []).sort(
            (a, b) => (b.tournaments?.year || 0) - (a.tournaments?.year || 0)
          );
          // The team's most recent outing in some *other* year — the roster we
          // offer to carry forward when it's re-entered for this one.
          const previous = participations.find(gt => gt.tournament_id !== selectedTournament);
          return {
            id: t.id,
            name: t.name,
            years: participations.map(gt => gt.tournaments?.year).filter(Boolean),
            lastPlayed: previous?.tournaments?.year ?? null,
            lastRoster: (previous?.golf_team_players || [])
              .sort((a, b) => a.player_order - b.player_order)
              .map(p => p.contact_id)
              .filter(Boolean),
            // Everyone who has ever played for this team in another year. Used to
            // recognise the team when suggestions are generated — someone who
            // played for it two years ago still counts as a returning player.
            pastRoster: [
              ...new Set(
                participations
                  .filter(gt => gt.tournament_id !== selectedTournament)
                  .flatMap(gt => (gt.golf_team_players || []).map(p => p.contact_id))
                  .filter(Boolean)
              ),
            ],
          };
        })
      );

      const { data: golfEvent, error: eventError } = await supabase
        .from('tournament_events')
        .select('id')
        .eq('tournament_id', selectedTournament)
        .eq('event_type', 'golf_tournament')
        .maybeSingle();
      if (eventError) throw eventError;

      if (!golfEvent) {
        setGolfers([]);
        setExistingTeamContactIds(new Set());
        setExistingTeams([]);
        setError('No golf tournament event found for this tournament.');
        return;
      }

      const { data: regEvents, error: regEventsError } = await supabase
        .from('registration_events')
        .select('registration_id')
        .eq('tournament_event_id', golfEvent.id);
      if (regEventsError) throw regEventsError;

      if (!regEvents || regEvents.length === 0) {
        setGolfers([]);
        setExistingTeamContactIds(new Set());
        setExistingTeams([]);
        return;
      }

      const registrationIds = [...new Set(regEvents.map(re => re.registration_id))];

      const { data: registrations, error: regError } = await supabase
        .from('registrations')
        .select('id, contact_id, golf_handicap, preferred_teammates, registration_group_id, contacts(id, first_name, last_name, email)')
        .in('id', registrationIds)
        .not('contact_id', 'is', null);
      if (regError) throw regError;

      const golferList = (registrations || []).map(reg => ({
        id: reg.id,
        contact_id: reg.contact_id,
        first_name: reg.contacts?.first_name || '',
        last_name: reg.contacts?.last_name || '',
        email: reg.contacts?.email || '',
        golf_handicap: reg.golf_handicap,
        preferred_teammates: reg.preferred_teammates,
        registration_group_id: reg.registration_group_id,
      }));
      setGolfers(golferList);

      const { data: teams, error: teamsError } = await supabase
        .from('golf_teams')
        .select(`
          id,
          team_id,
          display_name,
          teams ( name ),
          golf_team_players ( player_name, contact_id, handicap, player_order )
        `)
        .eq('tournament_id', selectedTournament)
        .is('deleted_at', null)
        .order('teams(name)');
      if (teamsError) throw teamsError;

      const teamContactIds = new Set();
      for (const team of (teams || [])) {
        for (const player of (team.golf_team_players || [])) {
          if (player.contact_id) {
            teamContactIds.add(player.contact_id);
            continue;
          }
          const playerName = player.player_name?.trim().toLowerCase() || '';
          // Exact full name
          let match = golferList.find(
            g => `${g.first_name} ${g.last_name}`.toLowerCase() === playerName
          );
          // Last name only (when unique among registered golfers)
          if (!match) {
            const nameParts = playerName.split(/\s+/);
            const lastName = nameParts[nameParts.length - 1];
            const candidates = golferList.filter(g => g.last_name.toLowerCase() === lastName);
            if (candidates.length === 1) match = candidates[0];
          }
          // First name only (when unique)
          if (!match) {
            const firstName = playerName.split(/\s+/)[0];
            const candidates = golferList.filter(g => g.first_name.toLowerCase() === firstName);
            if (candidates.length === 1) match = candidates[0];
          }
          if (match) teamContactIds.add(match.contact_id);
        }
      }
      setExistingTeamContactIds(teamContactIds);
      // The stored handicap is a snapshot from when the team was built, so
      // prefer the registration's current value when we can link the player.
      const handicapByContactId = new Map(
        golferList
          .filter(g => g.contact_id && g.golf_handicap != null)
          .map(g => [g.contact_id, g.golf_handicap])
      );
      setExistingTeams(
        (teams || []).map(team => ({
          id: team.id,
          teams_id: team.team_id,
          // `name` is what this year's entry is called; `identityName` is what the
          // team is called in general. They differ only when a returning team plays
          // under a different name this year.
          name: team.display_name || team.teams?.name || 'Unnamed Team',
          identityName: team.teams?.name || '',
          members: (team.golf_team_players || [])
            .sort((a, b) => a.player_order - b.player_order)
            .map(p => ({
              player_name: p.player_name,
              handicap: handicapByContactId.get(p.contact_id) ?? p.handicap,
              contact_id: p.contact_id,
            })),
        }))
      );
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedTournament]);

  useEffect(() => {
    if (selectedTournament) fetchData();
  }, [selectedTournament, fetchData]);

  // --- Generate algorithm suggestions ---
  const handleGenerate = () => {
    const { suggestedTeams } = buildTeamSuggestions(golfers, existingTeamContactIds, {
      priorTeams: teamCatalog.map(t => ({
        id: t.id,
        name: t.name,
        lastPlayed: t.lastPlayed,
        roster: t.pastRoster,
      })),
      // Identities already saved for this year can't be entered a second time.
      claimedTeamIds: existingTeams.map(t => t.teams_id).filter(Boolean),
    });
    setPendingTeams(suggestedTeams);
  };

  // --- Add a blank team manually ---
  const handleAddNewTeam = () => {
    setPendingTeams(prev => [
      ...prev,
      { name: `Team ${prev.length + existingTeams.length + 1}`, teams_id: null, members: [] },
    ]);
  };

  // --- Re-enter an existing team for this year ---
  // Links the pending team to its teams row, so saving adds a new participation
  // under the same identity rather than creating a look-alike name. The roster is
  // seeded with last time's players who have registered again and aren't already
  // spoken for — the rest of the card is filled by hand, since a returning team
  // often sends different people.
  const handleReuseTeam = (teamsId) => {
    const team = reusableTeams.find(t => t.id === teamsId);
    if (!team) return;
    const returningMembers = availableReturningIds(team.lastRoster)
      .slice(0, 4)
      .map(contactId => ({
        ...golfers.find(g => g.contact_id === contactId),
        reasons: ['Returning player'],
      }));
    setPendingTeams(prev => [
      ...prev,
      {
        name: team.name,
        identityName: team.name,
        teams_id: team.id,
        lastPlayed: team.lastPlayed,
        members: returningMembers,
      },
    ]);
  };

  // Drop the link so the card goes back to being a brand new, freely named team.
  const handleUnlinkPendingTeam = (teamIdx) => {
    setPendingTeams(prev => {
      const updated = [...prev];
      updated[teamIdx] = { ...updated[teamIdx], teams_id: null, lastPlayed: null };
      return updated;
    });
  };

  // --- Drag & Drop ---
  const handleDragStart = (golfer) => setDraggedGolfer(golfer);
  const handleDragEnd = () => { setDraggedGolfer(null); setDragOver(null); };

  const handleDropOnPending = (teamIdx) => {
    if (!draggedGolfer) return;
    if (pendingTeams[teamIdx].members.length >= 4) return;
    setPendingTeams(prev => {
      const updated = [...prev];
      updated[teamIdx] = {
        ...updated[teamIdx],
        members: [...updated[teamIdx].members, { ...draggedGolfer, reasons: [] }],
      };
      return updated;
    });
    setDraggedGolfer(null);
    setDragOver(null);
  };

  // --- Edit existing saved team ---
  const handleStartEdit = (team) => {
    setEditingTeamId(team.id);
    setEditingTeamData({ name: team.name, members: [...team.members] });
  };

  const handleCancelEdit = () => {
    setEditingTeamId(null);
    setEditingTeamData(null);
  };

  const handleDropOnEditing = () => {
    if (!draggedGolfer || !editingTeamData) return;
    if (editingTeamData.members.length >= 4) return;
    setEditingTeamData(prev => ({
      ...prev,
      members: [...prev.members, {
        player_name: `${draggedGolfer.first_name} ${draggedGolfer.last_name}`,
        handicap: draggedGolfer.golf_handicap ?? null,
        contact_id: draggedGolfer.contact_id,
      }],
    }));
    setDraggedGolfer(null);
    setDragOver(null);
  };

  const handleRemoveFromEditing = (contactId) => {
    setEditingTeamData(prev => ({
      ...prev,
      members: prev.members.filter(m => m.contact_id !== contactId),
    }));
  };

  const handleSaveEdit = async () => {
    if (!editingTeamData || !editingTeamId) return;
    setSaving(true);
    setError(null);
    try {
      // Renaming the team's most recent year moves the identity to the new name and
      // pins earlier years to what they played under; renaming an older year is a
      // correction to that year alone. applyTeamName() decides which this is.
      const originalTeam = existingTeams.find(t => t.id === editingTeamId);
      let nameChange = null;
      if (editingTeamData.name !== originalTeam?.name && originalTeam?.teams_id) {
        nameChange = await applyTeamName({
          teamsId: originalTeam.teams_id,
          golfTeamId: editingTeamId,
          newName: editingTeamData.name,
        });
      }

      // Replace all players: delete then re-insert
      const { error: delErr } = await supabase
        .from('golf_team_players')
        .delete()
        .eq('team_id', editingTeamId);
      if (delErr) throw delErr;

      if (editingTeamData.members.length > 0) {
        const inserts = editingTeamData.members.map((m, i) => ({
          team_id: editingTeamId,
          player_name: m.player_name,
          contact_id: m.contact_id || null,
          handicap: m.handicap ?? null,
          player_order: i + 1,
        }));
        const { error: insErr } = await supabase.from('golf_team_players').insert(inserts);
        if (insErr) throw insErr;
      }

      await logAudit({
        action: 'golf_team.updated',
        entityType: 'golf_team',
        entityId: editingTeamId,
        entityLabel: editingTeamData.name,
        changes: originalTeam && originalTeam.name !== editingTeamData.name
          ? { name: { from: originalTeam.name, to: editingTeamData.name } }
          : undefined,
        metadata: {
          player_count: editingTeamData.members.length,
          ...(nameChange?.movedIdentity
            ? { team_renamed: true, years_pinned_to_previous_name: nameChange.frozenYears }
            : {}),
        },
      });

      // Rebuild existingTeamContactIds from scratch after edit
      await fetchData();
      setEditingTeamId(null);
      setEditingTeamData(null);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Only draft teams can be deleted. They're scratch work, so it's a hard delete:
  // the golf_teams row goes and golf_team_players cascades with it. Once the year
  // is published the teams are real history — the button is gone, and unpublishing
  // is the deliberate step you have to take before removing one. The `teams` name
  // row is left alone either way: it's shared across years and reused by name when
  // a team is saved again.
  const handleDeleteTeam = async () => {
    if (!teamToDelete || isPublished) return;
    setDeleting(true);
    setError(null);
    try {
      const { error: delErr } = await supabase
        .from('golf_teams')
        .delete()
        .eq('id', teamToDelete.id);
      if (delErr) throw delErr;

      await logAudit({
        action: 'golf_team.deleted',
        entityType: 'golf_team',
        entityId: teamToDelete.id,
        entityLabel: teamToDelete.name,
        // Permanent, so keep the roster in the log — it's the only record left.
        metadata: {
          permanent: true,
          player_count: teamToDelete.members.length,
          players: teamToDelete.members.map(m => m.player_name).filter(Boolean),
        },
      });

      if (editingTeamId === teamToDelete.id) {
        setEditingTeamId(null);
        setEditingTeamData(null);
      }
      setTeamToDelete(null);
      await fetchData();
    } catch (err) {
      console.error('Error deleting team:', err);
      setError(err.message || 'Failed to delete team');
      setTeamToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleRemoveFromPending = (teamIdx, contactId) => {
    setPendingTeams(prev => {
      const updated = [...prev];
      updated[teamIdx] = {
        ...updated[teamIdx],
        members: updated[teamIdx].members.filter(m => m.contact_id !== contactId),
      };
      return updated;
    });
  };

  // --- Save a single pending team ---
  const handleAcceptTeam = async (teamIdx) => {
    const team = pendingTeams[teamIdx];
    if (!team.name.trim()) { setError('Team name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      // A re-entered team already knows its identity; otherwise fall back to
      // matching on name so retyping an existing team's name still reuses it.
      let teamsId = team.teams_id;
      if (!teamsId) {
        const { data: existing } = await supabase.from('teams').select('id').ilike('name', team.name).maybeSingle();
        if (existing) {
          teamsId = existing.id;
        } else {
          const { data: newRow, error: e } = await supabase.from('teams').insert({ name: team.name }).select().single();
          if (e) throw e;
          teamsId = newRow.id;
        }
      }

      const identityName = team.teams_id
        ? (teamCatalog.find(t => t.id === team.teams_id)?.name ?? null)
        : team.name;
      const { data: newTeam, error: teamError } = await supabase
        .from('golf_teams')
        .insert({ tournament_id: selectedTournament, team_id: teamsId })
        .select().single();
      if (teamError) throw teamError;

      // A returning team entered under a new name renames the team from this year
      // on, pinning earlier years to the name they played under.
      if (team.name !== identityName) {
        await applyTeamName({ teamsId, golfTeamId: newTeam.id, newName: team.name });
      }

      if (team.members.length > 0) {
        const playerInserts = team.members.map((m, i) => ({
          team_id: newTeam.id,
          player_name: m.first_name ? `${m.first_name} ${m.last_name}` : (m.player_name || ''),
          contact_id: m.contact_id || null,
          handicap: m.golf_handicap ?? m.handicap ?? null,
          player_order: i + 1,
        }));
        const { error: pe } = await supabase.from('golf_team_players').insert(playerInserts);
        if (pe) throw pe;
      }

      await logAudit({
        action: 'golf_team.assigned',
        entityType: 'golf_team',
        entityId: newTeam.id,
        entityLabel: team.name,
        metadata: { member_count: team.members.length },
      });

      const newIds = new Set(existingTeamContactIds);
      team.members.forEach(m => { if (m.contact_id) newIds.add(m.contact_id); });
      setExistingTeamContactIds(newIds);
      setExistingTeams(prev => [...prev, {
        id: newTeam.id,
        teams_id: teamsId,
        name: team.name,
        identityName: identityName || team.name,
        members: team.members.map(m => ({
          player_name: m.first_name ? `${m.first_name} ${m.last_name}` : (m.player_name || ''),
          handicap: m.golf_handicap ?? m.handicap ?? null,
          contact_id: m.contact_id || null,
        })),
      }]);
      setPendingTeams(prev => prev.filter((_, i) => i !== teamIdx));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save team');
    } finally {
      setSaving(false);
    }
  };

  // --- Save all pending teams ---
  const handleAcceptAll = async () => {
    setShowConfirmAll(false);
    setSaving(true);
    setError(null);
    // Work through a snapshot since indices shift on each accept
    const snapshot = [...pendingTeams];
    let acceptedCount = 0;
    try {
      for (const team of snapshot) {
        if (!team.name.trim()) continue;
        let teamsId = team.teams_id;
        if (!teamsId) {
          const { data: existing } = await supabase.from('teams').select('id').ilike('name', team.name).maybeSingle();
          if (existing) {
            teamsId = existing.id;
          } else {
            const { data: newRow, error: e } = await supabase.from('teams').insert({ name: team.name }).select().single();
            if (e) throw e;
            teamsId = newRow.id;
          }
        }

        const identityName = team.teams_id
          ? (teamCatalog.find(t => t.id === team.teams_id)?.name ?? null)
          : team.name;
        const { data: newTeam, error: teamError } = await supabase
          .from('golf_teams')
          .insert({ tournament_id: selectedTournament, team_id: teamsId })
          .select().single();
        if (teamError) throw teamError;

        if (team.name !== identityName) {
          await applyTeamName({ teamsId, golfTeamId: newTeam.id, newName: team.name });
        }

        if (team.members.length > 0) {
          const playerInserts = team.members.map((m, i) => ({
            team_id: newTeam.id,
            player_name: m.first_name ? `${m.first_name} ${m.last_name}` : (m.player_name || ''),
            contact_id: m.contact_id || null,
            handicap: m.golf_handicap ?? m.handicap ?? null,
            player_order: i + 1,
          }));
          const { error: pe } = await supabase.from('golf_team_players').insert(playerInserts);
          if (pe) throw pe;
        }
        acceptedCount += 1;
      }

      // One summary entry for the bulk accept (not one per team).
      if (acceptedCount > 0) {
        await logAudit({
          action: 'golf_team.assigned',
          entityType: 'golf_team',
          entityLabel: `${acceptedCount} teams`,
          metadata: { team_count: acceptedCount, bulk: true },
        });
      }

      // Refresh all data
      await fetchData();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save teams');
    } finally {
      setSaving(false);
    }
  };

  const handleTeamNameChange = (teamIdx, name) => {
    setPendingTeams(prev => {
      const updated = [...prev];
      updated[teamIdx] = { ...updated[teamIdx], name };
      return updated;
    });
  };

  const handleDismiss = (teamIdx) => {
    setPendingTeams(prev => prev.filter((_, i) => i !== teamIdx));
  };

  // Small shared badge so a card's handicap reads the same whether it's saved,
  // being edited or still pending. Hover shows the arithmetic.
  const HandicapBadge = ({ members }) => {
    const result = teamHandicapFor(members);
    if (!result) return null;
    return (
      <div className="mt-1 text-center">
        <span
          title={describeTeamHandicap(result)}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
        >
          Team handicap {result.strokes}
        </span>
      </div>
    );
  };

  const totalGolfers = golfers.length;
  const onTeams = existingTeamContactIds.size;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Team Builder</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Drag golfers from the pool on the left onto team cards on the right.
            {handicapEnabled
              ? ' Team handicaps follow this year\u2019s rules and update as you build.'
              : ' This year has no team handicap \u2014 add one in Admin \u2192 Rules.'}
            {scratchToLowest &&
              ' The lowest team in the field will be scratched to 0 on the leaderboard, with every other team\u2019s handicap reduced by that amount \u2014 the numbers shown here are before that adjustment.'}
          </p>
        </div>
        {pendingTeams.length > 0 && (
          <button
            onClick={() => setShowConfirmAll(true)}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : `Save All (${pendingTeams.length})`}
          </button>
        )}
      </div>

      {/* Tournament selector + actions */}
      <div className="bg-white dark:bg-night-800 p-4 rounded-lg shadow flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tournament</label>
          <Select
            value={selectedTournament}
            onChange={e => setSelectedTournament(e.target.value)}
            className="block w-full max-w-xs"
          >
            {tournaments.map(t => <option key={t.id} value={t.id}>{t.year}</option>)}
          </Select>
        </div>
        <button
          onClick={handleAddNewTeam}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-night-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 hover:bg-gray-50 dark:bg-night-700 disabled:opacity-50"
        >
          + Add Team
        </button>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Returning team
          </label>
          <Select
            value=""
            onChange={e => handleReuseTeam(e.target.value)}
            disabled={loading || reusableTeams.length === 0}
            placeholder={reusableTeams.length === 0 ? 'None available' : 'Add a team from a past year…'}
            className="block w-full sm:w-64"
          >
            {reusableTeams.map(t => (
              <option key={t.id} value={t.id}>
                {[
                  t.name,
                  t.lastPlayed ? `last played ${t.lastPlayed}` : null,
                  t.returningCount > 0
                    ? `${t.returningCount} player${t.returningCount !== 1 ? 's' : ''} back`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' — ')}
              </option>
            ))}
          </Select>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading || golfers.length === 0}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
        >
          Generate Suggestions
        </button>
        <button
          onClick={() => setShowPublishConfirm(true)}
          disabled={loading || publishing || !currentTournament || (!isPublished && existingTeams.length === 0)}
          title={
            !isPublished && existingTeams.length === 0
              ? 'Save at least one team before publishing'
              : undefined
          }
          className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium disabled:opacity-50 ${
            isPublished
              ? 'border-gray-300 dark:border-night-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-night-700 hover:bg-gray-50 dark:hover:bg-night-600'
              : 'border-transparent text-white bg-green-600 hover:bg-green-700'
          }`}
        >
          {isPublished ? 'Unpublish teams' : 'Publish teams'}
        </button>
      </div>

      {/* Draft / published state — the whole point is knowing which you're in. */}
      {currentTournament && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            isPublished
              ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-300'
              : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300'
          }`}
        >
          {isPublished ? (
            <>
              <strong>Published.</strong> The {currentTournament.year} teams are live on the public
              leaderboard. Edits you make here go public immediately, and teams can no longer be
              deleted — unpublish first if you need to remove one.
            </>
          ) : (
            <>
              <strong>Draft.</strong> The {currentTournament.year} teams are saved but hidden from the
              public site — they won't appear on the leaderboard, in its year picker, or in tee times
              until you publish.
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Stats */}
      {!loading && golfers.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total Golfers', value: totalGolfers, color: 'text-gray-900 dark:text-gray-100' },
            { label: 'On Teams', value: onTeams, color: 'text-green-600' },
            { label: 'Pending Teams', value: pendingTeams.length, color: 'text-primary-600 dark:text-primary-400' },
            { label: 'Unassigned', value: unassignedGolfers.length, color: 'text-yellow-600' },
          ].map(stat => (
            <div key={stat.label} className="overflow-hidden rounded-lg bg-white dark:bg-night-800 px-4 py-4 shadow">
              <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</dt>
              <dd className={`mt-1 text-3xl font-semibold tracking-tight ${stat.color}`}>{stat.value}</dd>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading golfers...</p>
        </div>
      )}

      {/* Main two-panel layout */}
      {!loading && golfers.length > 0 && (
        <div className="flex gap-4 items-start">
          {/* Left: Unassigned pool */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white dark:bg-night-800 shadow rounded-lg overflow-hidden">
              <div
                className={`px-3 py-2 border-b border-gray-200 dark:border-night-700 ${dragOver === 'unassigned' ? 'bg-yellow-50' : 'bg-gray-50 dark:bg-night-700'}`}
                onDragOver={e => { e.preventDefault(); setDragOver('unassigned'); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => setDragOver(null)}
              >
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Unassigned ({unassignedGolfers.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {unassignedGolfers.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-gray-400 text-center">All assigned</p>
                ) : (
                  unassignedGolfers.map(golfer => (
                    <div
                      key={golfer.contact_id}
                      draggable
                      onDragStart={() => handleDragStart(golfer)}
                      onDragEnd={handleDragEnd}
                      className={`px-3 py-2.5 cursor-grab active:cursor-grabbing select-none hover:bg-gray-50 dark:bg-night-700 ${
                        draggedGolfer?.contact_id === golfer.contact_id ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <svg className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
                        </svg>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {golfer.first_name} {golfer.last_name}
                          </div>
                          {golfer.golf_handicap != null && (
                            <div className="text-xs text-gray-400">HCP {golfer.golf_handicap}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Teams */}
          <div className="flex-1 min-w-0">
            {/* Existing saved teams */}
            {existingTeams.length > 0 && (
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Saved Teams ({existingTeams.length})
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {existingTeams.map(team => {
                    const isEditing = editingTeamId === team.id;
                    const displayMembers = isEditing ? editingTeamData.members : team.members;
                    const isFull = displayMembers.length >= 4;
                    const isOver = dragOver === `existing-${team.id}`;

                    return (
                      <div
                        key={team.id}
                        onDragOver={e => { if (isEditing && !isFull && draggedGolfer) { e.preventDefault(); setDragOver(`existing-${team.id}`); } }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={() => isEditing && handleDropOnEditing()}
                        className={`bg-white dark:bg-night-800 shadow rounded-lg p-3 border-2 transition-colors ${
                          isEditing
                            ? isOver ? 'border-primary-400 bg-primary-50' : 'border-primary-300'
                            : 'border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingTeamData.name}
                              onChange={e => setEditingTeamData(prev => ({ ...prev, name: e.target.value }))}
                              title={`Sets the name for ${currentTournament?.year || 'this year'} only`}
                              className="text-sm font-semibold text-gray-900 dark:text-gray-100 border-0 border-b border-primary-300 focus:border-primary-500 focus:ring-0 px-0 py-0.5 bg-transparent w-full mr-2"
                            />
                          ) : (
                            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{team.name}</span>
                          )}
                          <span className="text-xs text-gray-400 flex-shrink-0">{displayMembers.length}/4</span>
                        </div>

                        {(isEditing || team.name !== team.identityName) && team.identityName && (
                          <p className="-mt-1 mb-2 text-xs text-gray-400 truncate">
                            {team.name !== team.identityName
                              ? `Normally “${team.identityName}”`
                              : `Renaming applies to ${currentTournament?.year || 'this year'} only`}
                          </p>
                        )}

                        <div className="space-y-1 mb-2">
                          {displayMembers.map((m, i) => (
                            <div key={m.contact_id || i} className="text-sm text-gray-600 dark:text-gray-400 flex items-center justify-between">
                              <span>
                                <span className="text-gray-300 text-xs mr-1">{i + 1}.</span>
                                {m.player_name}
                                {m.handicap != null && <span className="text-gray-400 text-xs ml-1">({m.handicap})</span>}
                              </span>
                              {isEditing && (
                                <button
                                  onClick={() => handleRemoveFromEditing(m.contact_id)}
                                  className="text-gray-300 hover:text-red-500 ml-1 flex-shrink-0"
                                  title="Remove"
                                >×</button>
                              )}
                            </div>
                          ))}
                        </div>

                        {isEditing && !isFull && (
                          <div className={`border-2 border-dashed rounded p-1.5 text-center text-xs mb-2 ${
                            isOver ? 'border-primary-400 text-primary-600 dark:text-primary-400 bg-primary-50' : 'border-gray-200 dark:border-night-700 text-gray-400'
                          }`}>
                            {draggedGolfer ? 'Drop here' : `${4 - displayMembers.length} spot${4 - displayMembers.length !== 1 ? 's' : ''} open`}
                          </div>
                        )}

                        {!isEditing && !isFull && (
                          <div className="mt-1 text-xs text-gray-400 text-center">{4 - displayMembers.length} spot{4 - displayMembers.length !== 1 ? 's' : ''} open</div>
                        )}
                        {!isEditing && isFull && (
                          <div className="mt-1 text-xs text-gray-400 text-center">Full</div>
                        )}

                        <HandicapBadge members={displayMembers} />

                        <div className="mt-2 flex gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={handleSaveEdit}
                                disabled={saving}
                                className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                              >
                                {saving ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="px-2 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-night-600 hover:bg-gray-50 dark:bg-night-700 rounded"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStartEdit(team)}
                                className={`px-2 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-night-600 hover:bg-gray-50 dark:bg-night-700 rounded ${isPublished ? 'w-full' : 'flex-1'}`}
                              >
                                Edit
                              </button>
                              {!isPublished && (
                                <button
                                  onClick={() => setTeamToDelete(team)}
                                  disabled={deleting}
                                  title="Delete this draft team permanently"
                                  className="px-2 py-1.5 text-xs font-medium text-red-700 border border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pending (unsaved) teams */}
            {pendingTeams.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Pending Teams — not yet saved ({pendingTeams.length})
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingTeams.map((team, teamIdx) => {
                    const isFull = team.members.length >= 4;
                    const isOver = dragOver === `pending-${teamIdx}`;
                    return (
                      <div
                        key={teamIdx}
                        onDragOver={e => { if (!isFull && draggedGolfer) { e.preventDefault(); setDragOver(`pending-${teamIdx}`); } }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={() => handleDropOnPending(teamIdx)}
                        className={`bg-white dark:bg-night-800 shadow rounded-lg p-3 border-2 transition-colors ${
                          isOver ? 'border-primary-400 bg-primary-50' : 'border-dashed border-gray-300 dark:border-night-600'
                        }`}
                      >
                        {/* Editing the name of a returning team sets it for this year
                            only — past years keep the name they were played under. */}
                        <input
                          type="text"
                          value={team.name}
                          onChange={e => handleTeamNameChange(teamIdx, e.target.value)}
                          className="block w-full text-sm font-semibold text-gray-900 dark:text-gray-100 border-0 border-b border-gray-200 dark:border-night-700 focus:border-primary-500 focus:ring-0 px-0 py-0.5 mb-1 bg-transparent"
                          placeholder="Team name"
                        />
                        {team.teams_id && (
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              Returning{team.lastPlayed ? ` — last played ${team.lastPlayed}` : ''}
                            </span>
                            <button
                              onClick={() => handleUnlinkPendingTeam(teamIdx)}
                              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
                              title="Make this a separate new team instead"
                            >
                              Unlink
                            </button>
                          </div>
                        )}
                        {team.teams_id && team.name !== team.identityName && (
                          <p className="-mt-1 mb-2 text-xs text-gray-400 truncate" title={`Known as "${team.identityName}" in other years`}>
                            Normally “{team.identityName}”
                          </p>
                        )}

                        {/* Members */}
                        <div className="space-y-1 mb-2">
                          {team.members.map((m, i) => (
                            <div key={m.contact_id || i} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                              <span>
                                <span className="text-gray-300 text-xs mr-1">{i + 1}.</span>
                                {m.first_name ? `${m.first_name} ${m.last_name}` : m.player_name}
                                {(m.golf_handicap ?? m.handicap) != null && (
                                  <span className="text-gray-400 text-xs ml-1">({m.golf_handicap ?? m.handicap})</span>
                                )}
                              </span>
                              <button
                                onClick={() => handleRemoveFromPending(teamIdx, m.contact_id)}
                                className="text-gray-300 hover:text-red-500 ml-1 flex-shrink-0"
                                title="Remove"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Drop zone */}
                        {!isFull && (
                          <div className={`border-2 border-dashed rounded p-1.5 text-center text-xs mb-2 ${
                            isOver ? 'border-primary-400 text-primary-600 dark:text-primary-400 bg-primary-50' : 'border-gray-200 dark:border-night-700 text-gray-400'
                          }`}>
                            {draggedGolfer ? 'Drop here' : `${4 - team.members.length} spot${4 - team.members.length !== 1 ? 's' : ''} open`}
                          </div>
                        )}

                        <HandicapBadge members={team.members} />

                        {/* Reason tags (from algorithm) */}
                        {team.members.some(m => m.reasons?.length > 0) && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {team.members.flatMap(m => m.reasons || []).filter((r, i, a) => a.indexOf(r) === i).map((reason, ri) => (
                              <span key={ri} className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                reason.startsWith('Returning') ? 'bg-green-100 text-green-700'
                                : reason.startsWith('Registered') ? 'bg-blue-100 text-blue-700'
                                : reason.startsWith('Preferred') || reason.startsWith('Prefers') ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 dark:bg-night-900 text-gray-600 dark:text-gray-400'
                              }`}>{reason}</span>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptTeam(teamIdx)}
                            disabled={saving || team.members.length === 0}
                            className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => handleDismiss(teamIdx)}
                            className="px-2 py-1.5 text-xs font-medium text-red-700 border border-red-300 hover:bg-red-50 rounded"
                          >
                            Discard
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state for teams panel */}
            {existingTeams.length === 0 && pendingTeams.length === 0 && (
              <div className="bg-white dark:bg-night-800 shadow rounded-lg p-8 text-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-night-700">
                <p className="text-sm">No teams yet.</p>
                <p className="text-sm mt-1">Click <strong>+ Add Team</strong> to create one manually, or <strong>Generate Suggestions</strong> to auto-assign.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state — no registrations */}
      {!loading && golfers.length === 0 && !error && (
        <div className="text-center py-12 bg-white dark:bg-night-800 rounded-lg shadow">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No golf registrations</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Select a tournament with golf registrations to get started.</p>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(teamToDelete)}
        onClose={() => setTeamToDelete(null)}
        onConfirm={handleDeleteTeam}
        title="Delete Team"
        message={
          teamToDelete
            ? `Permanently delete "${teamToDelete.name}"?${
                teamToDelete.members.length > 0
                  ? ` Its ${teamToDelete.members.length} player${teamToDelete.members.length !== 1 ? 's' : ''} will go back to the unassigned pool.`
                  : ''
              } Draft teams aren't kept in the recycle bin, so this can't be undone.`
            : ''
        }
        confirmText={deleting ? 'Deleting…' : 'Delete'}
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />

      <ConfirmDialog
        isOpen={showConfirmAll}
        onClose={() => setShowConfirmAll(false)}
        onConfirm={handleAcceptAll}
        title="Save All Teams"
        message={`This will save ${pendingTeams.length} team${pendingTeams.length !== 1 ? 's' : ''} with a total of ${pendingTeams.reduce((sum, t) => sum + t.members.length, 0)} players. Continue?`}
        confirmText="Save All"
        confirmButtonClass="bg-primary-600 hover:bg-primary-700"
      />

      <ConfirmDialog
        isOpen={showPublishConfirm}
        onClose={() => setShowPublishConfirm(false)}
        onConfirm={handleTogglePublish}
        title={isPublished ? 'Unpublish teams' : 'Publish teams'}
        message={
          isPublished
            ? `Hide the ${currentTournament?.year} teams from the public leaderboard? They'll stay saved here, and the leaderboard will fall back to the most recent published year.`
            : `Publish all ${existingTeams.length} saved team${existingTeams.length !== 1 ? 's' : ''} for ${currentTournament?.year}? They'll appear on the public leaderboard right away, and ${currentTournament?.year} becomes the year it opens on.`
        }
        confirmText={isPublished ? 'Unpublish' : 'Publish'}
        confirmButtonClass={isPublished ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}
      />
    </div>
  );
}
