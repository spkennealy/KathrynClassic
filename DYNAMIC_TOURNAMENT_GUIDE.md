# Dynamic Tournament Data Guide

## Overview

The Kathryn Classic website now automatically pulls tournament information from the database. The system intelligently determines which tournament year to display based on the current date and available data.

---

## How It Works

### Automatic Year Selection Logic

The system follows this logic to determine which tournament to display:

1. **Current Year Active**: If the current year's tournament exists and hasn't ended yet → Show current year
2. **Current Year Passed**: If current year tournament has passed → Show next year's tournament
3. **Next Year Not Available**: If next year doesn't exist → Fall back to most recent past tournament
4. **New Year Rollover**: At the start of each year, automatically checks for new tournament data

**Example:**
- **Date: August 1, 2025** → Shows 2025 tournament (hasn't happened yet)
- **Date: September 15, 2025** → Shows 2026 tournament (2025 has passed)
- **Date: January 1, 2026** → Shows 2026 tournament (if it exists)

---

## Database Tables

### `tournaments`
Stores high-level tournament information for each year.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique identifier |
| `year` | INTEGER | Tournament year (2025, 2026, etc.) |
| `start_date` | DATE | First day of tournament |
| `end_date` | DATE | Last day of tournament |
| `total_raised` | DECIMAL | Total money raised (updated after event) |
| `total_attendees` | INTEGER | Number of attendees (updated after event) |
| `notes` | TEXT | Optional notes about the tournament |

### `tournament_events`
Stores individual events within each tournament.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique identifier |
| `tournament_id` | UUID | Links to tournaments table |
| `event_name` | TEXT | Display name (e.g., "Welcome Dinner") |
| `event_type` | TEXT | System identifier (e.g., "welcome_dinner") |
| `event_date` | DATE | Date of the event |
| `start_time` | TIME | Event start time |
| `end_time` | TIME | Event end time |
| `location` | TEXT | Event venue |
| `host` | TEXT | Event host name(s) |
| `adult_price` | DECIMAL | Price for adults |
| `child_price` | DECIMAL | Price for children |
| `description` | TEXT | Brief description |
| `details` | TEXT[] | Array of bullet points |

---

## Setting Up a New Tournament Year

### Step 1: Create Tournament Record

```sql
INSERT INTO tournaments (year, start_date, end_date, total_raised, total_attendees, notes)
VALUES (
  2026,  -- New year
  '2026-09-11',  -- Start date
  '2026-09-12',  -- End date
  0,  -- Will be updated after tournament
  0,  -- Will be updated after tournament
  'Third annual Kathryn Classic tournament'
);
```

### Step 2: Add Tournament Events

After creating the tournament, get its ID:

```sql
SELECT id FROM tournaments WHERE year = 2026;
```

Then insert events (use the provided template or copy from the script):

```sql
INSERT INTO tournament_events (
  tournament_id,
  event_name,
  event_type,
  event_date,
  start_time,
  end_time,
  location,
  host,
  adult_price,
  child_price,
  description,
  details
)
SELECT
  t.id,
  'Welcome Dinner',
  'welcome_dinner',
  '2026-09-11'::date,
  '17:00:00'::time,
  '20:00:00'::time,
  'The Grill at Pine Mountain Lake',
  'Kierstyn Moore',
  80.00,  -- Updated price
  45.00,  -- Updated price
  'Join us for appetizers, drinks, and dinner',
  ARRAY[
    'Heavy appetizers and open bar',
    'Welcome remarks',
    'Dinner served',
    'Tournament overview and instructions'
  ]
FROM tournaments t
WHERE t.year = 2026;

-- Repeat for other events...
```

### Step 3: Verify Data

```sql
-- Check tournament
SELECT * FROM tournaments WHERE year = 2026;

-- Check events
SELECT
  te.event_name,
  te.event_date,
  te.start_time,
  te.adult_price,
  te.child_price
FROM tournament_events te
JOIN tournaments t ON te.tournament_id = t.id
WHERE t.year = 2026
ORDER BY te.event_date, te.start_time;
```

---

## Where Tournament Data Appears

### 1. Home Page (`/`)
- Displays tournament dates in the header badge
- Example: "September 11-12, 2026"

### 2. Schedule Page (`/schedule`)
- Shows full event schedule with dates, times, locations
- Displays host information
- Lists event details
- Shows page title with year: "2026 Tournament Schedule"

### 3. Registration Page (`/registration`)
- Displays available events with pricing
- Shows separate adult/child pricing
- Page title includes year: "Register for The Kathryn Classic 2026"
- Links registrations to specific tournament in database
- Calculates total based on selected events and attendee types

### 4. History Page (`/history`)
- Shows past tournament results
- Displays total raised, attendees, and awards
- Year selector to view different tournaments

---

## Updating Pricing

To update event prices for a specific year:

```sql
UPDATE tournament_events
SET
  adult_price = 85.00,
  child_price = 45.00
WHERE tournament_id = (SELECT id FROM tournaments WHERE year = 2026)
  AND event_type = 'welcome_dinner';
```

To update multiple events at once:

```sql
-- Update all events for 2026 with a 10% increase
UPDATE tournament_events
SET
  adult_price = adult_price * 1.10,
  child_price = child_price * 1.10
WHERE tournament_id = (SELECT id FROM tournaments WHERE year = 2026);
```

---

## Updating After Tournament

After the tournament concludes, update the summary data:

```sql
UPDATE tournaments
SET
  total_raised = 15750.00,  -- Actual amount raised
  total_attendees = 92  -- Actual number of attendees
WHERE year = 2025;
```

---

## Testing the System

### Test Scenario 1: View Current Tournament
1. Navigate to the home page
2. Verify the correct year and dates are displayed
3. Check that the schedule page shows the same tournament
4. Verify registration shows the correct events and pricing

### Test Scenario 2: Add New Year
1. Create a new tournament for next year in Supabase
2. Add events for that tournament
3. Refresh the website
4. After the current tournament ends, verify the site automatically switches to the new year

### Test Scenario 3: No Future Data
1. Remove or comment out future tournament data
2. Verify the site falls back to showing the most recent past tournament
3. Confirm registration message indicates no current registration available

---

## Common Tasks

### Change Event Details
```sql
UPDATE tournament_events
SET
  location = 'New Venue Name',
  host = 'Updated Host Name'
WHERE tournament_id = (SELECT id FROM tournaments WHERE year = 2026)
  AND event_type = 'golf_tournament';
```

### Add Event Detail Bullet Point
```sql
UPDATE tournament_events
SET
  details = array_append(details, 'New detail point here')
WHERE tournament_id = (SELECT id FROM tournaments WHERE year = 2026)
  AND event_type = 'beach_day';
```

### Update Tournament Dates
```sql
UPDATE tournaments
SET
  start_date = '2026-09-18',
  end_date = '2026-09-19'
WHERE year = 2026;

-- Also update event dates
UPDATE tournament_events
SET event_date = '2026-09-18'
WHERE tournament_id = (SELECT id FROM tournaments WHERE year = 2026)
  AND event_type = 'welcome_dinner';
```

---

## Troubleshooting

### Site Shows Wrong Year
**Problem**: Website displays last year's tournament instead of current year

**Solution**:
1. Check if current year tournament exists in database
2. Verify tournament dates are correct
3. Check browser console for errors
4. Clear browser cache and refresh

### Registration Not Available
**Problem**: Registration page shows "not currently available" message

**Solution**:
1. Verify tournament record exists for the target year
2. Confirm events are linked to the correct tournament_id
3. Check that event_type values match expected format

### Prices Not Showing Correctly
**Problem**: Registration shows wrong prices

**Solution**:
1. Query the tournament_events table to verify prices
2. Ensure adult_price and child_price are set correctly
3. Check that event_type matches between events and registration

---

## Best Practices

1. **Set Up New Year in Advance**: Create next year's tournament 2-3 months before current tournament ends
2. **Keep Pricing Consistent**: Update all events when changing pricing structure
3. **Test Before Tournament**: Verify all data is correct well before registration opens
4. **Update Totals Promptly**: Add final amounts raised and attendees within a week of tournament
5. **Archive Old Data**: Keep past tournament data in the database for the History page

---

## Files Modified

- `src/utils/tournamentUtils.js` - Helper functions for tournament data
- `src/components/Registration/Registration.js` - Dynamic event loading
- `src/components/Schedule/Schedule.js` - Dynamic schedule display
- `src/components/Home/Home.js` - Dynamic tournament dates
- `populate-2025-events.sql` - Script to populate event data

---

## Support

If you encounter issues:
1. Check Supabase dashboard for data accuracy
2. Review browser console for JavaScript errors
3. Verify SQL queries run without errors
4. Test with different tournament years to isolate the issue

---

## Summary

✅ Tournament data is now fully dynamic and database-driven
✅ Automatically switches to next year after current tournament ends
✅ Falls back to most recent data if future data unavailable
✅ Separate adult/child pricing pulled from database
✅ Easy to update through SQL queries
✅ No code changes needed to update tournament information

The website will now seamlessly transition between tournament years without any code modifications!
