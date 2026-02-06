import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import EventForm from './EventForm';

export default function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState('all');
  const [tournaments, setTournaments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    const initializeData = async () => {
      await fetchTournaments();
      await fetchEvents();
    };
    initializeData();
  }, []);

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, year')
        .order('year', { ascending: false });

      if (error) throw error;
      setTournaments(data || []);

      // Set default to latest tournament
      if (data && data.length > 0 && selectedYear === 'all') {
        setSelectedYear(data[0].year.toString());
      }
    } catch (err) {
      console.error('Error fetching tournaments:', err);
    }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('tournament_events')
        .select(`
          *,
          tournaments (
            year
          )
        `)
        .order('event_date', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '-';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const filteredEvents = selectedYear === 'all'
    ? events
    : events.filter(e => e.tournaments?.year === parseInt(selectedYear));

  const handleAdd = () => {
    setSelectedEvent(null);
    setShowForm(true);
  };

  const handleEdit = (event) => {
    setSelectedEvent(event);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setSelectedEvent(null);
  };

  const handleSave = () => {
    fetchEvents();
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading events...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Events</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage tournament events and activities
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          Add Event
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex gap-4 items-center">
          <label htmlFor="year-filter" className="text-sm font-medium text-gray-700">
            Filter by Year:
          </label>
          <select
            id="year-filter"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          >
            <option value="all">All Years</option>
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.year}>
                {tournament.year}
              </option>
            ))}
          </select>
          <div className="flex items-center text-sm text-gray-600 ml-auto">
            Showing {filteredEvents.length} events
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                  Event Name
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Type
                </th>
                <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">
                  Year
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Date & Time
                </th>
                <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                  Adult Price
                </th>
                <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                  Child Price
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Location
                </th>
                <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredEvents.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                    {event.event_name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 capitalize">
                    {event.event_type?.replace(/_/g, ' ')}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-center">
                    {event.tournaments?.year}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {formatDate(event.event_date)}
                    {event.start_time && <span className="text-gray-400"> • {formatTime(event.start_time)}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">
                    {formatCurrency(event.adult_price)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">
                    {formatCurrency(event.child_price)}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500">
                    {event.location || '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                    <button
                      onClick={() => handleEdit(event)}
                      className="text-primary-600 hover:text-primary-900 font-medium"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredEvents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {selectedYear === 'all' ? 'No events found' : `No events found for ${selectedYear}`}
            </p>
          </div>
        )}
      </div>

      {/* Event Form Modal */}
      {showForm && (
        <EventForm
          event={selectedEvent}
          onClose={handleClose}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
