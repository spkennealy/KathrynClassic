# Supabase Invite User Setup - 2026 Updated Guide

## Overview
This guide shows how to manually add users in Supabase and have them create their own password using the built-in `inviteUserByEmail()` method.

## Step 1: Configure Redirect URL in Supabase

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add your Set Password page URL to **Redirect URLs**:
   ```
   http://localhost:3000/admin/set-password
   ```
3. For production, also add:
   ```
   https://admin.kathrynclassic.com/admin/set-password
   ```

## Step 2: Configure Email Template (Optional but Recommended)

1. Go to Supabase Dashboard → Authentication → Email Templates
2. Find the "Invite user" template
3. Make sure the confirmation URL button uses:
   ```html
   <a href="{{ .ConfirmationURL }}">Accept Invite</a>
   ```

   This automatically includes the access_token and refresh_token.

## Step 3: Invite a User

You have two options:

### Option A: Using Supabase Dashboard (Manual)

1. Go to Authentication → Users
2. Click "Invite user" button
3. Enter email address
4. Set redirect URL: `http://localhost:3000/admin/set-password`
5. Click "Send invite"

### Option B: Using API (Programmatic)

Create a server-side function (Node.js, Next.js API route, etc.):

```javascript
import { createClient } from '@supabase/supabase-js'

// Use service_role key (NEVER expose this in browser!)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function inviteAdmin(email) {
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: 'http://localhost:3000/admin/set-password',
      data: {
        role: 'admin' // optional metadata
      }
    }
  )

  if (error) {
    console.error('Error inviting user:', error)
    return { error }
  }

  console.log('User invited:', data)
  return { data }
}

// Example usage
inviteAdmin('admin@example.com')
```

## Step 4: User Sets Password

When the user clicks the invite link in their email:

1. They're redirected to `/admin/set-password`
2. The URL contains tokens in the hash: `#access_token=...&refresh_token=...&type=invite`
3. Supabase client automatically detects these tokens (implicit flow)
4. The session is established automatically
5. User can now set their password using `updateUser()`

## How It Works

The updated `SetPassword.js` component:
- Waits for Supabase to automatically process URL hash tokens
- Listens for auth state changes
- Once session is established, allows password setting
- Uses `supabase.auth.updateUser({ password })` to save the password

## Troubleshooting

### Issue: "User from sub claim in JWT does not exist"

This error means the user record doesn't exist in Supabase Auth. Common causes:

1. **Email confirmation is required** - Check Authentication → Providers → Email:
   - Make sure "Confirm email" is DISABLED for invite flow
   - Or set "Enable email confirmations" to false in your config

2. **User was deleted** - Check Authentication → Users to verify the user exists

3. **Invite link expired** - Default expiry is 24 hours. Send a fresh invite.

4. **Wrong project** - Make sure your REACT_APP_SUPABASE_URL matches the dashboard you're using

### Issue: Session not detected

1. Check browser console for errors
2. Verify redirect URL is configured in Supabase Dashboard
3. Make sure URL uses path routing (not hash routing like `/#/page`)
4. Check that Supabase client is initialized before component mounts

### Issue: "Invalid Refresh Token: Already Used"

The refresh token can only be used once. If you get this error:
1. Send a fresh invite to the user
2. Have them click the NEW link (old links won't work)

## Testing Checklist

- [ ] Redirect URL added to Supabase Dashboard
- [ ] Email template uses `{{ .ConfirmationURL }}`
- [ ] Email confirmation disabled (or properly configured)
- [ ] User invited via Dashboard or API
- [ ] User receives email
- [ ] Click invite link redirects to set password page
- [ ] Session detected (user email shows on page)
- [ ] Password form submits successfully
- [ ] Redirect to /admin works
- [ ] User can login with new password

## Production Deployment

When deploying to `admin.kathrynclassic.com`:

1. Add production URL to Supabase redirect URLs
2. Update invite redirectTo parameter to use production URL
3. Keep invite flow private (no signup link on public site)
4. Only invite trusted administrators

## References

- [Supabase inviteUserByEmail Documentation](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)
- [Password-based Auth Guide](https://supabase.com/docs/guides/auth/passwords)
- [Set password after email invite Discussion](https://github.com/orgs/supabase/discussions/20333)
- [Invite email template configuration](https://github.com/orgs/supabase/discussions/21097)
