import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';

export default function TournamentForm({ tournament, onClose, onSave }) {
  const [formData, setFormData] = useState({
    year: '',
    start_date: '',
    end_date: '',
    location: '',
    golf_course: '',
    par: '72',
    total_raised: '',
    golfer_count: '',
    total_attendees: '',
    notes: '',
    registration_closed: false,
    tournament_summary: '',
    is_finalized: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (tournament) {
      setFormData({
        year: tournament.year || '',
        start_date: tournament.start_date || '',
        end_date: tournament.end_date || '',
        location: tournament.location || '',
        golf_course: tournament.golf_course || '',
        par: tournament.par || '72',
        total_raised: tournament.total_raised || '',
        golfer_count: tournament.golfer_count || '',
        total_attendees: tournament.total_attendees || '',
        notes: tournament.notes || '',
        registration_closed: tournament.registration_closed || false,
        tournament_summary: tournament.tournament_summary || '',
        is_finalized: tournament.is_finalized || false,
      });
    }
  }, [tournament]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const tournamentData = {
        year: parseInt(formData.year),
        start_date: formData.start_date,
        end_date: formData.end_date,
        location: formData.location || null,
        golf_course: formData.golf_course || null,
        par: formData.par ? parseInt(formData.par) : 72,
        total_raised: formData.total_raised ? parseFloat(formData.total_raised) : null,
        golfer_count: formData.golfer_count ? parseInt(formData.golfer_count) : null,
        total_attendees: formData.total_attendees ? parseInt(formData.total_attendees) : null,
        notes: formData.notes || null,
        registration_closed: formData.registration_closed,
        tournament_summary: formData.tournament_summary || null,
        is_finalized: formData.is_finalized,
      };

      if (tournament) {
        // Update existing tournament
        const { error } = await supabase
          .from('tournaments')
          .update(tournamentData)
          .eq('id', tournament.id);

        if (error) throw error;
      } else {
        // Create new tournament
        const { error } = await supabase
          .from('tournaments')
          .insert([tournamentData]);

        if (error) throw error;
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving tournament:', err);
      setError(err.message || 'Failed to save tournament');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {tournament ? 'Edit Tournament' : 'Add Tournament'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="year" className="block text-sm font-medium text-gray-700">
                Year <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="year"
                required
                min="2000"
                max="2100"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="start_date"
                  required
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="end_date"
                  required
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                Location
              </label>
              <input
                type="text"
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Pine Mountain Lake"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="golf_course" className="block text-sm font-medium text-gray-700">
                  Golf Course
                </label>
                <input
                  type="text"
                  id="golf_course"
                  value={formData.golf_course}
                  onChange={(e) => setFormData({ ...formData, golf_course: e.target.value })}
                  placeholder="e.g., Pine Mountain Lake Golf Course"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="par" className="block text-sm font-medium text-gray-700">
                  Course Par
                </label>
                <input
                  type="number"
                  id="par"
                  min="60"
                  max="80"
                  value={formData.par}
                  onChange={(e) => setFormData({ ...formData, par: e.target.value })}
                  placeholder="72"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Typically 72</p>
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                Notes
              </label>
              <textarea
                id="notes"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes about this tournament..."
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="total_raised" className="block text-sm font-medium text-gray-700">
                Total Raised ($)
              </label>
              <input
                type="number"
                id="total_raised"
                min="0"
                step="0.01"
                value={formData.total_raised}
                onChange={(e) => setFormData({ ...formData, total_raised: e.target.value })}
                placeholder="0.00"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="golfer_count" className="block text-sm font-medium text-gray-700">
                  Number of Golfers
                </label>
                <input
                  type="number"
                  id="golfer_count"
                  min="0"
                  value={formData.golfer_count}
                  onChange={(e) => setFormData({ ...formData, golfer_count: e.target.value })}
                  placeholder="0"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="total_attendees" className="block text-sm font-medium text-gray-700">
                  Total Attendees
                </label>
                <input
                  type="number"
                  id="total_attendees"
                  min="0"
                  value={formData.total_attendees}
                  onChange={(e) => setFormData({ ...formData, total_attendees: e.target.value })}
                  placeholder="0"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <label htmlFor="tournament_summary" className="block text-sm font-medium text-gray-700 mb-2">
                Tournament Summary
              </label>
              <textarea
                id="tournament_summary"
                rows={6}
                value={formData.tournament_summary}
                onChange={(e) => setFormData({ ...formData, tournament_summary: e.target.value })}
                placeholder="Write a 1-2 paragraph summary of the tournament, including the success of the event, who won, how much money was raised, and how many participated..."
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                This summary will appear on the public Tournament History page
              </p>
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-4">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="registration_closed"
                    type="checkbox"
                    checked={formData.registration_closed}
                    onChange={(e) => setFormData({ ...formData, registration_closed: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="registration_closed" className="font-medium text-gray-700">
                    Close Registration
                  </label>
                  <p className="text-gray-500">
                    When checked, new registrations will be added to a waitlist instead
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="is_finalized"
                    type="checkbox"
                    checked={formData.is_finalized}
                    onChange={(e) => setFormData({ ...formData, is_finalized: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="is_finalized" className="font-medium text-gray-700">
                    Finalize Tournament
                  </label>
                  <p className="text-gray-500">
                    When checked, this tournament will appear on the public Tournament History page. Only check this after all scores are entered and the summary is complete.
                  </p>
                </div>
              </div>
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
              {loading ? 'Saving...' : tournament ? 'Update Tournament' : 'Create Tournament'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
