import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Custom single-select dropdown that matches the admin design system in light
// and dark mode (native <select> can't style its OS-rendered option list).
//
// Near drop-in for <select>: keep the same `value`, `onChange`, `disabled`, and
// `<option>` children. `onChange` receives an event-shaped `{ target: { value } }`
// (value is always a string, like native selects), so existing handlers work.
// The menu renders in a portal with fixed positioning so it's never clipped.

// Flatten <option> children (handles arrays from .map()) into a plain list.
const collectOptions = (children) => {
  const out = [];
  React.Children.forEach(children, (child) => {
    if (!child || child.type !== 'option') return;
    out.push({
      value: child.props.value,
      label: child.props.children,
      disabled: !!child.props.disabled,
    });
  });
  return out;
};

const MENU_MAX_HEIGHT = 288;

export default function Select({ value, onChange, children, disabled = false, id, className = '', placeholder, triggerClassName }) {
  const options = collectOptions(children);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, openUp: false });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const current = options.find((o) => String(o.value) === String(value));
  const displayLabel = current ? current.label : (placeholder ?? (options[0] ? options[0].label : ''));
  const isPlaceholder = !current && placeholder != null;

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const openUp = rect.bottom + MENU_MAX_HEIGHT > window.innerHeight && rect.top - MENU_MAX_HEIGHT > 0;
    setCoords({
      top: openUp ? rect.top : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      openUp,
    });
  }, []);

  const openMenu = () => { if (disabled) return; place(); setOpen(true); };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
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

  const pick = (o) => {
    if (o.disabled) return;
    onChange({ target: { value: String(o.value) } });
    setOpen(false);
  };

  // Custom trigger (e.g. a colored status pill) vs the default input-style box.
  const triggerCls = triggerClassName
    ? `inline-flex items-center gap-1 focus:outline-none ${open ? 'ring-2 ring-primary-500 ' : ''}${triggerClassName}`
    : 'flex w-full items-center justify-between gap-2 rounded-lg border border-gray-400 dark:border-night-600 ' +
      'py-2.5 pl-3 pr-2 text-sm bg-white dark:bg-night-700 shadow-sm focus:outline-none ' +
      (open ? 'border-primary-500 ' : '') +
      'disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className={`relative ${triggerClassName ? 'inline-block' : ''} ${className}`}>
      <button
        type="button"
        ref={triggerRef}
        id={id}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={triggerCls}
      >
        <span className={triggerClassName ? '' : `truncate ${isPlaceholder ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
          {displayLabel}
        </span>
        <svg className={`${triggerClassName ? 'h-3.5 w-3.5' : 'h-4 w-4 text-gray-400'} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !disabled && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: coords.openUp ? undefined : coords.top,
            bottom: coords.openUp ? window.innerHeight - coords.top + 4 : undefined,
            left: coords.left,
            minWidth: coords.width,
            maxHeight: MENU_MAX_HEIGHT,
          }}
          className="z-50 overflow-y-auto rounded-lg border border-gray-200 dark:border-night-600 bg-white dark:bg-night-800 shadow-xl py-1"
        >
          {options.map((o, i) => {
            const isSel = String(o.value) === String(value);
            return (
              <button
                key={`${o.value}-${i}`}
                type="button"
                disabled={o.disabled}
                onClick={() => pick(o)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  o.disabled
                    ? 'text-gray-400 cursor-not-allowed'
                    : isSel
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                    : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-night-700'
                }`}
              >
                <span className="flex-1 truncate">{o.label}</span>
                {isSel && (
                  <svg className="h-4 w-4 flex-shrink-0 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
