import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Disclosure } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import ThemeToggle from './ThemeToggle';
import { DONATE_URL } from '../../config/links';

// "Home" is deliberately absent — the title/logo on the left links there.
const navigation = [
  { name: 'About', href: '/about' },
  { name: 'Schedule', href: '/schedule' },
  { name: 'Register', href: '/registration' },
  { name: 'Rules', href: '/rules' },
  { name: 'Leaderboard', href: '/leaderboard' },
  { name: 'History', href: '/history' },
];

export default function Navbar() {
  const location = useLocation();

  return (
    <Disclosure as="nav" className="bg-white dark:bg-night-800 border-b border-gray-200 dark:border-night-700">
      {({ open, close }) => (
        <>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-2 md:gap-4 py-4 md:py-5">
              <div className="min-w-0 flex-1 md:flex-none text-left">
                <Link to="/" className="flex items-center gap-3">
                  {/* Official logo, wordmark cropped off since the title sits right
                      beside it. Paper background is keyed out to transparency, with a
                      mint recolour for dark mode where the original green would vanish.
                      Hidden on the narrowest screens, where the bar is already full
                      with the Donate button and menu toggle. */}
                  <span className="hidden sm:block flex-shrink-0">
                    <img
                      src="/kc_logo_mark.png"
                      alt=""
                      width={681}
                      height={270}
                      className="dark:hidden h-11 lg:h-14 w-auto"
                    />
                    <img
                      src="/kc_logo_mark_dark.png"
                      alt=""
                      width={681}
                      height={270}
                      className="hidden dark:block h-11 lg:h-14 w-auto"
                    />
                  </span>
                  <div className="min-w-0">
                    <h1 className="text-primary-600 dark:text-primary-400 font-serif text-xl sm:text-2xl lg:text-3xl font-bold leading-tight">The Kathryn Classic</h1>
                    <p className="text-primary-600 dark:text-primary-400 text-xs sm:text-sm font-medium md:text-center">A weekend of family, golf &amp; giving</p>
                  </div>
                </Link>
              </div>
              <div className="hidden md:block">
                <div className="flex items-center gap-x-3 lg:gap-x-5 xl:gap-x-8">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`${
                        location.pathname === item.href
                          ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                          : 'text-primary-600 dark:text-primary-400 hover:border-b-2 hover:border-primary-600 dark:hover:border-primary-400'
                      } whitespace-nowrap pb-1 text-sm lg:text-base font-serif transition-all duration-200`}
                    >
                      {item.name}
                    </Link>
                  ))}
                  <span className="h-5 w-px bg-gray-300 dark:bg-night-600" aria-hidden="true" />
                  <ThemeToggle />
                  <a
                    href={DONATE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center whitespace-nowrap rounded-lg bg-primary-600 px-3 lg:px-4 py-2 text-sm lg:text-base font-serif font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
                  >
                    Donate
                  </a>
                </div>
              </div>
              <div className="-mr-2 flex items-center gap-2 md:hidden">
                <a
                  href={DONATE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg bg-primary-600 px-3 py-2 text-sm font-serif font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
                >
                  Donate
                </a>
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

          <Disclosure.Panel className="md:hidden border-t border-gray-200 dark:border-night-700">
            <div className="space-y-1 px-2 pb-3 pt-2 sm:px-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => close()}
                  className={`${
                    location.pathname === item.href
                      ? 'bg-primary-50 dark:bg-night-700 text-primary-600 dark:text-primary-400 font-medium'
                      : 'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-night-700'
                  } block rounded-lg px-3 py-2 text-base transition-colors font-serif`}
                >
                  {item.name}
                </Link>
              ))}
              <div className="border-t border-gray-200 dark:border-night-700 mt-2 pt-2">
                <ThemeToggle variant="row" />
              </div>
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}