import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import TournamentForm from './TournamentForm';

export default function TournamentList() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState(null);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('year', { ascending: false });

      if (error) throw error;
      setTournaments(data || []);
    } catch (err) {
      console.error('Error fetching tournaments:', err);
      setError('Failed to load tournaments');
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

  const handleAdd = () => {
    setSelectedTournament(null);
    setShowForm(true);
  };

  const handleEdit = (tournament) => {
    setSelectedTournament(tournament);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setSelectedTournament(null);
  };

  const handleSave = () => {
    fetchTournaments();
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading tournaments...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Tournaments</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage Kathryn Classic tournament details
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          Add Tournament
        </button>
      </div>

      {/* Tournaments List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                Year
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Dates
              </th>
              <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">
                Attendees
              </th>
              <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                Total Raised
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
            {tournaments.map((tournament) => (
              <tr key={tournament.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                  {tournament.year}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-center">
                  {tournament.total_attendees || '-'}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right font-medium">
                  {formatCurrency(tournament.total_raised)}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500">
                  {tournament.location || '-'}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                  <button
                    onClick={() => handleEdit(tournament)}
                    className="text-primary-600 hover:text-primary-900 font-medium"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {tournaments.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No tournaments found</p>
          </div>
        )}
      </div>

      {/* Tournament Form Modal */}
      {showForm && (
        <TournamentForm
          tournament={selectedTournament}
          onClose={handleClose}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
