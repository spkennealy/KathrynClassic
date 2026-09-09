// Email-safe wrapper for the rich HTML body. This MUST stay in sync with the
// `shell()` in supabase/functions/send-bulk-email/index.ts so the admin preview
// matches what recipients actually receive.
export function emailShell(bodyHtml) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f6;font-family:Arial,Helvetica,sans-serif;color:#222;">
  <div style="padding:24px;">
    <div style="background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e3e8e8;">
      ${bodyHtml || ''}
    </div>
    <p style="text-align:center;font-size:12px;color:#999;margin:16px 0 4px;">
      <a href="https://www.kathrynclassic.com/" style="color:#999;text-decoration:underline;">The Kathryn Classic</a>
    </p>
    <p style="text-align:center;font-size:12px;color:#999;margin:0;line-height:1.5;">
      Can't make it this year?
      <a href="#" style="color:#999;text-decoration:underline;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;
}

// Parse a comma/newline/semicolon separated address list into a clean array.
export function parseAddressList(value) {
  return (value || '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Personalization variables available in subject + body. Keep in sync with the
// `render()` map in supabase/functions/send-bulk-email/index.ts.
//
// The payment/event tokens only resolve to something when the recipient has a
// registration for the campaign's selected year (RecipientSelector attaches
// `totalCost` / `amountPaid` / `events` for that year) — otherwise they render
// blank, same as an empty last_name. That's why these are opt-in via filters
// (e.g. "Payment status in a specific year") rather than always meaningful.
export const EMAIL_VARIABLES = [
  { token: '{{first_name}}', label: 'First name' },
  { token: '{{last_name}}', label: 'Last name' },
  { token: '{{name}}', label: 'Full name' },
  { token: '{{email}}', label: 'Email' },
  { token: '{{total_cost}}', label: "Total cost, campaign year" },
  { token: '{{amount_paid}}', label: "Amount paid, campaign year" },
  { token: '{{balance_due}}', label: "Balance due, campaign year" },
  { token: '{{events}}', label: 'Registered events, campaign year (comma list)' },
  { token: '{{events_table}}', label: 'Itemized events + balance (HTML block)' },
  // Solo registrants count as their own one-person "group", so these work for
  // anyone with a registration this year — just like total_cost/balance_due
  // above. They only go blank for a non-organizer member of someone else's
  // group (their own total_cost/balance_due still work fine).
  { token: '{{group_size}}', label: 'People in the group (1 if solo)' },
  { token: '{{group_total_cost}}', label: 'Group total cost (yours, or whole group if organizer)' },
  { token: '{{group_amount_paid}}', label: 'Group amount paid (yours, or whole group if organizer)' },
  { token: '{{group_balance_due}}', label: 'Group balance due (yours, or whole group if organizer)' },
  { token: '{{group_table}}', label: 'Roster + balance (HTML block; just you if solo)' },
];

const fmt = (n) =>
  `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

// Small inline table for the {{events_table}} block: event/amount rows plus
// total/paid/balance. Mirrors the equivalent block in send-bulk-email's
// render map — keep the two in sync.
function eventsTableHtml(r) {
  if (!r?.events || r.events.length === 0) return '';
  const rows = r.events
    .map(
      (e) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(e.name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${e.amount == null ? 'TBD' : fmt(e.amount)}</td>
      </tr>`
    )
    .join('');
  const totalCost = Number(r.totalCost) || 0;
  const amountPaid = Number(r.amountPaid) || 0;
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f0fdfa;">
            <th style="padding:8px 12px;text-align:left;">Event</th>
            <th style="padding:8px 12px;text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr>
            <td style="padding:10px 12px;text-align:right;color:#666;">Total cost</td>
            <td style="padding:10px 12px;text-align:right;color:#666;">${fmt(totalCost)}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;text-align:right;color:#666;">Amount paid</td>
            <td style="padding:10px 12px;text-align:right;color:#0d9488;">&minus;${fmt(amountPaid)}</td>
          </tr>
          <tr>
            <td style="padding:12px;text-align:right;font-weight:bold;border-top:2px solid #ddd;">Balance due</td>
            <td style="padding:12px;text-align:right;font-weight:bold;color:#b91c1c;border-top:2px solid #ddd;">${fmt(totalCost - amountPaid)}</td>
          </tr>
        </tbody>
      </table>`;
}

// Full-roster table for the {{group_table}} block: one row per group member
// (name + their own events, subtext-style) plus a group amount-paid/balance
// row. Mirrors groupSummaryVars' table in send-registration-confirmation —
// keep the two in sync. Built for the group's organizer, or for a solo
// registrant's own one-person "group" — never for a non-organizer member.
function groupTableHtml(g) {
  if (!g?.members?.length) return '';
  const rows = g.members
    .map((m) => {
      const eventNames = m.events?.length ? m.events.map((e) => e.name).join(', ') : '—';
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">
          ${escapeHtml(m.name)}
          <div style="color:#888;font-size:12px;">${escapeHtml(eventNames)}</div>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${fmt(m.totalCost)}</td>
      </tr>`;
    })
    .join('');
  const totalCost = Number(g.totalCost) || 0;
  const amountPaid = Number(g.amountPaid) || 0;
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f0fdfa;">
            <th style="padding:8px 12px;text-align:left;">Registrant</th>
            <th style="padding:8px 12px;text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr>
            <td style="padding:10px 12px;text-align:right;color:#666;">Group amount paid</td>
            <td style="padding:10px 12px;text-align:right;color:#0d9488;">&minus;${fmt(amountPaid)}</td>
          </tr>
          <tr>
            <td style="padding:12px;text-align:right;font-weight:bold;border-top:2px solid #ddd;">Group balance due</td>
            <td style="padding:12px;text-align:right;font-weight:bold;color:#b91c1c;border-top:2px solid #ddd;">${fmt(totalCost - amountPaid)}</td>
          </tr>
        </tbody>
      </table>`;
}

// Replace {{variable}} tokens. Known variables resolve to the contact's value
// (blank if empty); unknown tokens are left untouched so typos stay visible.
// Mirrors render() in the edge function.
export function renderTemplate(template, vars) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (m, key) => {
    const k = String(key).toLowerCase();
    return k in vars ? (vars[k] ?? '') : m;
  });
}

// Build the variable map for a recipient ({ email, name, firstName, lastName,
// totalCost?, amountPaid?, events?, group? }). The payment/event fields are
// only present when RecipientSelector found a registration for the campaign
// year; `group` is present for everyone with one — a solo registrant's own
// one-person "group", or the whole group for whoever organized it (earliest-
// created registration in the group, same convention as send-registration-
// confirmation) — but absent for a non-organizer member of someone else's
// group.
//
// With no recipient at all (editing a template, or a campaign before anyone's
// selected), this returns {} so every {{token}} is left literal in the
// preview rather than rendering blank — EmailPreview then layers in
// EMAIL_VARIABLES_EXAMPLE for a friendlier default instead.
export function recipientVars(r) {
  if (!r) return {};
  const hasFinancials = r.totalCost != null || r.amountPaid != null;
  const totalCost = Number(r.totalCost) || 0;
  const amountPaid = Number(r.amountPaid) || 0;
  const g = r.group;
  const hasGroup = !!g?.members?.length;
  const groupTotalCost = Number(g?.totalCost) || 0;
  const groupAmountPaid = Number(g?.amountPaid) || 0;
  return {
    first_name: r.firstName || '',
    last_name: r.lastName || '',
    name: r.name || '',
    full_name: r.name || '',
    email: r.email || '',
    total_cost: hasFinancials ? fmt(totalCost) : '',
    amount_paid: hasFinancials ? fmt(amountPaid) : '',
    balance_due: hasFinancials ? fmt(totalCost - amountPaid) : '',
    events: r.events?.length ? r.events.map((e) => e.name).join(', ') : '',
    events_table: eventsTableHtml(r),
    group_size: hasGroup ? String(g.members.length) : '',
    group_total_cost: hasGroup ? fmt(groupTotalCost) : '',
    group_amount_paid: hasGroup ? fmt(groupAmountPaid) : '',
    group_balance_due: hasGroup ? fmt(groupTotalCost - groupAmountPaid) : '',
    group_table: hasGroup ? groupTableHtml(g) : '',
  };
}

// Fallback values EmailPreview uses when there's no real recipient to show —
// makes an unpicked audience preview like a plausible email instead of a
// blank or all-literal one. Real recipient data always takes precedence.
export const EMAIL_VARIABLES_EXAMPLE = {
  first_name: 'Alex',
  last_name: 'Sample',
  name: 'Alex Sample',
  full_name: 'Alex Sample',
  email: 'alex@example.com',
  total_cost: fmt(190),
  amount_paid: fmt(50),
  balance_due: fmt(140),
  events: 'Golf Tournament, Welcome Dinner',
  events_table: eventsTableHtml({
    totalCost: 190,
    amountPaid: 50,
    events: [
      { name: 'Golf Tournament', amount: 150 },
      { name: 'Welcome Dinner', amount: 40 },
    ],
  }),
  group_size: '3',
  group_total_cost: fmt(570),
  group_amount_paid: fmt(190),
  group_balance_due: fmt(380),
  group_table: groupTableHtml({
    totalCost: 570,
    amountPaid: 190,
    members: [
      { name: 'Alex Sample', totalCost: 190, events: [{ name: 'Golf Tournament', amount: 150 }, { name: 'Welcome Dinner', amount: 40 }] },
      { name: 'Jamie Sample', totalCost: 190, events: [{ name: 'Golf Tournament', amount: 150 }, { name: 'Welcome Dinner', amount: 40 }] },
      { name: 'Taylor Sample', totalCost: 190, events: [{ name: 'Golf Tournament', amount: 150 }, { name: 'Welcome Dinner', amount: 40 }] },
    ],
  }),
};
