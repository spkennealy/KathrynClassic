-- Fix admin_tournament_stats.actual_total_attendees double-counting.
--
-- The view LEFT JOINs registration_events (one row per registration per event),
-- so summing child_count counted the same kids at every event they attended
-- (e.g. a family of 6 at Welcome Dinner + Beach Day + Awards Dinner showed as 18).
--
-- Corrected to a unique weekend headcount:
--   actual_total_attendees = distinct contacts registered
--                          + per registration, the MAX child_count across its
--                            events, summed (children aren't tracked individually,
--                            so the same kids across events count once).
--
-- Only actual_total_attendees and total_children change; all other columns
-- (names, order, types) are preserved so the rest of the dashboard is unaffected.
--
-- Apply via the Supabase dashboard SQL editor, or `supabase db push`.

CREATE OR REPLACE VIEW admin_tournament_stats AS
SELECT t.id AS tournament_id,
    t.year,
    t.start_date,
    t.end_date,
    t.total_raised,
    t.total_attendees AS reported_attendees,
    count(DISTINCT r.id) AS registration_count,
    count(DISTINCT r.contact_id) AS unique_contacts,
    count(DISTINCT r.id) FILTER (WHERE r.payment_status = 'paid'::payment_status) AS paid_count,
    count(DISTINCT r.id) FILTER (WHERE r.payment_status = 'pending'::payment_status) AS pending_count,
    count(DISTINCT re.tournament_event_id) AS events_with_registrations,
    count(DISTINCT r.contact_id) + COALESCE(kids.children_total, 0::bigint) AS actual_total_attendees,
    COALESCE(kids.children_total, 0::bigint) AS total_children
   FROM tournaments t
     LEFT JOIN registrations r ON r.tournament_id = t.id AND r.deleted_at IS NULL
     LEFT JOIN registration_events re ON re.registration_id = r.id
     LEFT JOIN (
       SELECT r2.tournament_id,
              sum(per_reg.max_children)::bigint AS children_total
       FROM registrations r2
         JOIN (
           SELECT registration_id, max(COALESCE(child_count, 0)) AS max_children
           FROM registration_events
           GROUP BY registration_id
         ) per_reg ON per_reg.registration_id = r2.id
       WHERE r2.deleted_at IS NULL
       GROUP BY r2.tournament_id
     ) kids ON kids.tournament_id = t.id
  WHERE t.deleted_at IS NULL
  GROUP BY t.id, t.year, t.start_date, t.end_date, t.total_raised, t.total_attendees, kids.children_total
  ORDER BY t.year DESC;
