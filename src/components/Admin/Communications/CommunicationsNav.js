import React from 'react';
import { NavLink } from 'react-router-dom';

// Shared top-right tab bar for the Communications section, so the admin can
// switch between composing, unsubscribes, and history from any of the pages.
const TABS = [
  { to: '/admin/communications', label: 'New Email', end: true },
  { to: '/admin/communications/templates', label: 'Templates', end: false },
  { to: '/admin/communications/unsubscribes', label: 'Unsubscribes', end: false },
  { to: '/admin/communications/history', label: 'History', end: false },
];

export default function CommunicationsNav() {
  return (
    <nav className="flex w-full overflow-x-auto sm:w-auto sm:inline-flex shrink-0 rounded-lg bg-gray-100 dark:bg-night-700 p-1">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `flex-1 sm:flex-none px-2 sm:px-3 py-1.5 text-sm font-medium text-center whitespace-nowrap rounded-md transition-colors ${
              isActive
                ? 'bg-white dark:bg-night-800 text-primary-700 dark:text-primary-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
