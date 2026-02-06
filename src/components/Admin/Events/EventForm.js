import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';

export default function EventForm({ event, onClose, onSave }) {
  const [formData, setFormData] = useState({
    tournament_id: '',
    event_name: '',
    event_type: '',
    event_date: '',
    start_time: '',
    location: '',
    adult_price: '',
    child_price: '',
    description: '',
  });
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTournaments();
    if (event) {
      setFormData({
        tournament_id: event.tournament_id || '',
        event_name: event.event_name || '',
        event_type: event.event_type || '',
        event_date: event.event_date || '',
        start_time: event.start_time || '',
        location: event.location || '',
        adult_price: event.adult_price || '',
        child_price: event.child_price || '',
        description: event.description || '',
      });
    }
  }, [event]);

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, year')
        .order('year', { ascending: false });

      if (error) throw error;
      setTournaments(data || []);
    } catch (err) {
      console.error('Error fetching tournaments:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const eventData = {
        tournament_id: formData.tournament_id,
        event_name: formData.event_name,
        event_type: formData.event_type,
        event_date: formData.event_date,
        start_time: formData.start_time || null,
        location: formData.location || null,
        adult_price: formData.adult_price ? parseFloat(formData.adult_price) : 0,
        child_price: formData.child_price ? parseFloat(formData.child_price) : 0,
        description: formData.description || null,
      };

      if (event) {
        // Update existing event
        const { error } = await supabase
          .from('tournament_events')
          .update(eventData)
          .eq('id', event.id);

        if (error) throw error;
      } else {
        // Create new event
        const { error } = await supabase
          .from('tournament_events')
          .insert([eventData]);

        if (error) throw error;
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving event:', err);
      setError(err.message || 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const eventTypes = [
    { value: 'golf_tournament', label: 'Golf Tournament' },
    { value: 'welcome_dinner', label: 'Welcome Dinner' },
    { value: 'beach_day', label: 'Beach Day' },
    { value: 'awards_dinner', label: 'Awards Dinner' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {event ? 'Edit Event' : 'Add Event'}
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
              <label htmlFor="tournament_id" className="block text-sm font-medium text-gray-700">
                Tournament <span className="text-red-500">*</span>
              </label>
              <select
                id="tournament_id"
                required
                value={formData.tournament_id}
                onChange={(e) => setFormData({ ...formData, tournament_id: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="">Select a tournament</option>
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.year}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="event_name" className="block text-sm font-medium text-gray-700">
                  Event Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="event_name"
                  required
                  value={formData.event_name}
                  onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                  placeholder="e.g., The Kathryn Class Golf Tournament"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="event_type" className="block text-sm font-medium text-gray-700">
                  Event Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="event_type"
                  required
                  value={formData.event_type}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                >
                  <option value="">Select type</option>
                  {eventTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="event_date" className="block text-sm font-medium text-gray-700">
                  Event Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="event_date"
                  required
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="start_time" className="block text-sm font-medium text-gray-700">
                  Start Time
                </label>
                <input
                  type="time"
                  id="start_time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
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
                placeholder="e.g., Cape May National Golf Club"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="adult_price" className="block text-sm font-medium text-gray-700">
                  Adult Price ($) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="adult_price"
                  required
                  min="0"
                  step="0.01"
                  value={formData.adult_price}
                  onChange={(e) => setFormData({ ...formData, adult_price: e.target.value })}
                  placeholder="0.00"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="child_price" className="block text-sm font-medium text-gray-700">
                  Child Price ($) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="child_price"
                  required
                  min="0"
                  step="0.01"
                  value={formData.child_price}
                  onChange={(e) => setFormData({ ...formData, child_price: e.target.value })}
                  placeholder="0.00"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description of the event"
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
              {loading ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
