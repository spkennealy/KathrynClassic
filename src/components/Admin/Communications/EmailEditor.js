import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';

// Rich HTML body editor: TipTap visual mode with a raw-HTML toggle. `value` is
// the HTML string; `onChange` is called with updated HTML.
export default function EmailEditor({ value, onChange }) {
  const [mode, setMode] = useState('visual'); // 'visual' | 'html'

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none min-h-[16rem] p-4 dark:prose-invert',
      },
    },
  });

  // Re-sync the editor when `value` changes from the outside (e.g. loading a
  // template, or returning from HTML mode). Guard against feedback loops by only
  // setting content when it actually differs.
  useEffect(() => {
    if (editor && mode === 'visual' && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor, mode]);

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
        <div className="bg-white dark:bg-night-800 text-gray-900 dark:text-gray-100">
          <EditorContent editor={editor} />
        </div>
      ) : (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="block w-full min-h-[16rem] p-4 font-mono text-sm bg-white dark:bg-night-800 text-gray-900 dark:text-gray-100 border-0 focus:ring-0 resize-y"
          placeholder="<p>Write your HTML here…</p>"
        />
      )}
    </div>
  );
}
