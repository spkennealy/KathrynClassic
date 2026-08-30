import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../../supabaseClient';
import { logAudit } from '../../../utils/audit';
import Select from '../Select';
import RegistrationEditForm from './RegistrationEditForm';
import ContactEditForm from '../Contacts/ContactEditForm';
import ConfirmDialog from '../ConfirmDialog';

const PAGE_SIZE = 50;

// Build the PostgREST `.or()` filter for a search term. A primary contact match
// (name/email/phone) is preferred; preferred_teammates is matched secondarily.
// Multi-word terms ("First Last") are matched against first_name + last_name together,
// since those are separate columns.
const buildSearchConditions = (searchTerm) => {
  const term = searchTerm.trim();
  const conditions = [
    `first_name.ilike.%${term}%`,
    `last_name.ilike.%${term}%`,
    `email.ilike.%${term}%`,
    `phone.ilike.%${term}%`,
    `preferred_teammates.ilike.%${term}%`,
  ];

  const words = term.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const first = words[0];
    const last = words.slice(1).join(' ');
    conditions.push(`and(first_name.ilike.%${first}%,last_name.ilike.%${last}%)`);
  }

  const isNumeric = !isNaN(term) && term !== '';
  if (isNumeric) {
    conditions.push(`tournament_year.eq.${parseInt(term)}`);
    conditions.push(`golf_handicap.eq.${parseFloat(term)}`);
  }

  return conditions.join(',');
};

