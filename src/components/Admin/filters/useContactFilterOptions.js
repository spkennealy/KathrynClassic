import { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { PAYMENT_STATUS_OPTIONS } from './contactFilterFields';

const titleize = (s) =>
  String(s)
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

// Option lists for the condition builder's `multi` fields, fetched once. These
// come from the source tables rather than from whatever rows happen to be on
// screen — the old Year dropdown listed only the years present in the current
// 50-row page, which quietly hid most of the data.
export default function useContactFilterOptions() {
  const [options, setOptions] = useState({
    years: [],
    events: [],
    eventYearTypes: [],
    yearPaymentStatuses: [],
    awardCategories: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [{ data: tournaments }, { data: events }, { data: awards }] = await Promise.all([
          supabase
            .from('tournaments')
            .select('id, year')
            .is('deleted_at', null)
            .order('year', { ascending: false }),
          supabase
            .from('tournament_events')
            .select('id, event_name, event_type, tournament_id')
            .is('deleted_at', null),
          supabase.from('tournament_awards').select('award_category').is('deleted_at', null),
        ]);
        if (cancelled) return;

        const yearById = new Map((tournaments || []).map((t) => [t.id, t.year]));

        const eventOptions = (events || [])
          .map((e) => ({
            value: e.id,
            year: yearById.get(e.tournament_id) ?? null,
            eventType: e.event_type,
            label: `${yearById.get(e.tournament_id) ?? '?'} · ${e.event_name}`,
          }))
          .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.label.localeCompare(b.label));

        // '2025-beach_day' tokens, matching the view's event_year_types column.
        const eventYearTypes = [
          ...new Map(
            eventOptions
              .filter((e) => e.year && e.eventType)
              .map((e) => [
                `${e.year}-${e.eventType}`,
                {
                  value: `${e.year}-${e.eventType}`,
                  label: `${e.year} · ${titleize(e.eventType)}`,
                },
              ])
          ).values(),
        ];

        // Mirror the regexp_replace the view applies to award_category_keys, so
        // the option values line up with what's actually stored.
        const awardCategories = [
          ...new Set(
            (awards || [])
              .map((a) =>
                String(a.award_category || '')
                  .toLowerCase()
                  .replace(/[^a-z0-9_-]/g, '')
              )
              .filter(Boolean)
          ),
        ]
          .sort()
          .map((key) => ({ value: key, label: titleize(key) }));

        const years = (tournaments || []).map((t) => t.year);

        // '2025-paid' tokens, matching the view's year_payment_statuses column.
        const yearPaymentStatuses = years.flatMap((y) =>
          PAYMENT_STATUS_OPTIONS.map((s) => ({
            value: `${y}-${s.value}`,
            label: `${y} · ${s.label}`,
          }))
        );

        setOptions({
          years: years.map((y) => ({ value: y, label: String(y) })),
          events: eventOptions.map(({ value, label }) => ({ value, label })),
          eventYearTypes,
          yearPaymentStatuses,
          awardCategories,
        });
      } catch (err) {
        // A missing option list degrades the builder but shouldn't break the page.
        console.error('Error loading filter options:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { options, loading };
}
