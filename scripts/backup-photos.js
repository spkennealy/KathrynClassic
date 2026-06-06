/**
 * Downloads the entire `event-photos` Supabase Storage bucket into ./photos/,
 * preserving the bucket's folder structure. Intended to run in CI (GitHub Actions)
 * as part of the daily backup; the workflow tars up ./photos/ afterwards.
 *
 * Requires env vars:
 *   SUPABASE_URL                - project URL
 *   SUPABASE_SERVICE_ROLE_KEY   - service-role key (needed to read the private bucket)
 *
 * Exits non-zero on any error so the backup workflow fails loudly.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const BUCKET = 'event-photos';
const OUTPUT_DIR = path.join(__dirname, '..', 'photos');

// Trim to guard against secrets pasted with a trailing newline/space.
const rawUrl = (process.env.SUPABASE_URL || '').trim();
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!rawUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var.');
  process.exit(1);
}

// Reduce to the project origin (scheme + host). The Supabase client appends its own
// /storage/v1, /rest/v1, etc., so any path accidentally included in the secret
// (e.g. ".../rest/v1") must be stripped — otherwise storage calls get routed to
// PostgREST and fail with "Invalid path specified in request URL" (PGRST125).
let supabaseUrl;
try {
  const parsed = new URL(rawUrl);
  supabaseUrl = parsed.origin;
  if (parsed.pathname && parsed.pathname !== '/') {
    console.log(`Note: stripped stray path "${parsed.pathname}" from SUPABASE_URL.`);
  }
} catch {
  console.error(`SUPABASE_URL is not a valid URL: "${rawUrl}"`);
  process.exit(1);
}

// Non-sensitive diagnostics so a misconfigured secret is obvious in the CI log.
console.log(`SUPABASE_URL origin: ${supabaseUrl}`);
console.log(`Service key: length=${serviceRoleKey.length}, prefix="${serviceRoleKey.slice(0, 6)}…"`);

const supabase = createClient(supabaseUrl, serviceRoleKey);

// storage.list() is per-folder (not recursive); an entry with a null `id` is a folder.
// The root is listed with no prefix arg (matches the working call in EventForm.js).
async function walk(prefix = '') {
  const files = [];
  const pageSize = 100;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix || undefined, { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } });

    if (error) {
      throw new Error(`list "${prefix}": ${error.message} (status=${error.statusCode ?? '?'}, name=${error.name ?? '?'})`);
    }
    if (!data || data.length === 0) break;

    for (const entry of data) {
      if (entry.name === '.emptyFolderPlaceholder') continue;
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        // Folder — recurse into it.
        files.push(...(await walk(entryPath)));
      } else {
        files.push(entryPath);
      }
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return files;
}

async function downloadFile(objectPath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(objectPath);
  if (error) throw new Error(`download "${objectPath}": ${error.message}`);

  const destPath = path.join(OUTPUT_DIR, objectPath);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const buffer = Buffer.from(await data.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Listing bucket "${BUCKET}"...`);
  const files = await walk();
  console.log(`Found ${files.length} object(s). Downloading...`);

  let done = 0;
  for (const objectPath of files) {
    await downloadFile(objectPath);
    done += 1;
    if (done % 25 === 0 || done === files.length) {
      console.log(`  ${done}/${files.length}`);
    }
  }

  console.log(`Done. ${files.length} object(s) written to ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error('Photo backup failed:', err.message);
  process.exit(1);
});
