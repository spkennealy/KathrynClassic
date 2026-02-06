import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import ContactEditForm from './ContactEditForm';

const PAGE_SIZE = 50;

export default function ContactList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedContactIds, setSelectedContactIds] = useState(new Set());
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [allContactIds, setAllContactIds] = useState([]);
  const [filters, setFilters] = useState({
    hasEmail: 'all', // 'all', 'yes', 'no'
    hasPhone: 'all',
    hasRegistrations: 'all',
    hasTournaments: 'all',
    hasAwards: 'all',
    tournamentYear: 'all',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [availableYears, setAvailableYears] = useState([]);

  // Fetch contacts and total count
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Build query
        let query = supabase.from('admin_contact_activity').select('*', { count: 'exact' });

        // Apply search filter
        if (searchTerm) {
          query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }

        // Apply filters
        if (filters.hasEmail === 'yes') {
          query = query.not('email', 'is', null);
        } else if (filters.hasEmail === 'no') {
          query = query.is('email', null);
        }

        if (filters.hasPhone === 'yes') {
          query = query.not('phone', 'is', null);
        } else if (filters.hasPhone === 'no') {
          query = query.is('phone', null);
        }

        if (filters.hasRegistrations === 'yes') {
          query = query.gt('total_registrations', 0);
        } else if (filters.hasRegistrations === 'no') {
          query = query.or('total_registrations.is.null,total_registrations.eq.0');
        }

        if (filters.hasTournaments === 'yes') {
          query = query.gt('tournaments_attended', 0);
        } else if (filters.hasTournaments === 'no') {
          query = query.or('tournaments_attended.is.null,tournaments_attended.eq.0');
        }

        if (filters.hasAwards === 'yes') {
          query = query.gt('awards_won', 0);
        } else if (filters.hasAwards === 'no') {
          query = query.or('awards_won.is.null,awards_won.eq.0');
        }

        if (filters.tournamentYear !== 'all') {
          query = query.contains('tournament_years', [parseInt(filters.tournamentYear)]);
        }

        query = query.order('last_name');

        // Apply pagination or limit based on search
        if (searchTerm || hasActiveFilters()) {
          query = query.limit(500);
        } else {
          const offset = (currentPage - 1) * PAGE_SIZE;
          query = query.range(offset, offset + PAGE_SIZE - 1);
        }

        const { data, error: dataError, count } = await query;

        if (dataError) throw dataError;
        setContacts(data || []);
        setTotalCount(count || 0);

        // Extract available years
        if (data && data.length > 0) {
          const years = new Set();
          data.forEach(contact => {
            if (contact.tournament_years) {
              contact.tournament_years.forEach(year => years.add(year));
            }
          });
          setAvailableYears(Array.from(years).sort((a, b) => b - a));
        }
      } catch (err) {
        console.error('Error fetching contacts:', err);
        setError(err.message || 'Failed to load contacts');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Clear selections when page changes (but not if all pages are selected)
    if (!selectAllPages) {
      setSelectedContactIds(new Set());
    }
  }, [currentPage, selectAllPages, searchTerm, filters]);

  // When searching, contacts are already filtered by the database query
  // When not searching, show all contacts from the current page
  const filteredContacts = contacts;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleEdit = (contact) => {
    setSelectedContact(contact);
    setShowEditForm(true);
  };

  const handleCloseEdit = () => {
    setShowEditForm(false);
    setSelectedContact(null);
  };

  const handleSaveEdit = async () => {
    // Refresh the contacts list
    try {
      setLoading(true);
      setError(null);

      // Fetch total count
      const { count, error: countError } = await supabase
        .from('admin_contact_activity')
        .select('contact_id', { count: 'exact', head: true });

      if (countError) throw countError;
      setTotalCount(count || 0);

      // Fetch contacts for current page
      const offset = (currentPage - 1) * PAGE_SIZE;
      const { data, error: dataError } = await supabase
        .from('admin_contact_activity')
        .select('*')
        .order('last_name')
        .range(offset, offset + PAGE_SIZE - 1);

      if (dataError) throw dataError;
      setContacts(data || []);
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setError(err.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allContactIds = new Set(filteredContacts.map(c => c.contact_id));
      setSelectedContactIds(allContactIds);
      setSelectAllPages(false);
    } else {
      setSelectedContactIds(new Set());
      setSelectAllPages(false);
    }
  };

  const handleSelectAllPages = async () => {
    try {
      // Fetch all contact IDs from the database
      const { data, error } = await supabase
        .from('admin_contact_activity')
        .select('contact_id, email');

      if (error) throw error;

      const allIds = new Set(data.map(c => c.contact_id));
      setSelectedContactIds(allIds);
      setAllContactIds(data);
      setSelectAllPages(true);
    } catch (err) {
      console.error('Error fetching all contacts:', err);
      alert('Failed to select all contacts. Please try again.');
    }
  };

  const handleDeselectAll = () => {
    setSelectedContactIds(new Set());
    setSelectAllPages(false);
    setAllContactIds([]);
  };

  const handleSelectContact = (contactId) => {
    setSelectedContactIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const handleEmailContacts = () => {
    let emails;

    if (selectAllPages && allContactIds.length > 0) {
      // Use all contacts from database
      emails = allContactIds
        .map(c => c.email)
        .filter(email => email);
    } else {
      // Use filtered contacts from current page
      const selectedContacts = filteredContacts.filter(c => selectedContactIds.has(c.contact_id));
      emails = selectedContacts
        .map(c => c.email)
        .filter(email => email);
    }

    if (emails.length === 0) {
      alert('No valid email addresses found for selected contacts.');
      return;
    }

    const emailString = emails.join(', ');

    // Copy to clipboard
    navigator.clipboard.writeText(emailString).then(() => {
      setShowCopiedMessage(true);
      setTimeout(() => setShowCopiedMessage(false), 3000);
    }).catch(err => {
      console.error('Failed to copy emails:', err);
      alert('Failed to copy emails to clipboard. Please try again.');
    });
  };

  const hasActiveFilters = () => {
    return filters.hasEmail !== 'all' ||
           filters.hasPhone !== 'all' ||
           filters.hasRegistrations !== 'all' ||
           filters.hasTournaments !== 'all' ||
           filters.hasAwards !== 'all' ||
           filters.tournamentYear !== 'all';
  };

  const clearFilters = () => {
    setFilters({
      hasEmail: 'all',
      hasPhone: 'all',
      hasRegistrations: 'all',
      hasTournaments: 'all',
      hasAwards: 'all',
      tournamentYear: 'all',
    });
  };

  const allFilteredSelected = filteredContacts.length > 0 &&
    filteredContacts.every(c => selectedContactIds.has(c.contact_id));
  const someFilteredSelected = filteredContacts.some(c => selectedContactIds.has(c.contact_id));

  if (loading && contacts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading contacts...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage tournament participants and their contact information
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedContact(null);
            setShowEditForm(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Contact
        </button>
      </div>

      {/* Search and Email Button */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="search" className="sr-only">Search contacts</label>
            <input
              type="text"
              id="search"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
          </div>
          {selectedContactIds.size > 0 && (
            <button
              onClick={handleEmailContacts}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Contacts ({selectedContactIds.size})
            </button>
          )}
          <div className="flex items-center text-sm text-gray-600">
            {searchTerm ? (
              <>Showing {filteredContacts.length} matching contacts</>
            ) : (
              <>Page {currentPage} of {totalPages} ({totalCount} total contacts)</>
            )}
          </div>
        </div>
        {showCopiedMessage && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">
              ✓ Email addresses copied to clipboard! You can now paste them into Gmail's BCC field.
            </p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="font-medium text-gray-900">Filters</span>
            {hasActiveFilters() && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                Active
              </span>
            )}
          </div>
          <svg className={`h-5 w-5 text-gray-400 transition-transform ${showFilters ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showFilters && (
          <div className="px-4 py-4 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Has Email Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <select
                  value={filters.hasEmail}
                  onChange={(e) => setFilters({ ...filters, hasEmail: e.target.value })}
                  className="block w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="all">All</option>
                  <option value="yes">Has Email</option>
                  <option value="no">No Email</option>
                </select>
              </div>

              {/* Has Phone Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <select
                  value={filters.hasPhone}
                  onChange={(e) => setFilters({ ...filters, hasPhone: e.target.value })}
                  className="block w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="all">All</option>
                  <option value="yes">Has Phone</option>
                  <option value="no">No Phone</option>
                </select>
              </div>

              {/* Has Registrations Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Registrations</label>
                <select
                  value={filters.hasRegistrations}
                  onChange={(e) => setFilters({ ...filters, hasRegistrations: e.target.value })}
                  className="block w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="all">All</option>
                  <option value="yes">Has Registered</option>
                  <option value="no">Never Registered</option>
                </select>
              </div>

              {/* Has Tournaments Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tournaments</label>
                <select
                  value={filters.hasTournaments}
                  onChange={(e) => setFilters({ ...filters, hasTournaments: e.target.value })}
                  className="block w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="all">All</option>
                  <option value="yes">Attended</option>
                  <option value="no">Never Attended</option>
                </select>
              </div>

              {/* Has Awards Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Awards</label>
                <select
                  value={filters.hasAwards}
                  onChange={(e) => setFilters({ ...filters, hasAwards: e.target.value })}
                  className="block w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="all">All</option>
                  <option value="yes">Has Awards</option>
                  <option value="no">No Awards</option>
                </select>
              </div>

              {/* Tournament Year Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                <select
                  value={filters.tournamentYear}
                  onChange={(e) => setFilters({ ...filters, tournamentYear: e.target.value })}
                  className="block w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="all">All Years</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            {hasActiveFilters() && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Select All Pages Banner */}
      {allFilteredSelected && !selectAllPages && totalCount > filteredContacts.length && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-blue-800">
              All <strong>{filteredContacts.length}</strong> contacts on this page are selected.
            </p>
            <button
              onClick={handleSelectAllPages}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 underline"
            >
              Select all {totalCount} contacts
            </button>
          </div>
        </div>
      )}

      {/* All Pages Selected Banner */}
      {selectAllPages && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-blue-800">
              All <strong>{totalCount}</strong> contacts are selected.
            </p>
            <button
              onClick={handleDeselectAll}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 underline"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Contacts Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 w-12">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={input => {
                    if (input) {
                      input.indeterminate = someFilteredSelected && !allFilteredSelected;
                    }
                  }}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                />
              </th>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                Name
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Email
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Phone
              </th>
              <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">
                Registrations
              </th>
              <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">
                Tournaments
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Years
              </th>
              <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">
                Awards
              </th>
              <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredContacts.map((contact) => (
              <tr key={contact.contact_id} className="hover:bg-gray-50">
                <td className="py-4 pl-4 pr-3 text-sm w-12">
                  <input
                    type="checkbox"
                    checked={selectedContactIds.has(contact.contact_id)}
                    onChange={() => handleSelectContact(contact.contact_id)}
                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                  />
                </td>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                  {contact.first_name} {contact.last_name}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500">
                  {contact.email || (
                    <span className="text-yellow-600">⚠️ Missing</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {contact.phone || '-'}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-center">
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                    {contact.total_registrations || 0}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-center">
                  {contact.tournaments_attended || 0}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500">
                  {contact.tournament_years?.join(', ') || '-'}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-center">
                  {contact.awards_won > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                      🏅 {contact.awards_won}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                  <button
                    onClick={() => handleEdit(contact)}
                    className="text-primary-600 hover:text-primary-900 font-medium"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredContacts.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchTerm ? 'No contacts found matching your search' : 'No contacts found'}
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
                <span className="font-medium">{totalCount}</span> contacts
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

      {/* Contact Edit/Create Form Modal */}
      {showEditForm && (
        <ContactEditForm
          contact={selectedContact}
          onClose={handleCloseEdit}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}
