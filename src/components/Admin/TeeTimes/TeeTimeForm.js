import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';

export default function TeeTimeForm({ teeTime, tournamentId, onClose, onSave }) {
  const [formData, setFormData] = useState({
    tournament_event_id: '',
    team_id: '',
    tee_date: '',
    tee_time_input: '',
    hole_number: '1',
    notes: '',
  });
  const [events, setEvents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEvents();
    fetchTeams();
  }, [tournamentId]);

  useEffect(() => {
    if (teeTime) {
      const teeTimeDate = new Date(teeTime.tee_time);
      setFormData({
        tournament_event_id: teeTime.tournament_event_id || '',
        team_id: teeTime.team_id || '',
        tee_date: teeTimeDate.toISOString().split('T')[0],
        tee_time_input: teeTimeDate.toTimeString().slice(0, 5),
        hole_number: teeTime.hole_number?.toString() || '1',
        notes: teeTime.notes || '',
      });
    }
  }, [teeTime]);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('tournament_events')
        .select('id, event_name, event_type, event_date')
        .eq('tournament_id', tournamentId)
        .eq('event_type', 'golf_tournament')
        .order('event_date');

      if (error) throw error;
      setEvents(data || []);

      // Auto-select first golf event if only one exists
      if (data && data.length === 1 && !teeTime) {
        setFormData(prev => ({
          ...prev,
          tournament_event_id: data[0].id,
          tee_date: data[0].event_date,
        }));
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    }
  };

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('golf_teams')
        .select(`
          *,
          golf_team_players(
            player_name,
            player_order
          )
        `)
        .eq('tournament_id', tournamentId)
        .order('team_name');

      if (error) throw error;

      // Transform data to include players array
      const transformedTeams = (data || []).map(team => ({
        team_id: team.id,
        team_name: team.team_name,
        team_number: team.team_number,
        players: team.golf_team_players?.sort((a, b) => a.player_order - b.player_order) || []
      }));

      setTeams(transformedTeams);
    } catch (err) {
      console.error('Error fetching teams:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Combine date and time
      const teeTimeDateTime = new Date(`${formData.tee_date}T${formData.tee_time_input}`);

      const teeTimeData = {
        tournament_id: tournamentId,
        tournament_event_id: formData.tournament_event_id,
        team_id: formData.team_id || null,
        tee_time: teeTimeDateTime.toISOString(),
        hole_number: parseInt(formData.hole_number),
        notes: formData.notes || null,
        updated_at: new Date().toISOString(),
      };

      if (teeTime) {
        // Update existing
        const { error: updateError } = await supabase
          .from('tee_times')
          .update(teeTimeData)
          .eq('id', teeTime.tee_time_id);

        if (updateError) throw updateError;
      } else {
        // Create new
        const { error: insertError } = await supabase
          .from('tee_times')
          .insert([teeTimeData]);

        if (insertError) throw insertError;
      }

      onSave();
    } catch (err) {
      console.error('Error saving tee time:', err);
      setError(err.message || 'Failed to save tee time');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {teeTime ? 'Edit Tee Time' : 'Add Tee Time'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Event Selection */}
            <div>
              <label htmlFor="tournament_event_id" className="block text-sm font-medium text-gray-700">
                Golf Event <span className="text-red-500">*</span>
              </label>
              <select
                id="tournament_event_id"
                required
                value={formData.tournament_event_id}
                onChange={(e) => setFormData({ ...formData, tournament_event_id: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="">Select event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.event_name} - {new Date(event.event_date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            {/* Tee Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="tee_date" className="block text-sm font-medium text-gray-700">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="tee_date"
                  required
                  value={formData.tee_date}
                  onChange={(e) => setFormData({ ...formData, tee_date: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="tee_time_input" className="block text-sm font-medium text-gray-700">
                  Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  id="tee_time_input"
                  required
                  value={formData.tee_time_input}
                  onChange={(e) => setFormData({ ...formData, tee_time_input: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>
            </div>

            {/* Hole Number and Team */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="hole_number" className="block text-sm font-medium text-gray-700">
                  Starting Hole <span className="text-red-500">*</span>
                </label>
                <select
                  id="hole_number"
                  required
                  value={formData.hole_number}
                  onChange={(e) => setFormData({ ...formData, hole_number: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                >
                  {Array.from({ length: 18 }, (_, i) => i + 1).map(hole => (
                    <option key={hole} value={hole}>Hole {hole}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="team_id" className="block text-sm font-medium text-gray-700">
                  Assign Team
                </label>
                <select
                  id="team_id"
                  value={formData.team_id}
                  onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                >
                  <option value="">No team yet</option>
                  {teams.map((team) => (
                    <option key={team.team_id} value={team.team_id}>
                      {team.team_name || `Team #${team.team_number}`}
                      {team.players && team.players.length > 0 && ` - ${team.players[0].player_name}`}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Optional - can be assigned later
                </p>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                Notes
              </label>
              <textarea
                id="notes"
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes about this tee time..."
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
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
              {loading ? 'Saving...' : teeTime ? 'Update Tee Time' : 'Add Tee Time'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
