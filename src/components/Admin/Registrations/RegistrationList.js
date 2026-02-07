import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import RegistrationEditForm from './RegistrationEditForm';
import ConfirmDialog from '../ConfirmDialog';

const PAGE_SIZE = 50;

export default function RegistrationList() {
  const [filter, setFilter] = useState({
    tournamentYear: 'all',
    paymentStatus: 'all',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [registrationToDelete, setRegistrationToDelete] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch tournaments on mount
  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const { data, error } = await supabase
          .from('tournaments')
          .select('id, year')
          .order('year', { ascending: false });

        if (error) throw error;
        setTournaments(data || []);

        // Set default to latest tournament
        if (data && data.length > 0 && filter.tournamentYear === 'all') {
          setFilter(prev => ({ ...prev, tournamentYear: data[0].year.toString() }));
        }
      } catch (err) {
        console.error('Error fetching tournaments:', err);
      }
    };

    fetchTournaments();
  }, []);

  // Fetch registrations and total count whenever filter or page changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Build query base
        let countQuery = supabase
          .from('admin_registration_details')
          .select('registration_id', { count: 'exact', head: true });

        let dataQuery = supabase
          .from('admin_registration_details')
          .select('*')
          .order('registration_date', { ascending: false });

        // Apply filters
        if (filter.tournamentYear !== 'all') {
          countQuery = countQuery.eq('tournament_year', parseInt(filter.tournamentYear));
          dataQuery = dataQuery.eq('tournament_year', parseInt(filter.tournamentYear));
        }

        if (filter.paymentStatus !== 'all') {
          countQuery = countQuery.eq('payment_status', filter.paymentStatus);
          dataQuery = dataQuery.eq('payment_status', filter.paymentStatus);
        }

        // Apply search filter if present
        if (searchTerm) {
          // Build search conditions for all searchable text columns
          const searchConditions = [
            `first_name.ilike.%${searchTerm}%`,
            `last_name.ilike.%${searchTerm}%`,
            `email.ilike.%${searchTerm}%`,
            `phone.ilike.%${searchTerm}%`,
            `preferred_teammates.ilike.%${searchTerm}%`,
          ];

          // If search term is numeric, also search tournament year and golf handicap
          const isNumeric = !isNaN(searchTerm) && searchTerm.trim() !== '';
          if (isNumeric) {
            searchConditions.push(`tournament_year.eq.${parseInt(searchTerm)}`);
            searchConditions.push(`golf_handicap.eq.${parseFloat(searchTerm)}`);
          }

          const searchFilter = searchConditions.join(',');
          dataQuery = dataQuery.or(searchFilter);
          countQuery = countQuery.or(searchFilter);
        }

        // Fetch total count
        const { count, error: countError } = await countQuery;
        if (countError) throw countError;
        setTotalCount(count || 0);

        // Fetch data - if searching, get more results; otherwise paginate
        if (searchTerm) {
          const { data, error: dataError } = await dataQuery.limit(500);
          if (dataError) throw dataError;
          setRegistrations(data || []);
        } else {
          const offset = (currentPage - 1) * PAGE_SIZE;
          const { data, error: dataError } = await dataQuery.range(offset, offset + PAGE_SIZE - 1);
          if (dataError) throw dataError;
          setRegistrations(data || []);
        }
      } catch (err) {
        console.error('Error fetching registrations:', err);
        setError(err.message || 'Failed to load registrations');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filter, currentPage, searchTerm]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const handleEdit = (registration) => {
    setSelectedRegistration(registration);
    setShowEditForm(true);
  };

  const handleCloseEdit = () => {
    setShowEditForm(false);
    setSelectedRegistration(null);
  };

  const handleDeleteClick = (registration) => {
    setRegistrationToDelete(registration);
    setShowDeleteConfirm(true);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setRegistrationToDelete(null);
  };

  const handleDeleteConfirm = async () => {
    try {
      setError(null);

      // Soft delete by setting deleted_at timestamp
      const { error: deleteError } = await supabase
        .from('registrations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', registrationToDelete.registration_id);

      if (deleteError) throw deleteError;

      // Close dialog
      setShowDeleteConfirm(false);
      setRegistrationToDelete(null);

      // Refresh the list (will automatically exclude soft-deleted records)
      const fetchData = async () => {
        try {
          setLoading(true);
          setError(null);

          let countQuery = supabase
            .from('admin_registration_details')
            .select('registration_id', { count: 'exact', head: true });

          let dataQuery = supabase
            .from('admin_registration_details')
            .select('*')
            .order('registration_date', { ascending: false });

          if (filter.tournamentYear !== 'all') {
            countQuery = countQuery.eq('tournament_year', parseInt(filter.tournamentYear));
            dataQuery = dataQuery.eq('tournament_year', parseInt(filter.tournamentYear));
          }

          if (filter.paymentStatus !== 'all') {
            countQuery = countQuery.eq('payment_status', filter.paymentStatus);
            dataQuery = dataQuery.eq('payment_status', filter.paymentStatus);
          }

          if (searchTerm) {
            const searchConditions = [
              `first_name.ilike.%${searchTerm}%`,
              `last_name.ilike.%${searchTerm}%`,
              `email.ilike.%${searchTerm}%`,
              `phone.ilike.%${searchTerm}%`,
              `preferred_teammates.ilike.%${searchTerm}%`,
            ];

            const isNumeric = !isNaN(searchTerm) && searchTerm.trim() !== '';
            if (isNumeric) {
              searchConditions.push(`tournament_year.eq.${parseInt(searchTerm)}`);
              searchConditions.push(`golf_handicap.eq.${parseFloat(searchTerm)}`);
            }

            const searchFilter = searchConditions.join(',');
            dataQuery = dataQuery.or(searchFilter);
            countQuery = countQuery.or(searchFilter);
          }

          const { count, error: countError } = await countQuery;
          if (countError) throw countError;
          setTotalCount(count || 0);

          if (searchTerm) {
            const { data, error: dataError } = await dataQuery.limit(500);
            if (dataError) throw dataError;
            setRegistrations(data || []);
          } else {
            const offset = (currentPage - 1) * PAGE_SIZE;
            const { data, error: dataError } = await dataQuery.range(offset, offset + PAGE_SIZE - 1);
            if (dataError) throw dataError;
            setRegistrations(data || []);
          }
        } catch (err) {
          console.error('Error fetching registrations:', err);
          setError(err.message || 'Failed to load registrations');
        } finally {
          setLoading(false);
        }
      };

      await fetchData();
    } catch (err) {
      console.error('Error deleting registration:', err);
      setError(err.message || 'Failed to delete registration');
      setShowDeleteConfirm(false);
      setRegistrationToDelete(null);
    }
  };

  const handleSaveEdit = async () => {
    // Refresh the current page without changing page number
    try {
      setLoading(true);
      setError(null);

      // Build query base
      let countQuery = supabase
        .from('admin_registration_details')
        .select('registration_id', { count: 'exact', head: true });

      let dataQuery = supabase
        .from('admin_registration_details')
        .select('*')
        .order('registration_date', { ascending: false });

      // Apply filters
      if (filter.tournamentYear !== 'all') {
        countQuery = countQuery.eq('tournament_year', parseInt(filter.tournamentYear));
        dataQuery = dataQuery.eq('tournament_year', parseInt(filter.tournamentYear));
      }

      if (filter.paymentStatus !== 'all') {
        countQuery = countQuery.eq('payment_status', filter.paymentStatus);
        dataQuery = dataQuery.eq('payment_status', filter.paymentStatus);
      }

      // Apply search filter if present
      if (searchTerm) {
        const searchConditions = [
          `first_name.ilike.%${searchTerm}%`,
          `last_name.ilike.%${searchTerm}%`,
          `email.ilike.%${searchTerm}%`,
          `phone.ilike.%${searchTerm}%`,
          `preferred_teammates.ilike.%${searchTerm}%`,
        ];

        const isNumeric = !isNaN(searchTerm) && searchTerm.trim() !== '';
        if (isNumeric) {
          searchConditions.push(`tournament_year.eq.${parseInt(searchTerm)}`);
          searchConditions.push(`golf_handicap.eq.${parseFloat(searchTerm)}`);
        }

        const searchFilter = searchConditions.join(',');
        dataQuery = dataQuery.or(searchFilter);
        countQuery = countQuery.or(searchFilter);
      }

      // Fetch total count
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      setTotalCount(count || 0);

      // Fetch data for current page
      const offset = (currentPage - 1) * PAGE_SIZE;
      const { data, error: dataError } = await dataQuery
        .range(offset, offset + PAGE_SIZE - 1);

      if (dataError) throw dataError;
      setRegistrations(data || []);
    } catch (err) {
      console.error('Error fetching registrations:', err);
      setError(err.message || 'Failed to load registrations');
    } finally {
      setLoading(false);
    }
  };

  // When searching, registrations are already filtered by the database query
  // When not searching, show all registrations from the current page
  const filteredRegistrations = registrations;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (loading && registrations.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading registrations...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Registrations</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage tournament registrations and payment status
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedRegistration(null);
            setShowEditForm(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Registration
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <div className="flex-1">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            id="search"
            placeholder="Search by name, email, tournament, events, payment status, or date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tournament Year
            </label>
            <select
              value={filter.tournamentYear}
              onChange={(e) => setFilter({ ...filter, tournamentYear: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="all">All Years</option>
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.year}>
                  {tournament.year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Status
            </label>
            <select
              value={filter.paymentStatus}
              onChange={(e) => setFilter({ ...filter, paymentStatus: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="flex items-end">
            <span className="text-sm text-gray-600">
              {searchTerm ? (
                <>Showing {filteredRegistrations.length} matching registrations</>
              ) : (
                <>Page {currentPage} of {totalPages} ({totalCount} total registrations)</>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Registrations Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                Date
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Name
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Email
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Tournament
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Events
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Children
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Payment
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredRegistrations.map((reg) => (
              <tr key={reg.registration_id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500">
                  {new Date(reg.registration_date).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                  {reg.first_name} {reg.last_name}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500">
                  {reg.email || 'No email'}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {reg.tournament_year}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500">
                  <div className="max-w-xs truncate">
                    {reg.events?.join(', ') || 'None'}
                  </div>
                </td>
                <td className="px-3 py-4 text-sm text-gray-500">
                  {reg.children_by_event && Object.keys(reg.children_by_event).length > 0 ? (
                    <div className="space-y-1">
                      {Object.entries(reg.children_by_event).map(([eventType, count]) => (
                        count > 0 && (
                          <div key={eventType} className="text-xs">
                            <span className="font-medium">{count}</span> × {eventType.replace(/_/g, ' ')}
                          </div>
                        )
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">None</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm">
                  <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                    reg.payment_status === 'paid'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {reg.payment_status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-right space-x-3">
                  <button
                    onClick={() => handleEdit(reg)}
                    className="text-primary-600 hover:text-primary-900 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteClick(reg)}
                    className="text-red-600 hover:text-red-900 font-medium"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredRegistrations.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchTerm ? 'No registrations found matching your search' : 'No registrations found'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination - hidden when searching */}
      {!searchTerm && totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-lg shadow">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{' '}
                <span className="font-medium">{Math.min(currentPage * PAGE_SIZE, totalCount)}</span> of{' '}
                <span className="font-medium">{totalCount}</span> registrations
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === pageNum
                          ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Registration Edit/Create Form Modal */}
      {showEditForm && (
        <RegistrationEditForm
          registration={selectedRegistration}
          onClose={handleCloseEdit}
          onSave={handleSaveEdit}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Registration"
        message={`Are you sure you want to delete the registration for ${registrationToDelete?.first_name} ${registrationToDelete?.last_name}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
