import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { useAuth } from '../../../contexts/AuthContext';
import { logAudit } from '../../../utils/audit';
import { parseAddressList, EMAIL_VARIABLES } from './emailShell';
import CommunicationsNav from './CommunicationsNav';
import Select from '../Select';
import RecipientSelector from './RecipientSelector';
import EmailEditor from './EmailEditor';
import TemplateManager from './TemplateManager';
import EmailPreview from './EmailPreview';
import ConfirmDialog from '../ConfirmDialog';

export default function EmailCampaign() {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [ccRaw, setCcRaw] = useState('');
  const [bccRaw, setBccRaw] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [tournamentYears, setTournamentYears] = useState([]);
  const [campaignYear, setCampaignYear] = useState(''); // year this email is "about"
  const [template, setTemplate] = useState(null); // selected saved template, if any
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { sent, recipientCount, failed, status }
  const [error, setError] = useState(null);

  const cc = parseAddressList(ccRaw);
  const bcc = parseAddressList(bccRaw);

  // Load tournament years; default the campaign year to the open (else latest)
  // tournament. This is the year the unsubscribe link's "this year" option uses.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('tournaments')
        .select('year, registration_status')
        .is('deleted_at', null)
        .order('year', { ascending: false });
      if (data && data.length > 0) {
        setTournamentYears(data.map((t) => t.year));
        const open = data.find((t) => t.registration_status === 'open');
        setCampaignYear(String((open || data[0]).year));
      }
    })();
  }, []);

  // Stable callbacks so child effects don't re-run every render.
  const handleRecipientsChange = useCallback((list) => setRecipients(list), []);
  const handleTemplateChange = useCallback((tpl) => setTemplate(tpl), []);

  const handleLoadTemplate = ({ subject: s, body_html }) => {
    setSubject(s || '');
    setBodyHtml(body_html || '');
  };

  const canSend = subject.trim() && recipients.length > 0 && !sending;

  const doSend = async () => {
    setShowConfirm(false);
    setSending(true);
    setError(null);
    setResult(null);
    try {
      // 1) Create the campaign row (status 'sending'); the edge function updates it.
      const { data: campaign, error: insErr } = await supabase
        .from('email_campaigns')
        .insert({
          subject: subject.trim(),
          body_html: bodyHtml,
          cc,
          bcc,
          recipient_count: recipients.length,
          status: 'sending',
          sent_by: user?.id ?? null,
          template_id: template?.id ?? null,
          template_name: template?.name ?? null,
          tournament_year: campaignYear ? parseInt(campaignYear, 10) : null,
        })
        .select()
        .single();
      if (insErr) throw insErr;

      // 2) Invoke the function (session JWT is forwarded automatically).
      const { data, error: fnErr } = await supabase.functions.invoke('send-bulk-email', {
        body: {
          campaignId: campaign.id,
          campaignYear: campaignYear ? parseInt(campaignYear, 10) : null,
          subject: subject.trim(),
          bodyHtml,
          recipients,
          cc,
          bcc,
        },
      });

      // On a non-2xx response supabase-js puts the Response on fnErr.context;
      // read its body so we show the function's real error, not "non-2xx".
      if (fnErr) {
        let detail = fnErr.message;
        try {
          const body = await fnErr.context?.json?.();
          if (body?.error) detail = body.error;
        } catch (_) { /* ignore parse failure */ }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);

      await logAudit({
        action: 'email_campaign.sent',
        entityType: 'email_campaign',
        entityId: campaign.id,
        entityLabel: subject.trim(),
        metadata: {
          recipient_count: recipients.length,
          sent: data?.sent ?? null,
          failed: Array.isArray(data?.failed) ? data.failed.length : null,
          cc,
          bcc,
          tournament_year: campaignYear ? parseInt(campaignYear, 10) : null,
          template_name: template?.name ?? null,
        },
      });

      setResult(data);
    } catch (err) {
      setError(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  // Shared result/error banner (rendered at the bottom by the Send button).
  const ResultBanner = () => (
    <>
      {result && (
        <div className={`rounded-md p-4 ${result.status === 'failed' ? 'bg-red-50 border border-red-200' : result.status === 'partial' ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
          <p className={`text-sm ${result.status === 'failed' ? 'text-red-800' : result.status === 'partial' ? 'text-yellow-800' : 'text-green-800'}`}>
            {result.status === 'sent' && `✓ Email sent to ${result.recipientCount} recipient(s).`}
            {result.status === 'partial' && `⚠️ Sent with some failures. ${result.failed?.length || 0} recipient(s) failed.`}
            {result.status === 'failed' && `✗ Sending failed. ${result.failed?.length || 0} recipient(s) failed.`}
            {result.skipped > 0 && ` ${result.skipped} unsubscribed contact(s) were skipped.`}
          </p>
          {result.warnings?.length > 0 && (
            <ul className="mt-2 text-xs text-amber-800 list-disc pl-5">
              {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          {result.failed?.length > 0 && (
            <ul className="mt-2 text-xs text-red-700 list-disc pl-5 max-h-40 overflow-y-auto">
              {result.failed.map((f, i) => <li key={i}>{f.email}: {f.error}</li>)}
            </ul>
          )}
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-800 whitespace-pre-wrap">{error}</p>
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Communications</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Send a rich HTML email to registrants or contacts. Sent from info@kathrynclassic.com.
          </p>
        </div>
        <CommunicationsNav />
      </div>

      {/* 1. Recipients */}
      <section className="bg-white dark:bg-night-800 rounded-lg shadow p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">1. Recipients</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Campaign year</label>
            <Select value={campaignYear} onChange={(e) => setCampaignYear(e.target.value)} className="w-28">
              {tournamentYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          The unsubscribe link in this email lets recipients opt out of <strong>{campaignYear || 'this year'}</strong> emails
          or all emails. Contacts already unsubscribed (for {campaignYear || 'this year'} or entirely) are hidden below.
        </p>
        <RecipientSelector onChange={handleRecipientsChange} campaignYear={campaignYear} />
      </section>

      {/* 2. Content */}
      <section className="bg-white dark:bg-night-800 rounded-lg shadow p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">2. Content</h2>
          <TemplateManager subject={subject} bodyHtml={bodyHtml} onLoad={handleLoadTemplate} onTemplateChange={handleTemplateChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject line"
            className="block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Body</label>
          <EmailEditor value={bodyHtml} onChange={setBodyHtml} />
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
      </section>

      {/* 3. CC / BCC */}
      <section className="bg-white dark:bg-night-800 rounded-lg shadow p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">3. CC / BCC (optional)</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Separate multiple addresses with commas or new lines. These are added in addition to the selected recipients (who are always BCC'd).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CC</label>
            <textarea
              value={ccRaw}
              onChange={(e) => setCcRaw(e.target.value)}
              rows={2}
              className="block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">BCC</label>
            <textarea
              value={bccRaw}
              onChange={(e) => setBccRaw(e.target.value)}
              rows={2}
              className="block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
          </div>
        </div>
      </section>

      {/* 4. Preview & send */}
      <section className="bg-white dark:bg-night-800 rounded-lg shadow p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">4. Preview & send</h2>
        <EmailPreview subject={subject} bodyHtml={bodyHtml} recipientCount={recipients.length} cc={cc} bcc={bcc} sampleRecipient={recipients[0]} />

        {/* Send result / errors shown right here by the button */}
        <ResultBanner />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={!canSend}
            className="inline-flex items-center px-5 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending…' : `Send to ${recipients.length} recipient(s)`}
          </button>
        </div>
      </section>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={doSend}
        title="Send email"
        message={`Send "${subject}" to ${recipients.length} recipient(s)? This cannot be undone.`}
        confirmText="Send"
        cancelText="Cancel"
        confirmButtonClass="bg-primary-600 hover:bg-primary-700"
      />
    </div>
  );
}
