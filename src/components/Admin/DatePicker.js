import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Custom calendar date picker that matches the admin design system (teal
// selection, night-palette surfaces) and opens on click into the field.
//
// Drop-in for `<input type="date">`: `value` is a 'YYYY-MM-DD' string (or ''),
// and `onChange` receives an event-shaped object `{ target: { value } }`, so
// existing `(e) => ...e.target.value` handlers work unchanged.
//
// The calendar renders in a portal with fixed positioning so it is never
// clipped by a modal's `overflow-y-auto`.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const POPOVER_WIDTH = 288; // w-72
const POPOVER_HEIGHT = 340; // approx, for flip calculation

// Parse/format in LOCAL time (avoid the UTC shift of `new Date('YYYY-MM-DD')`).
const parseYMD = (str) => {
  if (!str) return null;
  const [y, m, d] = String(str).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
const toYMD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const formatDisplay = (date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const sameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function DatePicker({ value, onChange, id, placeholder = 'Select a date', className = '' }) {
  const selected = parseYMD(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(selected || new Date()); // any date within the shown month
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  // Keep the visible month in sync when the value changes from outside.
  useEffect(() => {
    if (selected) setView(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let top = rect.bottom + 4;
    if (top + POPOVER_HEIGHT > window.innerHeight && rect.top - POPOVER_HEIGHT - 4 > 0) {
      top = rect.top - POPOVER_HEIGHT - 4;
    }
    let left = rect.left;
    if (left + POPOVER_WIDTH > window.innerWidth - 8) left = window.innerWidth - POPOVER_WIDTH - 8;
    if (left < 8) left = 8;
    setCoords({ top, left });
  }, []);

  const openPicker = () => {
    if (selected) setView(selected);
    place();
    setOpen(true);
  };

  // While open: close on outside interaction, scroll, resize, or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        popoverRef.current && !popoverRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onScroll = () => setOpen(false);
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

  const emit = (date) => onChange({ target: { value: date ? toYMD(date) : '' } });

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const step = (deltaMonths, deltaYears = 0) => setView(new Date(year + deltaYears, month + deltaMonths, 1));

  const navBtn =
    'flex h-7 w-7 items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-night-700';

  const triggerCls =
    'flex w-full items-center justify-between gap-2 rounded-lg border border-gray-400 dark:border-night-600 ' +
    'py-2.5 px-3 text-sm bg-white dark:bg-night-700 shadow-sm focus:outline-none ' +
    (open ? 'border-primary-500 ' : '') +
    className;

  return (
    <>
      <button type="button" ref={triggerRef} id={id} onClick={() => (open ? setOpen(false) : openPicker())} className={triggerCls}>
        <span className={selected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}>
          {selected ? formatDisplay(selected) : placeholder}
        </span>
        <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: POPOVER_WIDTH }}
          className="z-50 rounded-lg border border-gray-200 dark:border-night-600 bg-white dark:bg-night-800 shadow-xl p-3"
        >
          {/* Month / year navigation */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <button type="button" title="Previous year" onClick={() => step(0, -1)} className={navBtn}>«</button>
              <button type="button" title="Previous month" onClick={() => step(-1)} className={navBtn}>‹</button>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {MONTHS[month]} {year}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" title="Next month" onClick={() => step(1)} className={navBtn}>›</button>
              <button type="button" title="Next year" onClick={() => step(0, 1)} className={navBtn}>»</button>
            </div>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500">{w}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={`b${i}`} />;
              const dDate = new Date(year, month, d);
              const isSel = sameDay(dDate, selected);
              const isToday = sameDay(dDate, today);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => { emit(dDate); setOpen(false); }}
                  className={`h-8 w-8 mx-auto flex items-center justify-center rounded-full text-sm transition-colors ${
                    isSel
                      ? 'bg-primary-600 text-white font-semibold'
                      : isToday
                      ? 'ring-1 ring-primary-500 text-gray-900 dark:text-gray-100'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-night-700'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-2 flex items-center justify-between border-t border-gray-100 dark:border-night-700 pt-2 text-sm">
            <button
              type="button"
              onClick={() => { emit(null); setOpen(false); }}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => { const t = new Date(); emit(t); setView(t); setOpen(false); }}
              className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700"
            >
              Today
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
