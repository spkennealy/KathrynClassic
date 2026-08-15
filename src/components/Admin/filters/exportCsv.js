// CSV export for the admin contact list. Nothing else in the app writes CSV, so
// this is the one place the escaping rules live.

import { formatPhone } from '../../../utils/phone';

const formatDate = (v) => (v ? new Date(v).toLocaleDateString('en-US') : '');
const joinList = (v) => (Array.isArray(v) ? v.join('; ') : v ?? '');

// One cell. Two separate concerns:
//   * RFC 4180 quoting, so a value containing a comma, quote or newline stays in
//     one column.
//   * Formula injection: Excel and Sheets execute a cell that starts with = + -
//     or @, so a contact who named themselves `=HYPERLINK(...)` would otherwise
//     run on the machine of whoever opens the export. Prefixing an apostrophe
//     makes it inert text.
const escapeCell = (value) => {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Columns are declared rather than derived so the export stays stable when the
// view gains columns.
export const CONTACT_CSV_COLUMNS = [
  { label: 'First Name', get: (r) => r.first_name },
  { label: 'Last Name', get: (r) => r.last_name },
  { label: 'Email', get: (r) => r.email },
  { label: 'Phone', get: (r) => formatPhone(r.phone) },
  { label: 'Total Registrations', get: (r) => r.total_registrations },
  { label: 'Tournaments Attended', get: (r) => r.tournaments_attended },
  { label: 'Tournament Years', get: (r) => joinList(r.tournament_years) },
  { label: 'Events', get: (r) => joinList(r.event_names) },
  { label: 'Children Registered', get: (r) => r.total_children },
  { label: 'Total Paid', get: (r) => r.total_amount_paid },
  { label: 'Payment Statuses', get: (r) => joinList(r.payment_statuses) },
  { label: 'Unpaid Registrations', get: (r) => r.unpaid_registrations },
  { label: 'Awards Won', get: (r) => r.awards_won },
  { label: 'Award Categories', get: (r) => joinList(r.award_categories) },
  { label: 'Award Years', get: (r) => joinList(r.award_years) },
  { label: 'First Registered', get: (r) => formatDate(r.first_registration_date) },
  { label: 'Last Registered', get: (r) => formatDate(r.last_registration_date) },
  { label: 'Created', get: (r) => formatDate(r.created_at) },
  { label: 'Unsubscribed From All', get: (r) => (r.unsubscribed_all ? 'Yes' : 'No') },
  { label: 'Unsubscribed Years', get: (r) => joinList(r.unsubscribed_years) },
];

export function toCsv(rows, columns = CONTACT_CSV_COLUMNS) {
  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => escapeCell(c.get(row))).join(','));
  // CRLF per the spec, and a BOM so Excel reads it as UTF-8 rather than mangling
  // accented names.
  return `\uFEFF${[header, ...body].join('\r\n')}`;
}

export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the click a tick to start the download before invalidating the URL.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const contactCsvFilename = () =>
  `contacts-${new Date().toISOString().slice(0, 10)}.csv`;

// PostgREST caps a single response (max-rows, 1000 on Supabase), so an export of
// the full filtered set has to page through.
export const EXPORT_CHUNK = 1000;
export const EXPORT_MAX = 20000;

// Separate, much smaller limit for `.in('contact_id', [...])` lookups: those ids
// travel in the URL, and 1000 UUIDs is roughly 37 KB — well past what servers
// accept. 100 keeps the request under ~4 KB.
export const ID_CHUNK = 100;

// `buildQuery(select)` must return an already-filtered PostgREST query.
export async function fetchAllRows(buildQuery, select = '*') {
  const rows = [];
  for (let from = 0; from < EXPORT_MAX; from += EXPORT_CHUNK) {
    const { data, error } = await buildQuery(select)
      .order('contact_id', { ascending: true })
      .range(from, from + EXPORT_CHUNK - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < EXPORT_CHUNK) break;
  }
  return rows;
}
