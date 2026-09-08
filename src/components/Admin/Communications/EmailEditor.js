import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { EMAIL_VARIABLES } from './emailShell';

const MAX_MENU_ITEMS = 8;

// Filter the variable list by whatever's been typed after the "/". Matches
// against both the token (bare word, no braces) and the human label.
function filterVariables(variables, query) {
  const q = query.trim().toLowerCase();
  const matches = !q
    ? variables
    : variables.filter((v) => {
        const bare = v.token.replace(/[{}]/g, '').toLowerCase();
        return bare.includes(q) || v.label.toLowerCase().includes(q);
      });
  return matches.slice(0, MAX_MENU_ITEMS);
}

// Caret pixel position inside a <textarea>, via the standard "mirror div"
// technique: an offscreen div styled identically to the textarea, holding the
// same text up to the caret, whose end position we measure. Returns viewport
// coordinates (matches getBoundingClientRect / position:fixed).
function textareaCaretRect(textarea, caretIndex) {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  const props = [
    'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'tabSize',
  ];
  props.forEach((p) => { mirror.style[p] = style[p]; });
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';

  mirror.textContent = textarea.value.slice(0, caretIndex);
  const marker = document.createElement('span');
  marker.textContent = '​';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const markerRect = marker.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const taRect = textarea.getBoundingClientRect();
  // Position relative to the mirror, then translate onto the real textarea,
  // netting out its own scroll offset.
  const top = taRect.top + (markerRect.top - mirrorRect.top) - textarea.scrollTop;
  const left = taRect.left + (markerRect.left - mirrorRect.left) - textarea.scrollLeft;

  document.body.removeChild(mirror);
  return { top, left, lineHeight: parseFloat(style.lineHeight) || 20 };
}

