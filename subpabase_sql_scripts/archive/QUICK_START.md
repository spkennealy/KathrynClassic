# Quick Start Guide - Contacts Table Migration

Ready to deploy? Follow these steps in order.

## Prerequisites

- [ ] Access to Supabase SQL Editor
- [ ] Access to production database
- [ ] Ability to deploy application code
- [ ] Database backup taken (timestamp: ____________)

## Step 1: Run Phase 1 Migration (5 minutes)

**Safe to run immediately - Non-breaking change**

1. Open Supabase SQL Editor
2. Copy contents of `001-create-contacts-table.sql`
3. Execute in SQL Editor
4. Verify success:

```sql
-- Should return true
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'contacts'
) AS contacts_exists;
```

✅ **Checkpoint**: Contacts table created, foreign keys added

---

## Step 2: Run Phase 2 Migration (5 minutes)

**Safe to run immediately - Data population only**

1. In Supabase SQL Editor
2. Copy contents of `002-migrate-existing-data.sql`
3. Execute in SQL Editor
4. Review verification output in console
5. Verify all records linked:

```sql
-- Both counts should match
SELECT COUNT(*) as total, COUNT(contact_id) as linked
FROM registrations;

-- Both counts should match
SELECT COUNT(*) as total, COUNT(contact_id) as linked
FROM donations;

-- Should return 0 rows
SELECT email, COUNT(*) FROM contacts GROUP BY email HAVING COUNT(*) > 1;
```

✅ **Checkpoint**: All existing records linked to contacts

⚠️ **STOP HERE** if any verification fails. See troubleshooting in MIGRATION_GUIDE.md

---

## Step 3: Deploy Application Code (30 minutes)

**Safe to deploy - Works with Phase 1 & 2 complete**

### Files to Deploy
1. `src/components/Registration/Registration.js`
2. `src/components/TournamentHistory/TournamentHistory.js`

### Deployment Steps
```bash
# 1. Commit changes
git add src/components/Registration/Registration.js
git add src/components/TournamentHistory/TournamentHistory.js
git commit -m "Refactor: Use centralized contacts table for registrations"

# 2. Deploy to production
# (Use your deployment process - Vercel, Netlify, etc.)
```

### Verify Deployment
```bash
# Check deployed version shows latest commit
# Test registration form loads without errors
# Check browser console for any errors
```

✅ **Checkpoint**: New code deployed to production

---

## Step 4: Test in Production (1 hour initial, then ongoing)

**Critical: Test thoroughly before Phase 3**

### Test 1: New Email Registration
```
1. Go to registration form
2. Fill out with NEW email (test-new-user@example.com)
3. Submit registration
4. Verify in database:
```
```sql
SELECT c.*, r.*
FROM contacts c
JOIN registrations r ON r.contact_id = c.id
WHERE c.email = 'test-new-user@example.com';
```
Expected: New contact created, registration linked

### Test 2: Existing Email Registration
```
1. Go to registration form
2. Fill out with EXISTING email (update name/phone)
3. Submit registration
4. Verify in database:
```
```sql
SELECT c.email, c.updated_at, COUNT(r.id) as registration_count
FROM contacts c
JOIN registrations r ON r.contact_id = c.id
WHERE c.email = 'existing@example.com'
GROUP BY c.id;
```
Expected: Contact updated (updated_at timestamp), new registration added

### Test 3: Multiple Adults (Mixed Emails)
```
1. Go to registration form
2. Add 4 adults (2 new emails, 2 existing)
3. All select golf tournament
4. Submit registration
5. Verify in database:
```
```sql
-- Check team assignment
SELECT c.first_name, c.last_name, r.team_group_id
FROM contacts c
JOIN registrations r ON r.contact_id = c.id
WHERE r.team_group_id = '...' -- Use actual UUID from submission
ORDER BY c.last_name;
```
Expected: 4 registrations, same team_group_id, correct contact links

### Test 4: Tournament History Display
```
1. Go to Tournament History page
2. Check champions display correctly
3. Verify no console errors
```

✅ **Checkpoint**: All tests passing in production

---

## Step 5: Monitor Production (1-2 weeks)

**Required waiting period before Phase 3**

