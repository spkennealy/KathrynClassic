-- Tournament Database Schema
-- This schema stores tournament information, events, pricing, and results

-- Tournaments table - stores each year's tournament
CREATE TABLE tournaments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_raised DECIMAL(10, 2) DEFAULT 0,
  total_attendees INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events table - stores individual events within tournaments
CREATE TABLE tournament_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'welcome_dinner', 'golf_tournament', 'beach_day', etc.
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  location TEXT,
  host TEXT,
  adult_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  child_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  description TEXT,
  details TEXT[], -- Array of detail points
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournament Awards/Results table - stores winners and special achievements
CREATE TABLE tournament_awards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  award_category TEXT NOT NULL, -- 'tournament_winner', 'closest_to_pin', 'longest_drive', etc.
  winner_name TEXT NOT NULL,
  details TEXT, -- Additional details about the achievement
  hole_number INTEGER, -- For hole-specific awards
  distance TEXT, -- For distance-related awards (e.g., "275 yards")
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update registrations table to link to tournaments and support different pricing
ALTER TABLE registrations
  ADD COLUMN tournament_id UUID REFERENCES tournaments(id),
  ADD COLUMN amount_paid DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'refunded'
  ADD COLUMN payment_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN cancellation_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN notes TEXT;

-- Enable Row Level Security
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_awards ENABLE ROW LEVEL SECURITY;

-- Public read access for all tournament tables
CREATE POLICY "Allow public reads on tournaments" ON tournaments
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public reads on tournament_events" ON tournament_events
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public reads on tournament_awards" ON tournament_awards
  FOR SELECT TO anon USING (true);

-- Insert data for 2025 tournament
INSERT INTO tournaments (year, start_date, end_date, total_raised, total_attendees, notes)
VALUES (
  2025,
  '2025-09-12',
  '2025-09-13',
  5106.00,
  100,
  'Inaugural Kathryn Classic tournament'
);

-- Get the tournament_id for 2025 (you'll need to replace this with actual ID from query)
-- For now, we'll add events manually after getting the ID

-- Example: Insert events for 2025 tournament
-- Replace {tournament_id} with actual UUID from the tournaments table
/*
INSERT INTO tournament_events (tournament_id, event_name, event_type, event_date, start_time, end_time, location, host, adult_price, child_price, description, details)
VALUES
(
  '{tournament_id}',
  'Welcome Dinner',
  'welcome_dinner',
  '2025-09-12',
  '17:00:00',
  '20:00:00',
  'The Grill at Pine Mountain Lake',
  'Kierstyn Moore',
  75.00,
  40.00,
  'Join us for appetizers, drinks, and dinner',
  ARRAY['Heavy appetizers and open bar', 'Welcome remarks', 'Dinner served', 'Tournament overview and instructions']
),
(
  '{tournament_id}',
  'Golf Tournament',
  'golf_tournament',
  '2025-09-13',
  '12:10:00',
  '18:00:00',
  'Pine Mountain Lake Golf Course',
  'Sean Kennealy',
  150.00,
  75.00,
  '18-hole tournament with scramble format',
  ARRAY['Check-in opens at 11:30 AM', 'Shotgun start at 12:10 PM', 'Lunch provided on the course', 'Contests: Longest drive, closest to the pin, and more']
),
(
  '{tournament_id}',
  'Beach Day',
  'beach_day',
  '2025-09-13',
  '11:00:00',
  '16:00:00',
  'Dunn Court Beach',
  'Kierstyn Moore & Kiley Lonsdale',
  65.00,
  35.00,
  'A day of relaxation and activities for non-golfers',
  ARRAY['Transportation provided', 'Beach activities including volleyball and paddleboarding', 'Catered lunch', 'Optional water activities']
);
*/

-- Create helpful views
CREATE OR REPLACE VIEW tournament_summary AS
SELECT
  t.year,
  t.start_date,
  t.end_date,
  t.total_raised,
  t.total_attendees,
  COUNT(DISTINCT te.id) as event_count,
  COUNT(DISTINCT ta.id) as award_count
FROM tournaments t
LEFT JOIN tournament_events te ON t.id = te.tournament_id
LEFT JOIN tournament_awards ta ON t.id = ta.tournament_id
GROUP BY t.id, t.year, t.start_date, t.end_date, t.total_raised, t.total_attendees
ORDER BY t.year DESC;
