# Contacts Table Migration - Implementation Summary

## Overview

Successfully implemented a centralized contacts table refactoring for the Kathryn Classic database. This eliminates data duplication across registrations, donations, and tournament awards tables.

## What Was Implemented

### Database Migrations (5 phases)

1. **Phase 1 - Create Contacts Table** (`001-create-contacts-table.sql`)
   - Creates `contacts` table with proper indexes and RLS policies
   - Adds nullable `contact_id` foreign keys to existing tables
   - Non-breaking change - safe to deploy immediately

2. **Phase 2 - Migrate Data** (`002-migrate-existing-data.sql`)
   - Populates contacts from existing registration and donation data
   - Links all existing records to contacts via foreign keys
   - Includes automatic verification queries
   - Safe to run - only populates new columns

3. **Phase 3 - Enforce Constraints** (`003-enforce-constraints.sql`)
   - Makes `contact_id` NOT NULL on registrations
   - Drops redundant columns (first_name, last_name, email, phone, etc.)
   - Updates database views
   - **BREAKING CHANGE** - Only run after 1-2 weeks of testing

4. **Phase 4 - Normalize Registration Events** (`004-normalize-registration-events.sql`)
   - Creates `registration_events` join table for event-level data
   - Migrates from `events` array + `child_counts` JSONB to normalized structure
   - Creates useful views for event attendance reporting
   - Safe to run - adds new table and populates it

5. **Phase 5 - Drop Old Event Columns** (`005-drop-old-event-columns.sql`)
   - Drops `events` and `child_counts` columns from registrations
   - **BREAKING CHANGE** - Only run after Phase 4 code is deployed and stable

### Application Code Updates

1. **Registration.js** (`src/components/Registration/Registration.js`)
   - Batch contact lookup by email (prevents N+1 queries)
   - Creates new contacts for new emails
   - Updates existing contacts with latest info on re-registration
   - References contacts by `contact_id` instead of duplicating data

2. **TournamentHistory.js** (`src/components/TournamentHistory/TournamentHistory.js`)
   - Joins with contacts table to fetch champion information
   - Prefers contact name if linked, falls back to `winner_name` for external winners

### Documentation

1. **MIGRATION_GUIDE.md** - Comprehensive guide covering:
   - Detailed explanation of each phase
   - Step-by-step instructions
   - Verification procedures
   - Rollback plans
   - Troubleshooting tips

2. **MIGRATION_CHECKLIST.md** - Quick reference checklist with:
   - Pre-migration tasks
   - Phase-by-phase verification steps
   - Testing procedures
   - Post-deployment monitoring

3. **test-queries.sql** - SQL queries for:
   - Phase verification
   - Data quality checks
   - Performance monitoring
   - Business intelligence

## Key Design Decisions

### Always Update Contact Info
Per user preference, existing contacts are always updated with the latest registration data. This ensures:
- Phone numbers stay current
- Name corrections propagate automatically
- Most recent information is always used

### Optional Contact Links for Awards
Tournament awards have both `contact_id` (nullable) and `winner_name` to support:
- Registered participants who are linked to contacts
- External/guest winners who never registered
- Historical winners before the contact system
- Team names (e.g., "Team Eagle")

Display logic: Prefer contact name if linked, otherwise use winner_name.

### Fields Removed
Per plan, removed these unused fields from registrations:
- `emergency_contact_name`
- `emergency_contact_phone`
- `dietary_restrictions`
- `total_amount` (now calculated from events)

If needed in future, add as tournament-specific fields to registrations table (not contacts).

## Deployment Sequence

**Critical: Follow this exact order**

1. ✅ Run Phase 1 migration (creates contacts table)
2. ✅ Run Phase 2 migration (populates contacts data)
3. ✅ Verify Phase 2 success (see checklist)
4. ✅ Deploy contacts code (Registration.js, TournamentHistory.js)
5. ⏰ Test in production for 1-2 weeks
6. ⚠️ Run Phase 3 migration (enforces contact constraints)
7. ✅ Run Phase 4 migration (creates registration_events table)
8. ✅ Deploy events code (updated Registration.js)
9. ⏰ Test in production for 1-2 weeks
10. ⚠️ Run Phase 5 migration (drops old event columns)

## Testing Strategy

### Before Phase 3
- Submit test registration with new email
- Submit test registration with existing email (verify update)
- Submit registration with multiple adults (mixed new/existing)
- Submit registration with 4 golfers (verify team assignment)
- View Tournament History page
- Check database for correct contact_id population
- Verify contacts.updated_at timestamp updates

