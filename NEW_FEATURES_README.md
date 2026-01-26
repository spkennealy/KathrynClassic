# New Features Documentation

## Overview
This document outlines the new features added to The Kathryn Classic website, including database schema changes, tournament history, updated registration with terms & conditions, and separate pricing for adults and children.

---

## 1. Database Schema Updates

### New Tables Created

#### `tournaments`
Stores information about each year's tournament.

**Columns:**
- `id` (UUID) - Primary key
- `year` (INTEGER) - Tournament year (unique)
- `start_date` (DATE) - Tournament start date
- `end_date` (DATE) - Tournament end date
- `total_raised` (DECIMAL) - Total amount raised for CJD Foundation
- `total_attendees` (INTEGER) - Total number of attendees
- `notes` (TEXT) - Additional notes about the tournament
- `created_at` (TIMESTAMP) - Record creation timestamp

#### `tournament_events`
Stores individual events within each tournament (Welcome Dinner, Golf Tournament, Beach Day).

**Columns:**
- `id` (UUID) - Primary key
- `tournament_id` (UUID) - Foreign key to tournaments table
- `event_name` (TEXT) - Name of the event
- `event_type` (TEXT) - Type identifier ('welcome_dinner', 'golf_tournament', 'beach_day')
- `event_date` (DATE) - Date of the event
- `start_time` (TIME) - Start time
- `end_time` (TIME) - End time
- `location` (TEXT) - Event location
- `host` (TEXT) - Event host name(s)
- `adult_price` (DECIMAL) - Price for adults
- `child_price` (DECIMAL) - Price for children
- `description` (TEXT) - Event description
- `details` (TEXT[]) - Array of detail points
- `created_at` (TIMESTAMP) - Record creation timestamp

#### `tournament_awards`
Stores tournament winners and achievements.

**Columns:**
- `id` (UUID) - Primary key
- `tournament_id` (UUID) - Foreign key to tournaments table
- `award_category` (TEXT) - Category type ('tournament_winner', 'longest_drive', 'closest_to_pin', etc.)
- `winner_name` (TEXT) - Name of the winner
- `details` (TEXT) - Additional details about the achievement
- `hole_number` (INTEGER) - Hole number for hole-specific awards
- `distance` (TEXT) - Distance for distance-related awards
- `created_at` (TIMESTAMP) - Record creation timestamp

### Updated Tables

#### `registrations`
Added new columns:
- `tournament_id` (UUID) - Links registration to specific tournament
- `amount_paid` (DECIMAL) - Amount paid by registrant
- `payment_status` (TEXT) - Status: 'pending', 'paid', 'refunded'
- `payment_date` (TIMESTAMP) - Date payment was received
- `cancellation_date` (TIMESTAMP) - Date of cancellation (if applicable)
- `notes` (TEXT) - Additional notes about the registration

### Setting Up the Database

1. **Open Supabase Dashboard**
   - Go to https://supabase.com
   - Select your project

2. **Run the Schema SQL**
   - Click "SQL Editor" in the left sidebar
   - Open the file `tournament-database-schema.sql`
   - Copy and paste the entire contents
   - Click "Run"

3. **Add Sample Data** (Optional)
   - The script includes sample data for 2024 and 2025 tournaments
   - You can modify the INSERT statements to match your actual data
   - Uncomment the INSERT statements for events and awards after replacing `{tournament_id}` with actual UUIDs

---

## 2. Registration Updates

### Separate Adult and Child Pricing

Events now have different prices for adults and children:

| Event | Adult Price | Child Price |
|-------|-------------|-------------|
| Welcome Dinner | $75 | $40 |
| Golf Tournament | $150 | $75 |
| Beach Day | $65 | $35 |

These prices are configured in `/src/components/Registration/Registration.js` in the `events` array and can be easily updated.

### Terms & Conditions

Comprehensive terms and conditions have been added to the registration form, including:

