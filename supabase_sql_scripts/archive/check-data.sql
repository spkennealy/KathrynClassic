-- Check if we have data in tournaments and events tables

-- Check tournaments
SELECT 'Tournaments:' as table_name;
SELECT id, year, start_date, end_date, location, total_raised, total_attendees
FROM tournaments
ORDER BY year DESC;

-- Check tournament_events
SELECT 'Tournament Events:' as table_name;
SELECT te.id, t.year, te.event_name, te.event_type, te.event_date, te.adult_price, te.child_price
FROM tournament_events te
JOIN tournaments t ON te.tournament_id = t.id
ORDER BY t.year DESC, te.event_date;

-- Check registrations
SELECT 'Registrations:' as table_name;
SELECT COUNT(*) as total_registrations FROM registrations;

-- Check registration_events
SELECT 'Registration Events:' as table_name;
SELECT COUNT(*) as total_registration_events FROM registration_events;
