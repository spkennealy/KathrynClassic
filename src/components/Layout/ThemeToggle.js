import React from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

// variant: "icon" (default, for desktop nav bars) or "row" (full-width labeled, for mobile menus)
export default function ThemeToggle({ variant = 'icon', className = '' }) {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={label}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-base font-serif text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-night-700 transition-colors ${className}`}
      >
        {isDark ? (
          <SunIcon className="h-5 w-5" aria-hidden="true" />
        ) : (
          <MoonIcon className="h-5 w-5" aria-hidden="true" />
        )}
        {isDark ? 'Light Mode' : 'Dark Mode'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-lg p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-night-700 focus:outline-none focus:ring-2 focus:ring-primary-600 transition-colors ${className}`}
    >
      {isDark ? (
        <SunIcon className="h-5 w-5" aria-hidden="true" />
      ) : (
        <MoonIcon className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}
