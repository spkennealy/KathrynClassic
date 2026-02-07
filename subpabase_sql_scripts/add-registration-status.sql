-- Add registration_status field to tournaments table
-- This replaces the simple boolean with a more flexible enum

-- Create enum type for registration status
DO $$ BEGIN
    CREATE TYPE registration_status_enum AS ENUM ('open', 'full', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add the new column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournaments' AND column_name = 'registration_status'
    ) THEN
        ALTER TABLE tournaments ADD COLUMN registration_status registration_status_enum DEFAULT 'open';
    END IF;
END $$;

-- Migrate existing registration_closed values if the column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournaments' AND column_name = 'registration_closed'
    ) THEN
        -- Convert old boolean to new enum
        UPDATE tournaments
        SET registration_status = CASE
            WHEN registration_closed = true THEN 'full'::registration_status_enum
            ELSE 'open'::registration_status_enum
        END;

        -- Drop the old column
        ALTER TABLE tournaments DROP COLUMN IF EXISTS registration_closed;
    END IF;
END $$;

-- Add a comment to explain the field
COMMENT ON COLUMN tournaments.registration_status IS
'Registration status: open (accepting registrations), full (show waitlist), closed (off-season, coming soon message)';
