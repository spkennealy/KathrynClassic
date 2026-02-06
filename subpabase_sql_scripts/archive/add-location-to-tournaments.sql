-- Add location column to tournaments table
ALTER TABLE tournaments
ADD COLUMN location TEXT;

-- Update existing tournaments with a default location if needed
-- You can update these manually later
UPDATE tournaments
SET location = 'Pine Mountain Lake'
WHERE year = 2025;

UPDATE tournaments
SET location = 'Pine Mountain Lake'
WHERE year = 2026;
