import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../supabaseClient';
import { ChangesView } from './AuditLog';

// Reusable modal showing the audit history for a single record. Works for any
// entity type — pass entityType + entityId and it queries audit_log for matches.
export default function RecordHistory({ entityType, entityId, entityLabel, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error: fetchError } = await supabase
          .from('audit_log')
          .select('*')
          .eq('entity_type', entityType)
          .eq('entity_id', String(entityId))
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setEntries(data || []);
      } catch (err) {
        console.error('Error fetching record history:', err);
        setError(err.message || 'Failed to load history');
      } finally {
        setLoading(false);
      }
    };

    if (entityId != null) fetchHistory();
  }, [entityType, entityId]);

  // Portal: keeps `fixed inset-0` clear of the caller's space-y-* sibling margin.
  return createPortal(
    <div className="admin-content fixed inset-0 bg-gray-500 bg-opacity-75 flex items-start sm:items-center justify-center p-4 overflow-y-auto z-50">
      <div className="bg-white dark:bg-night-800 rounded-lg shadow-xl max-w-2xl w-full modal-panel flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-night-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">History</h2>
            {entityLabel && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{entityLabel}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            </div>
          ) : error ? (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              No history recorded for this record.
            </p>
          ) : (
            <ol className="relative border-l border-gray-200 dark:border-night-600 ml-3 space-y-6">
              {entries.map((entry) => (
                <li key={entry.id} className="ml-6">
                  <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary-500"></span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-primary-100 dark:bg-primary-900/40 px-2.5 py-0.5 text-xs font-medium text-primary-800 dark:text-primary-300">
                      {entry.action}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      by {entry.actor_email || 'unknown'}
                    </span>
                  </div>
                  {(entry.changes || entry.metadata) && (
                    <div className="mt-2">
                      <ChangesView changes={entry.changes} metadata={entry.metadata} />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-night-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 border border-gray-300 dark:border-night-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-night-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
