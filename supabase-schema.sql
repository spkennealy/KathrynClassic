-- Kathryn Classic Database Schema
-- Run this SQL in your Supabase SQL Editor to create the necessary tables

-- =====================================================
-- REGISTRATIONS TABLE
-- Stores tournament registration information
-- =====================================================
CREATE TABLE IF NOT EXISTS registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  events TEXT[] NOT NULL,
  golf_handicap NUMERIC,
  dietary_restrictions TEXT,
  emergency_contact_name VARCHAR(100) NOT NULL,
  emergency_contact_phone VARCHAR(20) NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations(email);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations(created_at DESC);

-- =====================================================
-- DONATIONS TABLE
-- Stores donation/sponsorship information
-- =====================================================
CREATE TABLE IF NOT EXISTS donations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  company VARCHAR(255),
  donation_type VARCHAR(50) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  message TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_donations_email ON donations(email);

-- Create index on donation_type
CREATE INDEX IF NOT EXISTS idx_donations_type ON donations(donation_type);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at DESC);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================
-- Enable RLS on registrations table
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- Enable RLS on donations table
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- Allow anyone to insert registrations and donations
-- But only authenticated users (admin) can view/update/delete
-- =====================================================

-- Registrations: Allow public inserts
CREATE POLICY "Allow public to insert registrations"
ON registrations
FOR INSERT
TO anon
WITH CHECK (true);

-- Registrations: Allow authenticated users to view all
CREATE POLICY "Allow authenticated users to view registrations"
ON registrations
FOR SELECT
TO authenticated
USING (true);

-- Donations: Allow public inserts
CREATE POLICY "Allow public to insert donations"
ON donations
FOR INSERT
TO anon
WITH CHECK (true);

-- Donations: Allow authenticated users to view all
CREATE POLICY "Allow authenticated users to view donations"
ON donations
FOR SELECT
TO authenticated
USING (true);

-- =====================================================
-- FUNCTIONS
-- Auto-update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for registrations
DROP TRIGGER IF EXISTS update_registrations_updated_at ON registrations;
CREATE TRIGGER update_registrations_updated_at
  BEFORE UPDATE ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for donations
DROP TRIGGER IF EXISTS update_donations_updated_at ON donations;
CREATE TRIGGER update_donations_updated_at
  BEFORE UPDATE ON donations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS (Optional - for reporting)
-- =====================================================

-- View for registration summary
CREATE OR REPLACE VIEW registration_summary AS
SELECT
  COUNT(*) as total_registrations,
  SUM(total_amount) as total_revenue,
  COUNT(DISTINCT email) as unique_registrants,
  DATE_TRUNC('day', created_at) as registration_date
FROM registrations
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY registration_date DESC;

-- View for donation summary
CREATE OR REPLACE VIEW donation_summary AS
SELECT
  donation_type,
  COUNT(*) as count,
  SUM(amount) as total_amount,
  AVG(amount) as average_amount
FROM donations
GROUP BY donation_type
ORDER BY total_amount DESC;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant permissions on tables
GRANT INSERT ON registrations TO anon;
GRANT SELECT ON registrations TO authenticated;

GRANT INSERT ON donations TO anon;
GRANT SELECT ON donations TO authenticated;

-- Grant permissions on views
GRANT SELECT ON registration_summary TO authenticated;
GRANT SELECT ON donation_summary TO authenticated;
