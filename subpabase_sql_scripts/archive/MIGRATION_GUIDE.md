# Contacts Table Migration Guide

This guide explains how to migrate the Kathryn Classic database to use a centralized `contacts` table.

## Overview

The contacts table refactoring eliminates data duplication across `registrations`, `donations`, and `tournament_awards` tables by storing contact information (first name, last name, email, phone) in a single centralized table.

### Benefits
- **Eliminates duplication**: Contact info stored once, referenced by ID
- **Automatic updates**: Latest contact info from registrations updates the master record
- **Better data quality**: Single source of truth for contact information
- **Flexible relationships**: Awards can link to contacts or store external winner names

## Migration Phases

### Phase 1: Create Contacts Table (Non-breaking)
**File**: `001-create-contacts-table.sql`

**What it does**:
- Creates `contacts` table with indexes and RLS policies
- Adds nullable `contact_id` foreign key columns to `registrations`, `donations`, and `tournament_awards`
- Creates indexes on new foreign key columns
- Sets up permissions for public inserts and authenticated reads/updates

**Safe to run**: ✅ Yes - This is a non-breaking change

**How to run**:
```bash
# In Supabase SQL Editor, run:
cat 001-create-contacts-table.sql
```

**Verification**:
```sql
-- Check table was created
SELECT * FROM contacts LIMIT 1;

-- Check foreign key columns were added
SELECT contact_id FROM registrations LIMIT 1;
SELECT contact_id FROM donations LIMIT 1;
SELECT contact_id FROM tournament_awards LIMIT 1;
```

### Phase 2: Migrate Existing Data
**File**: `002-migrate-existing-data.sql`

**What it does**:
- Populates `contacts` from existing `registrations` data
- Populates `contacts` from existing `donations` data (new contacts only)
- Links all `registrations` to their corresponding `contacts` via `contact_id`
- Links all `donations` to their corresponding `contacts` via `contact_id`
- Best-effort linking of `tournament_awards` to `contacts` by name matching
- Runs verification queries to ensure data integrity

**Safe to run**: ✅ Yes - Reads existing data and populates new columns

**How to run**:
```bash
# In Supabase SQL Editor, run:
cat 002-migrate-existing-data.sql
```

**Verification output**: The script includes automatic verification that will output:
- Total registrations and how many are linked to contacts
- Total donations and how many are linked to contacts
- Check for duplicate contacts by email
- Count of linked awards

**Manual verification**:
```sql
-- All registrations should have contact_id
SELECT COUNT(*) as total, COUNT(contact_id) as linked
FROM registrations;

-- All donations should have contact_id
SELECT COUNT(*) as total, COUNT(contact_id) as linked
FROM donations;

-- Check for duplicates (should return 0 rows)
SELECT email, COUNT(*) as count
FROM contacts
GROUP BY email
HAVING COUNT(*) > 1;

-- Preview contact data
SELECT * FROM contacts LIMIT 10;
```

**IMPORTANT**: Do not proceed to Phase 3 until:
1. ✅ All registrations have `contact_id` populated
2. ✅ All donations have `contact_id` populated
3. ✅ No duplicate emails in contacts table
4. ✅ New application code is deployed (see below)

### Phase 3: Enforce Constraints (Breaking Change)
**File**: `003-enforce-constraints.sql`

**What it does**:
- Makes `registrations.contact_id` NOT NULL
- Drops redundant columns from `registrations`: `first_name`, `last_name`, `email`, `phone`, `emergency_contact_name`, `emergency_contact_phone`, `dietary_restrictions`, `total_amount`
- Drops redundant columns from `donations`: `first_name`, `last_name`, `email`, `phone`
- Drops old email indexes
- Updates database views to use contacts table
- Creates new `contact_activity_summary` view

**Safe to run**: ⚠️ **ONLY AFTER**:
1. Phase 2 is complete and verified
2. New application code is deployed to production
3. You've waited at least 1-2 weeks to ensure stability

**How to run**:
```bash
# In Supabase SQL Editor, run:
cat 003-enforce-constraints.sql
```

**Verification**:
```sql
-- Verify schema changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'registrations'
  AND column_name IN ('contact_id', 'first_name', 'email');
-- Should show: contact_id (NOT NULL), no first_name or email

-- Verify final state
SELECT
  (SELECT COUNT(*) FROM contacts) as total_contacts,
  (SELECT COUNT(*) FROM registrations) as total_registrations,
  (SELECT COUNT(*) FROM donations) as total_donations,
  (SELECT COUNT(*) FROM tournament_awards WHERE contact_id IS NOT NULL) as linked_awards;
```

## Application Code Changes

### Updated Files

1. **`src/components/Registration/Registration.js`** (lines 97-159)
   - New contact lookup/creation logic
   - Batch operations to avoid N+1 queries
   - Automatic contact updates with latest info
   - References contacts by `contact_id` instead of storing duplicate data

2. **`src/components/TournamentHistory/TournamentHistory.js`** (lines 14-23, 69)
   - Updated query to join `contacts` table
   - Display logic prefers contact name if linked, falls back to `winner_name`

### Deployment Sequence

**Critical**: Deploy in this exact order:

