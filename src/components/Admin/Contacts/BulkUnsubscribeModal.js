import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import Select from '../Select';
import { logAuditBulk } from '../../../utils/audit';

// Ids travel in the URL on `.in(...)` lookups, so keep each batch small.
const ID_CHUNK = 100;

const fullName = (c) => `${c.first_name || ''} ${c.last_name || ''}`.trim();

// Opts the selected contacts out of bulk email — either from one tournament
// year or from everything. Works for a single contact or several hundred; the
// Contacts page opens it with whatever is selected.
//
// Writes the same fields as the public token-based unsubscribe page and the
// Communications "Add unsubscribe" modal, so all three routes agree.
export default function BulkUnsubscribeModal({ isOpen, onClose, onSaved, contactIds }) {
  const [contacts, setContacts] = useState([]);
  const [years, setYears] = useState([]);
  const [scope, setScope] = useState('all'); // 'all' | <year string>
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = [];
      for (let i = 0; i < contactIds.length; i += ID_CHUNK) {
        const { data, error: err } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email, unsubscribed_all, unsubscribed_years')
          .in('id', contactIds.slice(i, i + ID_CHUNK));
        if (err) throw err;
        rows.push(...(data || []));
      }

      const { data: tData, error: tErr } = await supabase
        .from('tournaments')
        .select('year')
        .is('deleted_at', null)
        .order('year', { ascending: false });
      if (tErr) throw tErr;

      setContacts(
        rows.map((c) => ({
          ...c,
          unsubscribed_years: Array.isArray(c.unsubscribed_years) ? c.unsubscribed_years : [],
        }))
      );
      setYears((tData || []).map((t) => t.year));
    } catch (err) {
      setError(err.message || 'Failed to load contacts');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [contactIds]);

  useEffect(() => {
    if (!isOpen) return;
    setScope('all');
    setError(null);
    load();
  }, [isOpen, load]);

  // Only contacts the change would actually affect — the rest are already opted
  // out of this scope, and reporting "42 contacts" when 40 are no-ops is a lie.
  const affected = useMemo(() => {
    if (scope === 'all') return contacts.filter((c) => !c.unsubscribed_all);
    const year = parseInt(scope, 10);
    return contacts.filter((c) => !c.unsubscribed_years.includes(year));
  }, [contacts, scope]);

  const scopeLabel = scope === 'all' ? 'all emails' : `${scope} emails`;

  const save = async () => {
    if (affected.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const now = new Date().toISOString();

      if (scope === 'all') {
        for (let i = 0; i < affected.length; i += ID_CHUNK) {
          const ids = affected.slice(i, i + ID_CHUNK).map((c) => c.id);
          const { error: err } = await supabase
            .from('contacts')
            .update({ unsubscribed_all: true, updated_at: now })
            .in('id', ids);
          if (err) throw err;
        }
      } else {
        const year = parseInt(scope, 10);
        // unsubscribed_years is per-contact, so a single UPDATE can't append to
        // it. Group contacts by the array they'd end up with — in practice
        // almost everyone shares one or two — and issue one UPDATE per group.
        const groups = new Map();
        affected.forEach((c) => {
          const next = [...new Set([...c.unsubscribed_years, year])].sort((a, b) => b - a);
          const key = JSON.stringify(next);
          if (!groups.has(key)) groups.set(key, { years: next, ids: [] });
          groups.get(key).ids.push(c.id);
        });

        for (const { years: nextYears, ids } of groups.values()) {
          for (let i = 0; i < ids.length; i += ID_CHUNK) {
            const { error: err } = await supabase
              .from('contacts')
              .update({ unsubscribed_years: nextYears, updated_at: now })
              .in('id', ids.slice(i, i + ID_CHUNK));
            if (err) throw err;
          }
        }
      }

      // One entry per contact, so it shows up in each record's history.
      await logAuditBulk(
        affected.map((c) => ({
          action: 'contact.unsubscribed',
          entityType: 'contact',
          entityId: c.id,
          entityLabel: `${fullName(c) || c.email} — unsubscribed from ${scopeLabel}`,
          changes:
            scope === 'all'
              ? { unsubscribed_all: { from: false, to: true } }
              : {
                  unsubscribed_years: {
                    from: c.unsubscribed_years,
                    to: [...new Set([...c.unsubscribed_years, parseInt(scope, 10)])].sort((a, b) => b - a),
                  },
                },
          metadata: { bulk: affected.length > 1, scope },
        }))
      );

      onSaved?.(affected.length, scopeLabel);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Failed to update subscriptions');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const skipped = contacts.length - affected.length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="bulk-unsub-title" role="dialog" aria-modal="true">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>

        <div className="inline-block w-full transform overflow-hidden rounded-lg bg-white dark:bg-night-800 text-left align-bottom shadow-xl transition-all sm:my-8 sm:max-w-lg sm:align-middle">
          <div className="px-4 pt-5 pb-4 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100" id="bulk-unsub-title">
              Unsubscribe {contacts.length === 1 ? 'contact' : `${contactIds.length} contacts`}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Opt {contacts.length === 1 ? 'this contact' : 'these contacts'} out of bulk email — for a
              single tournament year, or for all future communications.
            </p>

            {error && (
              <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Unsubscribe from
              </label>
              <Select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="all">All future communications</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y} emails only</option>
                ))}
              </Select>
            </div>

            {loading ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading contacts…</p>
            ) : (
              <div className="mt-4 rounded-md bg-gray-50 dark:bg-night-700/50 p-3 text-sm">
                <p className="text-gray-900 dark:text-gray-100">
                  <strong>{affected.length}</strong>{' '}
                  {affected.length === 1 ? 'contact' : 'contacts'} will be unsubscribed from {scopeLabel}.
                </p>
                {skipped > 0 && (
                  <p className="mt-1 text-gray-500 dark:text-gray-400">
                    {skipped} already opted out of {scopeLabel} — unchanged.
                  </p>
                )}
                {affected.length > 0 && affected.length <= 5 && (
                  <ul className="mt-2 space-y-0.5 text-gray-600 dark:text-gray-400">
                    {affected.map((c) => (
                      <li key={c.id} className="truncate">
                        {fullName(c) || '(no name)'} — {c.email || 'no email'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-50 dark:bg-night-700 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              type="button"
              onClick={save}
              disabled={saving || loading || affected.length === 0}
              className="inline-flex w-full justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm"
            >
              {saving ? 'Saving…' : `Unsubscribe ${affected.length || ''}`.trim()}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 dark:border-night-600 bg-white dark:bg-night-800 px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
