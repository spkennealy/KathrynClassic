import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

const CARD_WIDTH = 240;

const titleize = (s) =>
  String(s || '')
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

// The awards badge on the contacts table, with a hover card listing the three
// most recent awards and the year each was won.
//
// The card renders in a portal with fixed positioning, matching Select and
// MultiSelect: the table wrapper sets `overflow-x-auto`, and CSS computes the
// other axis to `auto` as soon as one axis isn't `visible` — so an absolutely
// positioned card would be clipped by the row it belongs to.
export default function AwardsHoverCard({ count, awards }) {
  const [coords, setCoords] = useState(null);
  const anchorRef = useRef(null);

  const recent = Array.isArray(awards) ? awards : [];

  const show = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
    if (left + CARD_WIDTH > window.innerWidth - 8) left = window.innerWidth - CARD_WIDTH - 8;
    if (left < 8) left = 8;
    // Flip above the badge when there isn't room below it.
    const below = rect.bottom + 8;
    const openUp = below + 160 > window.innerHeight;
    setCoords({
      left,
      top: openUp ? undefined : below,
      bottom: openUp ? window.innerHeight - rect.top + 8 : undefined,
    });
  }, []);

  const hide = useCallback(() => setCoords(null), []);

  if (!count) return '-';

  return (
    <>
      <span
        ref={anchorRef}
        tabIndex={0}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex cursor-default items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        🏅 {count}
      </span>

      {coords && recent.length > 0 && createPortal(
        <div
          style={{ position: 'fixed', left: coords.left, top: coords.top, bottom: coords.bottom, width: CARD_WIDTH }}
          className="z-50 rounded-lg border border-gray-200 dark:border-night-600 bg-white dark:bg-night-800 p-3 shadow-xl"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {recent.length === count ? 'Awards' : `Most recent ${recent.length} of ${count}`}
          </p>
          <ul className="space-y-1.5">
            {recent.map((a, i) => (
              <li key={`${a.year}-${a.category}-${i}`} className="flex items-baseline gap-2 text-sm">
                <span className="w-10 flex-shrink-0 font-medium text-gray-500 dark:text-gray-400">
                  {a.year ?? '—'}
                </span>
                <span className="text-gray-900 dark:text-gray-100">{titleize(a.category)}</span>
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </>
  );
}
