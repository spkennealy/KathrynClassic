# Contacts Table Migration Checklist

Quick reference checklist for the contacts table migration.

## Pre-Migration

- [ ] Review the full [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
- [ ] Backup production database
- [ ] Test migrations on staging/development environment first
- [ ] Notify team about upcoming database changes

## Phase 1: Create Contacts Table (Safe - Non-breaking)

- [ ] Run `001-create-contacts-table.sql` in Supabase SQL Editor
- [ ] Verify contacts table created:
  ```sql
  SELECT * FROM contacts LIMIT 1;
  ```
- [ ] Verify foreign key columns added:
  ```sql
  \d registrations
  \d donations
  \d tournament_awards
  ```

## Phase 2: Migrate Existing Data (Safe - Data population)

- [ ] Run `002-migrate-existing-data.sql` in Supabase SQL Editor
- [ ] Review automatic verification output for any warnings
- [ ] Verify all registrations linked:
  ```sql
  SELECT COUNT(*) as total, COUNT(contact_id) as linked
  FROM registrations;
  -- Both numbers should match
  ```
- [ ] Verify all donations linked:
  ```sql
  SELECT COUNT(*) as total, COUNT(contact_id) as linked
  FROM donations;
  -- Both numbers should match
  ```
- [ ] Verify no duplicate contacts:
  ```sql
  SELECT email, COUNT(*) as count
  FROM contacts
  GROUP BY email
  HAVING COUNT(*) > 1;
  -- Should return 0 rows
  ```
- [ ] Inspect sample data looks correct:
  ```sql
  SELECT c.*, r.events, r.tournament_id
  FROM contacts c
  JOIN registrations r ON r.contact_id = c.id
  LIMIT 5;
  ```

## Application Code Deployment

- [ ] Update `src/components/Registration/Registration.js` with new contact logic
- [ ] Update `src/components/TournamentHistory/TournamentHistory.js` with contact joins
- [ ] Test locally:
  - [ ] Submit registration with new email
  - [ ] Submit registration with existing email
  - [ ] Submit registration with multiple adults (mixed emails)
  - [ ] View Tournament History page
- [ ] Deploy to staging environment
- [ ] Run full test suite in staging
- [ ] Deploy to production

## Post-Deployment Testing (Before Phase 3)

**Test in Production for 1-2 weeks**

- [ ] Submit test registration with **new email**
  - [ ] Verify new contact created in database
  - [ ] Verify registration.contact_id populated
- [ ] Submit test registration with **existing email**
  - [ ] Verify existing contact reused (no duplicate)
  - [ ] Verify contact info updated (check updated_at timestamp)
- [ ] Submit test registration with **4 golfers**
  - [ ] Verify team_group_id assigned
  - [ ] Verify all 4 registrations have same team_group_id
- [ ] Submit test registration with **multiple adults** (mixed new/existing)
  - [ ] Verify correct contact handling for each
- [ ] View **Tournament History page**
  - [ ] Verify champion names display correctly
  - [ ] Check both linked contacts and winner_name fallback
- [ ] Admin dashboard checks:
  - [ ] Verify registration data displays correctly
  - [ ] Check contact information appears properly
  - [ ] Run analytics/reports to ensure no breakage

## Monitor Production

- [ ] Watch for error logs in first 24 hours
- [ ] Monitor Supabase logs for any database errors
- [ ] Check with users - any reported issues?
- [ ] Verify data integrity daily for first week:
  ```sql
  -- All registrations should have contact_id
  SELECT COUNT(*) FROM registrations WHERE contact_id IS NULL;
  -- Should return 0

  -- No orphaned registrations (contact_id references non-existent contact)
  SELECT COUNT(*) FROM registrations r
  LEFT JOIN contacts c ON r.contact_id = c.id
  WHERE c.id IS NULL;
  -- Should return 0
  ```

## Phase 3: Enforce Constraints (BREAKING - Only after 1-2 weeks)

**⚠️ WARNING: This is irreversible without database backup**

### Pre-Phase 3 Final Checks

- [ ] All Phase 2 verification queries still pass
- [ ] New application code stable in production for 1-2 weeks
- [ ] No user-reported issues
- [ ] Create fresh database backup:
  ```bash
  # Document backup location and timestamp
  # Backup created: [DATE/TIME]
  # Location: [BACKUP_PATH]
  ```

### Run Phase 3

- [ ] Verify you have database backup from above step
- [ ] Run `003-enforce-constraints.sql` in Supabase SQL Editor
- [ ] Verify constraints enforced:
  ```sql
  -- contact_id should be NOT NULL now
  SELECT column_name, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'registrations'
    AND column_name = 'contact_id';
  -- is_nullable should be 'NO'
  ```
- [ ] Verify columns dropped:
  ```sql
  -- These should NOT exist anymore
  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'registrations'
    AND column_name IN ('first_name', 'last_name', 'email', 'phone',
                        'emergency_contact_name', 'emergency_contact_phone',
                        'dietary_restrictions', 'total_amount');
  -- Should return 0 rows
  ```
- [ ] Verify views updated:
  ```sql
  SELECT * FROM registration_summary LIMIT 5;
  SELECT * FROM contact_activity_summary LIMIT 5;
  ```

## Post-Phase 3 Testing

- [ ] Submit test registration - verify still works
- [ ] View admin dashboard - verify displays correctly
- [ ] Check Tournament History page - verify champions display
- [ ] Run all production tests again
- [ ] Monitor logs for 24-48 hours

## Completion

- [ ] Document completion date and any issues encountered
- [ ] Update team on successful migration
- [ ] Archive this checklist for future reference
- [ ] Celebrate! 🎉

---

## Rollback (If Needed Before Phase 3)

If you need to rollback before Phase 3:

```sql
-- Repopulate old columns from contacts
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
```

Then revert application code changes.

## Emergency Rollback (After Phase 3)

If critical issues after Phase 3:

1. Restore from database backup (taken before Phase 3)
2. Revert application code
3. Review what went wrong before re-attempting

**This is why we wait 1-2 weeks before Phase 3!**
