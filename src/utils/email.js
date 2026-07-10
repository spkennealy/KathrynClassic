// Normalize an email for storage and comparison: trim surrounding whitespace and
// lowercase it. Emails are case-insensitive in practice, so normalizing prevents
// duplicate contacts like `awalls@x.edu` vs `Awalls@x.edu`.
export function normalizeEmail(raw) {
  return (raw || '').trim().toLowerCase();
}

// Basic email-format check: one "@", a domain, and a dot in the domain, with no
// whitespace. Stricter/clearer than Yup's lenient default.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(value) {
  return EMAIL_RE.test(String(value ?? '').trim());
}
