# Database Architecture - Contacts Table Refactoring

## Before: Duplicated Contact Data

```
┌─────────────────────────────────────┐
│         REGISTRATIONS               │
├─────────────────────────────────────┤
│ id (PK)                             │
│ first_name          ◄───────────────┼─── DUPLICATED
│ last_name           ◄───────────────┼─── DUPLICATED
│ email               ◄───────────────┼─── DUPLICATED
│ phone               ◄───────────────┼─── DUPLICATED
│ events                              │
│ golf_handicap                       │
│ preferred_teammates                 │
│ team_group_id                       │
│ child_counts                        │
│ tournament_id (FK)                  │
│ payment_status                      │
│ emergency_contact_name              │
│ emergency_contact_phone             │
│ dietary_restrictions                │
│ total_amount                        │
│ created_at                          │
│ updated_at                          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│           DONATIONS                 │
├─────────────────────────────────────┤
│ id (PK)                             │
│ first_name          ◄───────────────┼─── DUPLICATED
│ last_name           ◄───────────────┼─── DUPLICATED
│ email               ◄───────────────┼─── DUPLICATED
│ phone               ◄───────────────┼─── DUPLICATED
│ company                             │
│ donation_type                       │
│ amount                              │
│ message                             │
│ is_anonymous                        │
│ created_at                          │
│ updated_at                          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│       TOURNAMENT_AWARDS             │
├─────────────────────────────────────┤
│ id (PK)                             │
│ tournament_id (FK)                  │
│ award_category                      │
│ winner_name         ◄───────────────┼─── No structured contact link
│ details                             │
│ hole_number                         │
│ distance                            │
│ created_at                          │
└─────────────────────────────────────┘
```

### Problems with Old Architecture
❌ Contact information duplicated across multiple tables
❌ Updates to contact info don't propagate
❌ Can't track person across registrations/donations
❌ Data inconsistency (same email, different names)
❌ Wasted storage space
❌ Complex queries to find unique people

---

## After: Centralized Contacts Table

```
                    ┌─────────────────────────────────┐
                    │          CONTACTS               │
                    ├─────────────────────────────────┤
                    │ id (PK)                         │
                    │ first_name                      │
                    │ last_name                       │
                    │ email (UNIQUE)                  │
                    │ phone                           │
                    │ created_at                      │
                    │ updated_at                      │
                    └─────────────────────────────────┘
                              ▲   ▲   ▲
                              │   │   │
              ┌───────────────┘   │   └─────────────────┐
              │                   │                     │
              │                   │                     │
┌─────────────┴─────────┐  ┌──────┴──────────┐  ┌──────┴──────────────┐
│    REGISTRATIONS      │  │   DONATIONS     │  │  TOURNAMENT_AWARDS  │
├───────────────────────┤  ├─────────────────┤  ├─────────────────────┤
│ id (PK)               │  │ id (PK)         │  │ id (PK)             │
│ contact_id (FK) ──────┼──┤ contact_id (FK) │  │ contact_id (FK)     │
│ events                │  │ company         │  │ winner_name (kept!) │
│ golf_handicap         │  │ donation_type   │  │ tournament_id (FK)  │
│ preferred_teammates   │  │ amount          │  │ award_category      │
│ team_group_id         │  │ message         │  │ details             │
│ child_counts          │  │ is_anonymous    │  │ hole_number         │
│ tournament_id (FK)    │  │ created_at      │  │ distance            │
│ payment_status        │  │ updated_at      │  │ created_at          │
│ created_at            │  └─────────────────┘  └─────────────────────┘
│ updated_at            │
└───────────────────────┘
```

### Benefits of New Architecture
✅ Contact info stored once, referenced by ID
✅ Updates to contact propagate everywhere automatically
✅ Easy to track person across multiple activities
✅ Consistent data (email is unique)
✅ Reduced storage space
✅ Simple queries for contact history
✅ Awards support both contact links AND external winners

---

## Data Flow: Registration Submission

### Old Flow
```
User submits form
    ↓
Store ALL contact data + registration data
    ↓
Done (contact data duplicated on every registration)
```

### New Flow
```
User submits form
    ↓
Extract unique emails from form
    ↓
Batch lookup: Do contacts exist for these emails?
    ↓
    ├─ New emails: Create new contacts
    │       ↓
    │   Get new contact IDs
    │
    └─ Existing emails: Update contacts with latest info
            ↓
        Get existing contact IDs
    ↓
Create registrations referencing contact_ids
    ↓
Done
```

---

## Key Relationships

### Registrations → Contacts
- **Cardinality**: Many registrations to One contact
- **Delete behavior**: CASCADE (if contact deleted, registrations deleted)
- **Constraint**: contact_id is NOT NULL (after Phase 3)
- **Use case**: Track all tournaments a person registered for

```sql
SELECT c.first_name, c.last_name, c.email,
       COUNT(r.id) as total_registrations,
       ARRAY_AGG(DISTINCT t.year) as years_attended
FROM contacts c
JOIN registrations r ON r.contact_id = c.id
JOIN tournaments t ON r.tournament_id = t.id
GROUP BY c.id;
```

### Donations → Contacts
- **Cardinality**: Many donations to One contact
- **Delete behavior**: SET NULL (donation preserved even if contact deleted)
- **Constraint**: contact_id is nullable (donations can exist without contacts)
- **Use case**: Track donation history per person