1. ✅ **Run Phase 1 migration** (creates contacts table, adds foreign key columns)
2. ✅ **Run Phase 2 migration** (populates contacts, links existing records)
3. ✅ **Verify Phase 2 success** (all records linked, no duplicates)
4. ✅ **Deploy updated application code** (Registration.js and TournamentHistory.js changes)
5. ✅ **Test in production** for 1-2 weeks
6. ✅ **Run Phase 3 migration** (enforces constraints, drops old columns)

### Testing Checklist

After deploying new application code (before Phase 3):

- [ ] Submit test registration with **new email** → verify new contact created
- [ ] Submit test registration with **existing email** → verify existing contact reused and updated
- [ ] Submit test registration with **multiple adults** (mixed new/existing emails) → verify correct behavior
- [ ] Submit test registration with **4 golfers** → verify team_group_id assigned correctly
- [ ] View **Tournament History page** → verify champion names display correctly
- [ ] Check database: verify `registrations.contact_id` populated correctly
- [ ] Check database: verify `contacts.updated_at` updates on re-registration
- [ ] Admin dashboard: verify registration data displays correctly

## Rollback Plan

### Before Phase 3 (Reversible)
If issues arise after Phase 2 but before Phase 3:

```sql
-- Can repopulate old columns from contacts
UPDATE registrations r
SET
  first_name = c.first_name,
  last_name = c.last_name,
  email = c.email,
  phone = c.phone
FROM contacts c
WHERE r.contact_id = c.id;

UPDATE donations d
SET
  first_name = c.first_name,
  last_name = c.last_name,
  email = c.email,
  phone = c.phone
FROM contacts c
WHERE d.contact_id = c.id;

-- Revert application code
-- Drop contacts table if needed
DROP TABLE IF EXISTS contacts CASCADE;
```

### After Phase 3 (Not Reversible)
Once Phase 3 is complete, old columns are gone. Recovery requires:
1. Restore from database backup
2. Extensive testing before re-attempting migration

**Prevention**: Wait 1-2 weeks after Phase 2 deployment before running Phase 3.

## Architecture Notes

### Contact Management Flow

**New Registration**:
1. User submits registration form with adult info
2. System batch-lookups all emails in `contacts` table
3. For new emails: creates new contacts
4. For existing emails: updates contact with latest info (name, phone)
5. Creates registration records referencing `contact_id`

**Why Update Existing Contacts?**
Per user preference, we always update contact info with the latest registration data. This ensures:
- Phone numbers stay current
- Name corrections propagate to all records
- Most recent info is always used

### Contact-Award Relationship

**Design Decision**: Awards have both `contact_id` (nullable) and `winner_name`:

- `contact_id` links to registered contacts when available
- `winner_name` supports:
  - External/guest winners who never registered
  - Historical winners before contact system
  - Team names (e.g., "Team Eagle")

**Display Logic**: Prefer contact name if linked, fall back to winner_name.

### Unused Fields Removed

Per plan, these fields are removed from `registrations`:
- `emergency_contact_name` - Not currently used in application
- `emergency_contact_phone` - Not currently used in application
- `dietary_restrictions` - Not currently used in application

If needed in future, add to `registrations` table as tournament-specific fields (don't add to contacts).

## Troubleshooting

### "Some registrations are not linked to contacts"
**Cause**: Registrations with NULL or invalid emails

**Fix**:
```sql
-- Find problematic registrations
SELECT id, first_name, last_name, email
FROM registrations
WHERE contact_id IS NULL;

-- Manual fix: create contacts for each
INSERT INTO contacts (first_name, last_name, email, phone)
VALUES ('John', 'Doe', 'john.doe@example.com', '555-1234')
ON CONFLICT (email) DO NOTHING;

-- Link registration
UPDATE registrations
SET contact_id = (SELECT id FROM contacts WHERE email = 'john.doe@example.com')
WHERE id = 'registration-uuid-here';
```

### "Duplicate contacts by email"
**Cause**: Race condition or pre-existing duplicates

**Fix**:
```sql
-- Find duplicates
SELECT email, COUNT(*) as count, ARRAY_AGG(id) as contact_ids
FROM contacts
GROUP BY email
HAVING COUNT(*) > 1;

-- Keep first, merge others (manual process)
-- 1. Identify which contact_id to keep
-- 2. Update all references to point to keeper
-- 3. Delete duplicate contacts
```

### Registration fails with "contact_id violates not-null constraint"
**Cause**: Phase 3 ran before application code was deployed

**Fix**: Deploy updated application code immediately. Cannot easily undo Phase 3.

## Performance Considerations

### Batch Operations
The new registration code uses batch operations to minimize database queries:
- Single batch lookup for all emails
- Single batch insert for new contacts
- Sequential updates for existing contacts (could be optimized with batch update in future)

### Indexes
Ensure these indexes exist for optimal performance:
- `idx_contacts_email` (UNIQUE) - Fast contact lookup by email
- `idx_contacts_name` - Fast name-based searches
- `idx_registrations_contact_id` - Fast registration queries by contact
- `idx_donations_contact_id` - Fast donation queries by contact

### Expected Query Patterns
- Registration submission: 3-4 queries (lookup, insert/update contacts, insert registrations)
- Admin dashboard: Single join query for registrations with contact info
- Tournament history: Single join query for awards with contact names

## Questions?

If you encounter issues during migration:
1. Check verification query output
2. Review troubleshooting section above
3. Examine Supabase logs for detailed error messages
4. Test queries in SQL editor before running migrations

**Remember**: Take it slow. Each phase can run independently, and you can pause between phases to verify everything works correctly.