// Sort so rows matching the primary contact come before rows that only matched
// because the term appears in preferred_teammates.
const sortByContactRelevance = (rows, searchTerm) => {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return rows;
  const isPrimary = (r) => {
    const full = `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase();
    return (
      (r.first_name || '').toLowerCase().includes(term) ||
      (r.last_name || '').toLowerCase().includes(term) ||
      full.includes(term) ||
      (r.email || '').toLowerCase().includes(term) ||
      (r.phone || '').toLowerCase().includes(term)
    );
  };
  return [...rows].sort((a, b) => (isPrimary(a) === isPrimary(b) ? 0 : isPrimary(a) ? -1 : 1));
};

export default function RegistrationList() {
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState({
    tournamentYear: 'all',
    paymentStatus: 'all',
  });
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [registrationToDelete, setRegistrationToDelete] = useState(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState(null);

  // Debounce the search box so we don't refetch on every keystroke (which caused
  // the input to lose focus when results briefly emptied during a fetch).
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);
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
          const searchFilter = buildSearchConditions(searchTerm);
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
          setRegistrations(sortByContactRelevance(data || [], searchTerm));
        } else {
          const offset = (currentPage - 1) * PAGE_SIZE;
          const { data, error: dataError } = await dataQuery.range(offset, offset + PAGE_SIZE - 1);
          if (dataError) throw dataError;
          setRegistrations(sortByContactRelevance(data || [], searchTerm));
        }
      } catch (err) {
        console.error('Error fetching registrations:', err);
        setError(err.message || 'Failed to load registrations');
      } finally {
        setLoading(false);
        setInitialLoad(false);
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

      // Delete associated registration_events first
      const { error: eventsDeleteError } = await supabase
        .from('registration_events')
        .delete()
        .eq('registration_id', registrationToDelete.registration_id);

      if (eventsDeleteError) throw eventsDeleteError;

      // Soft delete by setting deleted_at timestamp
      const { error: deleteError } = await supabase
        .from('registrations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', registrationToDelete.registration_id);

      if (deleteError) throw deleteError;

      await logAudit({
        action: 'registration.deleted',
        entityType: 'registration',
        entityId: registrationToDelete.registration_id,
        entityLabel: `${registrationToDelete.first_name} ${registrationToDelete.last_name}`,
        changes: {
          contact: `${registrationToDelete.first_name} ${registrationToDelete.last_name}`,
          email: registrationToDelete.email,
          tournament_year: registrationToDelete.tournament_year,
          payment_status: registrationToDelete.payment_status,
        },
      });

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
            const searchFilter = buildSearchConditions(searchTerm);
            dataQuery = dataQuery.or(searchFilter);
            countQuery = countQuery.or(searchFilter);
          }

          const { count, error: countError } = await countQuery;
          if (countError) throw countError;
          setTotalCount(count || 0);

          if (searchTerm) {
            const { data, error: dataError } = await dataQuery.limit(500);
            if (dataError) throw dataError;
            setRegistrations(sortByContactRelevance(data || [], searchTerm));
          } else {
            const offset = (currentPage - 1) * PAGE_SIZE;
            const { data, error: dataError } = await dataQuery.range(offset, offset + PAGE_SIZE - 1);
            if (dataError) throw dataError;
            setRegistrations(sortByContactRelevance(data || [], searchTerm));
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
        const searchFilter = buildSearchConditions(searchTerm);
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
      setRegistrations(sortByContactRelevance(data || [], searchTerm));
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

  // Build a map of registration_group_id → list of member names for group indicators
  const groupMap = useMemo(() => {
    const map = {};
    registrations.forEach((reg) => {
      if (reg.registration_group_id) {
        if (!map[reg.registration_group_id]) map[reg.registration_group_id] = [];
        map[reg.registration_group_id].push({
          id: reg.registration_id,
          name: `${reg.first_name} ${reg.last_name}`,
        });
      }
    });
    return map;
  }, [registrations]);

  // Assign a distinct color to each registration group
  const GROUP_COLORS = [
    { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700' },
    { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-700' },
    { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-700' },
    { bg: 'bg-rose-50', border: 'border-rose-400', text: 'text-rose-700' },
    { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-700' },
  ];

  const groupColorMap = useMemo(() => {
    const map = {};
    let colorIndex = 0;
    registrations.forEach((reg) => {
      if (reg.registration_group_id && !map[reg.registration_group_id]) {
        map[reg.registration_group_id] = GROUP_COLORS[colorIndex % GROUP_COLORS.length];
        colorIndex++;
      }
    });
    return map;
  }, [registrations]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (initialLoad && loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading registrations...</p>
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Registrations</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
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
      <div className="bg-white dark:bg-night-800 p-4 rounded-lg shadow space-y-4">
        <div className="flex-1">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Search
          </label>
          <input
            type="text"
            id="search"
            placeholder="Search by name, email, tournament, events, payment status, or date..."
            spellCheck={false}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="block w-full"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tournament Year
            </label>
            <Select
              value={filter.tournamentYear}
              onChange={(e) => setFilter({ ...filter, tournamentYear: e.target.value })}
              className="block w-full"
            >
              <option value="all">All Years</option>
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.year}>
                  {tournament.year}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Payment Status
            </label>
            <Select
              value={filter.paymentStatus}
              onChange={(e) => setFilter({ ...filter, paymentStatus: e.target.value })}
              className="block w-full"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </Select>
          </div>

          <div className="flex items-end">
            <span className="text-sm text-gray-600 dark:text-gray-400">
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
      <div className="bg-white dark:bg-night-800 shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50 dark:bg-night-700">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Date
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Name
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Tournament
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Events
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Children
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Preferred Teammates
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Payment
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-night-700 bg-white dark:bg-night-800">
            {(() => {
              const seenGroups = new Set();
              return filteredRegistrations.flatMap((reg) => {
                const rows = [];
                // Insert a colored group header row before the first member of each group
                if (reg.registration_group_id && groupMap[reg.registration_group_id] && !seenGroups.has(reg.registration_group_id)) {
                  seenGroups.add(reg.registration_group_id);
                  const color = groupColorMap[reg.registration_group_id];
                  rows.push(
                    <tr key={`group-${reg.registration_group_id}`} className={color.bg}>
                      <td colSpan={8} className={`px-4 py-1.5 text-xs font-medium ${color.text} border-t-2 border-l-2 border-r-2 ${color.border}`}>
                        Registered together: {groupMap[reg.registration_group_id].map((m) => m.name).join(', ')}
                      </td>
                    </tr>
                  );
                }
                const groupColor = reg.registration_group_id && groupColorMap[reg.registration_group_id];
                const groupMembers = reg.registration_group_id && groupMap[reg.registration_group_id];
                const isLastInGroup = groupMembers && groupMembers[groupMembers.length - 1].id === reg.registration_id;
                // Group color is applied to cells (not the <tr>) so it renders a full box.
                const gb = groupColor ? groupColor.border : '';
                const bBottom = groupColor && isLastInGroup ? ` border-b-2 ${gb}` : '';
                const bLeft = groupColor ? ` border-l-2 ${gb}` : '';
                const bRight = groupColor ? ` border-r-2 ${gb}` : '';
                rows.push(
                  <tr key={reg.registration_id} className="hover:bg-gray-50 dark:bg-night-700">
                    <td className={`whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 dark:text-gray-400${bLeft}${bBottom}`}>
                      {new Date(reg.registration_date).toLocaleDateString()}
                    </td>
                    <td className={`px-3 py-4 text-sm${bBottom}`}>
                      <button
                        onClick={() => {
                          setSelectedContact({ contact_id: reg.contact_id, first_name: reg.first_name, last_name: reg.last_name, email: reg.email, phone: reg.phone });
                          setShowContactForm(true);
                        }}
                        className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:text-primary-300 hover:underline text-left"
                      >
                        {reg.first_name} {reg.last_name}
                      </button>
                    </td>
                    <td className={`whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400${bBottom}`}>
                      {reg.tournament_year}
                    </td>
                    <td className={`px-3 py-4 text-sm text-gray-500 dark:text-gray-400${bBottom}`}>
                      {reg.events && reg.events.length > 0 ? (
                        <div className="space-y-0.5">
                          {reg.events.map((event, i) => {
                            const isGolf = /golf/i.test(event);
                            return (
                              <div key={i}>
                                {event}
                                {isGolf && reg.golf_handicap != null && reg.golf_handicap !== '' && (
                                  <span className="text-gray-400"> (handicap: {reg.golf_handicap})</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className={`px-3 py-4 text-sm text-gray-500 dark:text-gray-400${bBottom}`}>
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
                    <td className={`px-3 py-4 text-sm text-gray-500 dark:text-gray-400${bBottom}`}>
                      {reg.preferred_teammates ? (
                        <div>
                          {reg.preferred_teammates.split(',').map((name, i) => (
                            <div key={i}>{name.trim()}</div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-4 text-sm${bBottom}`}>
                      <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                        reg.payment_status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {reg.payment_status}
                      </span>
                    </td>
                    <td className={`whitespace-nowrap px-3 py-4 text-sm text-right space-x-3${bRight}${bBottom}`}>
                      <button
                        onClick={() => handleEdit(reg)}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:text-primary-300 font-medium"
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
                );
                return rows;
              });
            })()}
          </tbody>
        </table>

        {filteredRegistrations.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm ? 'No registrations found matching your search' : 'No registrations found'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination - hidden when searching */}
      {!searchTerm && totalPages > 1 && (
        <div className="bg-white dark:bg-night-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-night-700 sm:px-6 rounded-lg shadow">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-night-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 hover:bg-gray-50 dark:bg-night-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-night-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 hover:bg-gray-50 dark:bg-night-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
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
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-night-600 bg-white dark:bg-night-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:bg-night-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                          ? 'z-10 bg-primary-50 border-primary-500 text-primary-600 dark:text-primary-400'
                          : 'bg-white dark:bg-night-800 border-gray-300 dark:border-night-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:bg-night-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-night-600 bg-white dark:bg-night-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:bg-night-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Contact Edit Modal */}
      {showContactForm && (
        <ContactEditForm
          contact={selectedContact}
          onClose={() => { setShowContactForm(false); setSelectedContact(null); }}
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
