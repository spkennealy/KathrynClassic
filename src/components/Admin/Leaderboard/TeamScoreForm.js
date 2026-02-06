import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';

export default function TeamScoreForm({ team, tournamentId, onClose, onSave }) {
  const [formData, setFormData] = useState({
    team_name: '',
    team_number: '',
    total_score: '',
    score_to_par: '',
    status: 'F',
  });
  const [players, setPlayers] = useState([
    { name: '', handicap: '', contact_id: '', order: 1 },
    { name: '', handicap: '', contact_id: '', order: 2 },
    { name: '', handicap: '', contact_id: '', order: 3 },
    { name: '', handicap: '', contact_id: '', order: 4 },
  ]);
  const [availableContacts, setAvailableContacts] = useState([]);
  const [searchTerms, setSearchTerms] = useState(['', '', '', '']);
  const [showDropdowns, setShowDropdowns] = useState([false, false, false, false]);
  const [tournamentPar, setTournamentPar] = useState(72);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch tournament par
    const fetchTournamentPar = async () => {
      try {
        const { data, error } = await supabase
          .from('tournaments')
          .select('par')
          .eq('id', tournamentId)
          .single();

        if (error) throw error;
        if (data?.par) {
          setTournamentPar(data.par);
        }
      } catch (err) {
        console.error('Error fetching tournament par:', err);
      }
    };

    // Fetch contacts who have registrations for the golf tournament event
    const fetchContacts = async () => {
      try {
        // First, find the golf event for this tournament
        const { data: golfEvent, error: eventError } = await supabase
          .from('tournament_events')
          .select('id')
          .eq('tournament_id', tournamentId)
          .eq('event_type', 'golf_tournament')
          .maybeSingle();

        if (eventError) {
          console.error('Error fetching golf event:', eventError);
          return;
        }

        if (!golfEvent) {
          // No golf event found - show all contacts with any registration for this tournament
          const { data: registrations, error: regError } = await supabase
            .from('registrations')
            .select('contact_id')
            .eq('tournament_id', tournamentId)
            .not('contact_id', 'is', null);

          if (regError || !registrations || registrations.length === 0) {
            setAvailableContacts([]);
            return;
          }

          const contactIds = [...new Set(registrations.map(r => r.contact_id).filter(Boolean))];
          const { data, error } = await supabase
            .from('contacts')
            .select('id, first_name, last_name, email')
            .in('id', contactIds)
            .order('last_name', { ascending: true })
            .order('first_name', { ascending: true });

          if (!error) setAvailableContacts(data || []);
          return;
        }

        // Get registration_events for the golf event
        const { data: registrationEvents, error: regEventsError } = await supabase
          .from('registration_events')
          .select('registration_id')
          .eq('tournament_event_id', golfEvent.id);

        if (regEventsError || !registrationEvents || registrationEvents.length === 0) {
          setAvailableContacts([]);
          return;
        }

        // Get unique registration IDs
        const registrationIds = [...new Set(registrationEvents.map(re => re.registration_id))];

        // Get registrations to find contact IDs
        const { data: registrations, error: regError } = await supabase
          .from('registrations')
          .select('contact_id')
          .in('id', registrationIds)
          .not('contact_id', 'is', null);

        if (regError || !registrations || registrations.length === 0) {
          setAvailableContacts([]);
          return;
        }

        // Get unique contact IDs
        const contactIds = [...new Set(registrations.map(r => r.contact_id).filter(Boolean))];

        // Fetch contacts
        const { data, error } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email')
          .in('id', contactIds)
          .order('last_name', { ascending: true })
          .order('first_name', { ascending: true });

        if (!error) {
          setAvailableContacts(data || []);
        }
      } catch (err) {
        console.error('Error fetching contacts:', err);
        setAvailableContacts([]);
      }
    };

    fetchTournamentPar();
    fetchContacts();
  }, [tournamentId]);

  useEffect(() => {
    if (team) {
      setFormData({
        team_name: team.team_name || '',
        team_number: team.team_number || '',
        total_score: team.total_score || '',
        score_to_par: team.score_to_par || '',
        status: team.status || 'F',
      });

      if (team.players && team.players.length > 0) {
        const loadedPlayers = team.players.map(p => ({
          name: p.name || '',
          handicap: p.handicap || '',
          contact_id: p.contact_id || '',
          order: p.order || 1,
        }));
        // Ensure we have 4 player slots
        while (loadedPlayers.length < 4) {
          loadedPlayers.push({ name: '', handicap: '', contact_id: '', order: loadedPlayers.length + 1 });
        }
        setPlayers(loadedPlayers);

        // Set search terms to existing names
        const newSearchTerms = loadedPlayers.map(p => p.name || '');
        setSearchTerms(newSearchTerms);
      }
    }
  }, [team]);

  // Auto-calculate score to par when total score changes
  useEffect(() => {
    if (formData.total_score && tournamentPar) {
      const scoreToPar = parseInt(formData.total_score) - tournamentPar;
      setFormData(prev => ({ ...prev, score_to_par: scoreToPar.toString() }));
    }
  }, [formData.total_score, tournamentPar]);

  const handlePlayerChange = (index, field, value) => {
    const newPlayers = [...players];
    newPlayers[index][field] = value;
    setPlayers(newPlayers);
  };

  const handleSearchChange = (index, value) => {
    const newSearchTerms = [...searchTerms];
    newSearchTerms[index] = value;
    setSearchTerms(newSearchTerms);

    const newShowDropdowns = [...showDropdowns];
    newShowDropdowns[index] = value.length > 0;
    setShowDropdowns(newShowDropdowns);

    // If manually typing, clear contact_id
    const newPlayers = [...players];
    if (!newPlayers[index].contact_id || value !== newPlayers[index].name) {
      newPlayers[index].contact_id = '';
      newPlayers[index].name = value;
      setPlayers(newPlayers);
    }
  };

  const handleContactSelect = async (index, contact) => {
    const newPlayers = [...players];
    newPlayers[index].contact_id = contact.id;
    newPlayers[index].name = `${contact.first_name} ${contact.last_name}`;

    const newSearchTerms = [...searchTerms];
    newSearchTerms[index] = `${contact.first_name} ${contact.last_name}`;
    setSearchTerms(newSearchTerms);

    const newShowDropdowns = [...showDropdowns];
    newShowDropdowns[index] = false;
    setShowDropdowns(newShowDropdowns);

    // Try to fetch handicap from registrations
    try {
      const { data } = await supabase
        .from('registrations')
        .select('golf_handicap')
        .eq('contact_id', contact.id)
        .not('golf_handicap', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.golf_handicap) {
        newPlayers[index].handicap = data.golf_handicap;
      }
    } catch (err) {
      // No handicap found, that's okay
    }

    setPlayers(newPlayers);
  };

  const getFilteredContacts = (index) => {
    const searchTerm = searchTerms[index]?.toLowerCase() || '';
    if (!searchTerm) return [];

    return availableContacts.filter(contact => {
      if (!contact) return false;

      const firstName = contact.first_name || '';
      const lastName = contact.last_name || '';
      const email = contact.email || '';

      const fullName = `${firstName} ${lastName}`.toLowerCase();
      const emailLower = email.toLowerCase();

      return fullName.includes(searchTerm) || emailLower.includes(searchTerm);
    }).slice(0, 10); // Limit to 10 results
  };

  const recalculatePositions = async () => {
    try {
      // Fetch all teams for this tournament
      const { data: teams, error: fetchError } = await supabase
        .from('golf_teams')
        .select('id, score_to_par, total_score')
        .eq('tournament_id', tournamentId)
        .order('score_to_par', { ascending: true });

      if (fetchError) throw fetchError;

      if (!teams || teams.length === 0) return;

      // Calculate positions with tie detection
      let currentPosition = 1;
      let previousScore = null;
      let teamsAtPosition = 0;

      const updates = teams.map((team, index) => {
        if (previousScore === null || team.score_to_par !== previousScore) {
          // New score - update position
          currentPosition = index + 1;
          teamsAtPosition = 1;
          previousScore = team.score_to_par;
        } else {
          // Same score as previous - it's a tie
          teamsAtPosition++;
        }

        // Check if next team has same score to determine if tied
        const nextTeam = teams[index + 1];
        const isTied = teamsAtPosition > 1 || (nextTeam && nextTeam.score_to_par === team.score_to_par);

        return {
          id: team.id,
          position: currentPosition,
          is_tied: isTied,
        };
      });

      // Update all teams with new positions
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('golf_teams')
          .update({
            position: update.position,
            is_tied: update.is_tied,
            updated_at: new Date().toISOString(),
          })
          .eq('id', update.id);

        if (updateError) throw updateError;
      }
    } catch (err) {
      console.error('Error recalculating positions:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const teamData = {
        tournament_id: tournamentId,
        team_name: formData.team_name || null,
        team_number: formData.team_number ? parseInt(formData.team_number) : null,
        total_score: parseInt(formData.total_score),
        score_to_par: parseInt(formData.score_to_par),
        status: formData.status,
        updated_at: new Date().toISOString(),
      };

      let teamId;

      if (team) {
        // Update existing team
        const { error: updateError } = await supabase
          .from('golf_teams')
          .update(teamData)
          .eq('id', team.team_id);

        if (updateError) throw updateError;
        teamId = team.team_id;

        // Delete existing players
        await supabase
          .from('golf_team_players')
          .delete()
          .eq('team_id', teamId);
      } else {
        // Create new team
        const { data: newTeam, error: insertError } = await supabase
          .from('golf_teams')
          .insert([teamData])
          .select()
          .single();

        if (insertError) throw insertError;
        teamId = newTeam.id;
      }

      // Insert players (only non-empty names)
      // Try to auto-match contact_ids for manually entered names
      const playerRecords = await Promise.all(
        players
          .filter(p => p.name.trim())
          .map(async (p) => {
            let contactId = p.contact_id;

            // If no contact_id is set, try to find a matching contact by name
            if (!contactId && p.name.trim()) {
              const nameParts = p.name.trim().split(' ');
              if (nameParts.length >= 2) {
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(' ');

                // Try exact match first
                const { data: exactMatch } = await supabase
                  .from('contacts')
                  .select('id')
                  .ilike('first_name', firstName)
                  .ilike('last_name', lastName)
                  .maybeSingle();

                if (exactMatch) {
                  contactId = exactMatch.id;
                } else {
                  // Try fuzzy match with just last name
                  const { data: lastNameMatch } = await supabase
                    .from('contacts')
                    .select('id, first_name, last_name')
                    .ilike('last_name', lastName)
                    .limit(1)
                    .maybeSingle();

                  if (lastNameMatch) {
                    contactId = lastNameMatch.id;
                  }
                }
              }
            }

            return {
              team_id: teamId,
              player_name: p.name,
              contact_id: contactId || null,
              handicap: p.handicap ? parseFloat(p.handicap) : null,
              player_order: p.order,
            };
          })
      );

      if (playerRecords.length > 0) {
        const { error: playersError } = await supabase
          .from('golf_team_players')
          .insert(playerRecords);

        if (playersError) throw playersError;
      }

      // Recalculate positions for all teams in this tournament
      await recalculatePositions();

      onSave();
    } catch (err) {
      console.error('Error saving team:', err);
      setError(err.message || 'Failed to save team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {team ? 'Edit Team Score' : 'Add Team Score'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* Team Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="team_name" className="block text-sm font-medium text-gray-700">
                  Team Name (Optional)
                </label>
                <input
                  type="text"
                  id="team_name"
                  value={formData.team_name}
                  onChange={(e) => setFormData({ ...formData, team_name: e.target.value })}
                  placeholder="e.g., The Birdies"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="team_number" className="block text-sm font-medium text-gray-700">
                  Team Number (Optional)
                </label>
                <input
                  type="number"
                  id="team_number"
                  value={formData.team_number}
                  onChange={(e) => setFormData({ ...formData, team_number: e.target.value })}
                  placeholder="e.g., 1"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>
            </div>

            {/* Players */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Team Players (up to 4)
              </label>
              <div className="space-y-4">
                {players.map((player, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-1 flex items-center">
                        <span className="text-sm text-gray-500 font-medium">{index + 1}.</span>
                      </div>
                      <div className="col-span-11 space-y-3">
                        {/* Searchable Contact Selector */}
                        <div className="relative">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Search Contact or Enter Name
                          </label>
                          <input
                            type="text"
                            value={searchTerms[index]}
                            onChange={(e) => handleSearchChange(index, e.target.value)}
                            onFocus={() => {
                              const newShowDropdowns = [...showDropdowns];
                              newShowDropdowns[index] = searchTerms[index].length > 0;
                              setShowDropdowns(newShowDropdowns);
                            }}
                            onBlur={() => {
                              // Delay to allow click on dropdown item
                              setTimeout(() => {
                                const newShowDropdowns = [...showDropdowns];
                                newShowDropdowns[index] = false;
                                setShowDropdowns(newShowDropdowns);
                              }, 200);
                            }}
                            placeholder="Start typing name or email..."
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                          />
                          {/* Dropdown Results */}
                          {showDropdowns[index] && getFilteredContacts(index).length > 0 && (
                            <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-sm overflow-auto border border-gray-300">
                              {getFilteredContacts(index).map((contact) => (
                                <div
                                  key={contact.id}
                                  onClick={() => handleContactSelect(index, contact)}
                                  className="cursor-pointer px-3 py-2 hover:bg-primary-50"
                                >
                                  <div className="font-medium text-gray-900">
                                    {contact.last_name}, {contact.first_name}
                                  </div>
                                  <div className="text-xs text-gray-500">{contact.email}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          {player.contact_id && (
                            <div className="mt-1 text-xs text-green-600 flex items-center">
                              <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Linked to contact
                            </div>
                          )}
                        </div>
                        {/* Handicap */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Handicap
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={player.handicap}
                            onChange={(e) => handlePlayerChange(index, 'handicap', e.target.value)}
                            placeholder="e.g., 18"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Start typing to search contacts, or manually enter a name for guests
              </p>
            </div>

            {/* Course Par Info */}
            <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Course Par:</span>
                <span className="text-2xl font-bold text-primary-600">{tournamentPar}</span>
              </div>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="total_score" className="block text-sm font-medium text-gray-700">
                  Total Score <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="total_score"
                  required
                  value={formData.total_score}
                  onChange={(e) => setFormData({ ...formData, total_score: e.target.value })}
                  placeholder="e.g., 68"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Total strokes for the round</p>
              </div>

              <div>
                <label htmlFor="score_to_par" className="block text-sm font-medium text-gray-700">
                  Score to Par (Auto-calculated)
                </label>
                <input
                  type="text"
                  id="score_to_par"
                  readOnly
                  value={formData.score_to_par ? (formData.score_to_par === '0' ? 'E' : (parseInt(formData.score_to_par) > 0 ? `+${formData.score_to_par}` : formData.score_to_par)) : '-'}
                  className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm sm:text-sm font-bold text-center text-lg"
                  style={{ color: formData.score_to_par && parseInt(formData.score_to_par) < 0 ? '#dc2626' : '#111827' }}
                />
                <p className="mt-1 text-xs text-gray-500">Calculated: Total - {tournamentPar}</p>
              </div>
            </div>

            {/* Position & Ties Info */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    <strong>Position and ties are calculated automatically</strong> based on score to par. Teams with the same score will be tied.
                  </p>
                </div>
              </div>
            </div>

            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <input
                type="text"
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                placeholder="F for finished, or Thru 15"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">F = Finished, or current hole</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? 'Saving...' : team ? 'Update Score' : 'Add Score'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
