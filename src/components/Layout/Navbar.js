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
    <Disclosure as="nav" className="bg-white border-b border-gray-200">
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-20 items-center justify-between">
              <div className="flex-shrink-0">
                <Link to="/" className="block">
                  <h1 className="text-primary-600 font-serif text-3xl font-bold leading-tight">The Kathryn Classic</h1>
                  <p className="text-primary-600 text-sm font-medium">A weekend of golf & giving</p>
                </Link>
              </div>
              <div className="hidden md:block">
                <div className="flex items-center space-x-8">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`${
                        location.pathname === item.href
                          ? 'text-primary-600 border-b-2 border-primary-600'
                          : 'text-primary-600 hover:border-b-2 hover:border-primary-600'
                      } pb-1 text-base font-serif transition-all duration-200`}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="-mr-2 flex md:hidden">
                <Disclosure.Button className="inline-flex items-center justify-center rounded-lg bg-primary-600 p-2 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 transition-colors">
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

          <Disclosure.Panel className="md:hidden border-t border-gray-200">
            <div className="space-y-1 px-2 pb-3 pt-2 sm:px-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`${
                    location.pathname === item.href
                      ? 'bg-primary-50 text-primary-600 font-medium'
                      : 'text-primary-600 hover:bg-primary-50'
                  } block rounded-lg px-3 py-2 text-base transition-colors font-serif`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}