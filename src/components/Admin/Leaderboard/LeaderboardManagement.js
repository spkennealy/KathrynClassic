import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import TeamScoreForm from './TeamScoreForm';

export default function LeaderboardManagement() {
  const [teams, setTeams] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournament) {
      fetchTeams();
    }
  }, [selectedTournament]);

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, year')
        .order('year', { ascending: false });

      if (error) throw error;
      setTournaments(data || []);

      // Select most recent tournament by default
      if (data && data.length > 0) {
        setSelectedTournament(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching tournaments:', err);
    }
  };

  const fetchTeams = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('leaderboard_view')
        .select('*')
        .eq('tournament_id', selectedTournament)
        .order('position', { ascending: true });

      if (error) throw error;
      setTeams(data || []);
    } catch (err) {
      console.error('Error fetching teams:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeam = () => {
    setSelectedTeam(null);
    setShowForm(true);
  };

  const handleEditTeam = (team) => {
    setSelectedTeam(team);
    setShowForm(true);
  };

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm('Are you sure you want to delete this team?')) {
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
      alert('Failed to delete team');
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedTeam(null);
  };

  const handleSaveForm = () => {
    fetchTeams();
    handleCloseForm();
  };

  const formatScore = (scoreToPar) => {
    if (scoreToPar === 0) return 'E';
    if (scoreToPar > 0) return `+${scoreToPar}`;
    return scoreToPar.toString();
  };

  const getPlaceEmoji = (position, isTied) => {
    // Only show awards for finished positions
    if (position === 1) return '🏆';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Leaderboard Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage tournament scores and team standings
          </p>
        </div>
        <button
          onClick={handleAddTeam}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          Add Team
        </button>
      </div>

      {/* Tournament Selector */}
      <div className="bg-white p-4 rounded-lg shadow">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tournament
        </label>
        <select
          value={selectedTournament}
          onChange={(e) => setSelectedTournament(e.target.value)}
          className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          {tournaments.map((tournament) => (
            <option key={tournament.id} value={tournament.id}>
              {tournament.year}
            </option>
          ))}
        </select>
      </div>

      {/* Teams Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading teams...</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                  Pos
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Team / Players
                </th>
                <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">
                  To Par
                </th>
                <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">
                  Total
                </th>
                <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {teams.map((team) => (
                <tr key={team.team_id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-bold text-gray-900">
                    <div className="flex items-center gap-2">
                      {team.is_tied ? `T${team.position}` : team.position}
                      {getPlaceEmoji(team.position, team.is_tied) && (
                        <span className="text-2xl">{getPlaceEmoji(team.position, team.is_tied)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-900">
                    {team.team_name && (
                      <div className="font-semibold text-primary-600 mb-1 flex items-center gap-2">
                        {team.team_name}
                      </div>
                    )}
                    {team.players && team.players.map((player, idx) => (
                      <div key={idx} className="text-gray-600">
                        {player.name}
                        {player.handicap && ` (${player.handicap})`}
                      </div>
                    ))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-center font-bold">
                    <span className={team.score_to_par < 0 ? 'text-red-600' : 'text-gray-900'}>
                      {formatScore(team.score_to_par)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-gray-900">
                    {team.total_score}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-center font-semibold text-gray-600">
                    {team.status || 'F'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right space-x-2">
                    <button
                      onClick={() => handleEditTeam(team)}
                      className="text-primary-600 hover:text-primary-900 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTeam(team.team_id)}
                      className="text-red-600 hover:text-red-900 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {teams.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No teams added yet</p>
            </div>
          )}
        </div>
      )}

      {/* Team Score Form Modal */}
      {showForm && (
        <TeamScoreForm
          team={selectedTeam}
          tournamentId={selectedTournament}
          onClose={handleCloseForm}
          onSave={handleSaveForm}
        />
      )}
    </div>
  );
}
