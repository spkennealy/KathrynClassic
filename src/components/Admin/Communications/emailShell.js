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
      Don't want these emails?
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
export const EMAIL_VARIABLES = [
  { token: '{{first_name}}', label: 'First name' },
  { token: '{{last_name}}', label: 'Last name' },
  { token: '{{name}}', label: 'Full name' },
  { token: '{{email}}', label: 'Email' },
];

// Replace {{variable}} tokens. Known variables resolve to the contact's value
// (blank if empty); unknown tokens are left untouched so typos stay visible.
// Mirrors render() in the edge function.
export function renderTemplate(template, vars) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (m, key) => {
    const k = String(key).toLowerCase();
    return k in vars ? (vars[k] ?? '') : m;
  });
}

// Build the variable map for a recipient ({ email, name, firstName, lastName }).
export function recipientVars(r) {
  return {
    first_name: r?.firstName || '',
    last_name: r?.lastName || '',
    name: r?.name || '',
    full_name: r?.name || '',
    email: r?.email || '',
  };
}
