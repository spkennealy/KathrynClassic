import React, { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';

const donationLevels = [
  { id: 'bronze', name: 'Bronze Sponsor', amount: 500, benefits: ['Recognition in event program', 'Tax deduction receipt'] },
  { id: 'silver', name: 'Silver Sponsor', amount: 1000, benefits: ['Logo on tournament banner', 'Recognition in event program', 'One player registration', 'Tax deduction receipt'] },
  { id: 'gold', name: 'Gold Sponsor', amount: 2500, benefits: ['Logo on tournament banner', 'Dedicated sign at one hole', 'Recognition in event program', 'Two player registrations', 'Welcome dinner tickets for two', 'Tax deduction receipt'] },
  { id: 'platinum', name: 'Platinum Sponsor', amount: 5000, benefits: ['Logo prominently displayed on all materials', 'Company name announced during events', 'Dedicated sign at two holes', 'Recognition in event program', 'Four player registrations', 'Welcome dinner tickets for four', 'Tax deduction receipt'] },
  { id: 'custom', name: 'Custom Amount', amount: '', benefits: ['Tax deduction receipt', 'Recognition in event program (for donations of $250+)'] },
];

const DonationSchema = Yup.object().shape({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  phone: Yup.string().required('Phone number is required'),
  company: Yup.string(),
  donationType: Yup.string().required('Please select a donation type'),
  customAmount: Yup.number().when('donationType', {
    is: 'custom',
    then: () => Yup.number().min(10, 'Minimum donation is $10').required('Amount is required'),
    otherwise: () => Yup.number().notRequired(),
  }),
  message: Yup.string(),
  isAnonymous: Yup.boolean(),
});

export default function Donations() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const handleSubmit = (values, { setSubmitting, resetForm }) => {
    // In a real application, you would send this data to your backend
    console.log('Donation submitted:', values);
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
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Thank You for Your Donation</h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Your generosity helps make The Kathryn Classic possible and supports our charitable cause.
              We've sent a confirmation email with tax receipt information.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <button
                onClick={() => setIsSubmitted(false)}
                className="rounded-md bg-green-800 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
              >
                Make Another Donation
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
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Support The Kathryn Classic</h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Your donation helps fund our tournament and supports our charitable mission.
            All donations are tax-deductible.
          </p>
        </div>
        
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 mb-16">
            {donationLevels.slice(0, 4).map((level) => (
              <div key={level.id} className="rounded-lg bg-gray-50 shadow-sm ring-1 ring-gray-900/5">
                <div className="p-6">
                  <h3 className="text-lg font-semibold leading-7 text-gray-900">{level.name}</h3>
                  <p className="mt-2 text-xl font-bold tracking-tight text-green-800">${level.amount}</p>
                  <ul className="mt-4 space-y-2 text-sm text-gray-600">
                    {level.benefits.map((benefit, index) => (
                      <li key={index} className="flex gap-x-3">
                        <svg className="h-5 w-5 flex-none text-green-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                        </svg>
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          
          <Formik
            initialValues={{
              firstName: '',
              lastName: '',
              email: '',
              phone: '',
              company: '',
              donationType: '',
              customAmount: '',
              message: '',
              isAnonymous: false,
            }}
            validationSchema={DonationSchema}
            onSubmit={handleSubmit}
          >
            {({ values, isSubmitting, setFieldValue }) => (
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
                  <label htmlFor="company" className="block text-sm font-semibold leading-6 text-gray-900">
                    Company (optional)
                  </label>
                  <div className="mt-2.5">
                    <Field
                      type="text"
                      name="company"
                      id="company"
                      className="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6"
                    />
                  </div>
                </div>
                
                <div className="sm:col-span-2">
                  <fieldset>
                    <legend className="block text-sm font-semibold leading-6 text-gray-900">Donation Level</legend>
                    <div className="mt-2.5 space-y-3">
                      {donationLevels.map((level) => (
                        <div key={level.id} className="relative flex items-start">
                          <div className="flex h-6 items-center">
                            <Field
                              type="radio"
                              name="donationType"
                              value={level.id}
                              id={level.id}
                              className="h-4 w-4 border-gray-300 text-green-600 focus:ring-green-600"
                              onChange={() => {
                                setFieldValue('donationType', level.id);
                                if (level.id !== 'custom') {
                                  setFieldValue('customAmount', level.amount);
                                } else {
                                  setFieldValue('customAmount', '');
                                }
                              }}
                            />
                          </div>
                          <div className="ml-3 text-sm leading-6">
                            <label htmlFor={level.id} className="font-medium text-gray-900">
                              {level.name}
                            </label>
                            {level.id !== 'custom' && (
                              <span className="text-gray-500 ml-2">(${level.amount})</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <ErrorMessage name="donationType" component="div" className="mt-1 text-sm text-red-600" />
                  </fieldset>
                </div>
                
                {values.donationType === 'custom' && (
                  <div className="sm:col-span-2">
                    <label htmlFor="customAmount" className="block text-sm font-semibold leading-6 text-gray-900">
                      Custom Amount ($)
                    </label>
                    <div className="mt-2.5">
                      <Field
                        type="number"
                        name="customAmount"
                        id="customAmount"
                        className="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6"
                        placeholder="Enter amount"
                      />
                      <ErrorMessage name="customAmount" component="div" className="mt-1 text-sm text-red-600" />
                    </div>
                  </div>
                )}
                
                <div className="sm:col-span-2">
                  <label htmlFor="message" className="block text-sm font-semibold leading-6 text-gray-900">
                    Message (optional)
                  </label>
                  <div className="mt-2.5">
                    <Field
                      as="textarea"
                      name="message"
                      id="message"
                      rows={3}
                      className="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6"
                      placeholder="Include a message to be shared with event participants"
                    />
                  </div>
                </div>
                
                <div className="sm:col-span-2">
                  <div className="relative flex gap-x-3">
                    <div className="flex h-6 items-center">
                      <Field
                        type="checkbox"
                        name="isAnonymous"
                        id="isAnonymous"
                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-600"
                      />
                    </div>
                    <div className="text-sm leading-6">
                      <label htmlFor="isAnonymous" className="font-medium text-gray-900">
                        Make my donation anonymous
                      </label>
                      <p className="text-gray-500">Your name will not be displayed in our donor recognition materials.</p>
                    </div>
                  </div>
                </div>
                
                <div className="sm:col-span-2 mt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="block w-full rounded-md bg-green-800 px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
                  >
                    {isSubmitting ? 'Processing...' : 'Donate Now'}
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