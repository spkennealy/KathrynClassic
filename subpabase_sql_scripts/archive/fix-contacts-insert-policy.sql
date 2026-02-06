-- Fix RLS policies for contacts table to allow inserts from admin users
-- This script ensures that authenticated users (admin) can create new contacts

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to insert contacts" ON contacts;
DROP POLICY IF EXISTS "Allow authenticated users to update contacts" ON contacts;
DROP POLICY IF EXISTS "Allow authenticated users to read contacts" ON contacts;

-- Enable RLS on contacts table (if not already enabled)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (admin) to read all contacts
CREATE POLICY "Allow authenticated users to read contacts"
ON contacts
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users (admin) to insert new contacts
CREATE POLICY "Allow authenticated users to insert contacts"
ON contacts
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users (admin) to update contacts
CREATE POLICY "Allow authenticated users to update contacts"
ON contacts
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'contacts'
ORDER BY policyname;
