import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { logAudit } from '../../../utils/audit';
import Select from '../Select';

const fullName = (c) => `${c.first_name || ''} ${c.last_name || ''}`.trim();

// Admin-facing modal for manually opting a contact out of bulk email — either
// from a specific tournament year or from all emails. Mirrors what the public
// token-based Unsubscribe page records, but initiated by an admin (e.g. someone
// asked to be removed by phone/email).
export default function AddUnsubscribeModal({ isOpen, onClose, onSaved }) {
  const [contacts, setContacts] = useState([]); // all non-deleted contacts w/ email
  const [years, setYears] = useState([]); // tournament years for the scope dropdown
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [scope, setScope] = useState('all'); // 'all' | <year string>
  const [saving, setSaving] = useState(false);

  // Load the contact directory + tournament years each time the modal opens.
  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: cData, error: cErr }, { data: tData, error: tErr }] = await Promise.all([
        supabase
          .from('contacts')
          .select('id, first_name, last_name, email, unsubscribed_all, unsubscribed_years')
          .is('deleted_at', null)
          .not('email', 'is', null)
          .limit(5000),
        supabase
          .from('tournaments')
          .select('year')
          .is('deleted_at', null)
          .order('year', { ascending: false }),
      ]);
      if (cErr) throw cErr;
      if (tErr) throw tErr;

      const cleaned = (cData || [])
        .map((c) => ({
          ...c,
          unsubscribed_years: Array.isArray(c.unsubscribed_years) ? c.unsubscribed_years : [],
        }))
        .sort((a, b) => fullName(a).localeCompare(fullName(b)));
      setContacts(cleaned);
      setYears((tData || []).map((t) => t.year));
    } catch (err) {
      setError(err.message || 'Failed to load contacts');
      setContacts([]);
      setYears([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    // Reset transient state and (re)load whenever the modal is opened.
    setSearch('');
    setSelectedId(null);
    setScope('all');
    setError(null);
    loadOptions();
  }, [isOpen, loadOptions]);

  const term = search.trim().toLowerCase();
  const visibleContacts = useMemo(() => {
    if (!term) return contacts.slice(0, 100);
    return contacts
      .filter((c) => `${fullName(c)} ${c.email || ''}`.toLowerCase().includes(term))
      .slice(0, 100);
  }, [contacts, term]);

  const selected = contacts.find((c) => c.id === selectedId) || null;

  // Would applying `scope` to the selected contact actually change anything?
  const alreadyUnsubscribed = useMemo(() => {
    if (!selected) return false;
    if (scope === 'all') return !!selected.unsubscribed_all;
    return selected.unsubscribed_years.includes(parseInt(scope, 10));
  }, [selected, scope]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      let patch;
      let auditLabel;
      if (scope === 'all') {
        patch = { unsubscribed_all: true };
        auditLabel = 'unsubscribed from all emails';
      } else {
        const yr = parseInt(scope, 10);
        const nextYears = [...new Set([...selected.unsubscribed_years, yr])].sort((a, b) => b - a);
        patch = { unsubscribed_years: nextYears };
        auditLabel = `unsubscribed from ${yr}`;
      }

      const { error: err } = await supabase
        .from('contacts')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', selected.id);
      if (err) throw err;

      await logAudit({
        action: 'contact.unsubscribed',
        entityType: 'contact',
        entityId: selected.id,
        entityLabel: `${fullName(selected)} — ${auditLabel}`,
        changes: patch,
      });

      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Failed to update subscription');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="add-unsub-title" role="dialog" aria-modal="true">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>

        <div className="inline-block w-full transform overflow-hidden rounded-lg bg-white dark:bg-night-800 text-left align-bottom shadow-xl transition-all sm:my-8 sm:max-w-lg sm:align-middle">
          <div className="px-4 pt-5 pb-4 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100" id="add-unsub-title">
              Add unsubscribe
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manually opt a contact out of bulk email — for a single tournament year or for everything.
            </p>

            {error && (
              <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Contact picker */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Contact</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                spellCheck={false}
                className="block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
              <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-gray-200 dark:border-night-700 divide-y divide-gray-100 dark:divide-night-700">
                {loading && (
                  <p className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Loading contacts…</p>
                )}
                {!loading && visibleContacts.map((c) => {
                  const isSel = c.id === selectedId;
                  const badges = [];
                  if (c.unsubscribed_all) badges.push('all');
                  c.unsubscribed_years.forEach((y) => badges.push(String(y)));
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-night-700 ${isSel ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-900 dark:text-gray-100">
                          {fullName(c) || '(no name)'}
                        </span>
                        <span className="block truncate text-gray-500 dark:text-gray-400">{c.email}</span>
                      </span>
                      {badges.length > 0 && (
                        <span className="flex-shrink-0 text-xs text-amber-700 dark:text-amber-400">
                          opted out: {badges.join(', ')}
                        </span>
                      )}
                    </button>
                  );
                })}
                {!loading && visibleContacts.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    {term ? 'No contacts match your search.' : 'No contacts found.'}
                  </p>
                )}
              </div>
              {!term && !loading && contacts.length > visibleContacts.length && (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Showing first {visibleContacts.length} of {contacts.length}. Search to narrow.
                </p>
              )}
            </div>

            {/* Scope */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Unsubscribe from</label>
              <Select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="all">All emails</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y} emails only</option>
                ))}
              </Select>
            </div>

            {selected && alreadyUnsubscribed && (
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
                {fullName(selected) || 'This contact'} is already unsubscribed from{' '}
                {scope === 'all' ? 'all emails' : `${scope}`}.
              </p>
            )}
          </div>

          <div className="bg-gray-50 dark:bg-night-700 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              type="button"
              onClick={save}
              disabled={!selected || saving || alreadyUnsubscribed}
              className="inline-flex w-full justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm"
            >
              {saving ? 'Saving…' : 'Add unsubscribe'}
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
