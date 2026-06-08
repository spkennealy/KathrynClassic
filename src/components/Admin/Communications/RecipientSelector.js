import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';

const PAYMENT_STATUSES = [
  { value: 'all', label: 'Any payment status' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Unpaid (pending)' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'past_due', label: 'Past due' },
];

const fullName = (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim();

// Resolves a recipient audience and reports the selected list up via
// `onChange([{ email, name }])`.
//
// Filters are always available. With none active you get every contact (incl.
// people who never registered). As soon as a year / payment / kids / event
// filter is set, the list narrows to matching registrations across any year,
// deduped to one row per contact.
export default function RecipientSelector({ onChange }) {
  const [years, setYears] = useState([]);
  const [eventNames, setEventNames] = useState([]);
  const [filters, setFilters] = useState({
    year: 'all',
    paymentStatus: 'all',
    hasKids: 'all', // 'all' | 'yes' | 'no'
    event: 'all', // event_name, or 'all'
  });
  const [rows, setRows] = useState([]); // deduped [{email, name, contact_id}]
  const [selected, setSelected] = useState(new Set()); // set of emails (lowercased)
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const registrationFilterActive =
    filters.year !== 'all' ||
    filters.paymentStatus !== 'all' ||
    filters.hasKids !== 'all' ||
    filters.event !== 'all';

  // Load available tournament years + event names once.
  useEffect(() => {
    (async () => {
      const [{ data: tData }, { data: eData }] = await Promise.all([
        supabase.from('tournaments').select('year').is('deleted_at', null).order('year', { ascending: false }),
        supabase.from('tournament_events').select('event_name').is('deleted_at', null),
      ]);
      if (tData) setYears(tData.map((t) => t.year));
      if (eData) {
        const names = [...new Set(eData.map((e) => e.event_name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        setEventNames(names);
      }
    })();
  }, []);

  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query;
      if (registrationFilterActive) {
        // Registration-based filtering: one row per registration, deduped below.
        query = supabase
          .from('admin_registration_details')
          .select('contact_id, first_name, last_name, email, payment_status, events, total_children')
          .not('email', 'is', null);
        if (filters.year !== 'all') query = query.eq('tournament_year', parseInt(filters.year));
        if (filters.paymentStatus !== 'all') query = query.eq('payment_status', filters.paymentStatus);
        if (filters.hasKids === 'yes') query = query.gt('total_children', 0);
        if (filters.hasKids === 'no') query = query.or('total_children.is.null,total_children.eq.0');
        if (filters.event !== 'all') query = query.contains('events', [filters.event]);
      } else {
        // No filters: every contact that has an email address.
        query = supabase
          .from('admin_contact_activity')
          .select('contact_id, first_name, last_name, email')
          .not('email', 'is', null);
      }
      query = query.limit(5000);

      const { data, error: err } = await query;
      if (err) throw err;

      // Dedupe by lowercased email (a contact can have many registration rows).
      const seen = new Map();
      (data || []).forEach((r) => {
        const email = (r.email || '').trim();
        if (!email) return;
        const key = email.toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, {
            email,
            name: fullName(r),
            firstName: r.first_name || '',
            lastName: r.last_name || '',
            contact_id: r.contact_id,
          });
        }
      });
      const deduped = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
      setRows(deduped);
      setSelected(new Set(seen.keys())); // select all by default
    } catch (err) {
      setError(err.message || 'Failed to load recipients');
      setRows([]);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }, [registrationFilterActive, filters]);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  // Report selection upward whenever it changes (include the fields used for
  // {{variable}} personalization).
  useEffect(() => {
    const recipients = rows
      .filter((r) => selected.has(r.email.toLowerCase()))
      .map((r) => ({ email: r.email, name: r.name, firstName: r.firstName, lastName: r.lastName }));
    onChange(recipients);
  }, [rows, selected, onChange]);

  const toggle = (email) => {
    const key = email.toLowerCase();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Client-side search over the loaded list (by name or email).
  const term = search.trim().toLowerCase();
  const visibleRows = term
    ? rows.filter((r) => r.name.toLowerCase().includes(term) || r.email.toLowerCase().includes(term))
    : rows;

  // "Select all" acts on whatever is currently visible (so searching then
  // selecting only adds the matches, without dropping prior selections).
  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.email.toLowerCase()));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleRows.forEach((r) => next.delete(r.email.toLowerCase()));
      else visibleRows.forEach((r) => next.add(r.email.toLowerCase()));
      return next;
    });
  };

  const clearFilters = () =>
    setFilters({ year: 'all', paymentStatus: 'all', hasKids: 'all', event: 'all' });

  const selectCls =
    'block w-full rounded-md border-gray-300 dark:border-night-600 text-sm dark:bg-night-700 dark:text-gray-100 focus:border-primary-500 focus:ring-primary-500';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Registered year</label>
          <select className={selectCls} value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })}>
            <option value="all">Any year</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Payment</label>
          <select className={selectCls} value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}>
            {PAYMENT_STATUSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Kids attending</label>
          <select className={selectCls} value={filters.hasKids} onChange={(e) => setFilters({ ...filters, hasKids: e.target.value })}>
            <option value="all">Any</option>
            <option value="yes">Has kids</option>
            <option value="no">No kids</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Event</label>
          <select className={selectCls} value={filters.event} onChange={(e) => setFilters({ ...filters, event: e.target.value })}>
            <option value="all">Any event</option>
            {eventNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {registrationFilterActive
            ? 'Showing contacts whose registrations match these filters (any matching year).'
            : 'Showing all contacts with an email address. Add a filter to narrow to registrants.'}
        </p>
        {registrationFilterActive && (
          <button type="button" onClick={clearFilters} className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700">
            Clear filters
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search recipients by name or email…"
        className="block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
      />

      {/* Recipient list */}
      <div className="border border-gray-200 dark:border-night-700 rounded-lg">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-night-700 bg-gray-50 dark:bg-night-700">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            {term ? 'Select all matches' : 'Select all'}
          </label>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {loading
              ? 'Loading…'
              : `${selected.size} of ${rows.length} selected${term ? ` · ${visibleRows.length} shown` : ''}`}
          </span>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-night-700">
          {visibleRows.map((r) => (
            <label key={r.email} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-night-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(r.email.toLowerCase())}
                onChange={() => toggle(r.email)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="font-medium text-gray-900 dark:text-gray-100">{r.name || '(no name)'}</span>
              <span className="text-gray-500 dark:text-gray-400">{r.email}</span>
            </label>
          ))}
          {!loading && visibleRows.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {term ? 'No recipients match your search.' : 'No recipients match these filters.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