1. **Payment Commitment**: Payment due 2 weeks before tournament (by August 29, 2025)
2. **Cancellation Policy**: Full refund if canceled more than 2 weeks in advance
3. **Event Participation**: Registration required, children must be supervised
4. **Assumption of Risk**: Standard liability disclaimer
5. **Weather & Schedule Changes**: Notification policy
6. **Photo & Media Release**: Consent for promotional use

Users must read and agree to all terms before submitting registration.

---

## 3. Tournament History Page

### Features

- **Year Selector**: Toggle between different tournament years
- **Tournament Summary**: Display total raised, attendees, and dates
- **Awards Display**: Show tournament winners, longest drive, closest to pin, etc.
- **Responsive Design**: Works beautifully on mobile and desktop

### Accessing the History Page

Navigate to: `https://yoursite.com/history`

Or click "History" in the navigation menu.

### Managing Tournament History

To add tournament results:

1. **Add Tournament Record**
   ```sql
   INSERT INTO tournaments (year, start_date, end_date, total_raised, total_attendees, notes)
   VALUES (2024, '2024-09-13', '2024-09-14', 12500.00, 78, 'Inaugural tournament!');
   ```

2. **Add Awards**
   ```sql
   -- Get the tournament_id first
   SELECT id FROM tournaments WHERE year = 2024;

   -- Then insert awards
   INSERT INTO tournament_awards (tournament_id, award_category, winner_name, details, hole_number, distance)
   VALUES
   ('tournament-id-here', 'tournament_winner', 'Team Smith', 'Winning score: 58', NULL, NULL),
   ('tournament-id-here', 'longest_drive', 'Mike Johnson', 'Hole 7', 7, '312 yards'),
   ('tournament-id-here', 'closest_to_pin', 'Sarah Williams', 'Hole 15 - Par 3', 15, '4 feet 2 inches');
   ```

### Award Categories

Predefined categories (with appropriate icons):
- `tournament_winner` - 🏆
- `longest_drive` - 💪
- `closest_to_pin` - 🎯
- You can add custom categories as needed

---

## 4. Navigation Updates

The "History" link has been added to:
- Main navigation bar (desktop and mobile)
- Footer

Navigation order:
1. Home
2. Schedule
3. Registration
4. History (NEW)
5. Donations
6. About

---

## 5. File Structure

New files added:
```
src/
  components/
    TournamentHistory/
      TournamentHistory.js       # Tournament history component
tournament-database-schema.sql   # Database schema for new tables
NEW_FEATURES_README.md          # This file
```

Modified files:
```
src/
  components/
    Registration/
      Registration.js            # Updated with terms, separate pricing
    Layout/
      Navbar.js                  # Added History link
      Footer.js                  # Added History link
  App.js                         # Added History route
```

---

## 6. Future Enhancements

Consider adding:
- Admin dashboard for managing tournament data
- Photo gallery from past tournaments
- Automated email confirmations with terms attached
- Payment tracking integration with Venmo/Zelle
- Real-time registration count display
- Event capacity limits

---

## 7. Testing Checklist

### Registration
- [ ] Adult registration with correct pricing
- [ ] Child registration with correct pricing
- [ ] Mixed adult/child registration calculates correctly
- [ ] Terms & conditions must be accepted
- [ ] Data saves to Supabase correctly

### Tournament History
- [ ] Displays past tournaments
- [ ] Year selector works
- [ ] Awards display correctly
- [ ] Handles empty data gracefully
- [ ] Formatting looks good on mobile and desktop

### Navigation
- [ ] History link appears in navbar
- [ ] History link appears in footer
- [ ] Active page highlighting works
- [ ] Mobile menu includes History

---

## 8. Support

For questions or issues:
- Check the Supabase dashboard for database errors
- Review browser console for frontend errors
- Ensure all SQL migrations ran successfully
- Verify environment variables are set correctly

---

## Summary

These updates provide:
✅ Comprehensive tournament history display
✅ Separate adult/child pricing
✅ Legal terms & conditions
✅ Enhanced database structure for future years
✅ Better data tracking for payments and cancellations

The website is now ready to handle multiple tournament years and showcase the impact of The Kathryn Classic!
