-- Fix RLS policies for registrations table to allow inserts from admin users
-- This script ensures that authenticated users (admin) can create, read, and update registrations

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to insert registrations" ON registrations;
DROP POLICY IF EXISTS "Allow authenticated users to update registrations" ON registrations;
DROP POLICY IF EXISTS "Allow authenticated users to read registrations" ON registrations;
DROP POLICY IF EXISTS "Allow authenticated users to delete registrations" ON registrations;

-- Enable RLS on registrations table (if not already enabled)
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (admin) to read all registrations
CREATE POLICY "Allow authenticated users to read registrations"
ON registrations
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users (admin) to insert new registrations
CREATE POLICY "Allow authenticated users to insert registrations"
ON registrations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users (admin) to update registrations
CREATE POLICY "Allow authenticated users to update registrations"
ON registrations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users (admin) to delete registrations
CREATE POLICY "Allow authenticated users to delete registrations"
ON registrations
FOR DELETE
TO authenticated
USING (true);

-- Also fix registration_events table policies
DROP POLICY IF EXISTS "Allow authenticated users to insert registration_events" ON registration_events;
DROP POLICY IF EXISTS "Allow authenticated users to update registration_events" ON registration_events;
DROP POLICY IF EXISTS "Allow authenticated users to read registration_events" ON registration_events;
DROP POLICY IF EXISTS "Allow authenticated users to delete registration_events" ON registration_events;

ALTER TABLE registration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read registration_events"
ON registration_events
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert registration_events"
ON registration_events
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update registration_events"
ON registration_events
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete registration_events"
ON registration_events
FOR DELETE
TO authenticated
USING (true);

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('registrations', 'registration_events')
ORDER BY tablename, policyname;
