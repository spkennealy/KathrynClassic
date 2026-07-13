// Metadata for the system "registration email" templates — the email_templates
// rows with a template_key, rendered by the send-registration-confirmation edge
// function. `variables` drives the token hints in the editor; `sampleVars` feeds
// the preview with realistic stand-ins for the blocks the edge function builds
// at send time (keep the markup loosely in sync with the block builders in
// supabase/functions/send-registration-confirmation/index.ts).

// Wrapper matching the `shell()` in the send-registration-confirmation edge
// function (600px column, padded card, year footer) so the preview looks like
// the email golfers actually receive. Keep in sync with the edge function.
export function registrationEmailShell(bodyHtml, year = '2026') {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f6;font-family:Arial,Helvetica,sans-serif;color:#222;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:10px;padding:28px;border:1px solid #e3e8e8;">
      ${bodyHtml || ''}
    </div>
    <p style="text-align:center;font-size:12px;color:#999;margin:16px 0 0;">
      The Kathryn Classic ${year}
    </p>
  </div>
</body>
</html>`;
}

const cell = 'padding:8px 12px;border-bottom:1px solid #eee;';

const SAMPLE_EVENTS_TABLE = `<table style="width:100%;border-collapse:collapse;font-size:14px;">
  <thead>
    <tr style="background:#f0fdfa;">
      <th style="padding:8px 12px;text-align:left;">Event</th>
      <th style="padding:8px 12px;text-align:left;">Attending</th>
      <th style="padding:8px 12px;text-align:right;">Amount</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="${cell}">Golf Tournament</td><td style="${cell}color:#666;">1 adult</td><td style="${cell}text-align:right;">$150.00</td></tr>
    <tr><td style="${cell}">Welcome Dinner</td><td style="${cell}color:#666;">2 adults, 1 child</td><td style="${cell}text-align:right;">$40.00</td></tr>
    <tr>
      <td colspan="2" style="padding:12px;text-align:right;font-weight:bold;">Total due</td>
      <td style="padding:12px;text-align:right;font-weight:bold;color:#0d9488;">$190.00</td>
    </tr>
  </tbody>
</table>`;

const SAMPLE_GROUP_TABLE = `<table style="width:100%;border-collapse:collapse;font-size:14px;">
  <thead>
    <tr style="background:#f0fdfa;">
      <th style="padding:8px 12px;text-align:left;">Registrant</th>
      <th style="padding:8px 12px;text-align:right;">Amount</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="${cell}">Alex Sample <span style="color:#0d9488;font-size:12px;">(you)</span><div style="color:#888;font-size:12px;">Golf Tournament, Welcome Dinner</div></td>
      <td style="${cell}text-align:right;white-space:nowrap;">$190.00</td>
    </tr>
    <tr>
      <td style="${cell}">Jamie Sample<div style="color:#888;font-size:12px;">Golf Tournament</div></td>
      <td style="${cell}text-align:right;white-space:nowrap;">$150.00</td>
    </tr>
    <tr>
      <td style="padding:12px;text-align:right;font-weight:bold;">Group total</td>
      <td style="padding:12px;text-align:right;font-weight:bold;color:#0d9488;">$340.00</td>
    </tr>
  </tbody>
</table>`;

const SAMPLE_PAYMENT_BOX = `<div style="background:#f0fdfa;border-radius:6px;padding:12px 16px;">
  <p style="margin:4px 0;font-size:14px;"><strong>Venmo:</strong> @Sean-Kennealy</p>
  <p style="margin:4px 0;font-size:14px;"><strong>Zelle:</strong> spkennealy@gmail.com</p>
  <p style="margin:4px 0;font-size:14px;"><strong>Check by mail:</strong> Make checks payable to “Sean Kennealy”</p>
</div>
<div style="text-align:center;margin-top:16px;">
  <a href="#" style="display:inline-block;margin:4px 6px;padding:12px 24px;background:#008CFF;color:#fff;font-size:14px;font-weight:bold;text-decoration:none;border-radius:8px;">Pay with Venmo</a>
  <a href="#" style="display:inline-block;margin:4px 6px;padding:12px 24px;background:#6D1ED4;color:#fff;font-size:14px;font-weight:bold;text-decoration:none;border-radius:8px;">Pay with Zelle</a>
</div>`;

const SAMPLE_PAYMENT_SECTION_INDIVIDUAL = `<h2 style="font-size:16px;margin:24px 0 8px;">How to pay</h2>
<p style="font-size:14px;color:#444;margin:0 0 8px;">
  Please submit your payment of <strong>$190.00</strong> within <strong>2 weeks</strong>
  using one of the methods below. Include your name in the payment note so we can match it to your registration.
</p>
${SAMPLE_PAYMENT_BOX}`;

const SAMPLE_PAYMENT_SECTION_ORGANIZER = `<h2 style="font-size:16px;margin:24px 0 8px;">How to pay</h2>
<p style="font-size:14px;color:#444;margin:0 0 8px;">
  As the organizer, you have two options — either works for us:
</p>
<ul style="font-size:14px;color:#444;margin:0 0 12px;padding-left:20px;">
  <li style="margin-bottom:6px;">Pay the <strong>full group total of $340.00</strong> yourself, or</li>
  <li>Pay just <strong>your own $190.00</strong> and ask each person above to pay their share using the same methods below.</li>
</ul>
${SAMPLE_PAYMENT_BOX}`;

const SAMPLE_TBD_NOTE = `<p style="font-size:14px;color:#926b00;background:#fff8e1;padding:10px 12px;border-radius:6px;">
  Some selected event pricing is still being finalized (estimated $20.00–$40.00). We'll email you the final amount.
</p>`;

const SAMPLE_RULES_BODY = `<h2>Format</h2>
<p>The Kathryn Classic is a 4-person scramble. Each golfer tees off on every hole, the team
selects the best shot, and all players play their next shot from that spot.</p>
<h2>Scramble Rules</h2>
<ul>
  <li>The team must use at least one tee shot from each member per 9 holes.</li>
  <li>All other rules abide by standard USGA rules.</li>
</ul>
<p style="font-size:12px;color:#999;">(Preview sample — the real email uses the rules saved in Admin → Rules for the tournament year.)</p>`;

export const REGISTRATION_TEMPLATES = {
  registration_confirmation: {
    label: 'Registration confirmation',
    description:
      'Sent to each golfer right after they register (solo registrants and members of a group).',
    variables: [
      { token: '{{first_name}}', label: 'First name' },
      { token: '{{last_name}}', label: 'Last name' },
      { token: '{{year}}', label: 'Tournament year' },
      { token: '{{total}}', label: 'Amount owed' },
      { token: '{{events_table}}', label: 'Table of registered events' },
      { token: '{{payment_section}}', label: 'How-to-pay section' },
      { token: '{{group_note}}', label: 'Group note (only for group members)' },
      { token: '{{tbd_note}}', label: 'Note shown only when pricing is TBD' },
    ],
    sampleVars: {
      first_name: 'Alex',
      last_name: 'Sample',
      year: '2026',
      total: '$190.00',
      events_table: SAMPLE_EVENTS_TABLE,
      payment_section: SAMPLE_PAYMENT_SECTION_INDIVIDUAL,
      group_note: '',
      tbd_note: SAMPLE_TBD_NOTE,
    },
  },
  registration_group_summary: {
    label: 'Registration group summary',
    description:
      'Sent to the organizer (first attendee) of a group registration, summarizing everyone they signed up.',
    variables: [
      { token: '{{first_name}}', label: 'Organizer first name' },
      { token: '{{last_name}}', label: 'Organizer last name' },
      { token: '{{year}}', label: 'Tournament year' },
      { token: '{{group_total}}', label: 'Group total owed' },
      { token: '{{your_total}}', label: "Organizer's own share" },
      { token: '{{group_table}}', label: 'Per-person summary table' },
      { token: '{{payment_section}}', label: 'How-to-pay section' },
    ],
    sampleVars: {
      first_name: 'Alex',
      last_name: 'Sample',
      year: '2026',
      group_total: '$340.00',
      your_total: '$190.00',
      total: '$340.00',
      group_table: SAMPLE_GROUP_TABLE,
      payment_section: SAMPLE_PAYMENT_SECTION_ORGANIZER,
    },
  },
  registration_rules: {
    label: 'Registration rules email',
    description:
      'Sent to each golfer right after their confirmation, containing the tournament rules for the year (managed in Admin → Rules). Skipped automatically when the year has no rules.',
    variables: [
      { token: '{{first_name}}', label: 'First name' },
      { token: '{{last_name}}', label: 'Last name' },
      { token: '{{year}}', label: 'Tournament year' },
      { token: '{{rules_body}}', label: "The year's rules (from Admin → Rules)" },
    ],
    sampleVars: {
      first_name: 'Alex',
      last_name: 'Sample',
      year: '2026',
      rules_body: SAMPLE_RULES_BODY,
    },
  },
};

// Display order for the pinned "Registration emails" section.
export const REGISTRATION_TEMPLATE_KEYS = Object.keys(REGISTRATION_TEMPLATES);
