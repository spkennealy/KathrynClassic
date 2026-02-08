import React, { useState, useEffect } from 'react';
import { Formik, Form, Field, ErrorMessage, FieldArray } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../supabaseClient';
import { getCurrentTournamentYear, getTournamentEvents, formatDate } from '../../utils/tournamentUtils';

const AdultSchema = Yup.object().shape({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  phone: Yup.string(),
  events: Yup.array().min(1, 'Select at least one event'),
  golfHandicap: Yup.number().when('events', {
    is: (events) => events && events.includes('golf_tournament'),
    then: () => Yup.number().required('Handicap is required for golf. Put 20 if you don\'t have one.'),
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
  email: Yup.string().email('Invalid email').required('Email is required'),
  phone: Yup.string(),
  notes: Yup.string(),
});

export default function Registration() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedTotal, setSubmittedTotal] = useState(0);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [tournamentYear, setTournamentYear] = useState(null);
  const [tournamentId, setTournamentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registrationStatus, setRegistrationStatus] = useState('open'); // 'open', 'full', 'closed'
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactAlreadyExists, setContactAlreadyExists] = useState(false);

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
          eventId: event.id
        }));

        setEvents(formattedEvents);
      }
    } catch (err) {
      console.error('Error loading tournament data:', err);
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
        if (event) {
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

  const handleWaitlistSubmit = async (values, { setSubmitting, resetForm }) => {
    try {
      setError(null);

      // STEP 1: Check if contact exists or create new one
      const { data: existingContact, error: lookupError } = await supabase
        .from('contacts')
        .select('id')
        .eq('email', values.email)
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
            phone: values.phone || null,
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
            email: values.email,
            phone: values.phone || null
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
      console.error('Error submitting waitlist:', err);
      setError('Failed to join waitlist. Please try again or contact support.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContactSubmit = async (values, { setSubmitting, resetForm }) => {
    try {
      setError(null);
      setContactAlreadyExists(false);

      // Check if contact already exists
      const { data: existingContact, error: lookupError } = await supabase
        .from('contacts')
        .select('id')
        .eq('email', values.email)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (existingContact) {
        // Contact already exists - update their info and show message
        await supabase
          .from('contacts')
          .update({
            first_name: values.firstName,
            last_name: values.lastName,
            phone: values.phone || null,
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
            email: values.email,
            phone: values.phone || null
          }]);

        if (insertError) throw insertError;

        setContactSubmitted(true);
      }

      resetForm();
    } catch (err) {
      console.error('Error submitting contact:', err);
      setError('Failed to save your information. Please try again or contact support.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (values, { setSubmitting, resetForm }) => {
    try {
      setError(null);

      // Calculate total amount and team info
      const totalAmount = calculateTotal(values.adults);
      const golfAdults = values.adults.filter(adult =>
        adult.events.includes('golf_tournament')
      );
      const isFullTeam = golfAdults.length === 4;
      const teamGroupId = isFullTeam ? crypto.randomUUID() : null;

      // STEP 1: Get unique emails and batch lookup contacts
      const emails = [...new Set(values.adults.map(a => a.email))];

      const { data: existingContacts, error: lookupError } = await supabase
        .from('contacts')
        .select('id, email')
        .in('email', emails);

      if (lookupError) throw lookupError;

      // Map existing contact_ids
      const contactMap = new Map(
        (existingContacts || []).map(c => [c.email, c.id])
      );

      // STEP 2: Identify new contacts to create
      const newContactsData = values.adults
        .filter(a => !contactMap.has(a.email))
        .reduce((acc, adult) => {
          // Deduplicate by email
          if (!acc.find(c => c.email === adult.email)) {
            acc.push({
              first_name: adult.firstName,
              last_name: adult.lastName,
              email: adult.email,
              phone: adult.phone || null
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

        (insertedContacts || []).forEach(c => contactMap.set(c.email, c.id));
      }

      // STEP 3: Update existing contacts with latest info
      const contactUpdates = values.adults
        .filter(a => existingContacts && existingContacts.find(c => c.email === a.email))
        .reduce((acc, adult) => {
          // Deduplicate by email
          const existing = acc.find(u => u.email === adult.email);
          if (!existing) {
            acc.push({
              id: contactMap.get(adult.email),
              email: adult.email,
              first_name: adult.firstName,
              last_name: adult.lastName,
              phone: adult.phone || null,
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

      // STEP 4: Create registrations with contact_id references (without events/child_counts)
      const registrations = values.adults.map(adult => {
        const isGolfer = adult.events.includes('golf_tournament');

        return {
          contact_id: contactMap.get(adult.email),
          golf_handicap: adult.golfHandicap || null,
          preferred_teammates: isGolfer && adult.preferredTeammates
            ? adult.preferredTeammates
            : null,
          team_group_id: isGolfer && teamGroupId ? teamGroupId : null,
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
        const adult = values.adults[index];

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
        console.log('Full team registered with team_group_id:', teamGroupId);
      }
      setSubmittedTotal(totalAmount);
      setIsSubmitted(true);
      resetForm();
    } catch (err) {
      console.error('Error saving registration:', err);
      setError('Failed to submit registration. Please try again or contact support.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="bg-primary-50 py-12 sm:py-24 lg:py-32 min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8">
              <svg className="mx-auto h-16 w-16 text-primary-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-primary-600 font-serif">
              {registrationStatus === 'full' ? 'Added to Waitlist!' : 'Congratulations!'}
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 font-serif">
              {registrationStatus === 'full'
                ? "You've been added to the waitlist for The Kathryn Classic. We'll contact you if a spot becomes available."
                : "You've successfully registered for The Kathryn Classic!"
              }
            </p>

            {registrationStatus !== 'full' && (
              <>
                <div className="mt-6 sm:mt-10 rounded-lg bg-primary-50 p-4 sm:p-8 ring-1 ring-primary-200">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Next Steps: Payment Required</h3>
                  <div className="text-left space-y-4">
                    <p className="text-base text-gray-700">
                      <strong>Total Amount Due:</strong> <span className="text-2xl font-bold text-primary-600">${submittedTotal}</span>
                    </p>
                    <div className="border-t border-primary-200 pt-4">
                      <p className="text-base font-semibold text-gray-900 mb-3">Please submit payment via:</p>
                      <div className="space-y-2 text-sm text-gray-700">
                        <p><strong>Venmo:</strong> Payment details will be provided</p>
                        <p><strong>Zelle:</strong> Payment details will be provided</p>
                      </div>
                      <p className="mt-4 text-sm text-gray-600 bg-white p-3 rounded border border-primary-200">
                        <strong>Note:</strong> Your registration will be confirmed once payment is received.
                        Please include your name in the payment note.
                      </p>
                    </div>
                  </div>
                </div>

                <p className="mt-8 text-base text-gray-600 font-serif">
                  A confirmation email with event details has been sent to your email address.
                </p>
              </>
            )}

            <div className="mt-10 flex items-center justify-center gap-x-6">
              <button
                onClick={() => {
                  setIsSubmitted(false);
                  setSubmittedTotal(0);
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
      <div className="bg-primary-50 py-12 sm:py-24 lg:py-32 min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-lg text-gray-600 font-serif">Loading registration form...</p>
          </div>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-primary-50 py-12 sm:py-24 lg:py-32 min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-primary-600 font-serif">Registration</h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 font-serif">
              Registration is not currently available. Please check back later for upcoming tournament dates.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show off-season message if registration is closed (no waitlist)
  if (registrationStatus === 'closed') {
    // Show success message if contact was submitted
    if (contactSubmitted) {
      return (
        <div className="bg-primary-50 py-24 sm:py-32 min-h-screen">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mb-8">
                <svg className="mx-auto h-16 w-16 text-primary-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-primary-600 font-serif">
                {contactAlreadyExists ? "You're Already on Our List!" : "Thank You!"}
              </h2>
              <p className="mt-6 text-lg leading-8 text-gray-600 font-serif">
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
      <div className="bg-primary-50 py-12 sm:py-24 lg:py-32 min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-8">
              <svg className="mx-auto h-16 w-16 text-primary-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-primary-600 font-serif">
              Registration Currently Closed
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 font-serif">
              We're currently in the off-season. Registration for the next Kathryn Classic will open in March 2026.
            </p>
            <p className="mt-4 text-base text-gray-600 font-serif">
              Sign up below to be notified when registration opens.
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
                email: Yup.string().email('Invalid email').required('Email is required'),
                phone: Yup.string(),
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

                  <div className="rounded-lg bg-white p-4 sm:p-8 shadow-lg ring-1 ring-gray-200">
                    <h3 className="text-xl font-semibold text-gray-900 mb-6">Get Notified</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold leading-6 text-gray-900">
                          First name <span className="text-red-500">*</span>
                        </label>
                        <Field
                          name="firstName"
                          className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                        />
                        <ErrorMessage name="firstName" component="div" className="mt-1 text-sm text-red-600" />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold leading-6 text-gray-900">
                          Last name <span className="text-red-500">*</span>
                        </label>
                        <Field
                          name="lastName"
                          className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                        />
                        <ErrorMessage name="lastName" component="div" className="mt-1 text-sm text-red-600" />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold leading-6 text-gray-900">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <Field
                          type="email"
                          name="email"
                          className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                        />
                        <ErrorMessage name="email" component="div" className="mt-1 text-sm text-red-600" />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold leading-6 text-gray-900">Phone</label>
                        <Field
                          type="tel"
                          name="phone"
                          className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
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
      <div className="bg-primary-50 py-12 sm:py-24 lg:py-32 min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-primary-600 font-serif">
              Registration Full - Join Waitlist
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 font-serif">
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

                  <div className="rounded-lg bg-white p-4 sm:p-8 shadow-lg ring-1 ring-gray-200">
                    <h3 className="text-xl font-semibold text-gray-900 mb-6">Your Information</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold leading-6 text-gray-900">
                          First name <span className="text-red-500">*</span>
                        </label>
                        <Field
                          name="firstName"
                          className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                        />
                        <ErrorMessage name="firstName" component="div" className="mt-1 text-sm text-red-600" />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold leading-6 text-gray-900">
                          Last name <span className="text-red-500">*</span>
                        </label>
                        <Field
                          name="lastName"
                          className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                        />
                        <ErrorMessage name="lastName" component="div" className="mt-1 text-sm text-red-600" />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold leading-6 text-gray-900">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <Field
                          type="email"
                          name="email"
                          className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                        />
                        <ErrorMessage name="email" component="div" className="mt-1 text-sm text-red-600" />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold leading-6 text-gray-900">Phone</label>
                        <Field
                          type="tel"
                          name="phone"
                          className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                        />
                        <ErrorMessage name="phone" component="div" className="mt-1 text-sm text-red-600" />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold leading-6 text-gray-900">
                          Additional Notes
                        </label>
                        <Field
                          as="textarea"
                          name="notes"
                          rows={3}
                          placeholder="Let us know which events you're interested in or any other details..."
                          className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary-50 py-12 sm:py-24 lg:py-32 min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-primary-600 font-serif">Register for The Kathryn Classic {tournamentYear}</h2>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-7 sm:leading-8 text-gray-600 font-serif">
            Join us for a weekend of golf, community, and giving back. Register multiple attendees at once and indicate how many children will attend each event.
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
                {error && (
                  <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                {/* Attendees Section */}
                <FieldArray name="adults">
                  {({ push, remove }) => (
                    <div className="space-y-6">
                      <h3 className="text-xl font-semibold text-gray-900">Attendees</h3>

                      {values.adults.map((adult, index) => (
                        <div key={index} className="rounded-lg bg-gray-50 p-4 sm:p-6 shadow-sm ring-1 ring-gray-200">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-semibold text-gray-900">Attendee {index + 1}</h4>
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
                              <label className="block text-sm font-semibold leading-6 text-gray-900">First name</label>
                              <Field
                                name={`adults.${index}.firstName`}
                                className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                              />
                              <ErrorMessage name={`adults.${index}.firstName`} component="div" className="mt-1 text-sm text-red-600" />
                            </div>

                            <div>
                              <label className="block text-sm font-semibold leading-6 text-gray-900">Last name</label>
                              <Field
                                name={`adults.${index}.lastName`}
                                className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                              />
                              <ErrorMessage name={`adults.${index}.lastName`} component="div" className="mt-1 text-sm text-red-600" />
                            </div>

                            <div>
                              <label className="block text-sm font-semibold leading-6 text-gray-900">Email</label>
                              <Field
                                type="email"
                                name={`adults.${index}.email`}
                                className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                              />
                              <ErrorMessage name={`adults.${index}.email`} component="div" className="mt-1 text-sm text-red-600" />
                            </div>

                            <div>
                              <label className="block text-sm font-semibold leading-6 text-gray-900">Phone</label>
                              <Field
                                type="tel"
                                name={`adults.${index}.phone`}
                                className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                              />
                              <ErrorMessage name={`adults.${index}.phone`} component="div" className="mt-1 text-sm text-red-600" />
                            </div>

                            <div className="sm:col-span-2">
                              <fieldset>
                                <legend className="block text-sm font-semibold leading-6 text-gray-900">Select Events</legend>
                                <div className="mt-2 space-y-3">
                                  {events.map((event) => (
                                    <div key={event.id} className="space-y-2">
                                      <div className="flex items-start">
                                        <Field
                                          type="checkbox"
                                          name={`adults.${index}.events`}
                                          value={event.id}
                                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 mt-1 flex-shrink-0"
                                        />
                                        <label className="ml-3 text-sm">
                                          <span className="font-medium text-gray-900">{event.name}</span>
                                          <span className="text-gray-500 block sm:inline sm:ml-2">(${event.adultPrice} per person)</span>
                                        </label>
                                      </div>
                                      {event.id !== 'golf_tournament' && adult.events.includes(event.id) && (
                                        <div className="flex items-center gap-2 animate-highlight rounded-lg px-2 py-1 ml-7">
                                          <Field
                                            type="number"
                                            name={`adults.${index}.childCounts.${event.id}`}
                                            min="0"
                                            placeholder="0"
                                            className="w-20 rounded-lg border-0 px-2 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 text-sm"
                                          />
                                          <span className="text-xs text-gray-500 whitespace-nowrap">children (free)</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <ErrorMessage name={`adults.${index}.events`} component="div" className="mt-1 text-sm text-red-600" />
                              </fieldset>

                              {adult.events.includes('golf_tournament') && (
                                <>
                                  <div className="mt-4">
                                    <label className="block text-sm font-semibold leading-6 text-gray-900">Golf Handicap</label>
                                    <Field
                                      type="number"
                                      name={`adults.${index}.golfHandicap`}
                                      placeholder="Enter handicap (or 20 if unknown)"
                                      className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                                    />
                                    <ErrorMessage name={`adults.${index}.golfHandicap`} component="div" className="mt-1 text-sm text-red-600" />
                                  </div>
                                  <div className="mt-4">
                                    <label className="block text-sm font-semibold leading-6 text-gray-900">Preferred Teammates</label>
                                    <Field
                                      type="text"
                                      name={`adults.${index}.preferredTeammates`}
                                      placeholder="Scottie Scheffler, Rory McIlroy, Tiger Woods..."
                                      className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Enter the names of players you'd like to play with, separated by commas</p>
                                    <ErrorMessage name={`adults.${index}.preferredTeammates`} component="div" className="mt-1 text-sm text-red-600" />
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => push({ firstName: '', lastName: '', email: '', phone: '', events: [], golfHandicap: '', preferredTeammates: '', childCounts: {} })}
                        className="w-full rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
                      >
                        + Add Attendee
                      </button>
                    </div>
                  )}
                </FieldArray>

                {/* Total */}
                <div className="border-t border-gray-900/10 pt-6">
                  <p className="text-2xl font-bold text-gray-900">
                    Total: ${calculateTotal(values.adults)}
                  </p>
                </div>

                {/* Terms & Conditions */}
                <div className="border-t border-gray-900/10 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Terms & Conditions</h3>
                  <div className="rounded-lg bg-gray-50 p-4 sm:p-6 ring-1 ring-gray-200 mb-6">
                    <div className="space-y-4 text-sm text-gray-700">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Payment Commitment</h4>
                        <p>
                          By registering, you commit to submitting payment at least <strong>two weeks before the tournament</strong>.
                          If payment is not received by this date, your spot(s) may be reopened to other attendees.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Cancellation Policy</h4>
                        <p>
                          Cancellations made more than two weeks before the tournament are eligible for a full refund.
                          Cancellations within two weeks of the tournament may receive a refund at the organizer's discretion,
                          depending on whether the spot can be filled.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Event Participation</h4>
                        <p>
                          All participants must register in advance. Walk-ups may be accommodated space permitting, but cannot be guaranteed.
                          Children must be supervised by a registered adult at all times during events.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Assumption of Risk</h4>
                        <p>
                          Participation in tournament activities is at your own risk. Please use appropriate safety equipment
                          and follow all posted rules at event venues. The tournament organizers are not liable for injuries,
                          accidents, or loss of personal property.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Weather & Schedule Changes</h4>
                        <p>
                          Events are subject to weather conditions and unforeseen circumstances. In the event of cancellation
                          or significant schedule changes, registered participants will be notified via email as soon as possible.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Photo & Media Release</h4>
                        <p>
                          By participating, you consent to the use of photographs and video taken during the tournament
                          for promotional purposes related to The Kathryn Classic and the CJD Foundation.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center gap-x-3">
                    <Field
                      type="checkbox"
                      name="agreeTerms"
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 mt-1"
                    />
                    <div className="text-sm">
                      <label className="font-medium text-gray-900">
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
                </div>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </div>
  );
}