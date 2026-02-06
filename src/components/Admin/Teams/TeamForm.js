import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';

export default function TeamForm({ team, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    tournament_id: '',
  });
  const [contacts, setContacts] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([null, null, null, null]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [contactSearchTerms, setContactSearchTerms] = useState(['', '', '', '']);
  const [showDropdowns, setShowDropdowns] = useState([false, false, false, false]);

  const isCreateMode = !team;

  useEffect(() => {
    fetchContacts();
    fetchTournaments();

    if (team) {
      setFormData({
        name: team.team_name || '',
        tournament_id: team.tournament_id || '',
      });

      // Populate existing members (for display only - can't edit golf_team_players yet)
      if (team.members && team.members.length > 0) {
        const searchTerms = ['', '', '', ''];
        team.members.forEach((member, index) => {
          if (index < 4) {
            searchTerms[index] = member.player_name;
          }
        });
        setContactSearchTerms(searchTerms);
      }
    }
  }, [team]);

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, year')
        .order('year', { ascending: false });

      if (error) throw error;
      setTournaments(data || []);

      // Set default to most recent tournament
      if (isCreateMode && data && data.length > 0) {
        setFormData(prev => ({ ...prev, tournament_id: data[0].id }));
      }
    } catch (err) {
      console.error('Error fetching tournaments:', err);
    }
  };

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email')
        .order('last_name');

      if (error) throw error;
      setContacts(data || []);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  };

  const handleSelectMember = (position, contact) => {
    const newMembers = [...selectedMembers];
    newMembers[position] = contact.id;
    setSelectedMembers(newMembers);

    const newSearchTerms = [...contactSearchTerms];
    newSearchTerms[position] = `${contact.first_name} ${contact.last_name}`;
    setContactSearchTerms(newSearchTerms);

    const newDropdowns = [...showDropdowns];
    newDropdowns[position] = false;
    setShowDropdowns(newDropdowns);
  };

  const handleSearchChange = (position, value) => {
    const newSearchTerms = [...contactSearchTerms];
    newSearchTerms[position] = value;
    setContactSearchTerms(newSearchTerms);

    const newDropdowns = [...showDropdowns];
    newDropdowns[position] = true;
    setShowDropdowns(newDropdowns);

    // Clear selection if user is typing
    const newMembers = [...selectedMembers];
    newMembers[position] = null;
    setSelectedMembers(newMembers);
  };

  const handleRemoveMember = (position) => {
    const newMembers = [...selectedMembers];
    newMembers[position] = null;
    setSelectedMembers(newMembers);

    const newSearchTerms = [...contactSearchTerms];
    newSearchTerms[position] = '';
    setContactSearchTerms(newSearchTerms);
  };

  const getFilteredContacts = (position) => {
    const searchTerm = contactSearchTerms[position].toLowerCase();
    if (!searchTerm) return [];

    return contacts.filter(contact => {
      const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
      const email = contact.email?.toLowerCase() || '';
      const isAlreadySelected = selectedMembers.includes(contact.id);
      return !isAlreadySelected && (fullName.includes(searchTerm) || email.includes(searchTerm));
    }).slice(0, 10);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate team name
      if (!formData.name.trim()) {
        setError('Team name is required');
        setLoading(false);
        return;
      }

      // Validate at least one member
      const hasMembers = selectedMembers.some(m => m !== null);
      if (!hasMembers) {
        setError('Please add at least one team member');
        setLoading(false);
        return;
      }

      let teamId;

      // Validate tournament selection
      if (!formData.tournament_id) {
        setError('Please select a tournament');
        setLoading(false);
        return;
      }

      if (isCreateMode) {
        // Create new golf_team
        const { data: newTeam, error: teamError } = await supabase
          .from('golf_teams')
          .insert({
            tournament_id: formData.tournament_id,
            team_name: formData.name,
            team_number: 0, // Will be set by admin
          })
          .select()
          .single();

        if (teamError) throw teamError;
        teamId = newTeam.id;
      } else {
        // Update existing golf_team
        const { error: teamError } = await supabase
          .from('golf_teams')
          .update({ team_name: formData.name })
          .eq('id', team.team_id);

        if (teamError) throw teamError;
        teamId = team.team_id;

        // Delete existing players
        const { error: deleteError } = await supabase
          .from('golf_team_players')
          .delete()
          .eq('team_id', teamId);

        if (deleteError) throw deleteError;
      }

      // Insert golf_team_players
      const memberInserts = [];
      for (let i = 0; i < selectedMembers.length; i++) {
        const contactId = selectedMembers[i];
        if (contactId) {
          // Get contact details
          const contact = contacts.find(c => c.id === contactId);
          if (contact) {
            memberInserts.push({
              team_id: teamId,
              player_name: `${contact.first_name} ${contact.last_name}`,
              handicap: null, // Can be set later
              player_order: i + 1,
            });
          }
        }
      }

      if (memberInserts.length > 0) {
        const { error: membersError } = await supabase
          .from('golf_team_players')
          .insert(memberInserts);

        if (membersError) throw membersError;
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving team:', err);
      setError(err.message || 'Failed to save team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isCreateMode ? 'New Team' : 'Edit Team'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Tournament Selection */}
            <div>
              <label htmlFor="tournament" className="block text-sm font-medium text-gray-700">
                Tournament <span className="text-red-500">*</span>
              </label>
              <select
                id="tournament"
                required
                value={formData.tournament_id}
                onChange={(e) => setFormData({ ...formData, tournament_id: e.target.value })}
                disabled={!isCreateMode}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm disabled:bg-gray-100"
              >
                <option value="">Select a tournament...</option>
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.year}
                  </option>
                ))}
              </select>
              {!isCreateMode && (
                <p className="mt-1 text-xs text-gray-500">
                  Cannot change tournament for existing team
                </p>
              )}
            </div>

            {/* Team Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Team Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="e.g., The Eagles, Dream Team"
              />
            </div>

            {/* Team Members */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Team Members (up to 4)
              </label>
              <div className="space-y-3">
                {[0, 1, 2, 3].map((position) => (
                  <div key={position} className="relative">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700 w-8">
                        {position + 1}.
                      </span>
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={contactSearchTerms[position]}
                          onChange={(e) => handleSearchChange(position, e.target.value)}
                          onFocus={() => {
                            const newDropdowns = [...showDropdowns];
                            newDropdowns[position] = true;
                            setShowDropdowns(newDropdowns);
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              const newDropdowns = [...showDropdowns];
                              newDropdowns[position] = false;
                              setShowDropdowns(newDropdowns);
                            }, 200);
                          }}
                          placeholder="Search for a player..."
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                          autoComplete="off"
                        />
                        {showDropdowns[position] && contactSearchTerms[position] && (
                          <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-48 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                            {getFilteredContacts(position).length > 0 ? (
                              getFilteredContacts(position).map((contact) => (
                                <button
                                  key={contact.id}
                                  type="button"
                                  onClick={() => handleSelectMember(position, contact)}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                                >
                                  <div className="font-medium text-gray-900">
                                    {contact.first_name} {contact.last_name}
                                  </div>
                                  {contact.email && (
                                    <div className="text-sm text-gray-500">{contact.email}</div>
                                  )}
                                </button>
                              ))
                            ) : (
                              <div className="px-4 py-2 text-sm text-gray-500">
                                No contacts found
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {selectedMembers[position] && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(position)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Add 1-4 players to the team. Players can be changed for different tournaments.
              </p>
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
              {loading ? 'Saving...' : (isCreateMode ? 'Create Team' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
