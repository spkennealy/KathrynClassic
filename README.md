# The Kathryn Classic

The Kathryn Classic is a website for an annual charity golf tournament. This single-page web application provides information about the tournament, schedule, registration, and donation options.

## Features

- Responsive design built with React and Tailwind CSS
- Masters-inspired branding and design
- Registration form for tournament events
- Donation options with various sponsorship levels
- Tournament schedule and information
- Mobile-friendly navigation

## Views

- **Home**: Landing page with tournament information and logo
- **Schedule**: Details about tournament weekend events
- **Registration**: Form to register for tournament events
- **Donations**: Options for donating to the tournament's charitable cause
- **About**: Information about the tournament history and committee

## Technologies Used

- React 18
- React Router 6
- Tailwind CSS
- Headless UI
- Heroicons
- Formik & Yup for form handling

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

### Development

Start the development server:

```bash
npm start
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Building for Production

Create a production build:

```bash
npm run build
```

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

## Database Backups

A GitHub Actions workflow (`.github/workflows/db-backup.yml`) runs **daily at ~3am PT** and uploads
two date-stamped files to an S3-compatible object storage bucket:

- `db/kathryn-YYYY-MM-DD.dump` — full Postgres dump (`pg_dump` custom format, pinned to v17 to match
  the remote database)
- `photos/kathryn-YYYY-MM-DD.tar.gz` — contents of the `event-photos` storage bucket
  (via `scripts/backup-photos.js`)

You can also trigger it manually from the repo's **Actions** tab → *Daily Database Backup* →
*Run workflow*.

### Required GitHub secrets

Set under **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|---|---|
| `SUPABASE_DB_URL` | Postgres **session pooler** connection string (port 5432, IPv4-reachable), incl. password — used by `pg_dump` |
| `SUPABASE_URL` | Project URL — used by the photos script |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — lets the photos script read the private bucket |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Object-storage credentials |
| `AWS_REGION` | Bucket region (e.g. `us-east-1`; use `auto` for Cloudflare R2) |
| `S3_BUCKET` | Destination bucket name |
| `S3_ENDPOINT` | *Only for R2 / Backblaze B2* — custom S3 endpoint URL. Omit for AWS S3. |

### Retention (30 days)

Set a **30-day expiration lifecycle rule** on the bucket at the storage provider (S3 / R2 / B2 all
support this). No pruning logic lives in the workflow — the provider expires old objects.

### Restoring from a backup

```bash
# Database — restore the dump into a target Postgres
pg_restore --clean --if-exists --no-owner -d "$TARGET_DB_URL" kathryn-YYYY-MM-DD.dump

# Photos — extract, then re-upload the files to the event-photos bucket
tar -xzf kathryn-YYYY-MM-DD.tar.gz -C ./restored-photos
```

## License

This project is licensed under the MIT License.
