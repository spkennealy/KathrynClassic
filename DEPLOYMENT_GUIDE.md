# Deployment Guide - Domain-Based Routing

This app supports two separate domains using the same codebase:
- **www.kathrynclassic.com** - Public site
- **admin.kathrynclassic.com** - Admin portal

## How It Works

The app detects which domain you're on and shows different content:

- **Public domain** (`www.` or no subdomain):
  - Shows Home, Schedule, Registration, Leaderboard, etc.
  - Redirects `/admin/*` routes to admin subdomain

- **Admin domain** (`admin.` subdomain):
  - Shows only admin login and admin routes
  - Redirects root `/` to `/admin/login`
  - Redirects other routes to public site

## Testing Locally

### Option 1: Edit Your Hosts File (Recommended)

1. **Edit hosts file:**
   ```bash
   # Mac/Linux
   sudo nano /etc/hosts

   # Windows
   # Open C:\Windows\System32\drivers\etc\hosts as Administrator
   ```

2. **Add these lines:**
   ```
   127.0.0.1 www.kathrynclassic.local
   127.0.0.1 admin.kathrynclassic.local
   ```

3. **Start the dev server:**
   ```bash
   npm start
   ```

4. **Access the sites:**
   - Public: http://www.kathrynclassic.local:3000
   - Admin: http://admin.kathrynclassic.local:3000

### Option 2: Use Localhost Subdomains

Some systems support `*.localhost` automatically:

- Public: http://localhost:3000
- Admin: http://admin.localhost:3000

If this doesn't work, use Option 1.

### Option 3: Test with Environment Variable (Quick Test)

You can temporarily force admin mode for testing:

```javascript
// In App.js, change line 31 to:
setIsAdminSite(hostname.startsWith('admin.') || process.env.REACT_APP_FORCE_ADMIN === 'true');
```

Then run:
```bash
REACT_APP_FORCE_ADMIN=true npm start
```

## Deploying to Vercel

### Step 1: Prepare Your Repository

Commit and push all changes:
```bash
git add .
git commit -m "Add domain-based routing for public/admin sites"
git push
```

### Step 2: Deploy Public Site

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Configure:
   - **Project Name**: `kathryn-classic-public`
   - **Framework Preset**: Create React App
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
5. Click **"Deploy"**
6. After deployment, add custom domain:
   - Go to **Settings** → **Domains**
   - Add `www.kathrynclassic.com`
   - Follow DNS configuration instructions

### Step 3: Deploy Admin Site

1. In Vercel Dashboard, click **"Add New Project"** again
2. Import the **same** GitHub repository
3. Configure:
   - **Project Name**: `kathryn-classic-admin`
   - **Framework Preset**: Create React App
   - **Root Directory**: `./` (same as public)
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
4. Click **"Deploy"**
5. After deployment, add custom domain:
   - Go to **Settings** → **Domains**
   - Add `admin.kathrynclassic.com`
   - Follow DNS configuration instructions

### Step 4: Environment Variables (Optional)

If you need different Supabase configs for each site:

**Public Site:**
- Add environment variables in Vercel project settings
- Prefix with `REACT_APP_`

**Admin Site:**
- Same variables (unless you want separate Supabase projects)

### Step 5: Configure DNS

In your domain registrar (e.g., GoDaddy, Namecheap):

1. **For www.kathrynclassic.com:**
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

2. **For admin.kathrynclassic.com:**
   ```
   Type: CNAME
   Name: admin
   Value: cname.vercel-dns.com
   ```

Vercel will handle SSL certificates automatically!

## Automatic Redirects

The app includes smart redirects:

**On Public Site (www):**
- Visiting `/admin/login` → Redirects to `admin.kathrynclassic.com/admin/login`

**On Admin Site (admin):**
- Visiting `/` → Redirects to `/admin/login`
- Visiting `/schedule` → Redirects to `www.kathrynclassic.com/schedule`

## Future Updates

When you push code changes to GitHub:
- Vercel automatically rebuilds and deploys BOTH sites
- No need to deploy separately
- Both sites stay in sync

## Troubleshooting

### Admin routes not working locally
- Check that you're using `admin.localhost:3000` or have edited hosts file
- Check browser console for "Is admin site: true"

### Redirects not working
- Clear browser cache
- Check that domain detection is working (see console logs)

### Build fails on Vercel
- Ensure all dependencies are in `package.json`
- Check build logs in Vercel dashboard

## Security Notes

- Admin authentication is handled by Supabase (secure)
- Row Level Security (RLS) protects all data
- Even if someone accesses admin routes, they can't see data without auth
- Admin code is in the bundle but protected by authentication