### After Phase 3
- Repeat all tests above
- Verify admin dashboard displays correctly
- Monitor logs for 24-48 hours
- Watch for any user-reported issues

## Rollback Plan

### Before Phase 3 (Reversible)
Can repopulate old columns from contacts table and drop contacts:
```sql
UPDATE registrations r
SET first_name = c.first_name, last_name = c.last_name,
    email = c.email, phone = c.phone
FROM contacts c
WHERE r.contact_id = c.id;

DROP TABLE IF EXISTS contacts CASCADE;
```
Then revert application code.

### After Phase 3 (Not Reversible)
Old columns are permanently deleted. Only option is database restore from backup.

**Prevention**: Wait 1-2 weeks between Phase 2 and Phase 3!

## Performance Optimizations

### Batch Operations
Registration submission uses batch operations to minimize database round-trips:
- Single batch lookup for all emails
- Single batch insert for new contacts
- Sequential updates for existing contacts

### Indexes Created
- `idx_contacts_email` (UNIQUE) - Fast email lookups
- `idx_contacts_name` - Fast name-based searches
- `idx_contacts_created_at` - Chronological queries
- `idx_registrations_contact_id` - Fast registration joins
- `idx_donations_contact_id` - Fast donation joins
- `idx_tournament_awards_contact_id` - Fast award joins

## Security (RLS Policies)

Contacts table has appropriate RLS policies:
- **anon role**: Can INSERT (for registration submissions)
- **authenticated role**: Can SELECT, UPDATE (for admin dashboard)

This matches the existing pattern for registrations and donations.

## Data Integrity

### Verification Built-In
Phase 2 migration includes automatic verification that checks:
- All registrations are linked to contacts
- All donations are linked to contacts
- No duplicate contacts by email
- Data quality issues

### Ongoing Monitoring
Use `test-queries.sql` to periodically check:
- No orphaned registrations/donations (contact_id points to non-existent contact)
- No NULL contact_ids after Phase 3
- Contact data quality (valid emails, complete names)
- Performance metrics (index usage, table sizes)

## New Features Enabled

### Contact Activity View
New `contact_activity_summary` view provides:
- Total registrations per contact
- Total donations per contact
- Award counts
- Easy dashboard/reporting queries

### Multi-Tournament Tracking
Can now easily query:
- Contacts who attended multiple tournaments
- Repeat participants year-over-year
- Contacts who both registered and donated
- Historical participation patterns

## Files Changed

### Created
- `/subpabase_sql_scripts/001-create-contacts-table.sql`
- `/subpabase_sql_scripts/002-migrate-existing-data.sql`
- `/subpabase_sql_scripts/003-enforce-constraints.sql`
- `/subpabase_sql_scripts/MIGRATION_GUIDE.md`
- `/subpabase_sql_scripts/MIGRATION_CHECKLIST.md`
- `/subpabase_sql_scripts/test-queries.sql`
- `/CONTACTS_MIGRATION_SUMMARY.md` (this file)

### Modified
- `/src/components/Registration/Registration.js` (lines 97-159)
- `/src/components/TournamentHistory/TournamentHistory.js` (lines 14-23, 69)

## Next Steps

1. **Review all documentation** - Ensure you understand each phase
2. **Test in development** - Run migrations on dev database first
3. **Backup production** - Create backup before any migration
4. **Deploy Phase 1** - Safe to run immediately
5. **Deploy Phase 2** - Safe to run after Phase 1
6. **Verify Phase 2** - Use checklist to ensure all data linked
7. **Deploy code** - Update Registration.js and TournamentHistory.js
8. **Test thoroughly** - Run all test scenarios
9. **Wait 1-2 weeks** - Monitor production, ensure stability
10. **Deploy Phase 3** - Final breaking change (after confidence)

## Success Metrics

After full deployment:
- ✅ Zero data duplication across tables
- ✅ Contact info automatically updates on re-registration
- ✅ Faster registration queries (single join vs. duplicate data)
- ✅ Cleaner database schema
- ✅ Support for multi-tournament tracking
- ✅ Flexible award winner relationships

## Support

If you encounter issues:
1. Check MIGRATION_GUIDE.md troubleshooting section
2. Run verification queries from test-queries.sql
3. Review Supabase logs for detailed errors
4. Test queries in SQL editor before applying to production

## Questions?

The implementation is complete and ready for deployment. All database migrations, code changes, and documentation are in place. Follow the deployment sequence carefully, especially the 1-2 week waiting period between Phase 2 and Phase 3.
