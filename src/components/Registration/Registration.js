import React, { useState, useEffect } from 'react';
import { Formik, Form, Field, ErrorMessage, FieldArray, useFormikContext } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../supabaseClient';
import { getCurrentTournamentYear, getTournamentEvents, formatDate } from '../../utils/tournamentUtils';
import { normalizePhone, isValidPhone } from '../../utils/phone';
import { normalizeEmail, isValidEmail } from '../../utils/email';
import { reportError } from '../../utils/reportError';
import { safeUuid } from '../../utils/uuid';
import BookYourStay from './BookYourStay';

// Shared field validators. Email is required and must be well-formed; phone is
// optional but, when anything is entered, must be a valid number.
const emailField = Yup.string()
  .required('Email is required')
  .test('email-format', 'Please enter a valid email address', (v) => !v || isValidEmail(v));
const phoneField = Yup.string()
  .test('phone-format', 'Please enter a valid phone number', (v) => !v || isValidPhone(v));

const AdultSchema = Yup.object().shape({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  email: emailField,
  phone: phoneField,
  events: Yup.array().min(1, 'Select at least one event'),
  golfHandicap: Yup.number().when('events', {
    is: (events) => events && events.includes('golf_tournament'),
    then: () => Yup.number().required('Required (use 20 if unknown)'),
    otherwise: () => Yup.number().notRequired(),
  }),
  preferredTeammates: Yup.string(),
  childCounts: Yup.object(),
});

const RegistrationSchema = Yup.object().shape({
  adults: Yup.array().of(AdultSchema).min(1, 'At least one attendee is required'),
  agreeTerms: Yup.boolean().oneOf([true], 'You must agree to the terms and conditions'),
});

const WaitlistSchema = Yup.object().shape({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  email: emailField,
  phone: phoneField,
  notes: Yup.string(),
});

// After a failed submit, scroll to the first field with a validation error so
// mobile users see what needs fixing instead of staying at the submit button.
function ScrollToError() {
  const { submitCount, isValid, errors } = useFormikContext();

  useEffect(() => {
    if (submitCount === 0 || isValid) return;

    // Collect the leaf error field paths (Formik nests them under adults.<i>.<field>).
    const paths = [];
    const walk = (obj, prefix) => {
      Object.entries(obj || {}).forEach(([key, val]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          walk(val, path);
        } else if (Array.isArray(val)) {
          val.forEach((item, i) => {
            if (item && typeof item === 'object') walk(item, `${path}.${i}`);
            else if (item) paths.push(`${path}.${i}`);
          });
        } else if (val) {
          paths.push(path);
        }
      });
    };
    walk(errors, '');

    // Find the first error field actually present in the DOM, topmost on screen.
    let target = null;
    let topY = Infinity;
    paths.forEach((name) => {
      const el = document.querySelector(`[name="${name}"]`);
      if (el) {
        const y = el.getBoundingClientRect().top;
        if (y < topY) {
          topY = y;
          target = el;
        }
      }
    });

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
    }
  }, [submitCount, isValid, errors]);

  return null;
}

