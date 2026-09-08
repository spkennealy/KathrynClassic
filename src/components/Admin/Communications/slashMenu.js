// Shared "/" merge-field dropdown: filtering, caret-position math, the
// dropdown's markup, and its keyboard nav. Used by EmailEditor (both its
// visual/contenteditable and HTML/textarea modes) and SubjectField (a plain
// <input>) so all three pick variables the same way.
import React from 'react';

const MAX_MENU_ITEMS = 8;

// Filter the variable list by whatever's been typed after the "/". Matches
// against both the token (bare word, no braces) and the human label.
export function filterVariables(variables, query) {
  const q = query.trim().toLowerCase();
  const matches = !q
    ? variables
    : variables.filter((v) => {
        const bare = v.token.replace(/[{}]/g, '').toLowerCase();
        return bare.includes(q) || v.label.toLowerCase().includes(q);
      });
  return matches.slice(0, MAX_MENU_ITEMS);
}

// A trailing "/query" right before the caret in a plain string — the shared
// trigger pattern for both <textarea> and <input> hosts (requires the slash
// to follow whitespace/start-of-text, not `<`/a word char, so e.g. closing
// HTML tags like `</p>` don't pop the menu open). Returns the query text, or
// null when there's no match.
export function matchSlash(textBeforeCaret) {
  const match = /(?:^|\s)\/(\w{0,24})$/.exec(textBeforeCaret);
  return match ? match[1] : null;
}

// Caret pixel position inside a <textarea> or single-line <input>, via the
// standard "mirror div" technique: an offscreen div styled identically to the
// field, holding the same text up to the caret, whose end position we
// measure. Returns viewport coordinates (matches getBoundingClientRect /
// position:fixed). `multiline` selects wrapping behavior to match a
// <textarea> (wraps) vs a single-line <input> (scrolls instead of wrapping).
export function caretRect(el, caretIndex, multiline) {
  const style = window.getComputedStyle(el);
  const mirror = document.createElement('div');
  const props = [
    'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'tabSize',
  ];
  props.forEach((p) => { mirror.style[p] = style[p]; });
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = multiline ? 'pre-wrap' : 'pre';
  mirror.style.wordWrap = 'break-word';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';

  mirror.textContent = el.value.slice(0, caretIndex);
  const marker = document.createElement('span');
  marker.textContent = '​';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const markerRect = marker.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  // Position relative to the mirror, then translate onto the real field,
  // netting out its own scroll offset.
  const top = elRect.top + (markerRect.top - mirrorRect.top) - el.scrollTop;
  const left = elRect.left + (markerRect.left - mirrorRect.left) - el.scrollLeft;

  document.body.removeChild(mirror);
  return { top, left, lineHeight: parseFloat(style.lineHeight) || 20 };
}

// Keyboard nav shared by every host. `slash` is { activeIndex, apply(item), ... }
// or null when the menu is closed. Returns true when the key was consumed
// (caller should preventDefault / stop the host's own handling).
export function handleSlashKeyDown(slash, filtered, setSlash, closeSlash, event) {
  if (!slash || filtered.length === 0) return false;
  if (event.key === 'ArrowDown') {
    setSlash((s) => ({ ...s, activeIndex: (s.activeIndex + 1) % filtered.length }));
    return true;
  }
  if (event.key === 'ArrowUp') {
    setSlash((s) => ({ ...s, activeIndex: (s.activeIndex - 1 + filtered.length) % filtered.length }));
    return true;
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    filtered[slash.activeIndex] && slash.apply(filtered[slash.activeIndex]);
    return true;
  }
  if (event.key === 'Escape') {
    closeSlash();
    return true;
  }
  return false;
}

// The dropdown itself. `slash` carries the fixed-position coords and the
// active index; `filtered` is the already-filtered variable list.
export function SlashMenuList({ slash, filtered }) {
  if (!slash || filtered.length === 0) return null;
  return (
    <div
      style={{ position: 'fixed', top: slash.top, left: slash.left }}
      className="z-50 w-72 max-h-64 overflow-y-auto rounded-md border border-gray-200 dark:border-night-600 bg-white dark:bg-night-800 shadow-lg py-1"
    >
      {filtered.map((item, i) => (
        <button
          key={item.token}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); slash.apply(item); }}
          className={`block w-full text-left px-3 py-1.5 text-sm ${
            i === slash.activeIndex
              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-night-700'
          }`}
        >
          <code className="font-mono text-xs">{item.token}</code>
          <span className="block text-xs text-gray-400">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
