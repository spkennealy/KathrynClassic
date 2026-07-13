import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { logAudit } from '../../../utils/audit';
import { EMAIL_VARIABLES } from './emailShell';
import { REGISTRATION_TEMPLATES, REGISTRATION_TEMPLATE_KEYS, registrationEmailShell } from './registrationTemplates';
import CommunicationsNav from './CommunicationsNav';
import EmailEditor from './EmailEditor';
import EmailPreview from './EmailPreview';
import ConfirmDialog from '../ConfirmDialog';

const emptyDraft = { name: '', subject: '', body_html: '' };

// Full CRUD manager for reusable email templates. Master list on the left, an
// editor (name / subject / rich body + live preview) on the right. Templates are
// soft-deleted (deleted_at) — consistent with the rest of the app — and every
// mutation is written to the Audit Log.
//
// Rows with a `template_key` are system templates: the registration emails sent
// automatically by the send-registration-confirmation edge function. They're
// pinned in their own section, their name is locked and they can't be deleted
// (the edge function looks them up by key), but subject/body are fully editable.
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

  // System (registration) templates vs. admin-created ones.
  const systemTemplates = REGISTRATION_TEMPLATE_KEYS
    .map((key) => templates.find((t) => t.template_key === key))
    .filter(Boolean);
  const customTemplates = templates.filter((t) => !t.template_key);

  const selectedTemplate = templates.find((t) => t.id === selectedId);
  const systemMeta = selectedTemplate?.template_key
    ? REGISTRATION_TEMPLATES[selectedTemplate.template_key]
    : null;

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
          changes: { name, subject: draft.subject || '', body_html: `${(draft.body_html || '').length} chars` },
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
        const old = templates.find((t) => t.id === selectedId) || {};
        const changes = {};
        if ((old.name || '') !== name) changes.name = { from: old.name ?? null, to: name };
        if ((old.subject || '') !== (draft.subject || '')) changes.subject = { from: old.subject ?? null, to: draft.subject || '' };
        if ((old.body_html || '') !== (draft.body_html || '')) {
          changes.body_html = { from: `${(old.body_html || '').length} chars`, to: `${(draft.body_html || '').length} chars` };
        }
        await logAudit({
          action: 'email_template.updated',
          entityType: 'email_template',
          entityId: selectedId,
          entityLabel: name,
          changes: Object.keys(changes).length ? changes : undefined,
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
        changes: { name: draft.name.trim(), subject: draft.subject || '' },
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
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Email Templates</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Create and manage reusable email templates. Load them when composing a new email.
            The registration emails golfers receive automatically are edited here too.
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
            {!loading && systemTemplates.length > 0 && (
              <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Registration emails
              </p>
            )}
            {!loading && systemTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTemplate(t)}
                className={`block w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-night-700 ${selectedId === t.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                  <svg className="h-3.5 w-3.5 flex-none text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                  </svg>
                  <span className="truncate">{t.name}</span>
                </span>
                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                  {t.subject || <span className="italic">No subject</span>}
                </span>
              </button>
            ))}
            {!loading && systemTemplates.length > 0 && (
              <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Custom templates
              </p>
            )}
            {!loading && customTemplates.map((t) => (
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
            {!loading && customTemplates.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {systemTemplates.length > 0
                  ? 'No custom templates yet. Create your first one.'
                  : 'No templates yet. Create your first one.'}
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

              {systemMeta && (
                <div className="rounded-md bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-900/40 p-3">
                  <p className="text-sm text-primary-800 dark:text-primary-200">
                    <span className="font-medium">Registration email.</span> {systemMeta.description} Sent
                    automatically — the subject and body are editable, but this template can't be renamed or deleted.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template name</label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Registration reminder"
                  disabled={!!systemMeta}
                  className="block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 focus:border-primary-500 focus:ring-primary-500 sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed"
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
                  {(systemMeta ? systemMeta.variables : EMAIL_VARIABLES).map((v, i) => (
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
                <EmailPreview
                  subject={draft.subject}
                  bodyHtml={draft.body_html}
                  recipientCount={0}
                  cc={[]}
                  bcc={[]}
                  extraVars={systemMeta?.sampleVars}
                  shellFn={systemMeta ? registrationEmailShell : undefined}
                />
              </div>

              <div className="flex items-center justify-between border-t border-gray-200 dark:border-night-700 pt-4">
                <div>
                  {!isNew && !systemMeta && (
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
