// Phone number helpers.
//
// We store a canonical, punctuation-free value so search/dedupe is reliable,
// and format only for display. Stored form: digits only, preserving a leading
// "+" for international numbers (e.g. "5105551234" or "+445551234567").

// Strip everything except digits, keeping a single leading "+" if present.
// Returns null for empty/no-digit input (so it slots into `phone: ... || null`).
export function normalizePhone(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  return (hasPlus ? '+' : '') + digits;
}

// Validate a phone number. Accepts US 10-digit, US 11-digit with a leading 1,
// or an international "+" number (8–15 digits, per E.164). Empty/no-digit input
// returns false — callers that treat phone as optional should skip empties
// (e.g. `!value || isValidPhone(value)`).
export function isValidPhone(value) {
  const str = String(value ?? '').trim();
  const hasPlus = str.startsWith('+');
  const digits = str.replace(/\D/g, '');
  if (hasPlus) return digits.length >= 8 && digits.length <= 15;
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
}

// Format a stored phone for display. US 10-digit -> "(510) 555-1234";
// US 11-digit (leading 1) -> "(510) 555-1234"; anything else is returned as-is
// (with a "+" preserved for international) so we never hide data.
export function formatPhone(value) {
  if (!value) return '';
  const str = String(value).trim();
  const hasPlus = str.startsWith('+');
  const digits = str.replace(/\D/g, '');

  if (!hasPlus && digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (!hasPlus && digits.length === 11 && digits.startsWith('1')) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  // US +1 international form
  if (hasPlus && digits.length === 11 && digits.startsWith('1')) {
    const d = digits.slice(1);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  // Fallback: show the original input (keeps international numbers intact).
  return str;
}