### Daily Checks (First 3 Days)
```sql
-- Check for NULL contact_ids (should always be 0)
SELECT COUNT(*) FROM registrations WHERE contact_id IS NULL;

-- Check for orphaned registrations (should always be 0)
SELECT COUNT(*) FROM registrations r
LEFT JOIN contacts c ON r.contact_id = c.id
WHERE c.id IS NULL;

-- Monitor contact growth
SELECT DATE(created_at) as date, COUNT(*) as new_contacts
FROM contacts
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Weekly Checks
- Review error logs for database errors
- Check with users - any issues reported?
- Run full test suite again
- Verify data integrity with `test-queries.sql`

✅ **Checkpoint**: 1-2 weeks passed, no issues in production

---

## Step 6: Run Phase 3 Migration (5 minutes)

**⚠️ BREAKING CHANGE - Only run after Steps 1-5 complete**

### Pre-Phase 3 Checklist
- [ ] Phase 1 & 2 deployed and verified
- [ ] Application code deployed and tested
- [ ] Production running stable for 1-2 weeks
- [ ] Fresh database backup taken (timestamp: ____________)
- [ ] All verification queries passing
- [ ] No NULL contact_ids in registrations/donations

### Run Phase 3
1. **Take fresh database backup** (critical!)
2. In Supabase SQL Editor
3. Copy contents of `003-enforce-constraints.sql`
4. Execute in SQL Editor
5. Verify constraints enforced:

```sql
-- contact_id should be NOT NULL
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'registrations' AND column_name = 'contact_id';
-- is_nullable should be 'NO'

-- Old columns should not exist
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'registrations'
  AND column_name IN ('first_name', 'last_name', 'email', 'phone');
-- Should return 0 rows
```

✅ **Checkpoint**: Phase 3 complete, old columns removed

---

## Step 7: Post-Phase 3 Testing (1 hour)

**Verify everything still works after breaking change**

### Repeat All Tests
- [ ] Test 1: New email registration
- [ ] Test 2: Existing email registration
- [ ] Test 3: Multiple adults registration
- [ ] Test 4: Tournament History display
- [ ] Test 5: Admin dashboard (if applicable)

### Monitor Closely
- [ ] Check error logs immediately after Phase 3
- [ ] Watch for 24 hours for any issues
- [ ] Verify no user-reported problems

✅ **Checkpoint**: All tests passing after Phase 3

---

## Success! 🎉

Your database is now using the centralized contacts table.

### What Changed
- ✅ Contact info stored once, referenced by ID
- ✅ Automatic contact updates on re-registration
- ✅ Cleaner, normalized database schema
- ✅ Better tracking across registrations/donations
- ✅ Foundation for future contact-based features

### Maintenance
- Use `test-queries.sql` for ongoing monitoring
- Run data quality checks monthly
- Monitor index performance
- Review contact_activity_summary view for insights

---

## Troubleshooting

### "Phase 2 shows unlinked registrations"
**Solution**: See MIGRATION_GUIDE.md troubleshooting section

### "Phase 3 fails with constraint violation"
**Solution**: Phase 2 didn't fully complete. Rollback and investigate.

### "Registration form not working after code deploy"
**Solution**: Check browser console. Ensure Phase 1 & 2 migrations ran first.

### "Tournament History not showing champions"
**Solution**: Check query in TournamentHistory.js. Verify tournament_awards have tournament_id.

---

## Timeline Summary

```
Day 1:
  Morning:  Run Phase 1 & 2 migrations (10 minutes)
  Morning:  Deploy application code (30 minutes)
  Afternoon: Run all production tests (1 hour)
  Evening:   Monitor logs

Day 2-7:
  Daily: Run verification queries (5 minutes)
  Daily: Check error logs
  Daily: Monitor user activity

Week 2-3:
  Weekly: Full verification
  Weekly: Review with team
  Weekly: Ensure stability

Week 3-4:
  Run Phase 3 migration (5 minutes)
  Immediate: Post-Phase 3 testing (1 hour)
  24-48h: Close monitoring
  Done! ✅
```

---

## Need Help?

1. Review [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed explanations
2. Check [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md) for step-by-step checklist
3. Run queries from [test-queries.sql](./test-queries.sql) for verification
4. Review [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the design

**Remember**: Take your time. Each phase can be paused and verified independently. Safety over speed!
