import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { logAudit, diffFields } from '../../../utils/audit';
import Select from '../Select';
import DatePicker from '../DatePicker';

const TEE_TIME_FIELDS = ['tournament_event_id', 'team_id', 'tee_time', 'hole_number', 'notes'];

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
          id,
          display_name,
          teams ( name ),
          golf_team_players ( player_name, player_order )
        `)
        .eq('tournament_id', tournamentId)
        .is('deleted_at', null)
        .order('teams(name)');

      if (error) throw error;

      const transformedTeams = (data || []).map(team => ({
        team_id: team.id,
        team_name: team.display_name || team.teams?.name,
        players: team.golf_team_players?.sort((a, b) => a.player_order - b.player_order) || [],
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

      const teeLabel = `${formData.tee_date} ${formData.tee_time_input} (hole ${formData.hole_number})`;

      if (teeTime) {
        // Update existing
        const { error: updateError } = await supabase
          .from('tee_times')
          .update(teeTimeData)
          .eq('id', teeTime.tee_time_id);

        if (updateError) throw updateError;

        const changes = diffFields(
          {
            tournament_event_id: teeTime.tournament_event_id,
            team_id: teeTime.team_id,
            tee_time: teeTime.tee_time,
            hole_number: teeTime.hole_number,
            notes: teeTime.notes,
          },
          teeTimeData,
          TEE_TIME_FIELDS
        );
        if (changes) {
          await logAudit({
            action: 'tee_time.updated',
            entityType: 'tee_time',
            entityId: teeTime.tee_time_id,
            entityLabel: teeLabel,
            changes,
          });
        }
      } else {
        // Create new
        const { data: inserted, error: insertError } = await supabase
          .from('tee_times')
          .insert([teeTimeData])
          .select('id')
          .single();

        if (insertError) throw insertError;

        await logAudit({
          action: 'tee_time.created',
          entityType: 'tee_time',
          entityId: inserted?.id,
          entityLabel: teeLabel,
          changes: { tee_time: teeTimeData.tee_time, hole_number: teeTimeData.hole_number, team_id: teeTimeData.team_id },
        });
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
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-start sm:items-center justify-center p-4 overflow-y-auto z-50">
      <div className="bg-white dark:bg-night-800 rounded-lg shadow-xl max-w-2xl w-full modal-panel overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-night-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
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
              <label htmlFor="tournament_event_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Golf Event <span className="text-red-500">*</span>
              </label>
              <Select
                id="tournament_event_id"
                required
                value={formData.tournament_event_id}
                onChange={(e) => setFormData({ ...formData, tournament_event_id: e.target.value })}
                className="mt-1 block w-full"
              >
                <option value="">Select event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.event_name} - {new Date(event.event_date).toLocaleDateString()}
                  </option>
                ))}
              </Select>
            </div>

            {/* Tee Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="tee_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Date <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <DatePicker
                    id="tee_date"
                    value={formData.tee_date}
                    onChange={(e) => setFormData({ ...formData, tee_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="tee_time_input" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  id="tee_time_input"
                  required
                  value={formData.tee_time_input}
                  onChange={(e) => setFormData({ ...formData, tee_time_input: e.target.value })}
                  className="mt-1 block w-full"
                />
              </div>
            </div>

            {/* Hole Number and Team */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="hole_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Starting Hole <span className="text-red-500">*</span>
                </label>
                <Select
                  id="hole_number"
                  required
                  value={formData.hole_number}
                  onChange={(e) => setFormData({ ...formData, hole_number: e.target.value })}
                  className="mt-1 block w-full"
                >
                  {Array.from({ length: 18 }, (_, i) => i + 1).map(hole => (
                    <option key={hole} value={hole}>Hole {hole}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label htmlFor="team_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Assign Team
                </label>
                <Select
                  id="team_id"
                  value={formData.team_id}
                  onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                  className="mt-1 block w-full"
                >
                  <option value="">No team yet</option>
                  {teams.map((team) => (
                    <option key={team.team_id} value={team.team_id}>
                      {team.team_name || 'Unnamed team'}
                      {team.players && team.players.length > 0 && ` - ${team.players[0].player_name}`}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Optional - can be assigned later
                </p>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Notes
              </label>
              <textarea
                id="notes"
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes about this tee time..."
                className="mt-1 block w-full"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 border border-gray-300 dark:border-night-600 rounded-md shadow-sm hover:bg-gray-50 dark:bg-night-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
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
