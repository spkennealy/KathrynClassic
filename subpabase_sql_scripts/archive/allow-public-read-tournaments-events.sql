-- =====================================================
-- ALLOW PUBLIC TO READ TOURNAMENTS AND EVENTS
-- Enables public website to display tournament/event data
-- =====================================================

-- Allow anonymous users to view tournaments
DROP POLICY IF EXISTS "Allow public to view tournaments" ON tournaments;
CREATE POLICY "Allow public to view tournaments"
ON tournaments FOR SELECT TO anon USING (true);

-- Allow anonymous users to view tournament events
DROP POLICY IF EXISTS "Allow public to view tournament_events" ON tournament_events;
CREATE POLICY "Allow public to view tournament_events"
ON tournament_events FOR SELECT TO anon USING (true);

-- Allow anonymous users to view tournament awards (for history page)
DROP POLICY IF EXISTS "Allow public to view tournament_awards" ON tournament_awards;
CREATE POLICY "Allow public to view tournament_awards"
ON tournament_awards FOR SELECT TO anon USING (true);

-- Verify policies were created
SELECT 'RLS Policies Created:' as status;
SELECT tablename, policyname, roles::text[], cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('tournaments', 'tournament_events', 'tournament_awards')
AND 'anon' = ANY(roles)
ORDER BY tablename;
