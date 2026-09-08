import React, { useState, useMemo, useCallback } from 'react';
import { EMAIL_VARIABLES } from './emailShell';
import { filterVariables, matchSlash, caretRect, handleSlashKeyDown, SlashMenuList } from './slashMenu';

// Single-line Subject input with the same "/" merge-field dropdown as the
// body editor — variables work in the subject at send time (render() runs
// over it too), this just gives the same insertion helper here.
export default function SubjectField({ value, onChange, variables = EMAIL_VARIABLES, placeholder }) {
  const [slash, setSlash] = useState(null);
  const closeSlash = useCallback(() => setSlash(null), []);

  const check = (el) => {
    const caret = el.selectionStart;
    if (caret !== el.selectionEnd) return closeSlash();

    const start = Math.max(0, caret - 30);
    const query = matchSlash(el.value.slice(start, caret));
    if (query == null) return closeSlash();

    const slashStart = caret - query.length - 1;
    const rect = caretRect(el, caret, false);

    setSlash({
      top: rect.top + rect.lineHeight + 4,
      left: rect.left,
      query,
      activeIndex: 0,
      apply: (item) => {
        const next = el.value.slice(0, slashStart) + item.token + el.value.slice(caret);
        onChange(next);
        const caretAfter = slashStart + item.token.length;
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(caretAfter, caretAfter);
        });
        closeSlash();
      },
    });
  };

  const filtered = useMemo(() => (slash ? filterVariables(variables, slash.query) : []), [slash, variables]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value || ''}
        onChange={(e) => { onChange(e.target.value); check(e.target); }}
        onClick={(e) => check(e.target)}
        onKeyUp={(e) => {
          if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) check(e.target);
        }}
        onKeyDown={(e) => {
          if (handleSlashKeyDown(slash, filtered, setSlash, closeSlash, e)) e.preventDefault();
        }}
        onBlur={closeSlash}
        placeholder={placeholder}
        className="block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
      />
      <SlashMenuList slash={slash} filtered={filtered} />
    </div>
  );
}
