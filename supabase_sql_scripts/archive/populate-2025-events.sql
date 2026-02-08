-- Populate 2025 Tournament Events
-- Run this script AFTER creating the tournaments table and inserting the 2025 tournament

-- First, get the tournament_id for 2025
-- You'll need to replace 'YOUR_TOURNAMENT_ID_HERE' with the actual UUID from the tournaments table
-- To get it, run: SELECT id FROM tournaments WHERE year = 2025;

-- Example query to get the ID (run this first):
-- SELECT id FROM tournaments WHERE year = 2025;

-- Then replace the ID below and run these INSERT statements:

INSERT INTO tournament_events (
  tournament_id,
  event_name,
  event_type,
  event_date,
  start_time,
  end_time,
  location,
  host,
  adult_price,
  child_price,
  description,
  details
)
SELECT
  t.id,
  'Welcome Dinner',
  'welcome_dinner',
  '2025-09-12'::date,
  '17:00:00'::time,
  '20:00:00'::time,
  'The Grill at Pine Mountain Lake',
  'Kierstyn Moore',
  75.00,
  40.00,
  'Join us for appetizers, drinks, and dinner',
  ARRAY[
    'Heavy appetizers and open bar',
    'Welcome remarks',
    'Dinner served',
    'Tournament overview and instructions',
    'Optional networking session after dinner'
  ]
FROM tournaments t
WHERE t.year = 2025;

INSERT INTO tournament_events (
  tournament_id,
  event_name,
  event_type,
  event_date,
  start_time,
  end_time,
  location,
  host,
  adult_price,
  child_price,
  description,
  details
)
SELECT
  t.id,
  'Golf Tournament',
  'golf_tournament',
  '2025-09-13'::date,
  '12:10:00'::time,
  '18:00:00'::time,
  'Pine Mountain Lake Golf Course',
  'Sean Kennealy',
  150.00,
  75.00,
  '18-hole tournament with scramble format',
  ARRAY[
    'Check-in opens at 11:30 AM',
    'Shotgun start at 12:10 PM',
    'Lunch provided on the course',
    'Contests: Longest drive, closest to the pin, and more',
    'Post-round drinks and appetizers in the clubhouse'
  ]
FROM tournaments t
WHERE t.year = 2025;

INSERT INTO tournament_events (
  tournament_id,
  event_name,
  event_type,
  event_date,
  start_time,
  end_time,
  location,
  host,
  adult_price,
  child_price,
  description,
  details
)
SELECT
  t.id,
  'Beach Day',
  'beach_day',
  '2025-09-13'::date,
  '11:00:00'::time,
  '16:00:00'::time,
  'Dunn Court Beach',
  'Kierstyn Moore & Kiley Lonsdale',
  65.00,
  35.00,
  'A day of relaxation and activities for non-golfers',
  ARRAY[
    'Transportation provided',
    'Beach activities including volleyball and paddleboarding',
    'Catered lunch',
    'Optional water activities',
    'Return transportation at 4:00 PM'
  ]
FROM tournaments t
WHERE t.year = 2025;

-- Verify the events were inserted
SELECT
  te.event_name,
  te.event_date,
  te.start_time,
  te.location,
  te.adult_price,
  te.child_price
FROM tournament_events te
JOIN tournaments t ON te.tournament_id = t.id
WHERE t.year = 2025
ORDER BY te.event_date, te.start_time;
