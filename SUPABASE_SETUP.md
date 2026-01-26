# Supabase Setup Instructions for Kathryn Classic

This guide will help you set up Supabase as the database for your Kathryn Classic website.

## Step 1: Create a Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" and sign up with GitHub or email
3. It's completely free for the tier we need!

## Step 2: Create a New Project

1. Once logged in, click "New Project"
2. Choose your organization (or create a new one)
3. Fill in the project details:
   - **Project Name**: kathryn-classic (or any name you prefer)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose the region closest to your users
   - **Pricing Plan**: Free tier is perfect for this project
4. Click "Create new project"
5. Wait a few minutes for the project to be set up

## Step 3: Get Your Project Credentials

1. In your Supabase dashboard, go to **Settings** (gear icon in left sidebar)
2. Click on **API** in the settings menu
3. You'll see two important values:
   - **Project URL** (looks like: `https://abcdefghijk.supabase.co`)
   - **anon public** key (under "Project API keys")
4. Keep this page open - you'll need these values in the next step

## Step 4: Configure Environment Variables

1. Create a `.env` file in your project root (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and add your Supabase credentials:
   ```
   REACT_APP_SUPABASE_URL=your_project_url_here
   REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here
   ```

3. Replace `your_project_url_here` with your **Project URL**
4. Replace `your_anon_key_here` with your **anon public** key

**IMPORTANT**: Never commit the `.env` file to git! It's already in `.gitignore`.

## Step 5: Create Database Tables

1. In your Supabase dashboard, click on **SQL Editor** (in left sidebar)
2. Click "New query"
3. Copy the entire contents of `supabase-schema.sql` file
4. Paste it into the SQL editor
5. Click "Run" (or press Cmd/Ctrl + Enter)
6. You should see "Success. No rows returned" - this is good!

This creates:
- **registrations** table - stores tournament registrations
- **donations** table - stores donations and sponsorships
- Indexes for faster queries
- Row Level Security (RLS) policies for data protection
- Helpful views for reporting

## Step 6: Verify Tables Were Created

1. In your Supabase dashboard, click on **Table Editor** (database icon)
2. You should see two tables:
   - `registrations`
   - `donations`
3. Click on each table to verify the columns are correct

## Step 7: Test Your Setup

1. Start your development server:
   ```bash
   npm start
   ```

2. Navigate to the Registration page and fill out the form
3. Submit the form
4. Go back to Supabase **Table Editor** → **registrations**
5. You should see your test registration!

## Step 8: View Your Data

You can view all registrations and donations in the Supabase dashboard:

1. **Table Editor** - View, edit, and delete records
2. **SQL Editor** - Run custom queries for reporting

### Example Queries

View all registrations:
```sql
SELECT * FROM registrations ORDER BY created_at DESC;
```

View registration summary:
```sql
SELECT * FROM registration_summary;
```

View donation summary by type:
```sql
SELECT * FROM donation_summary;
```

Count registrations by event:
```sql
SELECT
  unnest(events) as event_name,
  COUNT(*) as registrations
FROM registrations
GROUP BY event_name
ORDER BY registrations DESC;
```

## Security Notes

✅ **What's Secure:**
- Row Level Security (RLS) is enabled
- Public users can only INSERT data (submit registrations/donations)
- Only authenticated admin users can view the data
- Your database password and API keys are in environment variables (not in code)

✅ **Best Practices:**
- Never commit `.env` file to version control
- Keep your database password secure
- Use the anon key for public operations (already configured)
- Log in to Supabase dashboard to view/manage data

## Accessing Your Data as an Admin

To view registrations and donations, simply log in to your Supabase dashboard. You don't need to build an admin panel (though you can if you want to later).

## Free Tier Limits

The Supabase free tier includes:
- 500 MB database space
- 50,000 monthly active users
- 2 GB bandwidth
- 1 GB file storage

This is more than enough for a tournament website!

## Troubleshooting

### "Failed to submit registration"
- Check that your `.env` file has the correct credentials
- Verify you ran the SQL schema to create tables
- Check browser console for detailed error messages
- Verify your Supabase project is active

### "relation 'registrations' does not exist"
- You need to run the `supabase-schema.sql` in the SQL Editor
- Make sure the query ran successfully

### Can't see data in Supabase
- Make sure you're looking at the correct project
- Check the Table Editor, not the API Docs
- Refresh the page

## Next Steps

1. Test both registration and donation forms
2. Check that data appears in Supabase
3. Set up email notifications (optional - can be done later)
4. Add admin authentication if you want a custom admin panel

## Support

If you have issues:
1. Check the Supabase logs in your dashboard (Logs & Analytics)
2. Check browser console for errors
3. Verify environment variables are loaded (restart dev server after changing .env)

Congratulations! Your database is now set up and ready to store registrations and donations! 🎉
