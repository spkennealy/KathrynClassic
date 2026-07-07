import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import MultiSelect from '../MultiSelect';
import Select from '../Select';

// Payment-status options for the multi-select (no "all" entry — an empty
// selection means all statuses).
const PAYMENT_STATUS_OPTIONS = [
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
export default function RecipientSelector({ onChange, campaignYear }) {
  const [years, setYears] = useState([]);
  const [eventNames, setEventNames] = useState([]);
  const [filters, setFilters] = useState({
    registered: 'all', // 'all' | 'yes' | 'no'
    years: [], // selected tournament years (empty = all)
    paymentStatuses: [], // selected payment statuses (empty = all)
    hasKids: 'all', // 'all' | 'yes' | 'no'
    events: [], // selected event names (empty = all)
  });
  const [rows, setRows] = useState([]); // deduped [{email, name, contact_id}]
  // Selected recipients persist across filter changes so the admin can build a
  // list by filtering + selecting repeatedly. Keyed by lowercased email → full
  // recipient object (so we can report them upward even when a later filter no
  // longer includes them in `rows`).
  const [selectedMap, setSelectedMap] = useState(new Map());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // "Not registered" isolates contacts with zero registrations, so the
  // registration-based filters below don't apply and are disabled in the UI.
  const notRegistered = filters.registered === 'no';
  // "Registered" limits to actual registrants (for the selected year, or any).
  const onlyRegistered = filters.registered === 'yes';

  const registrationFilterActive =
    !notRegistered &&
    (onlyRegistered ||
      filters.years.length > 0 ||
      filters.paymentStatuses.length > 0 ||
      filters.hasKids !== 'all' ||
      filters.events.length > 0);

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
        if (filters.years.length > 0) query = query.in('tournament_year', filters.years.map((y) => parseInt(y, 10)));
        if (filters.paymentStatuses.length > 0) query = query.in('payment_status', filters.paymentStatuses);
        if (filters.hasKids === 'yes') query = query.gt('total_children', 0);
        if (filters.hasKids === 'no') query = query.or('total_children.is.null,total_children.eq.0');
        if (filters.events.length > 0) query = query.overlaps('events', filters.events);
      } else {
        // Every contact that has an email address. Includes the registration
        // history columns so the "not registered" filter can be applied below.
        query = supabase
          .from('admin_contact_activity')
          .select('contact_id, first_name, last_name, email, total_registrations, tournament_years')
          .not('email', 'is', null);
      }
      query = query.limit(5000);

      // Emails to hide because the contact has unsubscribed — from everything,
      // or from this campaign's year — and the per-contact unsubscribe token,
      // which we pass through to the send function so the email's unsubscribe
      // link never depends on a server-side lookup. Suppression is enforced
      // again server-side at send time.
      const { data: contactMeta, error: metaErr } = await supabase
        .from('contacts')
        .select('email, unsubscribe_token, unsubscribed_all, unsubscribed_years')
        .is('deleted_at', null)
        .not('email', 'is', null);
      if (metaErr) throw metaErr;
      const yr = campaignYear ? parseInt(campaignYear, 10) : null;
      const suppressed = new Set();
      const tokenByEmail = new Map();
      (contactMeta || []).forEach((c) => {
        const key = (c.email || '').trim().toLowerCase();
        if (!key) return;
        if (c.unsubscribe_token) tokenByEmail.set(key, c.unsubscribe_token);
        if (c.unsubscribed_all || (yr && (c.unsubscribed_years || []).includes(yr))) {
          suppressed.add(key);
        }
      });

      const { data, error: err } = await query;
      if (err) throw err;

      // "Not registered" narrows to contacts with no registration. With years
      // selected it means "not registered for any of those years" (they may have
      // registered in other years); with none it means never registered at all.
      let records = data || [];
      if (notRegistered) {
        if (filters.years.length === 0) {
          records = records.filter((r) => !r.total_registrations);
        } else {
          const yearNums = filters.years.map((y) => parseInt(y, 10));
          records = records.filter(
            (r) => !yearNums.some((y) => (r.tournament_years || []).includes(y))
          );
        }
      }

      // Dedupe by lowercased email (a contact can have many registration rows).
      const seen = new Map();
      records.forEach((r) => {
        const email = (r.email || '').trim();
        if (!email) return;
        const key = email.toLowerCase();
        if (suppressed.has(key)) return; // unsubscribed — hide from the list
        if (!seen.has(key)) {
          seen.set(key, {
            email,
            name: fullName(r),
            firstName: r.first_name || '',
            lastName: r.last_name || '',
            contact_id: r.contact_id,
            unsubscribeToken: tokenByEmail.get(key) || null,
          });
        }
      });
      const deduped = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
      setRows(deduped);
      // NOTE: selections are intentionally NOT reset here — they accumulate
      // across filter changes so the admin can build a list over several passes.
    } catch (err) {
      setError(err.message || 'Failed to load recipients');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [registrationFilterActive, notRegistered, filters, campaignYear]);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  // Report the accumulated selection upward (include the fields used for
  // {{variable}} personalization). Sourced from the persistent map so recipients
  // picked under earlier filters are still included.
  useEffect(() => {
    const recipients = [...selectedMap.values()].map((r) => ({
      email: r.email,
      name: r.name,
      firstName: r.firstName,
      lastName: r.lastName,
      unsubscribeToken: r.unsubscribeToken,
    }));
    onChange(recipients);
  }, [selectedMap, onChange]);

  const isSelected = (email) => selectedMap.has(email.toLowerCase());

  const toggle = (row) => {
    const key = row.email.toLowerCase();
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, row);
      return next;
    });
  };

  // Client-side search over the loaded list (by name or email).
  const term = search.trim().toLowerCase();
  const visibleRows = term
    ? rows.filter((r) => r.name.toLowerCase().includes(term) || r.email.toLowerCase().includes(term))
    : rows;

  // "Select all" acts on whatever is currently visible (so searching/filtering
  // then selecting only adds the matches, without dropping prior selections).
  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((r) => isSelected(r.email));
  const toggleAll = () => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (allVisibleSelected) visibleRows.forEach((r) => next.delete(r.email.toLowerCase()));
      else visibleRows.forEach((r) => next.set(r.email.toLowerCase(), r));
      return next;
    });
  };

  // Count of currently-visible rows that are selected (for the header summary).
  const selectedInView = visibleRows.filter((r) => isSelected(r.email)).length;
  const clearSelection = () => setSelectedMap(new Map());

  const clearFilters = () =>
    setFilters({ registered: 'all', years: [], paymentStatuses: [], hasKids: 'all', events: [] });

  // Human list of the selected years for the status message.
  const yearList = [...filters.years].sort((a, b) => b - a).join(', ');

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Registration</label>
          <Select value={filters.registered} onChange={(e) => setFilters({ ...filters, registered: e.target.value })}>
            <option value="all">All</option>
            <option value="yes">Registered</option>
            <option value="no">Not registered yet</option>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Registered Year</label>
          <MultiSelect
            options={years.map((y) => ({ value: y, label: String(y) }))}
            selected={filters.years}
            onChange={(vals) => setFilters({ ...filters, years: vals })}
            allLabel="All years"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Payment</label>
          <MultiSelect
            options={PAYMENT_STATUS_OPTIONS}
            selected={filters.paymentStatuses}
            onChange={(vals) => setFilters({ ...filters, paymentStatuses: vals })}
            allLabel="All payment statuses"
            disabled={notRegistered}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Kids attending</label>
          <Select value={filters.hasKids} disabled={notRegistered} onChange={(e) => setFilters({ ...filters, hasKids: e.target.value })}>
            <option value="all">All</option>
            <option value="yes">Has kids</option>
            <option value="no">No kids</option>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Event</label>
          <MultiSelect
            options={eventNames.map((name) => ({ value: name, label: name }))}
            selected={filters.events}
            onChange={(vals) => setFilters({ ...filters, events: vals })}
            allLabel="All events"
            disabled={notRegistered}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {notRegistered
            ? filters.years.length === 0
              ? 'Showing contacts who have never registered for any tournament. Pick a year to see who hasn’t registered for that year.'
              : `Showing contacts who have not registered for ${yearList}.`
            : onlyRegistered
            ? filters.years.length === 0
              ? 'Showing contacts who have registered for any tournament.'
              : `Showing contacts who registered for ${yearList}.`
            : registrationFilterActive
            ? 'Showing contacts whose registrations match these filters (any matching year).'
            : 'Showing all contacts with an email address. Add a filter to narrow to registrants.'}
        </p>
        {(registrationFilterActive || notRegistered) && (
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
        className="block w-full rounded-lg border border-gray-400 dark:border-night-600 py-2.5 px-3 shadow-sm bg-white dark:bg-night-700 text-gray-900 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-0 sm:text-sm"
      />

      {/* Selection summary + clear (total persists across filters) */}
      {selectedMap.size > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-primary-50 dark:bg-primary-900/20 px-4 py-2 text-sm">
          <span className="font-medium text-primary-800 dark:text-primary-300">
            {selectedMap.size} recipient{selectedMap.size === 1 ? '' : 's'} selected
          </span>
          <button type="button" onClick={clearSelection} className="text-xs font-medium text-primary-700 dark:text-primary-400 hover:underline">
            Clear selection
          </button>
        </div>
      )}

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
              : `${selectedInView} of ${visibleRows.length} shown selected`}
          </span>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-night-700">
          {visibleRows.map((r) => (
            <label key={r.email} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-night-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isSelected(r.email)}
                onChange={() => toggle(r)}
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
