import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Disclosure } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Schedule', href: '/schedule' },
  { name: 'Registration', href: '/registration' },
  { name: 'History', href: '/history' },
  { name: 'Donations', href: '/donations' },
  { name: 'About', href: '/about' },
];

export default function Navbar() {
  const location = useLocation();
  
  return (
    <Disclosure as="nav" className="bg-primary-600 shadow-md">
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex-shrink-0">
                <Link to="/">
                  <span className="text-white font-sans text-xl font-bold hover:text-primary-50 transition-colors">The Kathryn Classic</span>
                </Link>
              </div>
              <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2">
                <div className="flex items-baseline space-x-1">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`${
                        location.pathname === item.href
                          ? 'bg-primary-700 text-white font-medium'
                          : 'text-white hover:bg-primary-500 hover:text-white'
                      } rounded-lg px-3 py-2 text-sm transition-all duration-150`}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="hidden md:block">
                <Link
                  to="/registration"
                  className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-primary-600 shadow-sm hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors"
                >
                  Register Now
                </Link>
              </div>
              <div className="-mr-2 flex md:hidden">
                <Disclosure.Button className="inline-flex items-center justify-center rounded-lg bg-primary-700 p-2 text-white hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-600 transition-colors">
                  <span className="sr-only">Open main menu</span>
                  {open ? (
                    <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                  )}
                </Disclosure.Button>
              </div>
            </div>
          </div>

          <Disclosure.Panel className="md:hidden border-t border-primary-500">
            <div className="space-y-1 px-2 pb-3 pt-2 sm:px-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`${
                    location.pathname === item.href
                      ? 'bg-primary-700 text-white font-medium'
                      : 'text-white hover:bg-primary-500'
                  } block rounded-lg px-3 py-2 text-base transition-colors`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
            <div className="border-t border-primary-500 pb-3 pt-4">
              <div className="flex items-center px-5">
                <Link
                  to="/registration"
                  className="block w-full rounded-lg bg-white px-4 py-2.5 text-center text-sm font-semibold text-primary-600 shadow-sm hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors"
                >
                  Register Now
                </Link>
              </div>
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}