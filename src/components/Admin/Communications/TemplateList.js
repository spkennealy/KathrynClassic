import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { logAudit } from '../../../utils/audit';
import { EMAIL_VARIABLES } from './emailShell';
import CommunicationsNav from './CommunicationsNav';
import EmailEditor from './EmailEditor';
import EmailPreview from './EmailPreview';
import ConfirmDialog from '../ConfirmDialog';

const emptyDraft = { name: '', subject: '', body_html: '' };

// Full CRUD manager for reusable email templates. Master list on the left, an
// editor (name / subject / rich body + live preview) on the right. Templates are
// soft-deleted (deleted_at) — consistent with the rest of the app — and every
// mutation is written to the Audit Log.
export default function TemplateList() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [selectedId, setSelectedId] = useState(null); // template id, 'new', or null
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('email_templates')
        .select('*')
        .is('deleted_at', null)
        .order('name');
      if (err) throw err;
      setTemplates(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load templates');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const flash = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const isNew = selectedId === 'new';
  const editing = selectedId !== null;

  const startNew = () => {
    setSelectedId('new');
    setDraft(emptyDraft);
    setError(null);
  };

  const selectTemplate = (tpl) => {
    setSelectedId(tpl.id);
    setDraft({ name: tpl.name || '', subject: tpl.subject || '', body_html: tpl.body_html || '' });
    setError(null);
  };

  const cancelEdit = () => {
    setSelectedId(null);
    setDraft(emptyDraft);
    setError(null);
  };

  const canSave = draft.name.trim() && !saving;

  const handleSave = async () => {
    const name = draft.name.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const { data, error: err } = await supabase
          .from('email_templates')
          .insert({ name, subject: draft.subject || '', body_html: draft.body_html || '' })
          .select()
          .single();
        if (err) throw err;
        await logAudit({
          action: 'email_template.created',
          entityType: 'email_template',
          entityId: data.id,
          entityLabel: name,
        });
        await fetchTemplates();
        selectTemplate(data);
        flash('Template created');
      } else {
        const { error: err } = await supabase
          .from('email_templates')
          .update({
            name,
            subject: draft.subject || '',
            body_html: draft.body_html || '',
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedId);
        if (err) throw err;
        await logAudit({
          action: 'email_template.updated',
          entityType: 'email_template',
          entityId: selectedId,
          entityLabel: name,
        });
        await fetchTemplates();
        flash('Template saved');
      }
    } catch (err) {
      setError(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew || !selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('email_templates')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', selectedId);
      if (err) throw err;
      await logAudit({
        action: 'email_template.deleted',
        entityType: 'email_template',
        entityId: selectedId,
        entityLabel: draft.name.trim(),
      });
      setShowDeleteConfirm(false);
      cancelEdit();
      await fetchTemplates();
      flash('Template deleted');
    } catch (err) {
      setError(err.message || 'Failed to delete template');
      setShowDeleteConfirm(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Email Templates</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Create and manage reusable email templates. Load them when composing a new email.
          </p>
        </div>
        <CommunicationsNav />
      </div>

      {error && !showDeleteConfirm && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-1 bg-white dark:bg-night-800 rounded-lg shadow">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-night-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Templates {!loading && `(${templates.length})`}
            </h2>
            <button
              type="button"
              onClick={startNew}
              className="inline-flex items-center rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              New template
            </button>
          </div>
          <div className="max-h-[32rem] overflow-y-auto divide-y divide-gray-100 dark:divide-night-700">
            {loading && (
              <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</p>
            )}
            {!loading && templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTemplate(t)}
                className={`block w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-night-700 ${selectedId === t.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
              >
                <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{t.name}</span>
                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                  {t.subject || <span className="italic">No subject</span>}
                </span>
              </button>
            ))}
            {!loading && templates.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No templates yet. Create your first one.
              </p>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="lg:col-span-2">
          {!editing ? (
            <div className="bg-white dark:bg-night-800 rounded-lg shadow p-10 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Select a template to edit, or create a new one.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-night-800 rounded-lg shadow p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {isNew ? 'New template' : 'Edit template'}
                </h2>
                {message && <span className="text-sm text-green-600">{message}</span>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template name</label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Registration reminder"
                  className="block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                <input
                  type="text"
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  placeholder="Subject line"
                  className="block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Body</label>
                <EmailEditor value={draft.body_html} onChange={(html) => setDraft({ ...draft, body_html: html })} />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Personalize with variables (work in subject &amp; body):{' '}
                  {EMAIL_VARIABLES.map((v, i) => (
                    <React.Fragment key={v.token}>
                      {i > 0 && ', '}
                      <code className="px-1 rounded bg-gray-100 dark:bg-night-700 text-gray-700 dark:text-gray-300">{v.token}</code>
                      <span className="text-gray-400"> ({v.label})</span>
                    </React.Fragment>
                  ))}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview</label>
                <EmailPreview subject={draft.subject} bodyHtml={draft.body_html} recipientCount={0} cc={[]} bcc={[]} />
              </div>

              <div className="flex items-center justify-between border-t border-gray-200 dark:border-night-700 pt-4">
                <div>
                  {!isNew && (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={saving}
                      className="px-4 py-2 text-sm font-medium rounded-md border border-red-200 text-red-600 bg-white dark:bg-night-800 hover:bg-red-50 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-night-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 hover:bg-gray-50 dark:hover:bg-night-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canSave}
                    className="px-4 py-2 text-sm font-medium rounded-md border border-transparent bg-primary-600 text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving…' : isNew ? 'Create template' : 'Save changes'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete template"
        message={`Delete template "${draft.name}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
