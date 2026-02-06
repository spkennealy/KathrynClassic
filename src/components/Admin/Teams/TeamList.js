import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import TeamForm from './TeamForm';

export default function TeamList() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);

      // Fetch golf_teams with their players
      const { data: teamsData, error: teamsError } = await supabase
        .from('golf_teams')
        .select(`
          *,
          tournaments(year),
          golf_team_players(
            player_name,
            handicap,
            player_order,
            registration_id
          )
        `)
        .order('team_name');

      if (teamsError) throw teamsError;

      // Transform data to match expected format
      const transformedTeams = teamsData.map(team => ({
        team_id: team.id,
        team_name: team.team_name || `Team ${team.team_number}`,
        tournament_year: team.tournaments?.year,
        member_count: team.golf_team_players?.length || 0,
        members: team.golf_team_players?.sort((a, b) => a.player_order - b.player_order).map(p => ({
          player_name: p.player_name,
          handicap: p.handicap,
          position: p.player_order,
          registration_id: p.registration_id,
        })) || [],
      }));

      setTeams(transformedTeams);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setSelectedTeam(null);
    setShowForm(true);
  };

  const handleEdit = (team) => {
    setSelectedTeam(team);
    setShowForm(true);
  };

  const handleDelete = async (teamId, teamName) => {
    if (!window.confirm(`Are you sure you want to delete team "${teamName}"? This will also remove the team from any assigned tee times.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('golf_teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;
      fetchTeams();
    } catch (err) {
      console.error('Error deleting team:', err);
      alert('Failed to delete team: ' + err.message);
    }
  };

  const handleClose = () => {
    setShowForm(false);
    setSelectedTeam(null);
  };

  const handleSave = () => {
    fetchTeams();
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading teams...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage golf teams and their members
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Team
        </button>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <div key={team.team_id} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-medium text-gray-900">{team.team_name}</h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {team.member_count} {team.member_count === 1 ? 'player' : 'players'}
                </span>
              </div>

              {team.tournament_year && (
                <p className="text-sm text-gray-500 mb-4">Tournament: {team.tournament_year}</p>
              )}

              {/* Team Members */}
              <div className="space-y-2 mb-4">
                {team.members && team.members.length > 0 ? (
                  team.members.map((member, index) => (
                    <div key={index} className="text-sm text-gray-600">
                      <span className="font-medium">{member.position}.</span> {member.player_name}
                      {member.handicap && <span className="text-gray-400 ml-2">({member.handicap})</span>}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic">No members assigned</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(team)}
                  className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(team.team_id, team.team_name)}
                  className="inline-flex justify-center items-center px-3 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {teams.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No teams</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new team.</p>
          <div className="mt-6">
            <button
              onClick={handleAdd}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Team
            </button>
          </div>
        </div>
      )}

      {/* Team Form Modal */}
      {showForm && (
        <TeamForm
          team={selectedTeam}
          onClose={handleClose}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
