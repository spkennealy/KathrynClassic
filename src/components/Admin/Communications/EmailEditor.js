import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { EMAIL_VARIABLES } from './emailShell';
import { filterVariables, matchSlash, caretRect, handleSlashKeyDown, SlashMenuList } from './slashMenu';

// Rich HTML body editor: TipTap visual mode with a raw-HTML toggle (HTML is
// the default — most senders here paste/write markup directly). Typing "/"
// in either mode opens a filterable dropdown of merge-field variables
// (arrow keys + Enter/Tab to pick, Escape to dismiss, click also works).
// SubjectField.js reuses the same dropdown for the plain Subject input.
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
      handleKeyDown: (_view, event) => {
        const handled = handleSlashKeyDown(slash, filtered, setSlash, closeSlash, event);
        if (handled) event.preventDefault();
        return handled;
      },
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
    const query = matchSlash(textBefore);
    if (query == null) return closeSlash();

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
    const query = matchSlash(el.value.slice(start, caret));
    if (query == null) return closeSlash();

    const slashStart = caret - query.length - 1;
    const rect = caretRect(el, caret, true);

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
          <SlashMenuList slash={slash} filtered={filtered} />
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
              if (handleSlashKeyDown(slash, filtered, setSlash, closeSlash, e)) e.preventDefault();
            }}
            onBlur={closeSlash}
            spellCheck={false}
            className="block w-full min-h-[16rem] p-4 font-mono text-sm bg-white dark:bg-night-800 text-gray-900 dark:text-gray-100 border-0 focus:ring-0 resize-y"
            placeholder="<p>Write your HTML here…</p>"
          />
          <SlashMenuList slash={slash} filtered={filtered} />
        </div>
      )}
    </div>
  );
}
