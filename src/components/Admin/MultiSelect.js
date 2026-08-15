import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Checkbox dropdown for choosing zero or more values. An empty selection means
// "all" (shown via `allLabel`). The panel renders in a portal with fixed
// positioning so it's never clipped by a card/modal's overflow.
//
//   options   [{ value, label }]
//   selected  array of selected values
//   onChange  (nextArray) => void
// Below this, a search box is more friction than help.
const SEARCH_THRESHOLD = 8;

const labelText = (label) => (typeof label === 'string' ? label : String(label ?? ''));

export default function MultiSelect({
  options,
  selected,
  onChange,
  allLabel = 'All',
  disabled = false,
  // Opt in to filtering. The box only renders once the list is long enough.
  searchable = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const showSearch = searchable && options.length >= SEARCH_THRESHOLD;
  const term = query.trim().toLowerCase();
  const visibleOptions = term
    ? options.filter((o) => labelText(o.label).toLowerCase().includes(term))
    : options;

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 180);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    if (left < 8) left = 8;
    setCoords({ top: rect.bottom + 4, left, width });
  }, []);

  const openPanel = () => { place(); setQuery(''); setOpen(true); };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    // Capture-phase listener, so it also sees scrolls inside the panel itself —
    // without this guard a long option list closes as soon as you scroll it.
    const onScroll = (e) => {
      if (e.target instanceof Node && panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

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
    'focus:border-primary-500 focus:outline-none ' +
    (open ? 'border-primary-500 ' : '') +
    'disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="relative">
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className={buttonCls}
      >
        <span className={`truncate ${selected.length === 0 ? 'text-gray-500 dark:text-gray-400' : ''}`}>
          {summary}
        </span>
        <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !disabled && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, minWidth: coords.width }}
          className="z-50 flex max-h-72 flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-night-600 bg-white dark:bg-night-800 shadow-xl"
        >
          {showSearch && (
            // Outside the scroll area so it stays put while the list scrolls.
            <div className="border-b border-gray-100 dark:border-night-700 p-2">
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="block w-full rounded-md border border-gray-300 dark:border-night-600 py-1.5 px-2 text-sm bg-white dark:bg-night-700 text-gray-900 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-0"
              />
            </div>
          )}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full flex-shrink-0 px-3 py-2 text-left text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-gray-50 dark:hover:bg-night-700 border-b border-gray-100 dark:border-night-700"
            >
              Clear ({selected.length})
            </button>
          )}
          <div className="overflow-y-auto">
            {visibleOptions.map((o) => (
              <label
                key={o.value}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-night-700 cursor-pointer"
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
            {visibleOptions.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-400">
                {options.length === 0 ? 'No options' : 'No matches'}
              </p>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
