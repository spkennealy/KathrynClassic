import { supabase } from '../supabaseClient';

// Generate a short, human-readable reference code shown to the user and stored
// with the logged error. Excludes ambiguous chars (0/O, 1/I) so it's easy to
// read over the phone or in a text. Example: "K7P2QX".
export const makeReferenceId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i += 1) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
};

// Report a client-side error to the `report-error` edge function, which persists
// it to error_logs and emails the organizer. Returns the reference code so the
// caller can surface it to the user ("contact support and mention code X").
//
// Error reporting is best-effort and must never throw — if it fails we still
// have the console log and the user still sees a friendly message.
export async function reportError(context, err, { referenceId, payload } = {}) {
  const ref = referenceId || makeReferenceId();

  // Always log locally for dev/debugging in the user's console.
  // eslint-disable-next-line no-console
  console.error(`[${context}] error (ref ${ref}):`, err);

  try {
    await supabase.functions.invoke('report-error', {
      body: {
        referenceId: ref,
        context,
        message: err?.message ?? String(err),
        code: err?.code ?? null,
        details: err?.details ?? null,
        hint: err?.hint ?? null,
        stack: err?.stack ?? null,
        payload: payload ?? null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        url: typeof window !== 'undefined' ? window.location.href : null,
      },
    });
  } catch (reportErr) {
    // eslint-disable-next-line no-console
    console.error('Failed to report error:', reportErr);
  }

  return ref;
}
