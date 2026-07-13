import { supabase } from '../supabaseClient';

// Build the confirmation-email payload for every registration sharing a group id
// and send it via the `send-registration-confirmation` edge function. This mirrors
// the per-registrant math in Registration.js `buildConfirmationPayload` so admin-
// initiated group edits produce the same emails as a public registration.
//
// Registrants are ordered by registration_date (oldest first) so the original
// registrant is treated as the group organizer (registrants[0]) by the edge
// function — they receive the group-summary email, everyone else an individual one.
export async function sendGroupConfirmationEmails(groupId, tournamentId) {
  if (!groupId) return;

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

  // All registrations in the group, oldest first.
  const { data: regs, error: regsErr } = await supabase
    .from('registrations')
    .select('id, contact_id, registration_date')
    .eq('registration_group_id', groupId)
    .order('registration_date', { ascending: true });
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
