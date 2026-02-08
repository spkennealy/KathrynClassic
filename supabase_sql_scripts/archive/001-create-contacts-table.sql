-- =====================================================
-- PHASE 1: Create Contacts Table (Non-breaking)
-- This migration adds the contacts table and foreign keys
-- without removing existing columns
-- =====================================================

-- =====================================================
-- CREATE CONTACTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- CREATE INDEXES ON CONTACTS
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY ON CONTACTS
-- =====================================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES FOR CONTACTS
-- Allow public inserts (for registration submissions)
-- Allow authenticated users to read/update (for admin dashboard)
-- =====================================================

-- Allow public to insert contacts
CREATE POLICY "Allow public to insert contacts"
ON contacts
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow authenticated users to view all contacts
CREATE POLICY "Allow authenticated users to view contacts"
ON contacts
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update contacts
CREATE POLICY "Allow authenticated users to update contacts"
ON contacts
FOR UPDATE
TO authenticated
USING (true);

-- =====================================================
-- ADD UPDATED_AT TRIGGER TO CONTACTS
-- =====================================================
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ADD FOREIGN KEY COLUMNS TO EXISTING TABLES
-- =====================================================

-- Add contact_id to registrations (nullable for now)
ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE;

-- Add contact_id to donations (nullable, SET NULL on delete)
ALTER TABLE donations
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- Add contact_id to tournament_awards (nullable, SET NULL on delete)
ALTER TABLE tournament_awards
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- =====================================================
-- CREATE INDEXES ON FOREIGN KEY COLUMNS
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_registrations_contact_id ON registrations(contact_id);
CREATE INDEX IF NOT EXISTS idx_donations_contact_id ON donations(contact_id);
CREATE INDEX IF NOT EXISTS idx_tournament_awards_contact_id ON tournament_awards(contact_id);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT INSERT ON contacts TO anon;
GRANT SELECT, UPDATE ON contacts TO authenticated;
