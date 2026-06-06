-- Add 'completed' to registration_status_enum.
--
-- The admin tournament form and the public registration page added a
-- "Completed - Tournament has ended" status, but the enum type only had
-- open/full/closed, so writing 'completed' failed with 22P02
-- (invalid input value for enum registration_status_enum: "completed").
--
-- Apply via the Supabase dashboard SQL editor, or `supabase db push`.
-- Note: ALTER TYPE ... ADD VALUE appends the value; it cannot be used in the
-- same transaction that adds it (run/commit this before relying on it).

ALTER TYPE registration_status_enum ADD VALUE IF NOT EXISTS 'completed';
