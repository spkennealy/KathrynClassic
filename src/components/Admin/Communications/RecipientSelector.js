import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import FilterBuilder from '../filters/FilterBuilder';
import SavedViewsBar from '../filters/SavedViewsBar';
import useContactFilterOptions from '../filters/useContactFilterOptions';
import { getContactFilterFields, buildFieldMap } from '../filters/contactFilterFields';
import { emptyTree } from '../filters/filterModel';
import { applyFilters, countCompiledConditions } from '../filters/compileFilters';

const MAX_RECIPIENTS = 5000;
const FILTER_DEBOUNCE_MS = 350;

const fullName = (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim();

// Resolves a recipient audience and reports the selected list up via
// `onChange([{ email, name, ... }])`.
//
// Everything comes from one query against admin_contact_activity: the view is
// already one row per contact and carries the registration, event, award and
// unsubscribe data, so the audience is defined entirely by the shared filter
// builder. With no filters set you get every contact who has an email address.
//
// Unsubscribes are suppressed server-side here as well as at send time — this is
// so the admin sees an accurate count before sending, not a substitute for the
// enforcement in the send function.
export default function RecipientSelector({ onChange, campaignYear }) {
  const [tree, setTree] = useState(emptyTree);
  const [appliedTree, setAppliedTree] = useState(tree);
  const [rows, setRows] = useState([]); // deduped [{email, name, contact_id}]
  // Selected recipients persist across filter changes so the admin can build a
  // list by filtering + selecting repeatedly. Keyed by lowercased email → full
  // recipient object (so we can report them upward even when a later filter no
  // longer includes them in `rows`).
  const [selectedMap, setSelectedMap] = useState(new Map());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [truncated, setTruncated] = useState(false);
  // Registration/payment details for the campaign year, keyed by contact_id —
  // merged into reported recipients so the email can use {{balance_due}},
  // {{events}}, etc. Empty when the year has no matching tournament.
  const [yearDetailsByContact, setYearDetailsByContact] = useState(new Map());

  const { options, loading: optionsLoading } = useContactFilterOptions();
  const fields = useMemo(() => getContactFilterFields({ scope: 'recipients' }), []);
  const fieldMap = useMemo(() => buildFieldMap(fields), [fields]);

  useEffect(() => {
    const timer = setTimeout(() => setAppliedTree(tree), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [tree]);

  const activeFilterCount = useMemo(
    () => countCompiledConditions(tree, fieldMap),
    [tree, fieldMap]
  );

  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const year = campaignYear ? parseInt(campaignYear, 10) : null;

      let query = supabase
        .from('admin_contact_activity')
        .select('contact_id, first_name, last_name, email, unsubscribe_token')
        .not('email', 'is', null)
        // Suppress anyone who has opted out of everything, or out of this
        // campaign's year.
        .is('unsubscribed_all', false);
      if (year) query = query.not('unsubscribed_years', 'cs', `{${year}}`);

      query = applyFilters(query, { tree: appliedTree, fieldMap });

      const { data, error: err } = await query
        .order('last_name', { ascending: true })
        .limit(MAX_RECIPIENTS);
      if (err) throw err;

      // Two contacts can share an email address, so still dedupe.
      const seen = new Map();
      (data || []).forEach((r) => {
        const email = (r.email || '').trim();
        if (!email) return;
        const key = email.toLowerCase();
        if (seen.has(key)) return;
        seen.set(key, {
          email,
          name: fullName(r),
          firstName: r.first_name || '',
          lastName: r.last_name || '',
          contact_id: r.contact_id,
          unsubscribeToken: r.unsubscribe_token || null,
        });
      });

      setTruncated((data || []).length >= MAX_RECIPIENTS);
      setRows([...seen.values()].sort((a, b) => a.name.localeCompare(b.name)));
      // NOTE: selections are intentionally NOT reset here — they accumulate
      // across filter changes so the admin can build a list over several passes.
    } catch (err) {
      setError(err.message || 'Failed to load recipients');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [appliedTree, fieldMap, campaignYear]);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  // Load each contact's registration for the campaign year — their events
  // (with price) and total_cost/amount_paid — so the email can be personalized
  // with {{balance_due}}, {{events}}, {{events_table}}, etc. Keyed by
  // contact_id; contacts with no registration that year simply have no entry,
  // and those tokens render blank for them (same as an empty last_name).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const year = campaignYear ? parseInt(campaignYear, 10) : null;
      if (!year) {
        setYearDetailsByContact(new Map());
        return;
      }
      try {
        const { data: tournament } = await supabase
          .from('tournaments')
          .select('id')
          .eq('year', year)
          .maybeSingle();
        if (!tournament) {
          if (!cancelled) setYearDetailsByContact(new Map());
          return;
        }

        const [{ data: eventsData }, { data: regs }] = await Promise.all([
          supabase
            .from('tournament_events')
            .select('id, event_name, adult_price, price_tbd')
            .eq('tournament_id', tournament.id),
          supabase
            .from('registrations')
            .select('id, contact_id, total_cost, amount_paid')
            .eq('tournament_id', tournament.id)
            .is('deleted_at', null),
        ]);
        if (!regs || regs.length === 0) {
          if (!cancelled) setYearDetailsByContact(new Map());
          return;
        }
        const eventMap = new Map((eventsData || []).map((e) => [e.id, e]));

        const { data: regEvents } = await supabase
          .from('registration_events')
          .select('registration_id, tournament_event_id')
          .in('registration_id', regs.map((r) => r.id));
        const eventsByReg = new Map();
        (regEvents || []).forEach((re) => {
          if (!eventsByReg.has(re.registration_id)) eventsByReg.set(re.registration_id, []);
          eventsByReg.get(re.registration_id).push(re);
        });

        const map = new Map();
        regs.forEach((reg) => {
          const events = (eventsByReg.get(reg.id) || [])
            .map((re) => eventMap.get(re.tournament_event_id))
            .filter(Boolean)
            .map((ev) => ({ name: ev.event_name, amount: ev.price_tbd ? null : parseFloat(ev.adult_price) || 0 }));
          // A contact could have more than one registration for the same
          // tournament only in edge cases (e.g. re-registered); last one wins.
          map.set(reg.contact_id, {
            totalCost: Number(reg.total_cost) || 0,
            amountPaid: Number(reg.amount_paid) || 0,
            events,
          });
        });
        if (!cancelled) setYearDetailsByContact(map);
      } catch (err) {
        console.error('Failed to load registration details for campaign year:', err);
        if (!cancelled) setYearDetailsByContact(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignYear]);

  // Report the accumulated selection upward (include the fields used for
  // {{variable}} personalization). Sourced from the persistent map so recipients
  // picked under earlier filters are still included.
  useEffect(() => {
    const recipients = [...selectedMap.values()].map((r) => {
      const details = yearDetailsByContact.get(r.contact_id);
      return {
        email: r.email,
        name: r.name,
        firstName: r.firstName,
        lastName: r.lastName,
        unsubscribeToken: r.unsubscribeToken,
        ...(details ? { totalCost: details.totalCost, amountPaid: details.amountPaid, events: details.events } : {}),
      };
    });
    onChange(recipients);
  }, [selectedMap, onChange, yearDetailsByContact]);

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

  return (
    <div className="space-y-4">
      {/* Saved audiences */}
      <SavedViewsBar
        scope="recipients"
        tree={tree}
        onLoad={setTree}
        isKnownField={(key) => Boolean(fieldMap[key])}
      />

      {/* Audience filters */}
      <div className="rounded-lg border border-gray-200 dark:border-night-700 p-3">
        <FilterBuilder
          tree={tree}
          onChange={setTree}
          fields={fields}
          options={options}
          optionsLoading={optionsLoading}
        />
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {activeFilterCount === 0
          ? 'Showing every contact with an email address. Add a filter to narrow the audience — for example “Tournament year is NOT registered for 2026” to reach people who haven’t signed up yet.'
          : 'Showing contacts matching these filters. Unsubscribed contacts are always excluded.'}
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {truncated && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Showing the first {MAX_RECIPIENTS.toLocaleString()} matches. Narrow the filters to see the rest.
        </p>
      )}

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search recipients by name or email…"
        spellCheck={false}
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
