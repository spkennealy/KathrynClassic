# Admin User Management Guide

## The Simple, Working Approach

The invite email flow has issues with token expiration and email prefetching. Instead, use this reliable method:

## Adding a New Admin User

### Step 1: Create User in Supabase Dashboard

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Click **"Add user"** → **"Create new user"**
3. Fill in the form:
   ```
   Email: admin@example.com
   Password: [Generate secure temporary password]
   Auto Confirm User: ✅ ENABLE THIS
   ```
4. Click **"Create user"**

### Step 2: Share Credentials Securely

Share the temporary password with the new admin through a secure channel:
- Phone call
- Secure messaging (Signal, encrypted email)
- In person
- Password manager shared vault

**DO NOT** send passwords via regular email or text message.

### Step 3: Admin Changes Their Password

1. New admin goes to: `http://localhost:3000/admin/login`
   - Production: `https://admin.kathrynclassic.com/admin/login`
2. Logs in with email and temporary password
3. Clicks **"Change Password"** in the navigation
4. Sets their own secure password

## Why This Approach Works

✅ **Immediate access** - No waiting for emails
✅ **No token expiration** - No time limits
✅ **No email issues** - No prefetching problems
✅ **Secure** - User changes password immediately
✅ **Simple** - Fewer steps, fewer failure points

## Password Requirements

- Minimum 6 characters
- Should be unique and complex
- Not reused from other accounts

## Revoking Admin Access

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Find the user
3. Click the **"..."** menu → **"Delete user"**
4. Confirm deletion

The user is immediately logged out and cannot access the admin portal.

## Security Best Practices

1. **Auto Confirm User**: Always enable this when creating admin users
2. **Temporary passwords**: Make them random and complex
3. **Change immediately**: Admin should change password on first login
4. **Secure sharing**: Never send passwords via unsecured channels
5. **Limited access**: Only create accounts for trusted administrators
6. **Regular audits**: Periodically review active admin users

## Troubleshooting

### User can't login
- Check the email is correct (no typos)
- Verify "Auto Confirm User" was enabled
- Check user exists in Supabase Dashboard
- Try resetting password using "Create new user" again

### "Invalid login credentials"
- Password may have been entered incorrectly
- User may have already changed their password
- Check caps lock is off

### User locked out
- Delete the user and create a new one with a fresh password
- Or use Supabase Dashboard to manually reset their password

## Change Password Feature

Located at `/admin/change-password`, this allows admins to:
- Change their password while logged in
- No email verification required
- Immediate effect

Admins can access this from the navigation bar (top right).

## Production Deployment Notes

When deploying to `admin.kathrynclassic.com`:
- Update login URLs in this guide
- Keep admin portal URL private (no links from public site)
- Only share admin portal URL with authorized users
- Use strong, unique passwords for all admin accounts

## Summary

**Creating admin users with passwords directly in Supabase Dashboard is the recommended approach.** It's simple, reliable, and avoids all the issues with email-based invite flows.