```sql
SELECT c.first_name, c.last_name,
       COUNT(d.id) as donation_count,
       SUM(d.amount) as total_donated
FROM contacts c
JOIN donations d ON d.contact_id = c.id
GROUP BY c.id
ORDER BY total_donated DESC;
```

### Tournament Awards → Contacts
- **Cardinality**: Many awards to One contact
- **Delete behavior**: SET NULL (award preserved even if contact deleted)
- **Constraint**: contact_id is nullable (supports external winners)
- **Use case**: Track awards won by registered participants

```sql
SELECT ta.award_category,
       COALESCE(c.first_name || ' ' || c.last_name, ta.winner_name) as winner,
       c.email,
       CASE WHEN c.id IS NOT NULL THEN 'Registered' ELSE 'External' END as type
FROM tournament_awards ta
LEFT JOIN contacts c ON ta.contact_id = c.id
WHERE ta.tournament_id = 'some-uuid';
```

**Why keep winner_name?**
Supports external/historical winners who never registered:
- Guest players
- Winners before contact system existed
- Team names (e.g., "Team Eagle")
- Historical data migration

---

## Performance Optimization

### Indexes Created

```
CONTACTS TABLE:
  idx_contacts_email (UNIQUE)     ← Fast email lookups during registration
  idx_contacts_name               ← Fast name-based searches
  idx_contacts_created_at         ← Chronological queries

FOREIGN KEY INDEXES:
  idx_registrations_contact_id    ← Fast joins to contacts
  idx_donations_contact_id        ← Fast joins to contacts
  idx_tournament_awards_contact_id ← Fast joins to contacts
```

### Query Optimization

**Before**: Find all activities for john@example.com
```sql
-- 3 separate queries, no connection between records
SELECT * FROM registrations WHERE email = 'john@example.com';
SELECT * FROM donations WHERE email = 'john@example.com';
SELECT * FROM tournament_awards WHERE winner_name LIKE '%John%';
```

**After**: Find all activities for john@example.com
```sql
-- 1 query with joins
SELECT c.*, r.*, d.*, ta.*
FROM contacts c
LEFT JOIN registrations r ON r.contact_id = c.id
LEFT JOIN donations d ON d.contact_id = c.id
LEFT JOIN tournament_awards ta ON ta.contact_id = c.id
WHERE c.email = 'john@example.com';
```

---

## Migration Safety

### Phase 1: Non-breaking
- Adds new table and columns
- Existing queries still work
- Can deploy immediately

### Phase 2: Non-breaking
- Populates new columns
- Old columns still exist
- Can deploy immediately

### Phase 3: Breaking
- Drops old columns
- Old queries will FAIL
- ⚠️ Must deploy new code first
- ⚠️ Must wait 1-2 weeks after Phase 2

---

## RLS (Row Level Security) Policies

### Contacts Table
```sql
-- Public can INSERT (for registration form submissions)
CREATE POLICY "Allow public to insert contacts"
ON contacts FOR INSERT TO anon WITH CHECK (true);

-- Authenticated users can SELECT (for admin dashboard)
CREATE POLICY "Allow authenticated users to view contacts"
ON contacts FOR SELECT TO authenticated USING (true);

-- Authenticated users can UPDATE (for admin corrections)
CREATE POLICY "Allow authenticated users to update contacts"
ON contacts FOR UPDATE TO authenticated USING (true);
```

Matches the existing pattern for registrations and donations tables.

---

## Contact Update Strategy

When user re-registers with same email:

```javascript
// Check if contact exists
const existingContact = await lookupByEmail(email);

if (existingContact) {
  // ALWAYS update with latest info
  await updateContact(existingContact.id, {
    first_name: latestFirstName,
    last_name: latestLastName,
    phone: latestPhone,
    updated_at: now()
  });
} else {
  // Create new contact
  await createContact({...});
}
```

**Rationale**: Per user preference, latest registration data is always considered most accurate. This handles:
- Phone number updates
- Name corrections (married/changed names)
- Data quality improvements

---

## Future Extensions

### Easy to Add
- ✅ Email preferences (subscribe/unsubscribe)
- ✅ Communication history
- ✅ VIP/returning attendee flags
- ✅ Attendance patterns analysis
- ✅ Contact segments (frequent donors, multi-year attendees, etc.)

### Example: Add email preferences
```sql
ALTER TABLE contacts
ADD COLUMN email_notifications BOOLEAN DEFAULT true,
ADD COLUMN marketing_emails BOOLEAN DEFAULT true;
```

This affects only the contacts table, not registrations or donations.

---

## Comparison: Storage & Queries

### Storage Space

**Before**:
- Registrations: 200 bytes × 100 records = 20,000 bytes
- Donations: 200 bytes × 50 records = 10,000 bytes
- Total: 30,000 bytes of duplicated contact data

**After**:
- Contacts: 150 bytes × 60 unique people = 9,000 bytes
- Foreign keys: 16 bytes × 150 records = 2,400 bytes
- Total: 11,400 bytes (62% reduction!)

### Query Performance

**Before**: Find person's complete history
- 3 separate queries (registrations, donations, awards)
- Manual matching by email/name
- Inconsistent data handling

**After**: Find person's complete history
- 1 query with LEFT JOINs
- Guaranteed consistency
- Indexed lookups

---

## Summary

The contacts table refactoring creates a normalized, efficient database structure that:
- Eliminates data duplication
- Enables cross-table tracking
- Improves data consistency
- Reduces storage requirements
- Simplifies queries
- Supports future extensions

All while maintaining backward compatibility during the migration process.