// Rich HTML body editor: TipTap visual mode with a raw-HTML toggle (HTML is
// the default — most senders here paste/write markup directly). Typing "/"
// in either mode opens a filterable dropdown of merge-field variables
// (arrow keys + Enter/Tab to pick, Escape to dismiss, click also works).
export default function EmailEditor({ value, onChange, variables = EMAIL_VARIABLES }) {
  const [mode, setMode] = useState('html'); // 'visual' | 'html'
  const textareaRef = useRef(null);

  // Slash-menu state, shared by both modes. `apply` performs the substitution
  // for whichever mode opened it.
  const [slash, setSlash] = useState(null); // { top, left, query, activeIndex, apply(item) }

  const closeSlash = useCallback(() => setSlash(null), []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      checkSlashVisual(editor);
    },
    onSelectionUpdate: ({ editor }) => checkSlashVisual(editor),
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none min-h-[16rem] p-4 dark:prose-invert',
      },
      handleKeyDown: (_view, event) => handleSlashKeyDown(event),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync the editor when `value` changes from the outside (e.g. loading a
  // template, or returning from HTML mode). Guard against feedback loops by only
  // setting content when it actually differs.
  useEffect(() => {
    if (editor && mode === 'visual' && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor, mode]);

  // Close the menu whenever we switch modes or the query stops matching a
  // live "/word" (e.g. the user typed a space or deleted the slash).
  useEffect(() => {
    closeSlash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // --- Visual mode: detect a trailing "/query" right before the cursor -----
  const checkSlashVisual = useCallback((ed) => {
    const { state, view } = ed;
    const { from, empty } = state.selection;
    if (!empty || !view.hasFocus()) return closeSlash();

    const start = Math.max(0, from - 30);
    const textBefore = state.doc.textBetween(start, from, '\n', '\n');
    const match = /(?:^|\s)\/(\w{0,24})$/.exec(textBefore);
    if (!match) return closeSlash();

    const query = match[1];
    const slashFrom = from - query.length - 1;
    const coords = view.coordsAtPos(from);

    setSlash({
      top: coords.bottom + 4,
      left: coords.left,
      query,
      activeIndex: 0,
      apply: (item) => {
        ed.chain().focus().deleteRange({ from: slashFrom, to: from }).insertContent(item.token).run();
        closeSlash();
      },
    });
  }, [closeSlash]);

  // --- HTML mode: same detection, over the <textarea> value/caret ----------
  const checkSlashHtml = useCallback((el) => {
    const caret = el.selectionStart;
    if (caret !== el.selectionEnd) return closeSlash();

    const start = Math.max(0, caret - 30);
    const textBefore = el.value.slice(start, caret);
    // Require the slash to follow whitespace/start-of-text (not `<`, `/`, or a
    // word char) so closing tags like `</p>` don't pop the menu open.
    const match = /(?:^|\s)\/(\w{0,24})$/.exec(textBefore);
    if (!match) return closeSlash();

    const query = match[1];
    const slashStart = caret - query.length - 1;
    const rect = textareaCaretRect(el, caret);

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
  }, [closeSlash, onChange]);

  const filtered = useMemo(
    () => (slash ? filterVariables(variables, slash.query) : []),
    [slash, variables]
  );

  // Keyboard nav shared by both modes. Returns true when the key was consumed
  // (caller should preventDefault / stop the editor's own handling).
  const handleMenuKeyDown = (event) => {
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
  };

  const handleSlashKeyDown = (event) => {
    const handled = handleMenuKeyDown(event);
    if (handled) event.preventDefault();
    return handled;
  };

  const Btn = ({ onClick, active, disabled, title, children }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-2 py-1 text-sm rounded border ${
        active
          ? 'bg-primary-100 dark:bg-night-700 border-primary-400 text-primary-800 dark:text-primary-300'
          : 'bg-white dark:bg-night-800 border-gray-300 dark:border-night-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-night-700'
      } disabled:opacity-40`}
    >
      {children}
    </button>
  );

  const addLink = () => {
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('Link URL', prev);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt('Image URL');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  // The dropdown itself — shared markup for both modes, positioned via fixed
  // viewport coordinates computed by whichever mode opened it.
  const SlashMenu = () =>
    slash && filtered.length > 0
      ? (
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
      )
      : null;

  return (
    <div className="border border-gray-300 dark:border-night-600 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-2 border-b border-gray-200 dark:border-night-700 bg-gray-50 dark:bg-night-700">
        {mode === 'visual' && editor && (
          <>
            <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><strong>B</strong></Btn>
            <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><em>I</em></Btn>
            <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading">H</Btn>
            <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">• List</Btn>
            <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">1. List</Btn>
            <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote">❝</Btn>
            <Btn onClick={addLink} active={editor.isActive('link')} title="Link">🔗</Btn>
            <Btn onClick={addImage} title="Image">🖼️</Btn>
            <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">↺</Btn>
            <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">↻</Btn>
          </>
        )}
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Type <code className="px-1 rounded bg-gray-100 dark:bg-night-800">/</code> for merge fields
        </span>
        <div className="ml-auto">
          <Btn
            onClick={() => setMode(mode === 'visual' ? 'html' : 'visual')}
            active={mode === 'html'}
            title="Toggle HTML source"
          >
            {mode === 'visual' ? '</> HTML' : '👁 Visual'}
          </Btn>
        </div>
      </div>

      {/* Body */}
      {mode === 'visual' ? (
        <div className="relative bg-white dark:bg-night-800 text-gray-900 dark:text-gray-100">
          <EditorContent editor={editor} />
          <SlashMenu />
        </div>
      ) : (
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value || ''}
            onChange={(e) => {
              onChange(e.target.value);
              checkSlashHtml(e.target);
            }}
            onClick={(e) => checkSlashHtml(e.target)}
            onKeyUp={(e) => {
              if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
                checkSlashHtml(e.target);
              }
            }}
            onKeyDown={(e) => {
              if (handleMenuKeyDown(e)) e.preventDefault();
            }}
            onBlur={closeSlash}
            spellCheck={false}
            className="block w-full min-h-[16rem] p-4 font-mono text-sm bg-white dark:bg-night-800 text-gray-900 dark:text-gray-100 border-0 focus:ring-0 resize-y"
            placeholder="<p>Write your HTML here…</p>"
          />
          <SlashMenu />
        </div>
      )}
    </div>
  );
}
