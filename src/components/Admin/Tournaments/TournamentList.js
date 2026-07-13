import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import TournamentForm from './TournamentForm';
import ConfirmDialog from '../ConfirmDialog';
import Select from '../Select';
import { logAudit } from '../../../utils/audit';

export default function TournamentList() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tournamentToDelete, setTournamentToDelete] = useState(null);

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

  const handleDeleteClick = (tournament) => {
    setTournamentToDelete(tournament);
    setShowDeleteConfirm(true);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setTournamentToDelete(null);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error: deleteError } = await supabase
        .from('tournaments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', tournamentToDelete.id);

      if (deleteError) throw deleteError;

      await logAudit({
        action: 'tournament.deleted',
        entityType: 'tournament',
        entityId: tournamentToDelete.id,
        entityLabel: `Tournament ${tournamentToDelete.year}`,
        changes: {
          year: tournamentToDelete.year,
          start_date: tournamentToDelete.start_date,
          end_date: tournamentToDelete.end_date,
          location: tournamentToDelete.location,
        },
      });

      setShowDeleteConfirm(false);
      setTournamentToDelete(null);
      fetchTournaments();
    } catch (err) {
      console.error('Error deleting tournament:', err);
      alert('Failed to delete tournament');
      setShowDeleteConfirm(false);
      setTournamentToDelete(null);
    }
  };

  const handleRegistrationStatusChange = async (tournamentId, newStatus) => {
    try {
      const existing = tournaments.find(t => t.id === tournamentId);
      const oldStatus = existing?.registration_status;

      const { error } = await supabase
        .from('tournaments')
        .update({ registration_status: newStatus })
        .eq('id', tournamentId);

      if (error) throw error;

      if (oldStatus !== newStatus) {
        await logAudit({
          action: 'tournament.updated',
          entityType: 'tournament',
          entityId: tournamentId,
          entityLabel: existing?.year != null ? String(existing.year) : undefined,
          changes: { registration_status: { from: oldStatus ?? null, to: newStatus } },
        });
      }

      // Update local state
      setTournaments(tournaments.map(t =>
        t.id === tournamentId ? { ...t, registration_status: newStatus } : t
      ));
    } catch (err) {
      console.error('Error updating registration status:', err);
      alert('Failed to update registration status');
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800';
      case 'full':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'closed':
        return 'bg-gray-100 dark:bg-night-900 text-gray-800 dark:text-gray-100';
      default:
        return 'bg-gray-100 dark:bg-night-900 text-gray-800 dark:text-gray-100';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'open':
        return 'Open';
      case 'full':
        return 'Full (Waitlist)';
      case 'completed':
        return 'Completed';
      case 'closed':
        return 'Closed (Off-Season)';
      default:
        return status || 'Open';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading tournaments...</p>
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Tournaments</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
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
      <div className="bg-white dark:bg-night-800 shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50 dark:bg-night-700">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Year
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Dates
              </th>
              <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                Attendees
              </th>
              <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                Total Raised
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Location
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Registration Status
              </th>
              <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-night-700 bg-white dark:bg-night-800">
            {tournaments.map((tournament) => (
              <tr key={tournament.id} className="hover:bg-gray-50 dark:bg-night-700">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {tournament.year}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                  {tournament.total_attendees || '-'}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right font-medium">
                  {formatCurrency(tournament.total_raised)}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {tournament.location || '-'}
                </td>
                <td className="px-3 py-4 text-sm">
                  <Select
                    value={tournament.registration_status || 'open'}
                    onChange={(e) => handleRegistrationStatusChange(tournament.id, e.target.value)}
                    triggerClassName={`w-44 justify-between rounded-md px-3 py-1.5 text-xs font-semibold ${getStatusBadgeColor(tournament.registration_status || 'open')}`}
                  >
                    <option value="open">Open</option>
                    <option value="full">Full (Waitlist)</option>
                    <option value="completed">Completed</option>
                    <option value="closed">Closed (Off-Season)</option>
                  </Select>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-right space-x-3">
                  <button
                    onClick={() => handleEdit(tournament)}
                    className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:text-primary-300 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteClick(tournament)}
                    className="text-red-600 hover:text-red-900 font-medium"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {tournaments.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No tournaments found</p>
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Tournament"
        message={`Are you sure you want to delete the ${tournamentToDelete?.year} tournament? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
