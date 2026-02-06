# Phase 4-5 Guide: Registration Events Normalization

This guide covers the normalization of registration events, moving from arrays and JSONB to a proper join table.

## Problem with Current Structure

Currently, each registration stores:
- `events` - Array of event_type strings: `['welcome_dinner', 'beach_day']`
- `child_counts` - JSONB object: `{"welcome_dinner": 2, "beach_day": 1}`

### Issues:
1. **No referential integrity** - Event types are strings, not foreign keys to tournament_events
2. **Difficult to query** - "How many people at welcome dinner?" requires JSON/array operations
3. **Not normalized** - Can't easily report on per-event attendance
4. **Inconsistency** - Event could be in array but not in child_counts
5. **No individual event metadata** - Can't track per-event notes, modifications, etc.

## New Structure

### Before (Old):
```
registrations:
  id: reg-123
  contact_id: contact-456
  tournament_id: tourn-789
  events: ['welcome_dinner', 'beach_day', 'golf_tournament']
  child_counts: {"welcome_dinner": 2, "beach_day": 1, "golf_tournament": 0}
  golf_handicap: 12
  team_group_id: team-abc
```

### After (New):
```
registrations:
  id: reg-123
  contact_id: contact-456
  tournament_id: tourn-789
  golf_handicap: 12
  team_group_id: team-abc

registration_events:
  { registration_id: reg-123, tournament_event_id: event-uuid-1, child_count: 2 }
  { registration_id: reg-123, tournament_event_id: event-uuid-2, child_count: 1 }
  { registration_id: reg-123, tournament_event_id: event-uuid-3, child_count: 0 }
```

## Phase 4: Create and Populate registration_events

**File**: `004-normalize-registration-events.sql`

### What it does:
1. Creates `registration_events` table with proper foreign keys
2. Migrates data from `events` array and `child_counts` JSONB
3. Creates indexes for performance
4. Sets up RLS policies
5. Creates useful views:
   - `registration_details` - Full registration info with events
   - `event_attendance_summary` - Per-event attendance and revenue

### Migration Logic:
```sql
FOR each registration:
  FOR each event_type in registration.events array:
    Look up tournament_event_id from tournament_events table
    Get child_count from registration.child_counts[event_type]
    INSERT INTO registration_events (
      registration_id,
      tournament_event_id,
      child_count
    )
```

### Verification:
The migration includes automatic verification that checks:
- All registrations have corresponding registration_events
- Event counts match (array length vs. registration_events count)
- Sample data comparison (old vs. new structure)

### How to Run:

1. **Ensure Phase 3 is complete and stable**
   - Contacts table is in use
   - No contact-related issues in production

2. **Run Phase 4 migration**:
   ```bash
   # In Supabase SQL Editor
   cat 004-normalize-registration-events.sql
   # Copy and execute
   ```

3. **Review verification output** in the SQL editor console

4. **Manual verification**:
   ```sql
   -- Check all registrations migrated
   SELECT
     COUNT(*) as total_registrations,
     COUNT(DISTINCT registration_id) as registrations_with_events
   FROM registration_events;
   -- Numbers should be close (some registrations might have no events)

   -- Check sample data
   SELECT * FROM registration_details LIMIT 10;

   -- Check event attendance
   SELECT * FROM event_attendance_summary;
   ```

## Application Code Changes

**File**: `src/components/Registration/Registration.js`

### Changes Made:

**Old code** (Step 4-5):
```javascript
const registrations = values.adults.map(adult => ({
  contact_id: contactMap.get(adult.email),
  events: adult.events,  // Array
  child_counts: adult.childCounts || {},  // JSONB
  // ... other fields
}));

await supabase.from('registrations').insert(registrations);
```

**New code** (Step 4-6):
```javascript
// Step 4: Create registrations (without events/child_counts)
const registrations = values.adults.map(adult => ({
  contact_id: contactMap.get(adult.email),
  // events and child_counts removed!
  golf_handicap: adult.golfHandicap || null,
  team_group_id: isGolfer && teamGroupId ? teamGroupId : null,
  // ... other fields
}));

// Step 5: Insert registrations
const { data: insertedRegistrations } = await supabase
  .from('registrations')
  .insert(registrations)
  .select();

// Step 6: Create registration_events for each event
const registrationEvents = [];

insertedRegistrations.forEach((registration, index) => {
  const adult = values.adults[index];

  adult.events.forEach(eventType => {
    const event = events.find(e => e.id === eventType);

    if (event && event.eventId) {
      registrationEvents.push({
        registration_id: registration.id,
        tournament_event_id: event.eventId,  // UUID, not string!
        child_count: adult.childCounts?.[eventType] || 0
      });
    }
  });
});

// Insert all registration_events
await supabase
  .from('registration_events')
  .insert(registrationEvents);
```

### Key Differences:
1. **No more events array** - Removed from registration record
2. **No more child_counts JSONB** - Removed from registration record
3. **New Step 6** - Creates registration_events records after registrations
4. **Uses event.eventId** - The UUID from tournament_events, not the event_type string

## Deployment Sequence

### Before Phase 4:
- Phase 1, 2, 3 complete
- Contacts table in production
- System stable for 1-2 weeks

### Deploy Phase 4:

1. **Run Phase 4 migration** in Supabase SQL Editor
2. **Verify migration success**:
   ```sql
   -- All registrations should have events
   SELECT COUNT(*) FROM registrations WHERE id NOT IN (
     SELECT DISTINCT registration_id FROM registration_events
   );
   -- Should return 0 or very few
   ```

