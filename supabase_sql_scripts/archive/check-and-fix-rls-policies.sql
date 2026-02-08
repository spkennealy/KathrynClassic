-- =====================================================
-- CHECK AND FIX RLS POLICIES FOR PUBLIC ACCESS
-- =====================================================

-- First, check what RLS policies exist for tournaments
SELECT
  schemaname,
  tablename,
  policyname,
  roles::text[],
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('tournaments', 'tournament_events', 'tournament_awards')
ORDER BY tablename, policyname;

-- Check if RLS is enabled on these tables
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('tournaments', 'tournament_events', 'tournament_awards')
  AND schemaname = 'public';

-- Now let's ensure the correct policies exist
-- Drop all existing SELECT policies for anon users and recreate them

DROP POLICY IF EXISTS "Allow public to view tournaments" ON tournaments;
DROP POLICY IF EXISTS "Enable read access for all users" ON tournaments;
DROP POLICY IF EXISTS "tournaments_select_policy" ON tournaments;

CREATE POLICY "Enable read access for all users"
ON tournaments FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow public to view tournament_events" ON tournament_events;
DROP POLICY IF EXISTS "Enable read access for all users" ON tournament_events;
DROP POLICY IF EXISTS "tournament_events_select_policy" ON tournament_events;

CREATE POLICY "Enable read access for all users"
ON tournament_events FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow public to view tournament_awards" ON tournament_awards;
DROP POLICY IF EXISTS "Enable read access for all users" ON tournament_awards;
DROP POLICY IF EXISTS "tournament_awards_select_policy" ON tournament_awards;

CREATE POLICY "Enable read access for all users"
ON tournament_awards FOR SELECT
USING (true);

-- Verify the policies were created
SELECT 'Policies after update:' as status;
SELECT
  tablename,
  policyname,
  roles::text[],
  cmd
FROM pg_policies
WHERE tablename IN ('tournaments', 'tournament_events', 'tournament_awards')
  AND cmd = 'SELECT'
ORDER BY tablename;
