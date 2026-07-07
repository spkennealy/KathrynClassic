import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { ENTITY_TYPES, formatChanges } from '../../../utils/audit';
import DatePicker from '../DatePicker';
import Select from '../Select';

const PAGE_SIZE = 50;

// Shared renderer for a changes/metadata blob — used here and by RecordHistory.
export function ChangesView({ changes, metadata }) {
  const lines = formatChanges(changes);
  const hasMeta = metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0;

  if (lines.length === 0 && !hasMeta) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 italic">No field details recorded.</p>;
  }

  return (
    <div className="space-y-2">
      {lines.length > 0 && (
        <ul className="space-y-1">
          {lines.map((line) => (
            <li key={line.field} className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium text-gray-900 dark:text-gray-100">{line.field}</span>
              {line.isDiff ? (
                <>
                  : <span className="text-red-600 dark:text-red-400 line-through">{line.from}</span>
                  {' → '}
                  <span className="text-green-600 dark:text-green-400">{line.to}</span>
                </>
              ) : (
                <>: <span className="text-gray-600 dark:text-gray-400">{line.value}</span></>
              )}
            </li>
          ))}
        </ul>
      )}
      {hasMeta && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium">Metadata:</span>{' '}
          <pre className="inline whitespace-pre-wrap font-mono">{JSON.stringify(metadata)}</pre>
        </div>
      )}
    </div>
  );
}

// Small colored badge for the action string.
function ActionBadge({ action }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary-100 dark:bg-primary-900/40 px-2.5 py-0.5 text-xs font-medium text-primary-800 dark:text-primary-300">
      {action}
    </span>
  );
}

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    actorEmail: '',
    entityType: 'all',
    dateFrom: '',
    dateTo: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        let query = supabase.from('audit_log').select('*', { count: 'exact' });

        if (filters.actorEmail) {
          query = query.ilike('actor_email', `%${filters.actorEmail}%`);
        }
        if (filters.entityType !== 'all') {
          query = query.eq('entity_type', filters.entityType);
        }
        if (filters.dateFrom) {
          query = query.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
          query = query.lte('created_at', `${filters.dateTo}T23:59:59`);
        }
        if (search) {
          query = query.or(`entity_label.ilike.%${search}%,action.ilike.%${search}%`);
        }

        const offset = (currentPage - 1) * PAGE_SIZE;
        query = query
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        const { data, error: dataError, count } = await query;
        if (dataError) throw dataError;

        setEntries(data || []);
        setTotalCount(count || 0);
      } catch (err) {
        console.error('Error fetching audit log:', err);
        setError(err.message || 'Failed to load audit log');
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    };

    fetchData();
  }, [currentPage, search, filters]);

  // Reset to page 1 whenever filters/search change.
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filters]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const hasActiveFilters = () =>
    filters.actorEmail !== '' ||
    filters.entityType !== 'all' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '';

  const clearFilters = () => {
    setFilters({ actorEmail: '', entityType: 'all', dateFrom: '', dateTo: '' });
    setSearch('');
  };

  if (initialLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading audit log...</p>
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Audit Log</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          A record of admin actions — who changed what, and when.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-night-800 p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search by record or action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Admin</label>
            <input
              type="text"
              placeholder="email..."
              value={filters.actorEmail}
              onChange={(e) => setFilters({ ...filters, actorEmail: e.target.value })}
              className="block w-full rounded-md border-gray-300 dark:border-night-600 text-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Entity</label>
            <Select
              value={filters.entityType}
              onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
            >
              <option value="all">All</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
              <DatePicker
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
              <DatePicker
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage} of {totalPages || 1} ({totalCount} total entries)
          </p>
          {(hasActiveFilters() || search) && (
            <button
              onClick={clearFilters}
              className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-night-800 shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50 dark:bg-night-700">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">When</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Admin</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Action</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Entity</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Record</th>
              <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-night-700 bg-white dark:bg-night-800">
            {entries.map((entry) => {
              const expanded = expandedId === entry.id;
              return (
                <React.Fragment key={entry.id}>
                  <tr className="hover:bg-gray-50 dark:hover:bg-night-700">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {entry.actor_email || <span className="text-gray-400 italic">unknown</span>}
                    </td>
                    <td className="px-3 py-4 text-sm">
                      <ActionBadge action={entry.action} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {entry.entity_type}
                    </td>
                    <td className="px-3 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {entry.entity_label || '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                      {(entry.changes || entry.metadata) ? (
                        <button
                          onClick={() => setExpandedId(expanded ? null : entry.id)}
                          className="text-primary-600 dark:text-primary-400 hover:text-primary-900 font-medium"
                        >
                          {expanded ? 'Hide' : 'View'}
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-gray-50 dark:bg-night-700/50">
                      <td colSpan={6} className="px-6 py-4">
                        <ChangesView changes={entry.changes} metadata={entry.metadata} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {entries.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No audit entries found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white dark:bg-night-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-night-700 sm:px-6 rounded-lg shadow">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-night-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 hover:bg-gray-50 dark:hover:bg-night-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-night-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 hover:bg-gray-50 dark:hover:bg-night-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Showing <span className="font-medium">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{' '}
                <span className="font-medium">{Math.min(currentPage * PAGE_SIZE, totalCount)}</span> of{' '}
                <span className="font-medium">{totalCount}</span> entries
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-night-600 bg-white dark:bg-night-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-night-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                          : 'bg-white dark:bg-night-800 border-gray-300 dark:border-night-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-night-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-night-600 bg-white dark:bg-night-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-night-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
}
