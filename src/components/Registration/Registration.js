import React, { useState, useEffect } from 'react';
import { Formik, Form, Field, ErrorMessage, FieldArray } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../supabaseClient';
import { getCurrentTournamentYear, getTournamentEvents, formatDate } from '../../utils/tournamentUtils';

const AdultSchema = Yup.object().shape({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  phone: Yup.string().required('Phone is required'),
  events: Yup.array().min(1, 'Select at least one event'),
  golfHandicap: Yup.number().when('events', {
    is: (events) => events && events.includes('golf_tournament'),
    then: () => Yup.number().required('Handicap is required for golf. Put 20 if you don\'t have one.'),
    otherwise: () => Yup.number().notRequired(),
  }),
});

const KidSchema = Yup.object().shape({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  age: Yup.number(),
  events: Yup.array().min(1, 'Select at least one event'),
});

const RegistrationSchema = Yup.object().shape({
  adults: Yup.array().of(AdultSchema).min(1, 'At least one adult is required'),
  kids: Yup.array().of(KidSchema),
  agreeTerms: Yup.boolean().oneOf([true], 'You must agree to the terms and conditions'),
});

export default function Registration() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedTotal, setSubmittedTotal] = useState(0);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [tournamentYear, setTournamentYear] = useState(null);
  const [tournamentId, setTournamentId] = useState(null);
  const [loading, setLoading] = useState(true);

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

        // Get events
        const eventData = await getTournamentEvents(year);

        // Transform events to match expected format
        const formattedEvents = eventData.map(event => ({
          id: event.event_type,
          name: `${event.event_name} - ${formatDate(event.event_date).split(',')[0]}, ${formatDate(event.event_date).split(',')[1].trim()}`,
          adultPrice: parseFloat(event.adult_price),
          childPrice: parseFloat(event.child_price),
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

  const calculateTotal = (adults, kids) => {
    let total = 0;

    adults.forEach(adult => {
      adult.events.forEach(eventId => {
        const event = events.find(e => e.id === eventId);
        if (event) total += event.adultPrice;
      });
    });

    kids.forEach(kid => {
      kid.events.forEach(eventId => {
        const event = events.find(e => e.id === eventId);
        if (event) total += event.childPrice;
      });
    });

    return total;
  };

  const handleSubmit = async (values, { setSubmitting, resetForm }) => {
    try {
      setError(null);

      // Calculate total amount
      const totalAmount = calculateTotal(values.adults, values.kids);

      // Prepare data for database - insert each person as a separate record
      const registrations = [];

      // Add adults
      values.adults.forEach(adult => {
        registrations.push({
          first_name: adult.firstName,
          last_name: adult.lastName,
          email: adult.email,
          phone: adult.phone,
          events: adult.events,
          golf_handicap: adult.golfHandicap || null,
          is_child: false,
          age: null,
          tournament_id: tournamentId,
          payment_status: 'pending',
          created_at: new Date().toISOString(),
        });
      });

      // Add kids
      values.kids.forEach(kid => {
        registrations.push({
          first_name: kid.firstName,
          last_name: kid.lastName,
          email: null,
          phone: null,
          events: kid.events,
          golf_handicap: null,
          is_child: true,
          age: kid.age,
          tournament_id: tournamentId,
          payment_status: 'pending',
          created_at: new Date().toISOString(),
        });
      });

      // Insert into Supabase
      const { data, error: supabaseError } = await supabase
        .from('registrations')
        .insert(registrations)
        .select();

      if (supabaseError) {
        throw supabaseError;
      }

      console.log('Registration saved successfully:', data);
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
      <div className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8">
              <svg className="mx-auto h-16 w-16 text-primary-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Congratulations!</h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              You've successfully registered for The Kathryn Classic!
            </p>

            <div className="mt-10 rounded-lg bg-primary-50 p-8 ring-1 ring-primary-200">
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

            <p className="mt-8 text-base text-gray-600">
              A confirmation email with event details has been sent to your email address.
            </p>

            <div className="mt-10 flex items-center justify-center gap-x-6">
              <button
                onClick={() => {
                  setIsSubmitted(false);
                  setSubmittedTotal(0);
                }}
                className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-colors"
              >
                Register Another Group
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center">
            <p className="text-lg text-gray-600">Loading registration form...</p>
          </div>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Registration</h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Registration is not currently available. Please check back later for upcoming tournament dates.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Register for The Kathryn Classic {tournamentYear}</h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Join us for a weekend of golf, community, and giving back. Register multiple people at once.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-4xl sm:mt-20">
          <Formik
            initialValues={{
              adults: [{
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                events: [],
                golfHandicap: '',
              }],
              kids: [],
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

                {/* Adults Section */}
                <FieldArray name="adults">
                  {({ push, remove }) => (
                    <div className="space-y-6">
                      <h3 className="text-xl font-semibold text-gray-900">Adults</h3>

                      {values.adults.map((adult, index) => (
                        <div key={index} className="rounded-lg bg-gray-50 p-6 shadow-sm ring-1 ring-gray-200">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-semibold text-gray-900">Adult {index + 1}</h4>
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

                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                            <div className="sm:col-span-2">
                              <label className="block text-sm font-semibold leading-6 text-gray-900">Email</label>
                              <Field
                                type="email"
                                name={`adults.${index}.email`}
                                className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                              />
                              <ErrorMessage name={`adults.${index}.email`} component="div" className="mt-1 text-sm text-red-600" />
                            </div>

                            <div className="sm:col-span-2">
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
                                <div className="mt-2 space-y-2">
                                  {events.map((event) => (
                                    <div key={event.id} className="flex items-start">
                                      <Field
                                        type="checkbox"
                                        name={`adults.${index}.events`}
                                        value={event.id}
                                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 mt-1"
                                      />
                                      <label className="ml-3 text-sm">
                                        <span className="font-medium text-gray-900">{event.name}</span>
                                        <span className="text-gray-500 ml-2">(${event.adultPrice})</span>
                                      </label>
                                    </div>
                                  ))}
                                </div>
                                <ErrorMessage name={`adults.${index}.events`} component="div" className="mt-1 text-sm text-red-600" />
                              </fieldset>

                              {adult.events.includes('golf_tournament') && (
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
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => push({ firstName: '', lastName: '', email: '', phone: '', events: [], golfHandicap: '' })}
                        className="w-full rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
                      >
                        + Add Adult
                      </button>
                    </div>
                  )}
                </FieldArray>

                {/* Kids Section */}
                <FieldArray name="kids">
                  {({ push, remove }) => (
                    <div className="space-y-6">
                      <h3 className="text-xl font-semibold text-gray-900">Children</h3>

                      {values.kids.map((kid, index) => (
                        <div key={index} className="rounded-lg bg-blue-50 p-6 shadow-sm ring-1 ring-blue-200">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-semibold text-gray-900">Child {index + 1}</h4>
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="text-red-600 hover:text-red-700 text-sm font-medium"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label className="block text-sm font-semibold leading-6 text-gray-900">First name</label>
                              <Field
                                name={`kids.${index}.firstName`}
                                className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                              />
                              <ErrorMessage name={`kids.${index}.firstName`} component="div" className="mt-1 text-sm text-red-600" />
                            </div>

                            <div>
                              <label className="block text-sm font-semibold leading-6 text-gray-900">Last name</label>
                              <Field
                                name={`kids.${index}.lastName`}
                                className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                              />
                              <ErrorMessage name={`kids.${index}.lastName`} component="div" className="mt-1 text-sm text-red-600" />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-sm font-semibold leading-6 text-gray-900">Age</label>
                              <Field
                                type="number"
                                name={`kids.${index}.age`}
                                placeholder="0-17"
                                className="mt-2 block w-full rounded-lg border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-500 sm:text-sm"
                              />
                              <ErrorMessage name={`kids.${index}.age`} component="div" className="mt-1 text-sm text-red-600" />
                            </div>

                            <div className="sm:col-span-2">
                              <fieldset>
                                <legend className="block text-sm font-semibold leading-6 text-gray-900">Select Events</legend>
                                <div className="mt-2 space-y-2">
                                  {events.map((event) => (
                                    <div key={event.id} className="flex items-start">
                                      <Field
                                        type="checkbox"
                                        name={`kids.${index}.events`}
                                        value={event.id}
                                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 mt-1"
                                      />
                                      <label className="ml-3 text-sm">
                                        <span className="font-medium text-gray-900">{event.name}</span>
                                        <span className="text-gray-500 ml-2">(${event.childPrice} child rate)</span>
                                      </label>
                                    </div>
                                  ))}
                                </div>
                                <ErrorMessage name={`kids.${index}.events`} component="div" className="mt-1 text-sm text-red-600" />
                              </fieldset>
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => push({ firstName: '', lastName: '', age: '', events: [] })}
                        className="w-full rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
                      >
                        + Add Child
                      </button>
                    </div>
                  )}
                </FieldArray>

                {/* Total */}
                <div className="border-t border-gray-900/10 pt-6">
                  <p className="text-2xl font-bold text-gray-900">
                    Total: ${calculateTotal(values.adults, values.kids)}
                  </p>
                </div>

                {/* Terms & Conditions */}
                <div className="border-t border-gray-900/10 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Terms & Conditions</h3>
                  <div className="rounded-lg bg-gray-50 p-6 ring-1 ring-gray-200 mb-6">
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

                  <div className="flex gap-x-3">
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