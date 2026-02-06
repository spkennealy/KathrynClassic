# Admin Portal Implementation Guide

Complete guide to setting up and using the admin portal for Kathryn Classic.

## Step 1: Database Setup

Run the admin portal setup script:

```bash
# In Supabase SQL Editor, run:
admin-portal-setup.sql
```

This creates:
- ✅ RLS policies for authenticated admin access
- ✅ Dashboard views (tournament stats, event attendance, etc.)
- ✅ Helper functions for counts and statistics

## Step 2: Set Up Supabase Authentication

### Enable Email Authentication in Supabase

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable **Email** provider
3. Configure email templates (optional)

### Create Admin User

In Supabase SQL Editor:

```sql
-- Option 1: Sign up through Supabase Dashboard
-- Go to Authentication → Users → Invite User

-- Option 2: Create user via SQL (for development)
-- Note: This requires having the auth schema access
-- Typically done through Supabase Dashboard instead
```

**Recommended**: Use Supabase Dashboard → Authentication → Users → "Invite User"
- Enter your admin email
- They'll receive an invite link
- Set password on first login

## Step 3: Install Dependencies

```bash
npm install @supabase/auth-helpers-react
# or if not already installed:
# npm install @supabase/supabase-js
```

## Step 4: Create Admin Portal Components

### File Structure

```
src/
├── components/
│   ├── Admin/
│   │   ├── AdminLayout.js          # Main layout with nav
│   │   ├── AdminDashboard.js       # Stats dashboard
│   │   ├── AdminLogin.js           # Login page
│   │   ├── ProtectedRoute.js       # Auth guard
│   │   ├── Tournaments/
│   │   │   ├── TournamentList.js
│   │   │   ├── TournamentForm.js
│   │   │   └── TournamentDetail.js
│   │   ├── Events/
│   │   │   ├── EventList.js
│   │   │   ├── EventForm.js
│   │   │   └── EventDetail.js
│   │   ├── Registrations/
│   │   │   ├── RegistrationList.js
│   │   │   ├── RegistrationForm.js
│   │   │   └── RegistrationDetail.js
│   │   ├── Contacts/
│   │   │   ├── ContactList.js
│   │   │   ├── ContactForm.js
│   │   │   └── ContactDetail.js
│   │   └── Awards/
│   │       ├── AwardList.js
│   │       └── AwardForm.js
│   └── ...
├── hooks/
│   └── useAuth.js                  # Auth hook
└── contexts/
    └── AuthContext.js              # Auth context provider
```

## Step 5: Add Admin Routes

Update `App.js` or your router:

```javascript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminLogin from './components/Admin/AdminLogin';
import AdminLayout from './components/Admin/AdminLayout';
import AdminDashboard from './components/Admin/AdminDashboard';
import ProtectedRoute from './components/Admin/ProtectedRoute';
// ... import other admin components

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Registration />} />

        {/* Admin routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="tournaments" element={<TournamentList />} />
          <Route path="tournaments/new" element={<TournamentForm />} />
          <Route path="tournaments/:id" element={<TournamentDetail />} />
          <Route path="events" element={<EventList />} />
          <Route path="registrations" element={<RegistrationList />} />
          <Route path="contacts" element={<ContactList />} />
          <Route path="awards" element={<AwardList />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

## Step 6: Usage

### Admin Portal Access

1. Navigate to `/admin/login`
2. Sign in with admin credentials
3. Access admin dashboard at `/admin`

### Available Views

**Dashboard** (`/admin`)
- Tournament statistics
- Event attendance counts
- Registration overview
- Quick actions

**Tournaments** (`/admin/tournaments`)
- List all tournaments
- View/edit tournament details
- Create new tournaments
- See registration counts per tournament

**Events** (`/admin/events`)
- List all events
- View attendance (adults, children, total)
- Create/edit events
- See revenue per event

**Registrations** (`/admin/registrations`)
- List all registrations
- Filter by tournament, payment status
- Update payment status
- View full registration details with events

**Contacts** (`/admin/contacts`)
- List all contacts
- Search by name/email
- View registration history
- Update contact information

**Awards** (`/admin/awards`)
- List tournament awards
- Create/edit awards
- Link awards to contacts

## Database Views Available

### For Dashboard

```javascript
// Get tournament statistics
const { data } = await supabase
  .from('admin_tournament_stats')
  .select('*')
  .order('year', { ascending: false });

// Get event attendance
const { data } = await supabase
  .from('admin_event_attendance')
  .select('*')
  .eq('tournament_year', 2025);
```

### For Detail Views

```javascript
// Get full registration details
const { data } = await supabase
  .from('admin_registration_details')
  .select('*')
  .eq('tournament_year', 2025);

// Get contact activity
const { data } = await supabase
  .from('admin_contact_activity')
  .select('*')
  .order('last_registration_date', { ascending: false });

// Get golf teams
const { data } = await supabase
  .from('admin_golf_teams')
  .select('*')
  .eq('tournament_year', 2025);
```

## Security

### RLS Policies

All tables have RLS enabled with these rules:
- **Anonymous (public)**: Can INSERT registrations, contacts
- **Authenticated (admin)**: Can SELECT, INSERT, UPDATE (no DELETE)

### Best Practices

1. **Never expose admin credentials** in client code
2. **Use environment variables** for sensitive config
3. **Implement proper logout** functionality
4. **Session management** - tokens expire, handle refresh
5. **Validate data** on both client and server side

## Deployment Checklist

- [ ] Run `admin-portal-setup.sql` in production
- [ ] Create admin users in Supabase Dashboard
- [ ] Test authentication flow
- [ ] Verify RLS policies work correctly
- [ ] Test all CRUD operations
- [ ] Verify dashboard views show correct data
- [ ] Set up proper error handling
- [ ] Configure email templates for auth
- [ ] Set up password reset flow
- [ ] Document admin user management process

## Troubleshooting

### "Row-level security policy violation"
- Check that user is authenticated
- Verify RLS policies exist for the table
- Ensure authenticated role has proper permissions

### "Relation does not exist"
- Make sure admin-portal-setup.sql was run
- Check that views were created successfully
- Verify your Supabase client is initialized correctly

### Authentication not working
- Check Supabase URL and anon key are correct
- Verify email provider is enabled in Supabase
- Check browser console for auth errors
- Ensure cookies/local storage are enabled

## Next Steps

1. Customize dashboard to show your specific metrics
2. Add filtering and search to list views
3. Implement export functionality (CSV/Excel)
4. Add email notifications for new registrations
5. Create printable reports
6. Add bulk operations (bulk payment status update, etc.)
