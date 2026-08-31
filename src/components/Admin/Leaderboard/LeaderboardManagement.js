import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { logAudit } from '../../../utils/audit';
import TeamScoreForm from './TeamScoreForm';
import Select from '../Select';

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

  // Net scoring is a per-year rule; the view reports whether it applies.
  const usesHandicap = teams.some((team) => team.handicap_applied);
  const standingsToPar = (team) => team.standings_to_par ?? team.score_to_par;

  const handleDeleteTeam = async (team) => {
    if (!window.confirm('Are you sure you want to delete this team?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('golf_teams')
        .delete()
        .eq('id', team.team_id);

      if (error) throw error;

      await logAudit({
        action: 'golf_team.deleted',
        entityType: 'golf_team',
        entityId: team.team_id,
        entityLabel: team.team_name || `Team #${team.team_number ?? ''}`.trim(),
        changes: {
          team: team.team_name,
          score: team.total_score ?? team.score,
          position: team.position,
        },
      });

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
    if (scoreToPar == null) return '';
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Leaderboard Management</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
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
      <div className="bg-white dark:bg-night-800 p-4 rounded-lg shadow">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tournament
        </label>
        <Select
          value={selectedTournament}
          onChange={(e) => setSelectedTournament(e.target.value)}
          className="w-full max-w-xs"
        >
          {tournaments.map((tournament) => (
            <option key={tournament.id} value={tournament.id}>
              {tournament.year}
            </option>
          ))}
        </Select>
      </div>

      {/* Teams Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading teams...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-night-800 shadow rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50 dark:bg-night-700">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Pos
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Team / Players
                </th>
                {usesHandicap && (
                  <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                    HCP
                  </th>
                )}
                <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {usesHandicap ? 'Net to Par' : 'To Par'}
                </th>
                {usesHandicap && (
                  <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Net
                  </th>
                )}
                <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {usesHandicap ? 'Gross' : 'Total'}
                </th>
                <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Status
                </th>
                <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-night-700 bg-white dark:bg-night-800">
              {teams.map((team) => (
                <tr key={team.team_id} className="hover:bg-gray-50 dark:bg-night-700">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-bold text-gray-900 dark:text-gray-100">
                    <div className="flex items-center gap-2">
                      {team.is_tied ? `T${team.position}` : team.position}
                      {getPlaceEmoji(team.position, team.is_tied) && (
                        <span className="text-2xl">{getPlaceEmoji(team.position, team.is_tied)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {team.team_name && (
                      <div className="font-semibold text-primary-600 dark:text-primary-400 mb-1 flex items-center gap-2">
                        {team.team_name}
                      </div>
                    )}
                    {team.players && team.players.map((player, idx) => (
                      <div key={idx} className="text-gray-600 dark:text-gray-400">
                        {player.name}
                        {player.handicap && ` (${player.handicap})`}
                      </div>
                    ))}
                  </td>
                  {usesHandicap && (
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-center font-semibold text-gray-700 dark:text-gray-300">
                      {team.team_handicap ?? ''}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-center font-bold">
                    <span className={standingsToPar(team) < 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}>
                      {formatScore(standingsToPar(team))}
                    </span>
                  </td>
                  {usesHandicap && (
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-center font-semibold text-gray-900 dark:text-gray-100">
                      {team.net_score ?? team.total_score}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-gray-900 dark:text-gray-100">
                    {team.total_score}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-center font-semibold text-gray-600 dark:text-gray-400">
                    {team.status || 'F'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right space-x-2">
                    <button
                      onClick={() => handleEditTeam(team)}
                      className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:text-primary-300 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTeam(team)}
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
              <p className="text-gray-500 dark:text-gray-400">No teams added yet</p>
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
