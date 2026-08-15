import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import ContactEditForm from './ContactEditForm';
import BulkUnsubscribeModal from './BulkUnsubscribeModal';
import ConfirmDialog from '../ConfirmDialog';
import FilterBuilder from '../filters/FilterBuilder';
import SavedViewsBar from '../filters/SavedViewsBar';
import useContactFilterOptions from '../filters/useContactFilterOptions';
import { getContactFilterFields, buildFieldMap } from '../filters/contactFilterFields';
import { emptyTree } from '../filters/filterModel';
import { applyFilters, countCompiledConditions } from '../filters/compileFilters';
import {
  toCsv,
  downloadCsv,
  contactCsvFilename,
  fetchAllRows,
  ID_CHUNK,
  EXPORT_MAX,
} from '../filters/exportCsv';
import { formatPhone } from '../../../utils/phone';
import { logAudit } from '../../../utils/audit';

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

export default function ContactList() {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedContactIds, setSelectedContactIds] = useState(new Set());
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);
  const [showUnsubscribe, setShowUnsubscribe] = useState(false);
  const [unsubscribeResult, setUnsubscribeResult] = useState(null);
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [allContactIds, setAllContactIds] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sortConfig, setSortConfig] = useState({ column: 'last_name', direction: 'asc' });

  // `tree` is what the builder edits; `appliedTree` is what the query uses. The
  // gap is a debounce, so typing in a text condition doesn't refetch per keystroke.
  const [tree, setTree] = useState(emptyTree);
  const [appliedTree, setAppliedTree] = useState(tree);

  // Bumped after a mutation to re-run the fetch effect with the filters, sort and
  // page the admin currently has, rather than re-deriving a different query.
  const [refreshTick, setRefreshTick] = useState(0);

  const { options: filterOptions, loading: optionsLoading } = useContactFilterOptions();
  const fields = useMemo(() => getContactFilterFields({ scope: 'contacts' }), []);
  const fieldMap = useMemo(() => buildFieldMap(fields), [fields]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setAppliedTree(tree);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, tree]);

  // A new object identity every render would retrigger the effects below, so key
  // them on the serialization instead.
  const filterKey = useMemo(() => JSON.stringify(appliedTree), [appliedTree]);
  const activeFilterCount = useMemo(
    () => countCompiledConditions(tree, fieldMap),
    [tree, fieldMap]
  );

  const SORT_COLUMNS = {
    name: 'last_name',
    email: 'email',
    phone: 'phone',
    registrations: 'total_registrations',
    tournaments: 'tournaments_attended',
    years: 'tournament_years',
    awards: 'awards_won',
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      column: SORT_COLUMNS[key],
      direction: prev.column === SORT_COLUMNS[key] && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setCurrentPage(1);
  };

  const SortIcon = ({ colKey }) => {
    const active = sortConfig.column === SORT_COLUMNS[colKey];
    return (
      <span className={`ml-1 inline-flex flex-col leading-none ${active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-300'}`}>
        <svg className={`h-3 w-3 -mb-0.5 ${active && sortConfig.direction === 'asc' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-300'}`} viewBox="0 0 10 6" fill="currentColor">
          <path d="M0 6l5-6 5 6z"/>
        </svg>
        <svg className={`h-3 w-3 ${active && sortConfig.direction === 'desc' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-300'}`} viewBox="0 0 10 6" fill="currentColor">
          <path d="M0 0l5 6 5-6z"/>
        </svg>
      </span>
    );
  };

  // The single place filter state becomes a query. Every read path goes through
  // it — the list, select-all, and CSV export — so they can't drift apart.
  const buildContactQuery = useCallback(
    (select = '*', selectOptions) => {
      const query = supabase.from('admin_contact_activity').select(select, selectOptions);
      return applyFilters(query, { searchTerm, tree: appliedTree, fieldMap });
    },
    [searchTerm, appliedTree, fieldMap]
  );

  const applySort = useCallback(
    (query) => {
      let out = query.order(sortConfig.column, {
        ascending: sortConfig.direction === 'asc',
        nullsFirst: false,
      });
      if (sortConfig.column !== 'last_name') out = out.order('last_name', { ascending: true });
      // Unique tiebreaker. Without it, rows tied on the sort column can straddle
      // a page boundary and show up twice, or not at all.
      return out.order('contact_id', { ascending: true });
    },
    [sortConfig]
  );

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const offset = (currentPage - 1) * PAGE_SIZE;
        const { data, error: dataError, count } = await applySort(
          buildContactQuery('*', { count: 'exact' })
        ).range(offset, offset + PAGE_SIZE - 1);

        if (dataError) throw dataError;
        if (cancelled) return;

        setContacts(data || []);
        setTotalCount(count || 0);
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching contacts:', err);
        setError(err.message || 'Failed to load contacts');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setInitialLoading(false);
        }
      }
    };

    fetchData();

    // Debounced edits fire overlapping requests; without this a slow earlier
    // response can land last and overwrite newer results.
    return () => {
      cancelled = true;
    };
  }, [currentPage, refreshTick, buildContactQuery, applySort]);

  // Anything that changes which contacts match invalidates the page number.
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterKey]);

  // ...and invalidates the selection, unless the admin explicitly selected every
  // matching contact. Read through a ref so that toggling select-all itself
  // doesn't re-run this and wipe the selection it just made.
  const selectAllPagesRef = useRef(selectAllPages);
  useEffect(() => {
    selectAllPagesRef.current = selectAllPages;
  }, [selectAllPages]);

  useEffect(() => {
    if (!selectAllPagesRef.current) setSelectedContactIds(new Set());
  }, [currentPage, searchTerm, filterKey]);

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleEdit = (contact) => {
    setSelectedContact(contact);
    setShowEditForm(true);
  };

  const handleCloseEdit = () => {
    setShowEditForm(false);
    setSelectedContact(null);
  };

  const handleDeleteClick = (contact) => {
    setContactToDelete(contact);
    setShowDeleteConfirm(true);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setContactToDelete(null);
  };

  const handleDeleteConfirm = async () => {
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('contacts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', contactToDelete.contact_id);

      if (deleteError) throw deleteError;

      await logAudit({
        action: 'contact.deleted',
        entityType: 'contact',
        entityId: contactToDelete.contact_id,
        entityLabel: `${contactToDelete.first_name} ${contactToDelete.last_name}`,
        changes: {
          first_name: contactToDelete.first_name,
          last_name: contactToDelete.last_name,
          email: contactToDelete.email,
          phone: contactToDelete.phone,
        },
      });

      setShowDeleteConfirm(false);
      setContactToDelete(null);

      // Deleting the only row on the last page would otherwise strand the admin
      // on an empty page.
      if (currentPage > 1 && contacts.length === 1) {
        setCurrentPage((p) => p - 1);
      } else {
        refresh();
      }
    } catch (err) {
      console.error('Error deleting contact:', err);
      setError(err.message || 'Failed to delete contact');
      setShowDeleteConfirm(false);
      setContactToDelete(null);
    }
  };

  const handleSaveEdit = () => refresh();

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedContactIds(new Set(contacts.map((c) => c.contact_id)));
    } else {
      setSelectedContactIds(new Set());
    }
    setSelectAllPages(false);
  };

  // "Select all N" must mean the N matching the current search and filters.
  const handleSelectAllPages = async () => {
    try {
      setError(null);
      const rows = await fetchAllRows(
        (select) => buildContactQuery(select),
        'contact_id, email'
      );
      setSelectedContactIds(new Set(rows.map((c) => c.contact_id)));
      setAllContactIds(rows);
      setSelectAllPages(true);
    } catch (err) {
      console.error('Error fetching all contacts:', err);
      setError('Failed to select all contacts. Please try again.');
    }
  };

  const handleDeselectAll = () => {
    setSelectedContactIds(new Set());
    setSelectAllPages(false);
    setAllContactIds([]);
  };

  const handleSelectContact = (contactId) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
    setSelectAllPages(false);
  };

  const handleEmailContacts = () => {
    // Union both sources: the page always has rows, and allContactIds holds the
    // full matching set once "select all" has been used. Unioning means
    // unchecking one contact after a select-all doesn't silently narrow the
    // result back down to the current page.
    const byId = new Map();
    [...contacts, ...allContactIds].forEach((c) => byId.set(c.contact_id, c));
    const emails = [...selectedContactIds]
      .map((id) => byId.get(id)?.email)
      .filter(Boolean);

    if (emails.length === 0) {
      setError('No valid email addresses found for selected contacts.');
      return;
    }

    navigator.clipboard
      .writeText(emails.join(', '))
      .then(() => {
        setShowCopiedMessage(true);
        setTimeout(() => setShowCopiedMessage(false), 3000);
      })
      .catch((err) => {
        console.error('Failed to copy emails:', err);
        setError('Failed to copy emails to clipboard. Please try again.');
      });
  };

  // Exports the selection when there is one, otherwise everything matching the
  // current filters — not just the page on screen.
  const handleExportCsv = async () => {
    try {
      setExporting(true);
      setError(null);

      let rows;
      if (selectedContactIds.size > 0) {
        const ids = [...selectedContactIds];
        rows = [];
        // Chunked to keep the `in.(...)` list inside a sane URL length.
        for (let i = 0; i < ids.length; i += ID_CHUNK) {
          const { data, error: err } = await supabase
            .from('admin_contact_activity')
            .select('*')
            .in('contact_id', ids.slice(i, i + ID_CHUNK));
          if (err) throw err;
          rows.push(...(data || []));
        }
      } else {
        rows = await fetchAllRows((select) => buildContactQuery(select), '*');
      }

      if (rows.length === 0) {
        setError('Nothing to export.');
        return;
      }

      downloadCsv(contactCsvFilename(), toCsv(rows));

      await logAudit({
        action: 'contact.exported',
        entityType: 'contact',
        metadata: {
          count: rows.length,
          scope: selectedContactIds.size > 0 ? 'selection' : 'filtered',
          filtered: activeFilterCount > 0 || Boolean(searchTerm),
          truncated: rows.length >= EXPORT_MAX,
        },
      });
    } catch (err) {
      console.error('Error exporting contacts:', err);
      setError(err.message || 'Failed to export contacts');
    } finally {
      setExporting(false);
    }
  };

  const allPageSelected =
    contacts.length > 0 && contacts.every((c) => selectedContactIds.has(c.contact_id));
  const somePageSelected = contacts.some((c) => selectedContactIds.has(c.contact_id));

  if (initialLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading contacts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Contacts</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
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

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Search and actions */}
      <div className="bg-white dark:bg-night-800 p-4 rounded-lg shadow">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[12rem]">
            <label htmlFor="search" className="sr-only">Search contacts</label>
            <input
              type="text"
              id="search"
              placeholder="Search by name, email or phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="block w-full"
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
          {selectedContactIds.size > 0 && (
            <button
              onClick={() => setShowUnsubscribe(true)}
              className="inline-flex items-center px-4 py-2 border border-amber-300 dark:border-amber-700 rounded-md shadow-sm text-sm font-medium text-amber-700 dark:text-amber-400 bg-white dark:bg-night-700 hover:bg-amber-50 dark:hover:bg-night-600 transition-colors"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Unsubscribe ({selectedContactIds.size})
            </button>
          )}
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-night-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-night-700 hover:bg-gray-50 dark:hover:bg-night-600 disabled:opacity-50"
          >
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting
              ? 'Exporting…'
              : selectedContactIds.size > 0
              ? `Export CSV (${selectedContactIds.size} selected)`
              : `Export CSV (${totalCount})`}
          </button>
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage} of {totalPages} ({totalCount} total contacts)
          </div>
        </div>
        {showCopiedMessage && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">
              ✓ Email addresses copied to clipboard! You can now paste them into Gmail's BCC field.
            </p>
          </div>
        )}
        {unsubscribeResult && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-sm text-amber-800">
              ✓ {unsubscribeResult.count} {unsubscribeResult.count === 1 ? 'contact' : 'contacts'}{' '}
              unsubscribed from {unsubscribeResult.scopeLabel}.
            </p>
          </div>
        )}
      </div>

      {/* Saved views */}
      <SavedViewsBar
        scope="contacts"
        tree={tree}
        onLoad={setTree}
        isKnownField={(key) => Boolean(fieldMap[key])}
      />

      {/* Filters */}
      <div className="bg-white dark:bg-night-800 rounded-lg shadow">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:bg-night-700"
        >
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="font-medium text-gray-900 dark:text-gray-100">Filters</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-300">
                {activeFilterCount} active
              </span>
            )}
          </div>
          <svg className={`h-5 w-5 text-gray-400 transition-transform ${showFilters ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showFilters && (
          <div className="px-4 py-4 border-t border-gray-200 dark:border-night-700">
            <FilterBuilder
              tree={tree}
              onChange={setTree}
              fields={fields}
              options={filterOptions}
              optionsLoading={optionsLoading}
            />
          </div>
        )}
      </div>

      {/* Select All Pages Banner */}
      {allPageSelected && !selectAllPages && totalCount > contacts.length && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-blue-800">
              All <strong>{contacts.length}</strong> contacts on this page are selected.
            </p>
            <button
              onClick={handleSelectAllPages}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 underline"
            >
              Select all {totalCount} matching contacts
            </button>
          </div>
        </div>
      )}

      {/* All Pages Selected Banner */}
      {selectAllPages && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-blue-800">
              All <strong>{selectedContactIds.size}</strong> matching contacts are selected.
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
      <div className="bg-white dark:bg-night-800 shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50 dark:bg-night-700">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 w-12">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  ref={input => {
                    if (input) {
                      input.indeterminate = somePageSelected && !allPageSelected;
                    }
                  }}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 dark:border-night-600 text-green-600 focus:ring-green-500 cursor-pointer"
                />
              </th>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                <button onClick={() => handleSort('name')} className="inline-flex items-center hover:text-primary-600 dark:text-primary-400 transition-colors">
                  Name<SortIcon colKey="name" />
                </button>
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                <button onClick={() => handleSort('email')} className="inline-flex items-center hover:text-primary-600 dark:text-primary-400 transition-colors">
                  Email<SortIcon colKey="email" />
                </button>
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                <button onClick={() => handleSort('phone')} className="inline-flex items-center hover:text-primary-600 dark:text-primary-400 transition-colors">
                  Phone<SortIcon colKey="phone" />
                </button>
              </th>
              <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                <button onClick={() => handleSort('registrations')} className="inline-flex items-center hover:text-primary-600 dark:text-primary-400 transition-colors">
                  Registrations<SortIcon colKey="registrations" />
                </button>
              </th>
              <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                <button onClick={() => handleSort('tournaments')} className="inline-flex items-center hover:text-primary-600 dark:text-primary-400 transition-colors">
                  Tournaments<SortIcon colKey="tournaments" />
                </button>
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                <button onClick={() => handleSort('years')} className="inline-flex items-center hover:text-primary-600 dark:text-primary-400 transition-colors">
                  Years<SortIcon colKey="years" />
                </button>
              </th>
              <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                <button onClick={() => handleSort('awards')} className="inline-flex items-center hover:text-primary-600 dark:text-primary-400 transition-colors">
                  Awards<SortIcon colKey="awards" />
                </button>
              </th>
              <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-night-700 bg-white dark:bg-night-800">
            {contacts.map((contact) => (
              <tr key={contact.contact_id} className="hover:bg-gray-50 dark:bg-night-700">
                <td className="py-4 pl-4 pr-3 text-sm w-12">
                  <input
                    type="checkbox"
                    checked={selectedContactIds.has(contact.contact_id)}
                    onChange={() => handleSelectContact(contact.contact_id)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-night-600 text-green-600 focus:ring-green-500 cursor-pointer"
                  />
                </td>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {contact.first_name} {contact.last_name}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {contact.email || (
                    <span className="text-yellow-600">⚠️ Missing</span>
                  )}
                  {/* Without this the unsubscribe action has no visible effect. */}
                  {(contact.unsubscribed_all || contact.unsubscribed_years?.length > 0) && (
                    <span
                      className="ml-2 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300"
                      title={
                        contact.unsubscribed_all
                          ? 'Unsubscribed from all email'
                          : `Unsubscribed from ${contact.unsubscribed_years.join(', ')}`
                      }
                    >
                      {contact.unsubscribed_all
                        ? 'unsubscribed'
                        : `unsub ${contact.unsubscribed_years.join(', ')}`}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {formatPhone(contact.phone) || '-'}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                    {contact.total_registrations || 0}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                  {contact.tournaments_attended || 0}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {contact.tournament_years?.length ? contact.tournament_years.join(', ') : '-'}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                  {contact.awards_won > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                      🏅 {contact.awards_won}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-right space-x-3">
                  <button
                    onClick={() => handleEdit(contact)}
                    className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:text-primary-300 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteClick(contact)}
                    className="text-red-600 hover:text-red-900 font-medium"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {contacts.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || activeFilterCount > 0
                ? 'No contacts match your search and filters'
                : 'No contacts found'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
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
                <span className="font-medium">{totalCount}</span> contacts
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

      {/* Bulk / individual unsubscribe */}
      <BulkUnsubscribeModal
        isOpen={showUnsubscribe}
        contactIds={[...selectedContactIds]}
        onClose={() => setShowUnsubscribe(false)}
        onSaved={(count, scopeLabel) => {
          setUnsubscribeResult({ count, scopeLabel });
          setTimeout(() => setUnsubscribeResult(null), 5000);
          refresh();
        }}
      />

      {/* Contact Edit/Create Form Modal */}
      {showEditForm && (
        <ContactEditForm
          contact={selectedContact}
          onClose={handleCloseEdit}
          onSave={handleSaveEdit}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Contact"
        message={`Are you sure you want to delete ${contactToDelete?.first_name} ${contactToDelete?.last_name}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
