import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { logAudit } from '../../../utils/audit';
import CommunicationsNav from './CommunicationsNav';
import Select from '../Select';
import AddUnsubscribeModal from './AddUnsubscribeModal';

const fullName = (c) => `${c.first_name || ''} ${c.last_name || ''}`.trim();

// Admin view of everyone who has opted out of bulk email — either from a
// specific tournament year or from all emails — with one-click re-subscribe.
export default function UnsubscribeManager() {
  const [rows, setRows] = useState([]); // unsubscribed contacts
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [yearFilter, setYearFilter] = useState('all'); // 'all' | 'global' | <year>
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null); // contact id being updated
  const [addOpen, setAddOpen] = useState(false); // "Add unsubscribe" modal

  const fetchUnsubscribed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Authenticated admins can read the contacts table directly (same access
      // the contact list + soft-delete rely on).
      const { data, error: err } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, unsubscribed_all, unsubscribed_years')
        .is('deleted_at', null)
        .limit(5000);
      if (err) throw err;

      const unsub = (data || [])
        .map((c) => ({
          ...c,
          unsubscribed_years: Array.isArray(c.unsubscribed_years)
            ? [...c.unsubscribed_years].sort((a, b) => b - a)
            : [],
        }))
        .filter((c) => c.unsubscribed_all || c.unsubscribed_years.length > 0)
        .sort((a, b) => fullName(a).localeCompare(fullName(b)));

      setRows(unsub);
    } catch (err) {
      setError(err.message || 'Failed to load unsubscribes');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnsubscribed();
  }, [fetchUnsubscribed]);

  // Every year anyone has opted out of, for the filter dropdown.
  const years = useMemo(() => {
    const set = new Set();
    rows.forEach((c) => c.unsubscribed_years.forEach((y) => set.add(y)));
    return [...set].sort((a, b) => b - a);
  }, [rows]);

  const term = search.trim().toLowerCase();
  const visibleRows = rows.filter((c) => {
    if (yearFilter === 'global' && !c.unsubscribed_all) return false;
    if (yearFilter !== 'all' && yearFilter !== 'global' && !c.unsubscribed_years.includes(parseInt(yearFilter, 10))) return false;
    if (term) {
      const hay = `${fullName(c)} ${c.email || ''}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  // Persist a change to a contact's opt-out state, then refresh the row.
  const applyChange = async (contact, patch, auditLabel) => {
    setBusyId(contact.id);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('contacts')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', contact.id);
      if (err) throw err;
      await logAudit({
        action: 'contact.resubscribed',
        entityType: 'contact',
        entityId: contact.id,
        entityLabel: `${fullName(contact)} — ${auditLabel}`,
        changes: patch,
      });
      await fetchUnsubscribed();
    } catch (err) {
      setError(err.message || 'Failed to update subscription');
    } finally {
      setBusyId(null);
    }
  };

  const resubscribeYear = (contact, year) =>
    applyChange(
      contact,
      { unsubscribed_years: contact.unsubscribed_years.filter((y) => y !== year) },
      `re-subscribed to ${year}`
    );

  const resubscribeAll = (contact) =>
    applyChange(
      contact,
      { unsubscribed_all: false, unsubscribed_years: [] },
      're-subscribed to everything'
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Unsubscribes</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Contacts who opted out of bulk email. Re-subscribe them here.
          </p>
        </div>
        <CommunicationsNav />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white dark:bg-night-800 rounded-lg shadow p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or email…"
            className="block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Show</label>
          <Select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="w-full sm:w-64">
            <option value="all">All unsubscribes</option>
            <option value="global">Unsubscribed from all emails</option>
            {years.map((y) => (
              <option key={y} value={y}>Unsubscribed from {y}</option>
            ))}
          </Select>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          Add unsubscribe
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-night-800 shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50 dark:bg-night-700">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Name</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Email</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Opted out of</th>
              <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">Re-subscribe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-night-700 bg-white dark:bg-night-800">
            {visibleRows.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-night-700">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {fullName(c) || '(no name)'}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{c.email || '—'}</td>
                <td className="px-3 py-4 text-sm">
                  <div className="flex flex-wrap gap-1.5">
                    {c.unsubscribed_all && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                        All emails
                      </span>
                    )}
                    {c.unsubscribed_years.map((y) => (
                      <span key={y} className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                        {y}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                  <div className="inline-flex flex-wrap justify-end gap-x-3 gap-y-1">
                    {/* Per-year re-subscribe (only meaningful when not globally opted out) */}
                    {!c.unsubscribed_all && c.unsubscribed_years.map((y) => (
                      <button
                        key={y}
                        onClick={() => resubscribeYear(c, y)}
                        disabled={busyId === c.id}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300 font-medium disabled:opacity-50"
                      >
                        {y}
                      </button>
                    ))}
                    <button
                      onClick={() => resubscribeAll(c)}
                      disabled={busyId === c.id}
                      className="text-green-600 hover:text-green-800 font-semibold disabled:opacity-50"
                    >
                      {busyId === c.id ? 'Saving…' : 'All'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          </div>
        )}
        {!loading && visibleRows.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              {rows.length === 0 ? 'No one has unsubscribed. 🎉' : 'No unsubscribes match your filters.'}
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Tip: the year buttons re-subscribe a contact to just that tournament year; “All” clears every opt-out
        (including “all emails”). Re-subscribing is logged in the Audit Log.
      </p>

      <AddUnsubscribeModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={fetchUnsubscribed}
      />
    </div>
  );
}
