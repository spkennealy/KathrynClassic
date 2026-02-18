import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { buildTeamSuggestions } from './teamBuilderAlgorithm';
import ConfirmDialog from '../ConfirmDialog';

export default function TeamBuilder() {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Data
  const [golfers, setGolfers] = useState([]);
  const [existingTeamContactIds, setExistingTeamContactIds] = useState(new Set());
  const [suggestedTeams, setSuggestedTeams] = useState([]);
  const [unassigned, setUnassigned] = useState([]);

  // UI state
  const [selectedUnassigned, setSelectedUnassigned] = useState(new Set());
  const [editingTeamIdx, setEditingTeamIdx] = useState(null);
  const [swapPosition, setSwapPosition] = useState(null); // { teamIdx, memberIdx }
  const [showConfirmAll, setShowConfirmAll] = useState(false);

  // Stats
  const totalGolfers = golfers.length;
  const onTeams = existingTeamContactIds.size;
  const suggestedCount = suggestedTeams.length;
  const unassignedCount = unassigned.length;

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, year')
        .order('year', { ascending: false });

      if (error) throw error;
      setTournaments(data || []);

      if (data && data.length > 0) {
        setSelectedTournament(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching tournaments:', err);
    }
  };

  const fetchData = useCallback(async () => {
    if (!selectedTournament) return;

    try {
      setLoading(true);
      setError(null);
      setSuggestedTeams([]);
      setUnassigned([]);
      setSelectedUnassigned(new Set());

      // 1. Find the golf_tournament event for this tournament
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
        setError('No golf tournament event found for this tournament.');
        return;
      }

      // 2. Get registration_ids registered for that event
      const { data: regEvents, error: regEventsError } = await supabase
        .from('registration_events')
        .select('registration_id')
        .eq('tournament_event_id', golfEvent.id);

      if (regEventsError) throw regEventsError;

      if (!regEvents || regEvents.length === 0) {
        setGolfers([]);
        setExistingTeamContactIds(new Set());
        return;
      }

      const registrationIds = [...new Set(regEvents.map((re) => re.registration_id))];

      // 3. Fetch registrations with contact data
      const { data: registrations, error: regError } = await supabase
        .from('registrations')
        .select('id, contact_id, golf_handicap, preferred_teammates, registration_group_id, contacts(id, first_name, last_name, email)')
        .in('id', registrationIds)
        .not('contact_id', 'is', null);

      if (regError) throw regError;

      const golferList = (registrations || []).map((reg) => ({
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

      // 4. Fetch existing team player contact_ids for this tournament
      const { data: teams, error: teamsError } = await supabase
        .from('golf_teams')
        .select('id, golf_team_players(player_name)')
        .eq('tournament_id', selectedTournament);

      if (teamsError) throw teamsError;

      // Match team player names to contact_ids
      const teamContactIds = new Set();
      if (teams) {
        for (const team of teams) {
          if (team.golf_team_players) {
            for (const player of team.golf_team_players) {
              // Match by name to golfer list
              const match = golferList.find(
                (g) =>
                  `${g.first_name} ${g.last_name}`.toLowerCase() ===
                  player.player_name?.toLowerCase()
              );
              if (match) teamContactIds.add(match.contact_id);
            }
          }
        }
      }

      setExistingTeamContactIds(teamContactIds);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedTournament]);

  useEffect(() => {
    if (selectedTournament) {
      fetchData();
    }
  }, [selectedTournament, fetchData]);

  const handleGenerate = () => {
    const { suggestedTeams: teams, unassigned: left } = buildTeamSuggestions(
      golfers,
      existingTeamContactIds
    );
    setSuggestedTeams(teams);
    setUnassigned(left);
    setSelectedUnassigned(new Set());
    setEditingTeamIdx(null);
    setSwapPosition(null);
  };

  // --- Accept a single team ---
  const handleAcceptTeam = async (teamIdx) => {
    const team = suggestedTeams[teamIdx];
    setSaving(true);
    setError(null);

    try {
      // Create golf_team
      const { data: newTeam, error: teamError } = await supabase
        .from('golf_teams')
        .insert({
          tournament_id: selectedTournament,
          team_name: team.name,
          team_number: 0,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Insert golf_team_players
      const playerInserts = team.members.map((m, i) => ({
        team_id: newTeam.id,
        player_name: `${m.first_name} ${m.last_name}`,
        handicap: m.golf_handicap || null,
        player_order: i + 1,
      }));

      const { error: playersError } = await supabase
        .from('golf_team_players')
        .insert(playerInserts);

      if (playersError) throw playersError;

      // Update local state: remove from suggestions, add to existing team ids
      const newExisting = new Set(existingTeamContactIds);
      team.members.forEach((m) => newExisting.add(m.contact_id));
      setExistingTeamContactIds(newExisting);

      setSuggestedTeams((prev) => prev.filter((_, i) => i !== teamIdx));
    } catch (err) {
      console.error('Error creating team:', err);
      setError(err.message || 'Failed to create team');
    } finally {
      setSaving(false);
    }
  };

  // --- Accept all teams ---
  const handleAcceptAll = async () => {
    setShowConfirmAll(false);
    setSaving(true);
    setError(null);

    try {
      for (let i = 0; i < suggestedTeams.length; i++) {
        const team = suggestedTeams[i];

        const { data: newTeam, error: teamError } = await supabase
          .from('golf_teams')
          .insert({
            tournament_id: selectedTournament,
            team_name: team.name,
            team_number: 0,
          })
          .select()
          .single();

        if (teamError) throw teamError;

        const playerInserts = team.members.map((m, j) => ({
          team_id: newTeam.id,
          player_name: `${m.first_name} ${m.last_name}`,
          handicap: m.golf_handicap || null,
          player_order: j + 1,
        }));

        const { error: playersError } = await supabase
          .from('golf_team_players')
          .insert(playerInserts);

        if (playersError) throw playersError;
      }

      // Update local state
      const newExisting = new Set(existingTeamContactIds);
      suggestedTeams.forEach((team) => {
        team.members.forEach((m) => newExisting.add(m.contact_id));
      });
      setExistingTeamContactIds(newExisting);
      setSuggestedTeams([]);
    } catch (err) {
      console.error('Error creating teams:', err);
      setError(err.message || 'Failed to create teams');
    } finally {
      setSaving(false);
    }
  };

  // --- Dismiss a suggestion ---
  const handleDismiss = (teamIdx) => {
    const team = suggestedTeams[teamIdx];
    // Move members back to unassigned
    const dismissed = team.members.map((m) => ({
      id: m.id,
      contact_id: m.contact_id,
      first_name: m.first_name,
      last_name: m.last_name,
      email: m.email,
      golf_handicap: m.golf_handicap,
      preferred_teammates: m.preferred_teammates,
      registration_group_id: m.registration_group_id,
    }));
    setUnassigned((prev) => [...prev, ...dismissed]);
    setSuggestedTeams((prev) => prev.filter((_, i) => i !== teamIdx));
  };

  // --- Edit mode: swap member with unassigned ---
  const handleStartSwap = (teamIdx, memberIdx) => {
    setEditingTeamIdx(teamIdx);
    setSwapPosition({ teamIdx, memberIdx });
  };

  const handleSwap = (unassignedGolfer) => {
    if (!swapPosition) return;
    const { teamIdx, memberIdx } = swapPosition;

    setSuggestedTeams((prev) => {
      const updated = [...prev];
      const team = { ...updated[teamIdx] };
      const members = [...team.members];
      const removed = members[memberIdx];

      // Replace with unassigned golfer
      members[memberIdx] = {
        ...unassignedGolfer,
        reasons: ['Manually assigned'],
      };
      team.members = members;
      updated[teamIdx] = team;

      // Move removed member back to unassigned
      setUnassigned((prevU) => {
        const filtered = prevU.filter(
          (g) => g.contact_id !== unassignedGolfer.contact_id
        );
        return [
          ...filtered,
          {
            id: removed.id,
            contact_id: removed.contact_id,
            first_name: removed.first_name,
            last_name: removed.last_name,
            email: removed.email,
            golf_handicap: removed.golf_handicap,
            preferred_teammates: removed.preferred_teammates,
            registration_group_id: removed.registration_group_id,
          },
        ];
      });

      return updated;
    });

    setSwapPosition(null);
    setEditingTeamIdx(null);
  };

  const handleCancelSwap = () => {
    setSwapPosition(null);
    setEditingTeamIdx(null);
  };

  // --- Update team name ---
  const handleTeamNameChange = (teamIdx, name) => {
    setSuggestedTeams((prev) => {
      const updated = [...prev];
      updated[teamIdx] = { ...updated[teamIdx], name };
      return updated;
    });
  };

  // --- Create team from selected unassigned ---
  const handleCreateFromSelected = () => {
    if (selectedUnassigned.size < 2 || selectedUnassigned.size > 4) return;

    const members = unassigned.filter((g) =>
      selectedUnassigned.has(g.contact_id)
    );

    setSuggestedTeams((prev) => [
      ...prev,
      {
        members: members.map((m) => ({ ...m, reasons: ['Manually assigned'] })),
        name: `Team ${prev.length + 1}`,
      },
    ]);

    setUnassigned((prev) =>
      prev.filter((g) => !selectedUnassigned.has(g.contact_id))
    );
    setSelectedUnassigned(new Set());
  };

  // --- Toggle unassigned selection ---
  const toggleUnassigned = (contactId) => {
    setSelectedUnassigned((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Team Builder</h1>
          <p className="mt-2 text-sm text-gray-600">
            Auto-generate golf team suggestions from registration data
          </p>
        </div>
        {suggestedTeams.length > 0 && (
          <button
            onClick={() => setShowConfirmAll(true)}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Accept All'}
          </button>
        )}
      </div>

      {/* Tournament selector + Generate */}
      <div className="bg-white p-4 rounded-lg shadow flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tournament
          </label>
          <select
            value={selectedTournament}
            onChange={(e) => setSelectedTournament(e.target.value)}
            className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          >
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.year}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading || golfers.length === 0}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
        >
          Generate Suggestions
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Stats */}
      {!loading && golfers.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">Total Golfers</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
              {totalGolfers}
            </dd>
          </div>
          <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">On Teams</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-green-600">
              {onTeams}
            </dd>
          </div>
          <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">Suggested Teams</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-primary-600">
              {suggestedCount}
            </dd>
          </div>
          <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
            <dt className="truncate text-sm font-medium text-gray-500">Unassigned</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-yellow-600">
              {unassignedCount}
            </dd>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading golfers...</p>
        </div>
      )}

      {/* Suggested Teams */}
      {suggestedTeams.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Suggested Teams ({suggestedTeams.length})
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {suggestedTeams.map((team, teamIdx) => (
              <div
                key={teamIdx}
                className="bg-white overflow-hidden shadow rounded-lg"
              >
                <div className="px-4 py-5 sm:p-6">
                  {/* Team name input */}
                  <div className="mb-3">
                    <input
                      type="text"
                      value={team.name}
                      onChange={(e) => handleTeamNameChange(teamIdx, e.target.value)}
                      className="block w-full text-lg font-medium text-gray-900 border-0 border-b border-gray-200 focus:border-primary-500 focus:ring-0 px-0 py-1"
                      placeholder="Team name"
                    />
                  </div>

                  {/* Members */}
                  <div className="space-y-2 mb-4">
                    {team.members.map((member, memberIdx) => (
                      <div
                        key={member.contact_id}
                        className="flex items-start justify-between gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">
                            {member.first_name} {member.last_name}
                            {member.golf_handicap != null && (
                              <span className="text-gray-400 font-normal ml-2">
                                ({member.golf_handicap})
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {member.reasons?.map((reason, ri) => (
                              <span
                                key={ri}
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                  reason.startsWith('Registered')
                                    ? 'bg-blue-100 text-blue-700'
                                    : reason.startsWith('Preferred') || reason.startsWith('Prefers')
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                        {/* Swap button */}
                        {swapPosition?.teamIdx === teamIdx &&
                        swapPosition?.memberIdx === memberIdx ? (
                          <button
                            onClick={handleCancelSwap}
                            className="text-xs text-red-600 hover:text-red-800 font-medium whitespace-nowrap"
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartSwap(teamIdx, memberIdx)}
                            className="text-xs text-gray-500 hover:text-gray-700 font-medium whitespace-nowrap"
                          >
                            Swap
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Swap picker */}
                  {swapPosition?.teamIdx === teamIdx && (
                    <div className="mb-4 p-3 bg-yellow-50 rounded-md border border-yellow-200">
                      <p className="text-xs font-medium text-yellow-800 mb-2">
                        Select replacement from unassigned:
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {unassigned.map((g) => (
                          <button
                            key={g.contact_id}
                            onClick={() => handleSwap(g)}
                            className="w-full text-left px-2 py-1 text-sm rounded hover:bg-yellow-100"
                          >
                            {g.first_name} {g.last_name}
                            {g.golf_handicap != null && (
                              <span className="text-gray-400 ml-1">
                                ({g.golf_handicap})
                              </span>
                            )}
                          </button>
                        ))}
                        {unassigned.length === 0 && (
                          <p className="text-xs text-gray-500">No unassigned golfers</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptTeam(teamIdx)}
                      disabled={saving}
                      className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDismiss(teamIdx)}
                      className="inline-flex justify-center items-center px-3 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unassigned Golfers */}
      {!loading && (suggestedTeams.length > 0 || unassigned.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">
              Unassigned Golfers ({unassigned.length})
            </h2>
            {selectedUnassigned.size >= 2 && selectedUnassigned.size <= 4 && (
              <button
                onClick={handleCreateFromSelected}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Create Team from Selected ({selectedUnassigned.size})
              </button>
            )}
          </div>

          {unassigned.length > 0 ? (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 w-10">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Name
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Handicap
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Preferred Teammates
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {unassigned.map((golfer) => (
                    <tr
                      key={golfer.contact_id}
                      className={`hover:bg-gray-50 ${
                        selectedUnassigned.has(golfer.contact_id)
                          ? 'bg-primary-50'
                          : ''
                      }`}
                    >
                      <td className="whitespace-nowrap py-4 pl-4 pr-3">
                        <input
                          type="checkbox"
                          checked={selectedUnassigned.has(golfer.contact_id)}
                          onChange={() => toggleUnassigned(golfer.contact_id)}
                          className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                        {golfer.first_name} {golfer.last_name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {golfer.golf_handicap ?? '-'}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        {golfer.preferred_teammates || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 bg-white rounded-lg shadow">
              <p className="text-gray-500">All golfers have been assigned to teams</p>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && golfers.length === 0 && !error && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No golf registrations</h3>
          <p className="mt-1 text-sm text-gray-500">
            Select a tournament with golf registrations to get started.
          </p>
        </div>
      )}

      {/* Confirm All Dialog */}
      <ConfirmDialog
        isOpen={showConfirmAll}
        onClose={() => setShowConfirmAll(false)}
        onConfirm={handleAcceptAll}
        title="Accept All Teams"
        message={`This will create ${suggestedTeams.length} team${suggestedTeams.length !== 1 ? 's' : ''} with a total of ${suggestedTeams.reduce((sum, t) => sum + t.members.length, 0)} players. Continue?`}
        confirmText="Accept All"
        confirmButtonClass="bg-primary-600 hover:bg-primary-700"
      />
    </div>
  );
}
