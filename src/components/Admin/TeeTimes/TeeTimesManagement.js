import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import TeeTimeForm from './TeeTimeForm';

export default function TeeTimesManagement() {
  const [teeTimes, setTeeTimes] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedTeeTime, setSelectedTeeTime] = useState(null);

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournament) {
      fetchTeeTimes();
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

  const fetchTeeTimes = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('tee_times_view')
        .select('*')
        .eq('tournament_id', selectedTournament)
        .order('tee_time', { ascending: true });

      if (error) throw error;
      setTeeTimes(data || []);
    } catch (err) {
      console.error('Error fetching tee times:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeeTime = () => {
    setSelectedTeeTime(null);
    setShowForm(true);
  };

  const handleEditTeeTime = (teeTime) => {
    setSelectedTeeTime(teeTime);
    setShowForm(true);
  };

  const handleDeleteTeeTime = async (teeTimeId) => {
    if (!window.confirm('Are you sure you want to delete this tee time?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tee_times')
        .delete()
        .eq('id', teeTimeId);

      if (error) throw error;
      fetchTeeTimes();
    } catch (err) {
      console.error('Error deleting tee time:', err);
      alert('Failed to delete tee time');
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedTeeTime(null);
  };

  const handleSaveForm = () => {
    fetchTeeTimes();
    handleCloseForm();
  };

  const formatTeeTime = (datetime) => {
    const date = new Date(datetime);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tee Times</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage golf tournament tee times and team assignments
          </p>
        </div>
        <button
          onClick={handleAddTeeTime}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          Add Tee Time
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

      {/* Tee Times Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tee times...</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                  Tee Time
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Hole
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Team
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Players
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Notes
                </th>
                <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {teeTimes.map((teeTime) => (
                <tr key={teeTime.tee_time_id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                    {formatTeeTime(teeTime.tee_time)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {teeTime.hole_number}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-900">
                    {teeTime.team_name && (
                      <div className="font-semibold text-primary-600">{teeTime.team_name}</div>
                    )}
                    {teeTime.team_number && (
                      <div className="text-xs text-gray-500">Team #{teeTime.team_number}</div>
                    )}
                    {!teeTime.team_name && !teeTime.team_number && (
                      <span className="text-gray-400">No team assigned</span>
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-600">
                    {teeTime.players && teeTime.players.length > 0 ? (
                      <div className="space-y-1">
                        {teeTime.players.slice(0, 2).map((player, idx) => (
                          <div key={idx}>{player.player_name}</div>
                        ))}
                        {teeTime.players.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{teeTime.players.length - 2} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500">
                    {teeTime.notes || '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right space-x-2">
                    <button
                      onClick={() => handleEditTeeTime(teeTime)}
                      className="text-primary-600 hover:text-primary-900 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTeeTime(teeTime.tee_time_id)}
                      className="text-red-600 hover:text-red-900 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {teeTimes.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No tee times scheduled yet</p>
            </div>
          )}
        </div>
      )}

      {/* Tee Time Form Modal */}
      {showForm && (
        <TeeTimeForm
          teeTime={selectedTeeTime}
          tournamentId={selectedTournament}
          onClose={handleCloseForm}
          onSave={handleSaveForm}
        />
      )}
    </div>
  );
}
