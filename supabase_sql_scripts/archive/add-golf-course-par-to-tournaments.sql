-- Add golf course and par to tournaments table
ALTER TABLE tournaments
ADD COLUMN golf_course TEXT,
ADD COLUMN par INTEGER DEFAULT 72;

-- Update existing tournaments with default values
UPDATE tournaments
SET golf_course = 'Pine Mountain Lake Golf Course',
    par = 72
WHERE year IN (2025, 2026);

-- Add comment for clarity
COMMENT ON COLUMN tournaments.golf_course IS 'Name of the golf course for this tournament';
COMMENT ON COLUMN tournaments.par IS 'Par for the course (typically 72)';
