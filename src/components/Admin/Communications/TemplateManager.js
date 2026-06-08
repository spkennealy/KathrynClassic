import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import ConfirmDialog from '../ConfirmDialog';

// Save / load / delete reusable email templates. `subject` and `bodyHtml` are
// the current compose values; `onLoad({ subject, body_html })` populates them.
export default function TemplateManager({ subject, bodyHtml, onLoad, onTemplateChange }) {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchTemplates = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('email_templates')
      .select('*')
      .is('deleted_at', null)
      .order('name');
    if (err) {
      setError(err.message);
      return;
    }
    setTemplates(data || []);
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Tell the parent which template is currently selected (or none) so it can be
  // recorded on the campaign when sent.
  useEffect(() => {
    if (!onTemplateChange) return;
    onTemplateChange(templates.find((t) => t.id === selectedId) || null);
  }, [selectedId, templates, onTemplateChange]);

  const flash = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLoad = (id) => {
    setSelectedId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) onLoad({ subject: tpl.subject, body_html: tpl.body_html });
  };

  const openSaveModal = () => {
    setNewName('');
    setError(null);
    setShowSaveModal(true);
  };

  const handleSaveAsNew = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      setBusy(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('email_templates')
        .insert({ name, subject: subject || '', body_html: bodyHtml || '' })
        .select()
        .single();
      if (err) throw err;
      setShowSaveModal(false);
      await fetchTemplates();
      setSelectedId(data.id);
      flash('Template saved');
    } catch (err) {
      setError(err.message || 'Failed to save template');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedId) return;
    try {
      setBusy(true);
      setError(null);
      const { error: err } = await supabase
        .from('email_templates')
        .update({ subject: subject || '', body_html: bodyHtml || '', updated_at: new Date().toISOString() })
        .eq('id', selectedId);
      if (err) throw err;
      await fetchTemplates();
      flash('Template updated');
    } catch (err) {
      setError(err.message || 'Failed to update template');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      setBusy(true);
      setError(null);
      const { error: err } = await supabase
        .from('email_templates')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', selectedId);
      if (err) throw err;
      setShowDeleteConfirm(false);
      setSelectedId('');
      await fetchTemplates();
      flash('Template deleted');
    } catch (err) {
      setError(err.message || 'Failed to delete template');
    } finally {
      setBusy(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedId);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Template</label>
        <select
          value={selectedId}
          onChange={(e) => handleLoad(e.target.value)}
          className="rounded-md border-gray-300 dark:border-night-600 text-sm dark:bg-night-700 dark:text-gray-100 focus:border-primary-500 focus:ring-primary-500"
        >
          <option value="">— Load a template —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={openSaveModal}
        disabled={busy}
        className="px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-night-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 hover:bg-gray-50 dark:hover:bg-night-700 disabled:opacity-50"
      >
        Save as new
      </button>
      <button
        type="button"
        onClick={handleUpdate}
        disabled={busy || !selectedId}
        className="px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-night-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 hover:bg-gray-50 dark:hover:bg-night-700 disabled:opacity-40"
      >
        Update
      </button>
      <button
        type="button"
        onClick={() => setShowDeleteConfirm(true)}
        disabled={busy || !selectedId}
        className="px-3 py-2 text-sm font-medium rounded-md border border-red-200 text-red-600 bg-white dark:bg-night-800 hover:bg-red-50 disabled:opacity-40"
      >
        Delete
      </button>
      {message && <span className="text-sm text-green-600">{message}</span>}
      {error && !showSaveModal && <span className="text-sm text-red-600">{error}</span>}

      {/* Save-as-new modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowSaveModal(false)} />
            <div className="relative inline-block w-full max-w-md transform overflow-hidden rounded-lg bg-white dark:bg-night-800 text-left align-middle shadow-xl transition-all">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveAsNew();
                }}
              >
                <div className="px-6 pt-5 pb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Save template</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Give this email a name so you can reuse it later.</p>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-4 mb-1">Template name</label>
                  <input
                    type="text"
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Registration reminder"
                    className="block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                  {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                </div>
                <div className="bg-gray-50 dark:bg-night-700 px-6 py-3 flex flex-row-reverse gap-3">
                  <button
                    type="submit"
                    disabled={busy || !newName.trim()}
                    className="inline-flex justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSaveModal(false)}
                    className="inline-flex justify-center rounded-md border border-gray-300 dark:border-night-600 bg-white dark:bg-night-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-night-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete template"
        message={`Delete template "${selectedTemplate?.name}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
