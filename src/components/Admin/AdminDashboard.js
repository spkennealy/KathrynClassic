import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    tournaments: [],
    events: [],
    registrations: { total: 0, paid: 0, pending: 0 },
    contacts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get background color for event rows based on tournament year
  const getYearColor = (year) => {
    const colors = {
      2026: 'bg-blue-100',
      2025: 'bg-emerald-100',
      2024: 'bg-purple-100',
      2023: 'bg-amber-100',
      2022: 'bg-rose-100',
      2021: 'bg-cyan-100',
      2020: 'bg-indigo-100',
    };
    return colors[year] || 'bg-slate-100';
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch tournament stats
      const { data: tournaments, error: tournamentsError } = await supabase
        .from('admin_tournament_stats')
        .select('*')
        .order('year', { ascending: false })
        .limit(5);

      if (tournamentsError) throw tournamentsError;

      // Get the latest tournament and its stats
      const latestTournament = tournaments?.[0];

      // Fetch recent event attendance
      const { data: events, error: eventsError } = await supabase
        .from('admin_event_attendance')
        .select('*')
        .order('event_date', { ascending: false })
        .limit(5);

      if (eventsError) throw eventsError;

      // Use registration counts from the tournament stats view (already filtered)
      const totalRegistrations = latestTournament?.registration_count || 0;
      const paidRegistrations = latestTournament?.paid_count || 0;
      const pendingRegistrations = latestTournament?.pending_count || 0;

      // Fetch contact count
      const { count: contactCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true });

      setStats({
        tournaments: tournaments || [],
        events: events || [],
        registrations: {
          total: totalRegistrations || 0,
          paid: paidRegistrations || 0,
          pending: pendingRegistrations || 0,
        },
        contacts: contactCount || 0,
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading dashboard...</p>
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Overview of Kathryn Classic tournament management
        </p>
      </div>

      {/* Quick Stats */}
      {stats.tournaments.length > 0 && (
        <div className="text-sm text-gray-600 mb-2">
          Showing stats for {stats.tournaments[0].year} tournament
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">Total Registrations</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
            {stats.registrations.total}
          </dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">Paid</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-green-600">
            {stats.registrations.paid}
          </dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">Pending Payment</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-yellow-600">
            {stats.registrations.pending}
          </dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">Total Contacts</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
            {stats.contacts}
          </dd>
        </div>
      </div>

      {/* Recent Tournaments */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Recent Tournaments</h2>
            <Link
              to="/admin/tournaments"
              className="text-sm font-medium text-primary-600 hover:text-primary-500"
            >
              View all →
            </Link>
          </div>
          <div className="mt-4 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Year</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Dates</th>
                  <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Registrations</th>
                  <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Attendees</th>
                  <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Raised</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {stats.tournaments.map((tournament) => (
                  <tr key={tournament.tournament_id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                      {tournament.year}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {new Date(tournament.start_date).toLocaleDateString()} - {new Date(tournament.end_date).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">
                      {tournament.registration_count}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">
                      {tournament.actual_total_attendees || 0}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">
                      ${tournament.total_raised?.toLocaleString() || '0'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Recent Events</h2>
            <Link
              to="/admin/events"
              className="text-sm font-medium text-primary-600 hover:text-primary-500"
            >
              View all →
            </Link>
          </div>
          <div className="mt-4 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Event</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Date</th>
                  <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Adults</th>
                  <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Children</th>
                  <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {stats.events.map((event) => (
                  <tr key={event.event_id} className={`${getYearColor(event.tournament_year)} hover:opacity-90 transition-opacity`}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                      <span className="text-xs text-gray-500 font-normal">{event.tournament_year} -</span>{' '}
                      {event.event_name}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {new Date(event.event_date).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">
                      {event.adult_count || 0}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">
                      {event.child_count || 0}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900 text-right">
                      {event.total_attendees || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