3. **Wait - Don't deploy code yet!**
   - Old code still works (events/child_counts columns still exist)
   - New registration_events table populated but not yet used
   - System still stable

4. **Deploy updated Registration.js**
   - New registrations will use registration_events table
   - Old registrations still readable (views handle both)

5. **Test new registration flow**:
   - Submit test registration with multiple events
   - Verify registration_events records created
   - Check database for proper data

6. **Monitor for 1-2 weeks**:
   - Watch for errors
   - Verify all new registrations create registration_events
   - Ensure no issues with event selection

## Phase 5: Drop Old Columns

**File**: `005-drop-old-event-columns.sql`

### What it does:
1. Final verification (all registrations have registration_events)
2. Drops `events` column from registrations
3. Drops `child_counts` column from registrations
4. Shows final schema state

### When to Run:
⚠️ **Only after**:
- Phase 4 deployed and stable for 1-2 weeks
- New application code in production and working
- All new registrations using registration_events
- No errors or issues reported

### How to Run:

1. **Final backup** - Create fresh database backup

2. **Run Phase 5 migration**:
   ```bash
   # In Supabase SQL Editor
   cat 005-drop-old-event-columns.sql
   # Copy and execute
   ```

3. **Verify columns dropped**:
   ```sql
   -- Should return 0 rows
   SELECT column_name
   FROM information_schema.columns
   WHERE table_name = 'registrations'
     AND column_name IN ('events', 'child_counts');
   ```

4. **Test application** - Ensure everything still works

## New Query Patterns

### Get all events for a registration:
```sql
SELECT
  c.first_name,
  c.last_name,
  te.event_name,
  re.child_count
FROM registrations r
JOIN contacts c ON r.contact_id = c.id
JOIN registration_events re ON re.registration_id = r.id
JOIN tournament_events te ON re.tournament_event_id = te.id
WHERE r.id = 'some-uuid';
```

### Get total attendance for an event:
```sql
SELECT
  te.event_name,
  COUNT(DISTINCT re.registration_id) as adults,
  SUM(re.child_count) as children,
  COUNT(DISTINCT re.registration_id) + SUM(re.child_count) as total
FROM tournament_events te
LEFT JOIN registration_events re ON re.tournament_event_id = te.id
WHERE te.id = 'some-event-uuid'
GROUP BY te.id, te.event_name;
```

### Or use the view:
```sql
SELECT * FROM event_attendance_summary
WHERE tournament_year = 2025;
```

## Benefits of New Structure

1. **Referential Integrity** ✅
   - Foreign key to tournament_events
   - Can't reference non-existent events
   - Cascading deletes handled properly

2. **Easy Queries** ✅
   - Standard SQL joins, no JSON operations
   - Fast indexed lookups
   - Aggregate functions work normally

3. **Reporting** ✅
   - Per-event attendance summary view
   - Revenue calculations per event
   - Easy to build dashboards

4. **Flexibility** ✅
   - Can add per-event metadata (notes, waivers, etc.)
   - Can track event-level modifications
   - Can handle event-specific pricing logic

5. **Data Consistency** ✅
   - Can't have event in array without child_count
   - Database enforces relationships
   - No orphaned data

## Rollback Plans

### Before Phase 5 (Reversible):
If issues arise after Phase 4 but before Phase 5:

```sql
-- Can repopulate events and child_counts from registration_events
UPDATE registrations r
SET
  events = (
    SELECT ARRAY_AGG(te.event_type)
    FROM registration_events re
    JOIN tournament_events te ON re.tournament_event_id = te.id
    WHERE re.registration_id = r.id
  ),
  child_counts = (
    SELECT JSONB_OBJECT_AGG(te.event_type, re.child_count)
    FROM registration_events re
    JOIN tournament_events te ON re.tournament_event_id = te.id
    WHERE re.registration_id = r.id
  );

-- Revert application code
-- Drop registration_events table if needed
```

### After Phase 5 (Not Reversible):
Once Phase 5 is complete, old columns are gone. Recovery requires:
- Restore from database backup
- Extensive testing before re-attempting

**Prevention**: Wait 1-2 weeks between Phase 4 and Phase 5!

## Testing Checklist

### After Phase 4 Deployment:
- [ ] Run Phase 4 migration
- [ ] Verify all registrations have registration_events
- [ ] Check event_attendance_summary view works
- [ ] Old registration form still works (uses existing data)
- [ ] Deploy new Registration.js code
- [ ] Submit test registration with multiple events
- [ ] Verify registration_events records created correctly
- [ ] Check child counts stored properly per event
- [ ] Test with 0 children, 1 child, multiple children
- [ ] Monitor error logs for 48 hours

### After Phase 5 Deployment:
- [ ] Fresh database backup taken
- [ ] Run Phase 5 migration
- [ ] Verify columns dropped
- [ ] Test registration form still works
- [ ] Submit test registration
- [ ] Check admin dashboard (if applicable)
- [ ] Verify event_attendance_summary view still works
- [ ] Monitor logs for 48 hours

## Summary

Phases 4-5 complete the database normalization by moving from arrays and JSONB to a proper join table structure. This provides:
- Better data integrity
- Easier queries
- Improved reporting
- More flexibility for future features

Combined with Phases 1-3 (contacts table), the database is now fully normalized and follows best practices for relational database design.
