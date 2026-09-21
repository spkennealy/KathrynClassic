import React from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';

const TONES = {
  default: 'text-gray-700 dark:text-gray-200',
  warning: 'text-amber-700 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
};

// Three-dot "row actions" dropdown for table rows.
//
//   items  [{ label, onClick, tone?: 'default' | 'warning' | 'danger', disabled? }]
//   label  accessible name for the trigger button
//
// The item list is anchored (Headless UI renders it in a portal), so a table's
// overflow-x-auto wrapper can't clip it and it flips upward near the bottom of
// the viewport.
export default function RowActionsMenu({ items, label = 'Row actions' }) {
  return (
    <Menu>
      <MenuButton
        aria-label={label}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-night-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 data-[open]:bg-gray-100 dark:data-[open]:bg-night-700"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM10 17a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
        </svg>
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        className="z-50 w-48 rounded-md bg-white dark:bg-night-800 py-1 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none [--anchor-gap:4px]"
      >
        {items.map((item) => (
          <MenuItem key={item.label} disabled={item.disabled}>
            <button
              type="button"
              onClick={item.onClick}
              className={`block w-full px-4 py-2 text-left text-sm font-medium data-[focus]:bg-gray-100 dark:data-[focus]:bg-night-700 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 ${TONES[item.tone || 'default']}`}
            >
              {item.label}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}
