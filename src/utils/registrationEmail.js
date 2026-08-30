import { supabase } from '../supabaseClient';

// Build the confirmation-email payload for the given registration ids and
// send it via the `send-registration-confirmation` edge function. Mirrors
// the per-registrant math in Registration.js `buildConfirmationPayload` so
// admin-initiated sends produce the same emails as a public registration.
// Exported directly for call sites that already know exactly which
// registration(s) to email — a freshly-created batch, or a single registrant
// whose own registration changed (without pulling in their whole group).
//
// Registrants are ordered by created_at (oldest first), so when more than one
// id is passed the original registrant is treated as the group organizer
// (registrants[0]) by the edge function — they receive the group-summary
// email, everyone else an individual one.
export async function sendConfirmationEmailsForIds(registrationIds, tournamentId) {
  if (!registrationIds || registrationIds.length === 0) return;

  // Tournament year (shown in the email subject/body).
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('year')
    .eq('id', tournamentId)
    .maybeSingle();
  const tournamentYear = tournament?.year;

  // Event pricing for this tournament. Children attend free (see Registration.js).
  const { data: eventsData, error: eventsErr } = await supabase
    .from('tournament_events')
    .select('id, event_name, adult_price, price_tbd, adult_price_min, adult_price_max')
    .eq('tournament_id', tournamentId);
  if (eventsErr) throw eventsErr;
  const eventMap = new Map((eventsData || []).map((e) => [e.id, e]));

  // The requested registrations, oldest first. Excludes soft-deleted rows so a
  // deleted group member never gets emailed as part of a group send.
  const { data: regs, error: regsErr } = await supabase
    .from('registrations')
    .select('id, contact_id, created_at')
    .in('id', registrationIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (regsErr) throw regsErr;
  if (!regs || regs.length === 0) return;

  const contactIds = regs.map((r) => r.contact_id);
  const regIds = regs.map((r) => r.id);

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email')
    .in('id', contactIds);
  const contactMap = new Map((contacts || []).map((c) => [c.id, c]));

  const { data: regEvents } = await supabase
    .from('registration_events')
    .select('registration_id, tournament_event_id, child_count')
    .in('registration_id', regIds);
  const eventsByReg = new Map();
  (regEvents || []).forEach((re) => {
    if (!eventsByReg.has(re.registration_id)) eventsByReg.set(re.registration_id, []);
    eventsByReg.get(re.registration_id).push(re);
  });

  const registrants = regs
    .map((reg) => {
      const contact = contactMap.get(reg.contact_id) || {};
      const lines = [];
      let total = 0;
      let estimatedMin = 0;
      let estimatedMax = 0;
      let hasTbd = false;

      (eventsByReg.get(reg.id) || []).forEach((re) => {
        const ev = eventMap.get(re.tournament_event_id);
        if (!ev) return;
        const childCount = re.child_count || 0; // children attend free

        if (ev.price_tbd) {
          hasTbd = true;
          if (ev.adult_price_min != null && ev.adult_price_max != null) {
            estimatedMin += parseFloat(ev.adult_price_min);
            estimatedMax += parseFloat(ev.adult_price_max);
          }
          lines.push({ name: ev.event_name, adults: 1, children: childCount, amount: 0, tbd: true });
        } else {
          const amount = parseFloat(ev.adult_price) || 0;
          total += amount;
          lines.push({ name: ev.event_name, adults: 1, children: childCount, amount });
        }
      });

      return {
        firstName: contact.first_name || '',
        lastName: contact.last_name || '',
        email: contact.email || '',
        events: lines,
        total,
        hasTbd,
        estimatedMin,
        estimatedMax,
      };
    })
    .filter((r) => r.email);

  if (registrants.length === 0) return;

  const { error } = await supabase.functions.invoke('send-registration-confirmation', {
    body: { tournamentYear, registrants },
  });
  if (error) throw error;
}

// (Re)send confirmation emails to everyone registered alongside `registration`
// — its whole group when it has one (registration_group_id), or just itself
// for a solo registration. Used for the "Resend email" action, which
// deliberately mirrors what a fresh group registration on the public site
// sends (organizer gets the group summary, everyone else an individual
// email) rather than emailing only the one row that was clicked.
export async function sendConfirmationEmailsForRegistration(registration, tournamentId) {
  const groupId = registration?.registration_group_id;
  let ids;
  if (groupId) {
    const { data, error } = await supabase
      .from('registrations')
      .select('id')
      .eq('registration_group_id', groupId)
      .is('deleted_at', null);
    if (error) throw error;
    ids = (data || []).map((r) => r.id);
  } else {
    ids = registration?.id ? [registration.id] : [];
  }
  await sendConfirmationEmailsForIds(ids, tournamentId);
}
