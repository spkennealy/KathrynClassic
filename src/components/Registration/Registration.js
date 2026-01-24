import React, { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';

const events = [
  { id: 'welcome_dinner', name: 'Welcome Dinner', price: 75 },
  { id: 'golf_tournament', name: 'Golf Tournament', price: 150 },
  { id: 'beach_day', name: 'Beach Day (Non-Golfers)', price: 65 },
  { id: 'awards_brunch', name: 'Awards Ceremony & Brunch', price: 55 },
];

const RegistrationSchema = Yup.object().shape({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  phone: Yup.string().required('Phone number is required'),
  events: Yup.array().min(1, 'Select at least one event'),
  golfHandicap: Yup.number().when('events', {
    is: (events) => events && events.includes('golf_tournament'),
    then: () => Yup.number().required('Handicap is required for golf registration'),
    otherwise: () => Yup.number().notRequired(),
  }),
  dietaryRestrictions: Yup.string(),
  emergencyContactName: Yup.string().required('Emergency contact name is required'),
  emergencyContactPhone: Yup.string().required('Emergency contact phone is required'),
  agreeTerms: Yup.boolean().oneOf([true], 'You must agree to the terms and conditions'),
});

export default function Registration() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const calculateTotal = (selectedEvents) => {
    return events
      .filter(event => selectedEvents.includes(event.id))
      .reduce((sum, event) => sum + event.price, 0);
  };
  
  const handleSubmit = (values, { setSubmitting, resetForm }) => {
    // In a real application, you would send this data to your backend
    console.log('Registration submitted:', values);
    setTimeout(() => {
      setSubmitting(false);
      setIsSubmitted(true);
      resetForm();
    }, 1000);
  };
  
  if (isSubmitted) {
    return (
      <div className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Registration Complete</h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Thank you for registering for The Kathryn Classic! We've sent a confirmation email with event details.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <button
                onClick={() => setIsSubmitted(false)}
                className="rounded-md bg-green-800 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
              >
                Register Another Person
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Register for The Kathryn Classic</h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Join us for a weekend of golf, community, and giving back. Register for individual events or the full weekend.
          </p>
        </div>
        
        <div className="mx-auto mt-16 max-w-xl sm:mt-20">
          <Formik
            initialValues={{
              firstName: '',
              lastName: '',
              email: '',
              phone: '',
              events: [],
              golfHandicap: '',
              dietaryRestrictions: '',
              emergencyContactName: '',
              emergencyContactPhone: '',
              agreeTerms: false,
            }}
            validationSchema={RegistrationSchema}
            onSubmit={handleSubmit}
          >
            {({ values, isSubmitting, errors, touched }) => (
              <Form className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-semibold leading-6 text-gray-900">
                    First name
                  </label>
                  <div className="mt-2.5">
                    <Field
                      type="text"
                      name="firstName"
                      id="firstName"
                      autoComplete="given-name"
                      className="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6"
                    />
                    <ErrorMessage name="firstName" component="div" className="mt-1 text-sm text-red-600" />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="lastName" className="block text-sm font-semibold leading-6 text-gray-900">
                    Last name
                  </label>
                  <div className="mt-2.5">
                    <Field
                      type="text"
                      name="lastName"
                      id="lastName"
                      autoComplete="family-name"
                      className="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6"
                    />
                    <ErrorMessage name="lastName" component="div" className="mt-1 text-sm text-red-600" />
                  </div>
                </div>
                
                <div className="sm:col-span-2">
                  <label htmlFor="email" className="block text-sm font-semibold leading-6 text-gray-900">
                    Email
                  </label>
                  <div className="mt-2.5">
                    <Field
                      type="email"
                      name="email"
                      id="email"
                      autoComplete="email"
                      className="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6"
                    />
                    <ErrorMessage name="email" component="div" className="mt-1 text-sm text-red-600" />
                  </div>
                </div>
                
                <div className="sm:col-span-2">
                  <label htmlFor="phone" className="block text-sm font-semibold leading-6 text-gray-900">
                    Phone number
                  </label>
                  <div className="mt-2.5">
                    <Field
                      type="tel"
                      name="phone"
                      id="phone"
                      autoComplete="tel"
                      className="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6"
                    />
                    <ErrorMessage name="phone" component="div" className="mt-1 text-sm text-red-600" />
                  </div>
                </div>
                
                <div className="sm:col-span-2">
                  <fieldset>
                    <legend className="block text-sm font-semibold leading-6 text-gray-900">Select Events</legend>
                    <div className="mt-2.5 space-y-3">
                      {events.map((event) => (
                        <div key={event.id} className="relative flex items-start">
                          <div className="flex h-6 items-center">
                            <Field
                              type="checkbox"
                              name="events"
                              value={event.id}
                              id={event.id}
                              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-600"
                            />
                          </div>
                          <div className="ml-3 text-sm leading-6">
                            <label htmlFor={event.id} className="font-medium text-gray-900">
                              {event.name}
                            </label>
                            <span className="text-gray-500 ml-2">(${event.price})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <ErrorMessage name="events" component="div" className="mt-1 text-sm text-red-600" />
                  </fieldset>
                  
                  {values.events.includes('golf_tournament') && (
                    <div className="mt-4">
                      <label htmlFor="golfHandicap" className="block text-sm font-semibold leading-6 text-gray-900">
                        Golf Handicap
                      </label>
                      <div className="mt-2.5">
                        <Field
                          type="number"
                          name="golfHandicap"
                          id="golfHandicap"
                          className="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6"
                        />
                        <ErrorMessage name="golfHandicap" component="div" className="mt-1 text-sm text-red-600" />
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-4 border-t border-gray-900/10 pt-4">
                    <p className="text-base font-semibold leading-7 text-gray-900">
                      Total: ${calculateTotal(values.events)}
                    </p>
                  </div>
                </div>
                
                <div className="sm:col-span-2">
                  <label htmlFor="dietaryRestrictions" className="block text-sm font-semibold leading-6 text-gray-900">
                    Dietary Restrictions
                  </label>
                  <div className="mt-2.5">
                    <Field
                      as="textarea"
                      name="dietaryRestrictions"
                      id="dietaryRestrictions"
                      rows={2}
                      className="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6"
                      placeholder="Please list any dietary restrictions or allergies"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="emergencyContactName" className="block text-sm font-semibold leading-6 text-gray-900">
                    Emergency Contact Name
                  </label>
                  <div className="mt-2.5">
                    <Field
                      type="text"
                      name="emergencyContactName"
                      id="emergencyContactName"
                      className="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6"
                    />
                    <ErrorMessage name="emergencyContactName" component="div" className="mt-1 text-sm text-red-600" />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="emergencyContactPhone" className="block text-sm font-semibold leading-6 text-gray-900">
                    Emergency Contact Phone
                  </label>
                  <div className="mt-2.5">
                    <Field
                      type="tel"
                      name="emergencyContactPhone"
                      id="emergencyContactPhone"
                      className="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6"
                    />
                    <ErrorMessage name="emergencyContactPhone" component="div" className="mt-1 text-sm text-red-600" />
                  </div>
                </div>
                
                <div className="sm:col-span-2">
                  <div className="relative flex gap-x-3">
                    <div className="flex h-6 items-center">
                      <Field
                        type="checkbox"
                        name="agreeTerms"
                        id="agreeTerms"
                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-600"
                      />
                    </div>
                    <div className="text-sm leading-6">
                      <label htmlFor="agreeTerms" className="font-medium text-gray-900">
                        I agree to the terms and conditions
                      </label>
                      <p className="text-gray-500">By checking this box, you agree to our event policies, cancellation terms, and media release.</p>
                      <ErrorMessage name="agreeTerms" component="div" className="mt-1 text-sm text-red-600" />
                    </div>
                  </div>
                </div>
                
                <div className="sm:col-span-2 mt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="block w-full rounded-md bg-green-800 px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
                  >
                    {isSubmitting ? 'Submitting...' : 'Register Now'}
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