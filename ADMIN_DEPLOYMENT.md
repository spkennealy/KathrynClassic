# Admin Portal Deployment - Subdomain Setup

Setting up admin.kathrynclassic.com as a separate, private admin portal.

## Architecture

```
www.kathrynclassic.com        → Public site (registration, info)
admin.kathrynclassic.com      → Private admin portal (invited users only)
```

**No links between the two sites** - completely separate deployments.

## Option 1: Separate Deployments (Recommended)

### Setup

1. **Create two separate deployments:**
   - `www.kathrynclassic.com` - Public site (current)
   - `admin.kathrynclassic.com` - Admin-only site

2. **Public site** (www):
   - Remove all admin routes
   - Only public pages: Home, About, Registration, Tournament History, etc.
   - No authentication required

3. **Admin site** (admin):
   - Only admin components
   - Requires authentication for all routes
   - Root redirects to login if not authenticated

### File Structure for Admin Site

```
admin-app/
├── src/
│   ├── App.js              # Admin routes only
│   ├── supabaseClient.js   # Same Supabase config
│   ├── contexts/
│   │   └── AuthContext.js
│   └── components/
│       └── Admin/
│           ├── AdminLogin.js
│           ├── AdminLayout.js
│           ├── AdminDashboard.js
│           └── ... (all admin components)
├── public/
│   └── index.html          # Admin title/meta
└── package.json
```

### Deployment Steps

#### Using Vercel

```bash
# Deploy public site
cd kathryn-classic
vercel --prod
# Set domain: www.kathrynclassic.com

# Deploy admin site
cd admin-app
vercel --prod
# Set domain: admin.kathrynclassic.com
```

#### Using Netlify

```bash
# Deploy public site
cd kathryn-classic
netlify deploy --prod
# Set custom domain: www.kathrynclassic.com

# Deploy admin site
cd admin-app
netlify deploy --prod
# Set custom domain: admin.kathrynclassic.com
```

## Option 2: Single Deployment with Subdomain

If you prefer a single codebase:

### 1. Update DNS

Add CNAME record:
```
admin.kathrynclassic.com → CNAME → your-app.vercel.app
```

### 2. Environment-based Routing

```javascript
// App.js
const isAdminSite = window.location.hostname.startsWith('admin.');

function App() {
  if (isAdminSite) {
    return <AdminApp />;
  }
  return <PublicApp />;
}

function AdminApp() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }>
            {/* Admin routes */}
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function PublicApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Registration />} />
        {/* Public routes only - NO admin routes */}
      </Routes>
    </BrowserRouter>
  );
}
```

### 3. Remove Admin Links from Public Site

**Do NOT include:**
- No "Admin" link in navigation
- No `/admin` routes
- No mention of admin portal in public pages

**Only admins know the URL exists**.

## Security Configuration

### 1. Supabase RLS

Already configured:
- Public (anon): Can only INSERT registrations/contacts
- Authenticated: Full admin access

### 2. robots.txt for Admin Site

```
# /public/robots.txt (admin site)
User-agent: *
Disallow: /

# Prevent search engines from indexing admin site
```

### 3. Invite-Only Access

In Supabase Dashboard:
1. Go to Authentication → Users
2. Click "Invite User"
3. Enter admin email
4. They receive invite link
5. Set password on first login

**Do not allow public signups** - only invited users.

### 4. Disable Public Signup

In Supabase Dashboard:
1. Go to Authentication → Providers → Email
2. **Disable** "Enable Email Signup"
3. Keep "Enable Email" provider enabled (for login)

This ensures:
- ✅ Existing admins can login
- ❌ New users cannot self-register
- ✅ Only invited users can access

## Deployment Checklist

- [ ] Run `admin-portal-setup.sql` in Supabase
- [ ] Deploy admin site to admin.kathrynclassic.com
- [ ] Deploy public site to www.kathrynclassic.com
- [ ] Configure DNS (CNAME records)
- [ ] Set up robots.txt for admin site
- [ ] Disable public signup in Supabase
- [ ] Create admin users via Supabase Dashboard
- [ ] Test authentication flow
- [ ] Verify admin site is not linked from public site
- [ ] Confirm RLS policies work correctly
- [ ] Test on mobile devices
- [ ] Set up SSL certificates (auto with Vercel/Netlify)

## Admin User Management

### Create New Admin

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Invite User"
3. Enter their email
4. They receive invitation email
5. They click link and set password
6. They can now access admin.kathrynclassic.com

### Revoke Admin Access

1. Go to Supabase Dashboard → Authentication → Users
2. Find the user
3. Click "..." menu → Delete user

## Testing

### Before Going Live

```bash
# Test admin site
1. Go to admin.kathrynclassic.com
2. Should redirect to /login
3. Login with admin credentials
4. Verify dashboard loads
5. Test each admin section
6. Verify RLS permissions work
7. Test logout

# Test public site
1. Go to www.kathrynclassic.com
2. Should NOT have any admin links
3. Should NOT be able to access /admin routes
4. Public registration should work
5. No authentication required
```

## Recommended Approach

**Option 1 (Separate Deployments)** is recommended because:
- ✅ Complete separation of concerns
- ✅ Easier to maintain
- ✅ Better security (admin code not in public bundle)
- ✅ Can use different configs/environments
- ✅ Smaller bundle sizes for public site

## Quick Start Commands

### For Separate Admin Deployment

```bash
# 1. Copy admin components to new project
mkdir admin-app
cd admin-app
npx create-react-app .

# 2. Copy these files/folders:
# - src/contexts/AuthContext.js
# - src/components/Admin/
# - src/supabaseClient.js
# - All admin dependencies

# 3. Update App.js to only have admin routes

# 4. Deploy
vercel --prod
# or
netlify deploy --prod

# 5. Set custom domain: admin.kathrynclassic.com
```

That's it! Your admin portal is now completely separate and private.