export default function Registration() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedTotal, setSubmittedTotal] = useState(0);
  const [submittedTotals, setSubmittedTotals] = useState(null);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [tournamentYear, setTournamentYear] = useState(null);
  const [tournamentId, setTournamentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registrationStatus, setRegistrationStatus] = useState('open'); // 'open', 'full', 'closed'
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactAlreadyExists, setContactAlreadyExists] = useState(false);
  const [skippedDuplicates, setSkippedDuplicates] = useState([]);

  useEffect(() => {
    loadTournamentData();
  }, []);

  const loadTournamentData = async () => {
    try {
      const year = await getCurrentTournamentYear();
      setTournamentYear(year);

      // Get tournament
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('*')
        .eq('year', year)
        .single();

      if (tournament) {
        setTournamentId(tournament.id);
        // Handle both old (boolean) and new (enum) registration status
        if (tournament.registration_status) {
          setRegistrationStatus(tournament.registration_status);
        } else if (tournament.registration_closed) {
          setRegistrationStatus('full');
        } else {
          setRegistrationStatus('open');
        }

        // Get events
        const eventData = await getTournamentEvents(year);

        // Transform events to match expected format
        const formattedEvents = eventData.map(event => ({
          id: event.event_type,
          name: `${event.event_name} - ${formatDate(event.event_date).split(',')[0]}, ${formatDate(event.event_date).split(',')[1].trim()}`,
          adultPrice: parseFloat(event.adult_price),
          childPrice: 0, // Children attend free
          eventId: event.id,
          priceTbd: event.price_tbd || false,
          adultPriceMin: event.adult_price_min != null ? parseFloat(event.adult_price_min) : null,
          adultPriceMax: event.adult_price_max != null ? parseFloat(event.adult_price_max) : null,
          childPriceMin: event.child_price_min != null ? parseFloat(event.child_price_min) : null,
          childPriceMax: event.child_price_max != null ? parseFloat(event.child_price_max) : null,
        }));

        setEvents(formattedEvents);
      }
    } catch (err) {
      reportError('registration_load', err);
      setError('Failed to load tournament information. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = (adults) => {
    let total = 0;

    adults.forEach(adult => {
      adult.events.forEach(eventId => {
        const event = events.find(e => e.id === eventId);
        if (event && !event.priceTbd) {
          // Add adult price
          total += event.adultPrice;

          // Add children prices for this event
          const childCount = adult.childCounts?.[eventId] || 0;
          total += childCount * event.childPrice;
        }
      });
    });

    return total;
  };

  // Build the per-registrant payload for the confirmation email edge function.
  // One entry per newly registered adult, with their own events and amount owed.
  const buildConfirmationPayload = (adults) => {
    const registrants = adults.map(adult => {
      const lines = [];
      let total = 0;
      let estimatedMin = 0;
      let estimatedMax = 0;
      let hasTbd = false;

      adult.events.forEach(eventId => {
        const event = events.find(e => e.id === eventId);
        if (!event) return;
        const childCount = adult.childCounts?.[eventId] || 0;

        if (event.priceTbd) {
          hasTbd = true;
          if (event.adultPriceMin != null && event.adultPriceMax != null) {
            estimatedMin += event.adultPriceMin;
            estimatedMax += event.adultPriceMax;
          }
          lines.push({ name: event.name, adults: 1, children: childCount, amount: 0, tbd: true });
        } else {
          const amount = event.adultPrice + childCount * event.childPrice;
          total += amount;
          lines.push({ name: event.name, adults: 1, children: childCount, amount });
        }
      });

      return {
        firstName: adult.firstName,
        lastName: adult.lastName,
        email: adult.email,
        events: lines,
        total,
        hasTbd,
        estimatedMin,
        estimatedMax,
      };
    });

    return { tournamentYear, registrants };
  };

  const calculateTotals = (adults) => {
    let confirmed = 0;
    let estimatedMin = 0;
    let estimatedMax = 0;
    let hasTbd = false;
    let hasUnestimatedTbd = false;

    adults.forEach(adult => {
      adult.events.forEach(eventId => {
        const event = events.find(e => e.id === eventId);
        if (!event) return;

        if (!event.priceTbd) {
          confirmed += event.adultPrice;
          const childCount = adult.childCounts?.[eventId] || 0;
          confirmed += childCount * event.childPrice;
        } else {
          hasTbd = true;
          if (event.adultPriceMin != null && event.adultPriceMax != null) {
            estimatedMin += event.adultPriceMin;
            estimatedMax += event.adultPriceMax;
            const childCount = adult.childCounts?.[eventId] || 0;
            if (childCount > 0 && event.childPriceMin != null && event.childPriceMax != null) {
              estimatedMin += childCount * event.childPriceMin;
              estimatedMax += childCount * event.childPriceMax;
            }
          } else {
            hasUnestimatedTbd = true;
          }
        }
      });
    });

    return { confirmed, estimatedMin, estimatedMax, hasTbd, hasUnestimatedTbd };
  };

  const handleWaitlistSubmit = async (values, { setSubmitting, resetForm }) => {
    try {
      setError(null);

      // STEP 1: Check if contact exists or create new one (email match is
      // case-insensitive so we don't create duplicate contacts).
      const email = normalizeEmail(values.email);
      const { data: existingContact, error: lookupError } = await supabase
        .from('contacts')
        .select('id')
        .ilike('email', email)
        .maybeSingle();

      if (lookupError) throw lookupError;

      let contactId;

      if (existingContact) {
        contactId = existingContact.id;
        // Update existing contact
        await supabase
          .from('contacts')
          .update({
            first_name: values.firstName,
            last_name: values.lastName,
            phone: normalizePhone(values.phone),
            updated_at: new Date().toISOString()
          })
          .eq('id', contactId);
      } else {
        // Create new contact
        const { data: newContact, error: insertError } = await supabase
          .from('contacts')
          .insert([{
            first_name: values.firstName,
            last_name: values.lastName,
            email,
            phone: normalizePhone(values.phone)
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        contactId = newContact.id;
      }

      // STEP 2: Add to waitlist
      const { error: waitlistError } = await supabase
        .from('waitlist')
        .insert([{
          contact_id: contactId,
          tournament_id: tournamentId,
          notes: values.notes || null
        }]);

      if (waitlistError) {
        // Check if already on waitlist
        if (waitlistError.code === '23505') {
          setError('You are already on the waitlist for this tournament.');
          return;
        }
        throw waitlistError;
      }

      setIsSubmitted(true);
      resetForm();
    } catch (err) {
      const ref = await reportError('waitlist_submit', err, { payload: { email: values.email } });
      setError(`Failed to join waitlist. Please try again, or contact support and mention reference code ${ref}.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleContactSubmit = async (values, { setSubmitting, resetForm }) => {
    try {
      setError(null);
      setContactAlreadyExists(false);

      // Check if contact already exists (case-insensitive email match).
      const email = normalizeEmail(values.email);
      const { data: existingContact, error: lookupError } = await supabase
        .from('contacts')
        .select('id')
        .ilike('email', email)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (existingContact) {
        // Contact already exists - update their info and show message
        await supabase
          .from('contacts')
          .update({
            first_name: values.firstName,
            last_name: values.lastName,
            phone: normalizePhone(values.phone),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingContact.id);

        setContactAlreadyExists(true);
        setContactSubmitted(true);
      } else {
        // Create new contact
        const { error: insertError } = await supabase
          .from('contacts')
          .insert([{
            first_name: values.firstName,
            last_name: values.lastName,
            email,
            phone: normalizePhone(values.phone)
          }]);

        if (insertError) throw insertError;

        setContactSubmitted(true);
      }

      resetForm();
    } catch (err) {
      const ref = await reportError('contact_submit', err, { payload: { email: values.email } });
      setError(`Failed to save your information. Please try again, or contact support and mention reference code ${ref}.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (values, { setSubmitting, resetForm }) => {
    try {
      setError(null);
      setSkippedDuplicates([]);

      // Each attendee must have their own email. Contacts are keyed by email, so
      // reusing one address collapses two attendees into a single contact, and the
      // second registration row violates the idx_unique_active_registration index
      // (duplicate (contact_id, tournament)). Block it up front with a friendly
      // explanation, using the attendees' own email + first names in the examples.
      const normalizedEmails = values.adults.map(a => (a.email || '').trim().toLowerCase());
      const duplicatedEmail = normalizedEmails.find((e, i) => e && normalizedEmails.indexOf(e) !== i);
      if (duplicatedEmail) {
        const sharers = values.adults.filter((_, i) => normalizedEmails[i] === duplicatedEmail);
        const [localPart, domain] = duplicatedEmail.split('@');
        // Strip to alias-safe characters; fall back to generic names if blank/identical.
        const aliasTag = (name) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        let tag1 = aliasTag(sharers[0]?.firstName) || 'anna';
        let tag2 = aliasTag(sharers[1]?.firstName) || 'ben';
        if (tag1 === tag2) { tag1 = `${tag1}1`; tag2 = `${tag2}2`; }
        const examples = domain
          ? `${localPart}+${tag1}@${domain}\n${localPart}+${tag2}@${domain}`
          : `yourname+${tag1}@gmail.com\nyourname+${tag2}@gmail.com`;
        setError(
          `Each attendee needs their own email address, but "${duplicatedEmail}" is used more than once.\n\n` +
          `If you'd like to register two people from one inbox, most email providers (Gmail, Outlook, iCloud) ` +
          `support "+aliases": add "+" and any word before the @ — for example:\n\n` +
          `${examples}\n\n` +
          `Both still deliver to your normal inbox, but count as separate addresses here.`
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // STEP 1: Get unique emails and batch lookup contacts. Email matching is
      // case-insensitive (normalized keys + ilike) so we reuse existing contacts
      // instead of creating case-variant duplicates (e.g. Awalls@ vs awalls@).
      const emails = [...new Set(values.adults.map(a => normalizeEmail(a.email)))];
      const emailSet = new Set(emails);

      const { data: existingContacts, error: lookupError } = await supabase
        .from('contacts')
        .select('id, email')
        .or(emails.map(e => `email.ilike.${e}`).join(','));

      if (lookupError) throw lookupError;

      // Map existing contact_ids by normalized (lowercased) email. Filter to
      // exact normalized matches so an ilike wildcard can never mismap.
      const contactMap = new Map(
        (existingContacts || [])
          .filter(c => emailSet.has(normalizeEmail(c.email)))
          .map(c => [normalizeEmail(c.email), c.id])
      );

      // STEP 2: Identify new contacts to create
      const newContactsData = values.adults
        .filter(a => !contactMap.has(normalizeEmail(a.email)))
        .reduce((acc, adult) => {
          const email = normalizeEmail(adult.email);
          // Deduplicate by email
          if (!acc.find(c => c.email === email)) {
            acc.push({
              first_name: adult.firstName,
              last_name: adult.lastName,
              email,
              phone: normalizePhone(adult.phone)
            });
          }
          return acc;
        }, []);

      // Batch insert new contacts
      if (newContactsData.length > 0) {
        const { data: insertedContacts, error: insertError } = await supabase
          .from('contacts')
          .insert(newContactsData)
          .select('id, email');

        if (insertError) throw insertError;

        (insertedContacts || []).forEach(c => contactMap.set(normalizeEmail(c.email), c.id));
      }

      // STEP 3: Update existing contacts with latest info
      const contactUpdates = values.adults
        .filter(a => contactMap.has(normalizeEmail(a.email)))
        .reduce((acc, adult) => {
          const email = normalizeEmail(adult.email);
          // Deduplicate by email
          const existing = acc.find(u => u.email === email);
          if (!existing) {
            acc.push({
              id: contactMap.get(email),
              email,
              first_name: adult.firstName,
              last_name: adult.lastName,
              phone: normalizePhone(adult.phone),
              updated_at: new Date().toISOString()
            });
          }
          return acc;
        }, []);

      // Update contacts (upsert approach)
      for (const update of contactUpdates) {
        const { id, email, ...updateData } = update;
        await supabase
          .from('contacts')
          .update(updateData)
          .eq('id', id);
      }

      // STEP 3.5: Check for duplicate registrations
      const allContactIds = values.adults.map(a => contactMap.get(normalizeEmail(a.email)));

      const { data: existingRegIds, error: dupCheckError } = await supabase
        .rpc('check_existing_registrations', {
          p_contact_ids: allContactIds,
          p_tournament_id: tournamentId
        });

      if (dupCheckError) throw dupCheckError;

      const existingRegSet = new Set(existingRegIds || []);

      const duplicateAdults = values.adults.filter(a => existingRegSet.has(contactMap.get(normalizeEmail(a.email))));
      const newAdults = values.adults.filter(a => !existingRegSet.has(contactMap.get(normalizeEmail(a.email))));

      // If ALL attendees are already registered, show error and return
      if (newAdults.length === 0) {
        const names = duplicateAdults.map(a => `${a.firstName} ${a.lastName}`).join(', ');
        setError(`All attendees are already registered for this tournament: ${names}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // If some are duplicates, track them for the success page
      if (duplicateAdults.length > 0) {
        setSkippedDuplicates(duplicateAdults.map(a => ({
          firstName: a.firstName,
          lastName: a.lastName,
          email: a.email
        })));
      }

      // Calculate total amount and team info using only new adults
      const totalAmount = calculateTotal(newAdults);
      const totals = calculateTotals(newAdults);
      const golfAdults = newAdults.filter(adult =>
        adult.events.includes('golf_tournament')
      );
      const isFullTeam = golfAdults.length === 4;
      const teamGroupId = newAdults.length > 1 ? safeUuid() : null;

      // STEP 4: Create registrations with contact_id references (without events/child_counts)
      const registrations = newAdults.map(adult => {
        const isGolfer = adult.events.includes('golf_tournament');

        return {
          contact_id: contactMap.get(normalizeEmail(adult.email)),
          golf_handicap: adult.golfHandicap || null,
          preferred_teammates: isGolfer && adult.preferredTeammates
            ? adult.preferredTeammates
            : null,
          registration_group_id: teamGroupId,
          tournament_id: tournamentId,
          payment_status: 'pending',
          created_at: new Date().toISOString()
        };
      });

      // STEP 5: Insert registrations
      const { data: insertedRegistrations, error: supabaseError } = await supabase
        .from('registrations')
        .insert(registrations)
        .select();

      if (supabaseError) throw supabaseError;

      // STEP 6: Create registration_events for each event
      const registrationEvents = [];

      insertedRegistrations.forEach((registration, index) => {
        const adult = newAdults[index];

        adult.events.forEach(eventType => {
          // Find the event to get its UUID
          const event = events.find(e => e.id === eventType);

          if (event && event.eventId) {
            registrationEvents.push({
              registration_id: registration.id,
              tournament_event_id: event.eventId,
              child_count: adult.childCounts?.[eventType] || 0
            });
          }
        });
      });

      // Insert all registration_events
      if (registrationEvents.length > 0) {
        const { error: eventsError } = await supabase
          .from('registration_events')
          .insert(registrationEvents);

        if (eventsError) throw eventsError;
      }

      const data = insertedRegistrations;

      console.log('Registration saved successfully:', data);
      if (isFullTeam) {
        console.log('Full team registered with registration_group_id:', teamGroupId);
      }

      // STEP 7: Send confirmation emails (non-blocking — never fail the registration on email error)
      try {
        const { error: emailError } = await supabase.functions.invoke(
          'send-registration-confirmation',
          { body: buildConfirmationPayload(newAdults) }
        );
        if (emailError) console.error('Confirmation email error:', emailError);
      } catch (emailErr) {
        console.error('Failed to invoke confirmation email function:', emailErr);
      }

      setSubmittedTotal(totalAmount);
      setSubmittedTotals(totals);
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      resetForm();
    } catch (err) {
      const ref = await reportError('registration_submit', err, {
        payload: {
          tournamentId,
          adultCount: values.adults?.length ?? 0,
          emails: values.adults?.map((a) => a.email),
        },
      });
      setError(
        `Failed to submit registration. Please try again, or contact support and mention reference code ${ref}.`
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="bg-primary-50 dark:bg-night-900 py-12 sm:py-24 lg:py-32 min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8">
              <svg className="mx-auto h-16 w-16 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-primary-600 dark:text-primary-400 font-serif">
              {registrationStatus === 'full' ? 'Added to Waitlist!' : 'Congratulations!'}
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400 font-serif">
              {registrationStatus === 'full'
                ? "You've been added to the waitlist for The Kathryn Classic. We'll contact you if a spot becomes available."
                : "You've successfully registered for The Kathryn Classic!"
              }
            </p>

            {skippedDuplicates.length > 0 && (
              <div className="mt-6 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-4 sm:p-6 ring-1 ring-yellow-200 dark:ring-yellow-800 text-left">
                <div className="flex">
                  <svg className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div className="ml-3">
                    <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">Some attendees were already registered</h3>
                    <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
                      The following attendees were skipped because they are already registered for this tournament:
                    </p>
                    <ul className="mt-2 list-disc list-inside text-sm text-yellow-700 dark:text-yellow-400">
                      {skippedDuplicates.map((dup, i) => (
                        <li key={i}>{dup.firstName} {dup.lastName} ({dup.email})</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-400">
                      The total below reflects only the newly registered attendees.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {registrationStatus !== 'full' && (
              <>
                <div className="mt-6 sm:mt-10 rounded-lg bg-primary-50 dark:bg-night-800 p-4 sm:p-8 ring-1 ring-primary-200 dark:ring-night-700">
                  {submittedTotals?.hasTbd && submittedTotal === 0 ? (
                    <>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Next Steps: Watch Your Email</h3>
                      <div className="text-left space-y-4">
                        <p className="text-base text-gray-700 dark:text-gray-300">
                          Registration pricing for your selected event(s) is still being finalized.
                        </p>
                        <div className="border-t border-primary-200 dark:border-night-600 pt-4">
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">What to expect:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                            <li>An email with full tournament details will be sent to you</li>
                            <li>That email will include your final registration fees</li>
                            <li>Payment instructions will be included at that time</li>
                          </ul>
                          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-night-700 p-3 rounded border border-primary-200 dark:border-night-600">
                            <strong>Note:</strong> Your spot is reserved. No payment is needed until you receive the details email.
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Next Steps: Payment Required</h3>
                      <div className="text-left space-y-4">
                        <div>
                          <p className="text-base text-gray-700 dark:text-gray-300">
                            <strong>Total Amount Due:</strong> <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">${submittedTotal}</span>
                          </p>
                          {submittedTotals?.hasTbd && (
                            <div className="mt-1 space-y-0.5">
                              <p className="text-sm text-amber-700 dark:text-amber-400">
                                {submittedTotals.hasUnestimatedTbd && submittedTotals.estimatedMin === 0
                                  ? '+ TBD'
                                  : submittedTotals.hasUnestimatedTbd
                                  ? `+ est. $${submittedTotals.estimatedMin}–$${submittedTotals.estimatedMax} and additional TBD costs`
                                  : `+ est. $${submittedTotals.estimatedMin}–$${submittedTotals.estimatedMax} for TBD event(s)`
                                }
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">We will reach out to you with the final cost for TBD events.</p>
                            </div>
                          )}
                        </div>
                        <div className="border-t border-primary-200 dark:border-night-600 pt-4">
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Please submit payment via:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col items-center rounded-lg bg-white dark:bg-night-700 p-4 ring-1 ring-primary-200 dark:ring-night-600">
                              <img
                                src="/venmo-qr.png"
                                alt="Venmo QR code for Sean Kennealy"
                                className="h-40 w-40 object-contain"
                              />
                              <a
                                href="https://venmo.com/u/Sean-Kennealy"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 flex w-full items-center justify-center rounded-lg bg-[#008CFF] px-4 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-[#0074d4] transition-colors"
                              >
                                Pay with Venmo
                              </a>
                            </div>
                            <div className="flex flex-col items-center rounded-lg bg-white dark:bg-night-700 p-4 ring-1 ring-primary-200 dark:ring-night-600">
                              <img
                                src="/zelle-qr.png"
                                alt="Zelle QR code for Sean Kennealy"
                                className="h-40 w-40 object-contain"
                              />
                              <a
                                href="https://enroll.zellepay.com/qr-codes?data=spkennealy@gmail.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 flex w-full items-center justify-center rounded-lg bg-[#6D1ED4] px-4 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-[#5a17b0] transition-colors"
                              >
                                Pay with Zelle
                              </a>
                            </div>
                          </div>
                          <div className="mt-3 space-y-1 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-night-700 p-3 rounded border border-primary-200 dark:border-night-600">
                            <p><strong>Venmo:</strong> @Sean-Kennealy</p>
                            <p><strong>Zelle:</strong> spkennealy@gmail.com</p>
                            <p><strong>Check:</strong> Payable to “Sean Kennealy” — 3001 Santa Clara Ave, Alameda, CA 94501</p>
                          </div>
                          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-night-700 p-3 rounded border border-primary-200 dark:border-night-600">
                            <strong>Note:</strong> Please submit payment within 2 weeks of registering,
                            and include your name in the payment note.
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <p className="mt-8 text-base text-gray-600 dark:text-gray-400 font-serif">
                  A confirmation email with event details has been sent to your email address.
                </p>
              </>
            )}

            <BookYourStay className="mt-12 text-left" />

            <div className="mt-10 flex items-center justify-center gap-x-6">
              <button
                onClick={() => {
                  setIsSubmitted(false);
                  setSubmittedTotal(0);
                  setSubmittedTotals(null);
                  setSkippedDuplicates([]);
                }}
                className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-colors"
              >
                {registrationStatus === 'full' ? 'Add Another Person to Waitlist' : 'Register Another Group'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-primary-50 dark:bg-night-900 py-12 sm:py-24 lg:py-32 min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-lg text-gray-600 dark:text-gray-400 font-serif">Loading registration form...</p>
          </div>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-primary-50 dark:bg-night-900 py-12 sm:py-24 lg:py-32 min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-primary-600 dark:text-primary-400 font-serif">Registration</h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400 font-serif">
              Registration is not currently available. Please check back later for upcoming tournament dates.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show off-season message if registration is closed or the tournament has been
  // completed (both are terminal, no-waitlist states).
  if (registrationStatus === 'closed' || registrationStatus === 'completed') {
    // Show success message if contact was submitted
    if (contactSubmitted) {
      return (
        <div className="bg-primary-50 dark:bg-night-900 py-24 sm:py-32 min-h-screen">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mb-8">
                <svg className="mx-auto h-16 w-16 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-primary-600 dark:text-primary-400 font-serif">
                {contactAlreadyExists ? "You're Already on Our List!" : "Thank You!"}
              </h2>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400 font-serif">
                {contactAlreadyExists
                  ? "Your information has been updated. You're already in our system and will be notified when registration opens in March 2026."
                  : "You've been added to our mailing list. We'll send you an email when registration opens in March 2026."}
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <button
                  onClick={() => {
                    setContactSubmitted(false);
                    setContactAlreadyExists(false);
                  }}
                  className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-colors"
                >
                  Add Another Person
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Show form to collect contact info
    return (
      <div className="bg-primary-50 dark:bg-night-900 py-12 sm:py-24 lg:py-32 min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-8">
              <svg className="mx-auto h-16 w-16 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-primary-600 dark:text-primary-400 font-serif">
              {registrationStatus === 'completed'
                ? 'This Tournament Has Concluded'
                : 'Registration Currently Closed'}
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400 font-serif">
              {registrationStatus === 'completed'
                ? 'Thank you to everyone who came out to play, give, and remember together. Your generosity makes a lasting difference in the fight against CJD.'
                : "We're currently in the off-season. Registration for the next Kathryn Classic will open in March 2026."}
            </p>
            <p className="mt-4 text-base text-gray-600 dark:text-gray-400 font-serif">
              {registrationStatus === 'completed'
                ? "Sign up below and we'll let you know when registration opens for next year's tournament."
                : 'Sign up below to be notified when registration opens.'}
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-2xl sm:mt-20">
            <Formik
              initialValues={{
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
              }}
              validationSchema={Yup.object().shape({
                firstName: Yup.string().required('First name is required'),
                lastName: Yup.string().required('Last name is required'),
                email: emailField,
                phone: phoneField,
              })}
              onSubmit={handleContactSubmit}
            >
              {({ isSubmitting }) => (
                <Form className="space-y-6">
                  {error && (
                    <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  )}

                  <div className="rounded-lg bg-white dark:bg-night-800 p-4 sm:p-8 shadow-lg ring-1 ring-gray-200 dark:ring-night-700">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Get Notified</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
                          First name <span className="text-red-500">*</span>
                        </label>
                        <Field
                          name="firstName"
                          className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:bg-night-700 dark:ring-night-600 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                        />
                        <ErrorMessage name="firstName" component="div" className="mt-1 text-sm text-red-600" />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
                          Last name <span className="text-red-500">*</span>
                        </label>
                        <Field
                          name="lastName"
                          className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:bg-night-700 dark:ring-night-600 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                        />
                        <ErrorMessage name="lastName" component="div" className="mt-1 text-sm text-red-600" />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <Field
                          type="email"
                          name="email"
                          className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:bg-night-700 dark:ring-night-600 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                        />
                        <ErrorMessage name="email" component="div" className="mt-1 text-sm text-red-600" />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">Phone</label>
                        <Field
                          type="tel"
                          name="phone"
                          className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:bg-night-700 dark:ring-night-600 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                        />
                        <ErrorMessage name="phone" component="div" className="mt-1 text-sm text-red-600" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="block w-full rounded-lg bg-primary-600 px-4 py-3 text-center text-base font-semibold text-white shadow-sm hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? 'Submitting...' : 'Notify Me When Registration Opens'}
                    </button>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      </div>
    );
  }

  // Show waitlist form if registration is full
  if (registrationStatus === 'full') {
    return (
      <div className="bg-primary-50 dark:bg-night-900 py-12 sm:py-24 lg:py-32 min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-primary-600 dark:text-primary-400 font-serif">
              Registration Full - Join Waitlist
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400 font-serif">
              Registration for The Kathryn Classic {tournamentYear} is currently full.
              Please join our waitlist and we'll contact you if a spot becomes available.
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-2xl sm:mt-20">
            <Formik
              initialValues={{
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                notes: '',
              }}
              validationSchema={WaitlistSchema}
              onSubmit={handleWaitlistSubmit}
            >
              {({ isSubmitting }) => (
                <Form className="space-y-6">
                  {error && (
                    <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  )}

                  <div className="rounded-lg bg-white dark:bg-night-800 p-4 sm:p-8 shadow-lg ring-1 ring-gray-200 dark:ring-night-700">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Your Information</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
                          First name <span className="text-red-500">*</span>
                        </label>
                        <Field
                          name="firstName"
                          className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:bg-night-700 dark:ring-night-600 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                        />
                        <ErrorMessage name="firstName" component="div" className="mt-1 text-sm text-red-600" />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
                          Last name <span className="text-red-500">*</span>
                        </label>
                        <Field
                          name="lastName"
                          className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:bg-night-700 dark:ring-night-600 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                        />
                        <ErrorMessage name="lastName" component="div" className="mt-1 text-sm text-red-600" />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <Field
                          type="email"
                          name="email"
                          className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:bg-night-700 dark:ring-night-600 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                        />
                        <ErrorMessage name="email" component="div" className="mt-1 text-sm text-red-600" />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">Phone</label>
                        <Field
                          type="tel"
                          name="phone"
                          className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:bg-night-700 dark:ring-night-600 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                        />
                        <ErrorMessage name="phone" component="div" className="mt-1 text-sm text-red-600" />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
                          Additional Notes
                        </label>
                        <Field
                          as="textarea"
                          name="notes"
                          rows={3}
                          placeholder="Let us know which events you're interested in or any other details..."
                          className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:bg-night-700 dark:ring-night-600 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                        />
                        <ErrorMessage name="notes" component="div" className="mt-1 text-sm text-red-600" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="block w-full rounded-lg bg-primary-600 px-4 py-3 text-center text-base font-semibold text-white shadow-sm hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? 'Joining Waitlist...' : 'Join Waitlist'}
                    </button>
                  </div>
                </Form>
              )}
            </Formik>

            <BookYourStay className="mt-12" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary-50 dark:bg-night-900 py-12 sm:py-24 lg:py-32 min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-primary-600 dark:text-primary-400 font-serif">Register for The Kathryn Classic {tournamentYear}</h2>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-7 sm:leading-8 text-gray-600 dark:text-gray-400 font-serif">
            Join us for a weekend of golf, community, and giving back. Register multiple attendees at once and indicate how many children will attend each event &mdash; <span className="font-semibold text-primary-600 dark:text-primary-400">kids are always free!</span>
          </p>
        </div>

        <div className="mx-auto mt-8 sm:mt-16 max-w-4xl lg:mt-20">
          <Formik
            initialValues={{
              adults: [{
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                events: [],
                golfHandicap: '',
                preferredTeammates: '',
                childCounts: {},
              }],
              agreeTerms: false,
            }}
            validationSchema={RegistrationSchema}
            onSubmit={handleSubmit}
          >
            {({ values, isSubmitting }) => (
              <Form className="space-y-8">
                <ScrollToError />
                {error && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-4 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-800 dark:text-red-300 whitespace-pre-line">{error}</p>
                  </div>
                )}

                {/* Attendees Section */}
                <FieldArray name="adults">
                  {({ push, remove }) => (
                    <div className="space-y-6">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Attendees</h3>
                      {values.adults.length > 1 && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 -mt-3">
                          Attendee 1 is the group organizer and will receive a summary email with everyone's
                          costs and payment options. Each other attendee gets their own confirmation.
                        </p>
                      )}

                      {values.adults.map((adult, index) => (
                        <div key={index} className="rounded-lg bg-gray-50 dark:bg-night-800 p-4 sm:p-6 shadow-sm ring-1 ring-gray-200 dark:ring-night-700">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              Attendee {index + 1}
                              {index === 0 && values.adults.length > 1 && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-primary-100 dark:bg-primary-900/40 px-2 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300">
                                  Group organizer
                                </span>
                              )}
                            </h4>
                            {values.adults.length > 1 && (
                              <button
                                type="button"
                                onClick={() => remove(index)}
                                className="text-red-600 hover:text-red-700 text-sm font-medium"
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">First name</label>
                              <Field
                                name={`adults.${index}.firstName`}
                                className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:bg-night-700 dark:ring-night-600 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                              />
                              <ErrorMessage name={`adults.${index}.firstName`} component="div" className="mt-1 text-sm text-red-600" />
                            </div>

                            <div>
                              <label className="block text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">Last name</label>
                              <Field
                                name={`adults.${index}.lastName`}
                                className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:bg-night-700 dark:ring-night-600 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                              />
                              <ErrorMessage name={`adults.${index}.lastName`} component="div" className="mt-1 text-sm text-red-600" />
                            </div>

                            <div>
                              <label className="block text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">Email</label>
                              <Field
                                type="email"
                                name={`adults.${index}.email`}
                                className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:bg-night-700 dark:ring-night-600 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                              />
                              <ErrorMessage name={`adults.${index}.email`} component="div" className="mt-1 text-sm text-red-600" />
                            </div>

                            <div>
                              <label className="block text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">Phone</label>
                              <Field
                                type="tel"
                                name={`adults.${index}.phone`}
                                className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:bg-night-700 dark:ring-night-600 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                              />
                              <ErrorMessage name={`adults.${index}.phone`} component="div" className="mt-1 text-sm text-red-600" />
                            </div>

                            <div className="col-span-2">
                              <fieldset>
                                <legend className="block text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100 text-center w-full">Select Events</legend>
                                <div className="mt-2 space-y-3">
                                  {events.map((event) => (
                                    <div key={event.id} className="space-y-2">
                                      <div className="flex items-start">
                                        <Field
                                          type="checkbox"
                                          name={`adults.${index}.events`}
                                          value={event.id}
                                          className="h-4 w-4 rounded border-gray-300 dark:border-night-600 dark:bg-night-700 text-primary-600 dark:text-primary-400 focus:ring-primary-500 mt-1 flex-shrink-0"
                                        />
                                        <label className="ml-3 text-sm">
                                          <span className="font-medium text-gray-900 dark:text-gray-100">{event.name}</span>
                                          {event.priceTbd ? (
                                            <>
                                              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">Price TBD</span>
                                              {event.adultPriceMin != null && event.adultPriceMax != null && (
                                                <span className="text-gray-500 dark:text-gray-400 ml-1.5 text-xs">(est. ${event.adultPriceMin}–${event.adultPriceMax} per person)</span>
                                              )}
                                            </>
                                          ) : (
                                            <span className="text-gray-500 dark:text-gray-400 ml-2">(${event.adultPrice} per adult &middot; kids free)</span>
                                          )}
                                        </label>
                                      </div>
                                      {event.id !== 'golf_tournament' && adult.events.includes(event.id) && (
                                        <div className="flex items-center gap-2 animate-highlight rounded-lg px-2 py-1 ml-7">
                                          <Field
                                            type="number"
                                            name={`adults.${index}.childCounts.${event.id}`}
                                            min="0"
                                            placeholder="0"
                                            className="w-20 rounded-lg border-0 px-2 py-1.5 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:bg-night-700 dark:ring-night-600 focus:ring-2 focus:ring-inset focus:ring-primary-500 text-sm"
                                          />
                                          <span className="text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                            children &mdash; <span className="font-semibold text-primary-600 dark:text-primary-400">kids are free!</span>
                                          </span>
                                        </div>
                                      )}
                                      {event.id === 'golf_tournament' && adult.events.includes(event.id) && (
                                        <div className="ml-7 animate-highlight rounded-lg px-2 py-1">
                                          <div className="flex items-start gap-2">
                                            <div className="flex flex-col gap-1 flex-shrink-0">
                                              <div className="flex items-center gap-2">
                                                <Field
                                                  type="number"
                                                  name={`adults.${index}.golfHandicap`}
                                                  min="0"
                                                  placeholder="20"
                                                  className="w-20 rounded-lg border-0 px-2 py-1.5 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:bg-night-700 dark:ring-night-600 focus:ring-2 focus:ring-inset focus:ring-primary-500 text-sm"
                                                />
                                                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">handicap</span>
                                              </div>
                                              <ErrorMessage name={`adults.${index}.golfHandicap`} component="div" className="text-xs text-red-600" />
                                            </div>
                                            <Field
                                              type="text"
                                              name={`adults.${index}.preferredTeammates`}
                                              placeholder="Preferred teammates"
                                              className="flex-1 min-w-0 rounded-lg border-0 px-2 py-1.5 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:bg-night-700 dark:ring-night-600 focus:ring-2 focus:ring-inset focus:ring-primary-500 text-sm"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <ErrorMessage name={`adults.${index}.events`} component="div" className="mt-1 text-sm text-red-600" />
                              </fieldset>
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => push({ firstName: '', lastName: '', email: '', phone: '', events: [], golfHandicap: '', preferredTeammates: '', childCounts: {} })}
                        className="mx-auto flex items-center gap-1.5 rounded-lg border border-primary-600 dark:border-primary-400 bg-white dark:bg-night-700 px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 shadow-sm hover:bg-primary-50 dark:hover:bg-night-600 transition-colors"
                      >
                        + Add Attendee
                      </button>
                    </div>
                  )}
                </FieldArray>

                {/* Total */}
                <div className="border-t border-gray-900/10 dark:border-night-700 pt-6">
                  {(() => {
                    const totals = calculateTotals(values.adults);
                    return (
                      <>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {totals.hasTbd && totals.confirmed === 0 ? 'Total: TBD' : `Total: $${totals.confirmed}`}
                        </p>
                        {totals.hasTbd && (
                          <div className="mt-2 space-y-0.5">
                            <p className="text-sm text-amber-700 dark:text-amber-400">
                              {totals.hasUnestimatedTbd && totals.estimatedMin === 0
                                ? '+ TBD'
                                : totals.hasUnestimatedTbd
                                ? `+ est. $${totals.estimatedMin}–$${totals.estimatedMax} and additional TBD costs`
                                : `+ est. $${totals.estimatedMin}–$${totals.estimatedMax} for TBD event(s)`
                              }
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">We will reach out to you with the final cost for TBD events.</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Terms & Conditions */}
                <div className="border-t border-gray-900/10 dark:border-night-700 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 text-center">A Few Things to Know</h3>
                  <div className="rounded-lg bg-gray-50 dark:bg-night-800 p-4 sm:p-6 ring-1 ring-gray-200 dark:ring-night-700 mb-6">
                    <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Payment</h4>
                        <p>
                          Please submit payment at least <strong>two weeks before the tournament</strong> — if we don't
                          hear from you by then, we may need to open your spot to someone else.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Cancellations</h4>
                        <p>
                          If you need to cancel, please reach out at least two weeks before the tournament at{' '}
                          <a href="mailto:info@kathrynclassic.com" className="text-primary-600 dark:text-primary-400 hover:underline">info@kathrynclassic.com</a>.
                        </p>
                      </div>

                      {/* Saved for future use:

                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Walk-ups</h4>
                        <p>
                          We ask that everyone register ahead of time so we can plan accordingly. Walk-ups may be possible
                          depending on space, but we can't guarantee it. Kids need to be with a registered adult at all times.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Safety & Liability</h4>
                        <p>
                          Participation is at your own risk. Please follow the rules at each venue and use appropriate equipment.
                          The tournament organizers aren't liable for injuries, accidents, or lost property.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Weather</h4>
                        <p>
                          Events may be affected by weather or other circumstances beyond our control. If anything changes,
                          we'll let you know by email as soon as we can.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Photos & Video</h4>
                        <p>
                          By participating, you're okay with us using photos and video from the event to promote
                          The Kathryn Classic and the CJD Foundation.
                        </p>
                      </div>

                      */}
                    </div>
                  </div>

                  <div className="flex justify-center gap-x-3">
                    <Field
                      type="checkbox"
                      name="agreeTerms"
                      className="h-4 w-4 rounded border-gray-300 dark:border-night-600 dark:bg-night-700 text-primary-600 dark:text-primary-400 focus:ring-primary-500 mt-1"
                    />
                    <div className="text-sm">
                      <label className="font-medium text-gray-900 dark:text-gray-100">
                        I have read and agree to the terms and conditions above
                      </label>
                      <ErrorMessage name="agreeTerms" component="div" className="mt-1 text-sm text-red-600" />
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="block w-full rounded-lg bg-primary-600 px-4 py-3 text-center text-base font-semibold text-white shadow-sm hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-colors"
                  >
                    {isSubmitting ? 'Submitting...' : 'Complete Registration'}
                  </button>
                  <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Having trouble registering? Email us at{' '}
                    <a href="mailto:info@kathrynclassic.com" className="text-primary-600 dark:text-primary-400 hover:underline">info@kathrynclassic.com</a>{' '}
                    and we'll be happy to help.
                  </p>
                </div>
              </Form>
            )}
          </Formik>

          <BookYourStay className="mt-12" />
        </div>
      </div>
    </div>
  );
}