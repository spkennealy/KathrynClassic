import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { logAudit } from '../../../utils/audit';
import AwardForm from './AwardForm';
import ConfirmDialog from '../ConfirmDialog';
import Select from '../Select';

export default function AwardList() {
  const [awards, setAwards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [tournaments, setTournaments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedAward, setSelectedAward] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [awardToDelete, setAwardToDelete] = useState(null);

  useEffect(() => {
    fetchTournaments();
    fetchAwards();
  }, []);

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

  const fetchAwards = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('tournament_awards')
        .select(`
          *,
          tournaments (
            year
          ),
          contacts (
            first_name,
            last_name,
            email
          )
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAwards(data || []);
    } catch (err) {
      console.error('Error fetching awards:', err);
      setError('Failed to load awards');
    } finally {
      setLoading(false);
    }
  };

  const getAwardCategories = () => {
    const categories = new Set(awards.map(a => a.award_category).filter(Boolean));
    return Array.from(categories).sort();
  };

  const filteredAwards = awards.filter(award => {
    const yearMatch = selectedYear === 'all' || award.tournaments?.year === parseInt(selectedYear);
    const categoryMatch = selectedCategory === 'all' || award.award_category === selectedCategory;
    return yearMatch && categoryMatch;
  });

  const handleAdd = () => {
    setSelectedAward(null);
    setShowForm(true);
  };

  const handleEdit = (award) => {
    setSelectedAward(award);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setSelectedAward(null);
  };

  const handleSave = () => {
    fetchAwards();
  };

  const handleDeleteClick = (award) => {
    setAwardToDelete(award);
    setShowDeleteConfirm(true);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setAwardToDelete(null);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error: deleteError } = await supabase
        .from('tournament_awards')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', awardToDelete.id);

      if (deleteError) throw deleteError;

      await logAudit({
        action: 'award.deleted',
        entityType: 'award',
        entityId: awardToDelete.id,
        entityLabel: `${awardToDelete.award_category} — ${awardToDelete.winner_name}`,
        changes: {
          award_category: awardToDelete.award_category,
          winner_name: awardToDelete.winner_name,
          prize: awardToDelete.prize,
        },
      });

      setShowDeleteConfirm(false);
      setAwardToDelete(null);
      fetchAwards();
    } catch (err) {
      console.error('Error deleting award:', err);
      alert('Failed to delete award');
      setShowDeleteConfirm(false);
      setAwardToDelete(null);
    }
  };

  const formatAwardDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading awards...</p>
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Awards</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage tournament awards and winners
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          Add Award
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-night-800 p-4 rounded-lg shadow">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="year-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Year:
            </label>
            <Select
              id="year-filter"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-40"
            >
              <option value="all">All Years</option>
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.year}>
                  {tournament.year}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="category-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Category:
            </label>
            <Select
              id="category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-56"
            >
              <option value="all">All Categories</option>
              {getAwardCategories().map((category) => (
                <option key={category} value={category}>
                  {category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 ml-auto">
            Showing {filteredAwards.length} awards
          </div>
        </div>
      </div>

      {/* Awards Table */}
      <div className="bg-white dark:bg-night-800 shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50 dark:bg-night-700">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Winner
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Award Category
              </th>
              <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                Year
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Date
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Prize
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Description
              </th>
              <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-night-700 bg-white dark:bg-night-800">
            {filteredAwards.map((award) => {
              const winnerName = award.contacts
                ? `${award.contacts.first_name} ${award.contacts.last_name}`
                : award.winner_name;

              return (
                <tr key={award.id} className="hover:bg-gray-50 dark:bg-night-700">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                    <div className="flex items-center gap-3">
                      {award.photo_url && (
                        <img
                          src={award.photo_url}
                          alt={winnerName}
                          className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-night-700 flex-shrink-0"
                        />
                      )}
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">{winnerName}</div>
                        {award.contacts?.email && (
                          <div className="text-gray-500 dark:text-gray-400 text-xs">{award.contacts.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                      {award.award_category?.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                    {award.tournaments?.year}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {formatAwardDate(award.award_date) || '-'}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {award.prize || '-'}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                    {award.details || '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right space-x-3">
                    <button
                      onClick={() => handleEdit(award)}
                      className="text-primary-600 dark:text-primary-400 hover:text-primary-900 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(award)}
                      className="text-red-600 hover:text-red-900 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredAwards.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No awards found
              {(selectedYear !== 'all' || selectedCategory !== 'all') && ' with selected filters'}
            </p>
          </div>
        )}
      </div>

      {/* Award Form Modal */}
      {showForm && (
        <AwardForm
          award={selectedAward}
          onClose={handleClose}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Award"
        message={`Are you sure you want to delete this award? This action can be undone from the Recycle Bin.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
