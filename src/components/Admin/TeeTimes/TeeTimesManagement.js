import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { logAudit } from '../../../utils/audit';
import Select from '../Select';
import TeeTimeForm from './TeeTimeForm';

export default function TeeTimesManagement() {
  const [teeTimes, setTeeTimes] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedTeeTime, setSelectedTeeTime] = useState(null);
  const [golfEvent, setGolfEvent] = useState(null);
  const [savingFormat, setSavingFormat] = useState(false);

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournament) {
      fetchTeeTimes();
      fetchGolfEvent();
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
        .order('tee_time', { ascending: true })
        .order('hole_number', { ascending: true });

      if (error) throw error;
      setTeeTimes(data || []);
    } catch (err) {
      console.error('Error fetching tee times:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGolfEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('tournament_events')
        .select('id, event_name, tee_time_format')
        .eq('tournament_id', selectedTournament)
        .eq('event_type', 'golf_tournament')
        .order('event_date')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setGolfEvent(data || null);
    } catch (err) {
      console.error('Error fetching golf event:', err);
      setGolfEvent(null);
    }
  };

  const handleFormatChange = async (newFormat) => {
    if (!golfEvent || newFormat === golfEvent.tee_time_format) return;

    setSavingFormat(true);
    try {
      const { error } = await supabase
        .from('tournament_events')
        .update({ tee_time_format: newFormat })
        .eq('id', golfEvent.id);

      if (error) throw error;

      await logAudit({
        action: 'tournament_event.updated',
        entityType: 'tournament_event',
        entityId: golfEvent.id,
        entityLabel: golfEvent.event_name,
        changes: { tee_time_format: { from: golfEvent.tee_time_format, to: newFormat } },
      });

      setGolfEvent({ ...golfEvent, tee_time_format: newFormat });
    } catch (err) {
      console.error('Error updating tee time format:', err);
      alert('Failed to update tee time format');
    } finally {
      setSavingFormat(false);
    }
  };

  // Two players per line with a dot between them, same treatment as the
  // public leaderboard. A plain flex row (not flex-wrap) so a pair can never
  // break between the dot and the second name.
  const renderPlayers = (players) => {
    if (!players || players.length === 0) {
      return <span className="text-gray-400">-</span>;
    }

    const pairs = [];
    for (let i = 0; i < players.length; i += 2) {
      pairs.push(players.slice(i, i + 2));
    }

    return (
      <div className="space-y-1">
        {pairs.map((pair, pairIdx) => (
          <div key={pairIdx} className="flex items-baseline gap-x-2">
            <span>{pair[0].player_name}</span>
            {pair[1] && (
              <>
                <span className="text-gray-400 dark:text-gray-500" aria-hidden="true">•</span>
                <span>{pair[1].player_name}</span>
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  const handleAddTeeTime = () => {
    setSelectedTeeTime(null);
    setShowForm(true);
  };

  const handleEditTeeTime = (teeTime) => {
    setSelectedTeeTime(teeTime);
    setShowForm(true);
  };

  const handleDeleteTeeTime = async (teeTime) => {
    if (!window.confirm('Are you sure you want to delete this tee time?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tee_times')
        .delete()
        .eq('id', teeTime.tee_time_id);

      if (error) throw error;

      await logAudit({
        action: 'tee_time.deleted',
        entityType: 'tee_time',
        entityId: teeTime.tee_time_id,
        entityLabel: `${formatTeeTime(teeTime.tee_time)} (hole ${teeTime.hole_number})`,
        changes: {
          tee_time: teeTime.tee_time,
          hole_number: teeTime.hole_number,
          team: teeTime.team_name || null,
        },
      });

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Tee Times</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
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
      <div className="bg-white dark:bg-night-800 p-4 rounded-lg shadow flex flex-wrap gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tournament
          </label>
          <Select
            value={selectedTournament}
            onChange={(e) => setSelectedTournament(e.target.value)}
            className="block w-full max-w-xs"
          >
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.year}
              </option>
            ))}
          </Select>
        </div>

        {golfEvent && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Format
            </label>
            <Select
              value={golfEvent.tee_time_format}
              onChange={(e) => handleFormatChange(e.target.value)}
              disabled={savingFormat}
              className="block w-full max-w-xs"
            >
              <option value="standard">Standard — staggered times, everyone on hole 1</option>
              <option value="shotgun">Shotgun — simultaneous start, different holes</option>
            </Select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Controls how tee times appear on the public leaderboard.
            </p>
          </div>
        )}
      </div>

      {/* Tee Times Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading tee times...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-night-800 shadow rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50 dark:bg-night-700">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Tee Time
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Hole
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Team
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[220px]">
                  Players
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Notes
                </th>
                <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-night-700 bg-white dark:bg-night-800">
              {teeTimes.map((teeTime) => (
                <tr key={teeTime.tee_time_id} className="hover:bg-gray-50 dark:bg-night-700">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatTeeTime(teeTime.tee_time)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {teeTime.hole_number}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {teeTime.team_name ? (
                      <div className="font-semibold text-primary-600 dark:text-primary-400">{teeTime.team_name}</div>
                    ) : (
                      <span className="text-gray-400">No team assigned</span>
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-600 dark:text-gray-400 min-w-[220px]">
                    {renderPlayers(teeTime.players)}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {teeTime.notes || '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right space-x-2">
                    <button
                      onClick={() => handleEditTeeTime(teeTime)}
                      className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:text-primary-300 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTeeTime(teeTime)}
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
              <p className="text-gray-500 dark:text-gray-400">No tee times scheduled yet</p>
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
