import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Disclosure } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import Logo from '../Home/Logo';

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Schedule', href: '/schedule' },
  { name: 'Registration', href: '/registration' },
  { name: 'Donations', href: '/donations' },
  { name: 'About', href: '/about' },
];

export default function Navbar() {
  const [current, setCurrent] = useState(window.location.pathname);
  
  return (
    <Disclosure as="nav" className="bg-green-800">
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Link to="/">
                    <div className="flex items-center space-x-2">
                      <Logo width={40} height={40} />
                      <span className="text-white font-serif text-xl font-bold">The Kathryn Classic</span>
                    </div>
                  </Link>
                </div>
                <div className="hidden md:block">
                  <div className="ml-10 flex items-baseline space-x-4">
                    {navigation.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`${
                          current === item.href
                            ? 'bg-green-900 text-white'
                            : 'text-gray-200 hover:bg-green-700 hover:text-white'
                        } rounded-md px-3 py-2 text-sm font-medium`}
                        onClick={() => setCurrent(item.href)}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="ml-4 flex items-center md:ml-6">
                  <Link
                    to="/registration"
                    className="rounded-md bg-yellow-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-yellow-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-600"
                  >
                    Register Now
                  </Link>
                </div>
              </div>
              <div className="-mr-2 flex md:hidden">
                <Disclosure.Button className="inline-flex items-center justify-center rounded-md bg-green-900 p-2 text-gray-200 hover:bg-green-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-green-800">
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

          <Disclosure.Panel className="md:hidden">
            <div className="space-y-1 px-2 pb-3 pt-2 sm:px-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`${
                    current === item.href
                      ? 'bg-green-900 text-white'
                      : 'text-gray-200 hover:bg-green-700 hover:text-white'
                  } block rounded-md px-3 py-2 text-base font-medium`}
                  onClick={() => setCurrent(item.href)}
                >
                  {item.name}
                </Link>
              ))}
            </div>
            <div className="border-t border-green-700 pb-3 pt-4">
              <div className="flex items-center px-5">
                <Link
                  to="/registration"
                  className="block w-full rounded-md bg-yellow-600 px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-yellow-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-600"
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