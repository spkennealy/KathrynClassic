import React, { useState, useRef, useEffect } from 'react';

// Checkbox dropdown for choosing zero or more values. An empty selection means
// "all" (shown via `allLabel`). Styled to match the section's single selects.
//
//   options   [{ value, label }]
//   selected  array of selected values
//   onChange  (nextArray) => void
export default function MultiSelect({ options, selected, onChange, allLabel = 'All', disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close when clicking outside.
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (value) => {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
      ? options.find((o) => String(o.value) === String(selected[0]))?.label ?? String(selected[0])
      : `${selected.length} selected`;

  const buttonCls =
    'flex w-full items-center justify-between gap-2 rounded-lg border border-gray-400 dark:border-night-600 py-2.5 pl-3 pr-2 text-sm ' +
    'bg-white dark:bg-night-700 text-gray-900 dark:text-gray-100 shadow-sm ' +
    'focus:border-primary-500 focus:outline-none focus:ring-0 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={buttonCls}
      >
        <span className={`truncate ${selected.length === 0 ? 'text-gray-500 dark:text-gray-400' : ''}`}>
          {summary}
        </span>
        <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full min-w-max rounded-lg border border-gray-200 dark:border-night-600 bg-white dark:bg-night-700 shadow-lg max-h-60 overflow-y-auto">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full px-3 py-2 text-left text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-gray-50 dark:hover:bg-night-600 border-b border-gray-100 dark:border-night-600"
            >
              Clear ({selected.length})
            </button>
          )}
          {options.map((o) => (
            <label
              key={o.value}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-night-600 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.map(String).includes(String(o.value))}
                onChange={() => toggle(o.value)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="whitespace-nowrap">{o.label}</span>
            </label>
          ))}
          {options.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">No options</p>
          )}
        </div>
      )}
    </div>
  );
}
