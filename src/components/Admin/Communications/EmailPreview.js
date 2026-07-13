import React from 'react';
import { emailShell, renderTemplate, recipientVars } from './emailShell';

// Renders the email as a recipient will see it (variables substituted, wrapped
// in the shared shell) inside a sandboxed iframe, plus a header summary.
// `extraVars` layers additional token values (e.g. the registration templates'
// sample blocks) over the recipient-derived ones; `shellFn` swaps the wrapper
// when the email is sent by a function that uses a different shell.
export default function EmailPreview({ subject, bodyHtml, recipientCount, cc, bcc, sampleRecipient, extraVars, shellFn }) {
  const vars = { ...recipientVars(sampleRecipient || {}), ...(extraVars || {}) };
  const renderedSubject = renderTemplate(subject, vars);
  const renderedBody = renderTemplate(bodyHtml, vars);

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
        <p><span className="font-medium">Subject:</span> {renderedSubject || <span className="text-gray-400">(none)</span>}</p>
        <p><span className="font-medium">From:</span> info@kathrynclassic.com</p>
        <p><span className="font-medium">Recipients:</span> {recipientCount} (each gets their own personalized email)</p>
        {cc?.length > 0 && <p><span className="font-medium">CC:</span> {cc.join(', ')}</p>}
        {bcc?.length > 0 && <p><span className="font-medium">BCC:</span> {bcc.join(', ')}</p>}
        {sampleRecipient && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Personalized preview for <span className="font-medium">{sampleRecipient.name || sampleRecipient.email}</span>.
          </p>
        )}
      </div>
      <iframe
        title="Email preview"
        sandbox=""
        srcDoc={(shellFn || emailShell)(renderedBody)}
        className="w-full h-96 border border-gray-200 dark:border-night-700 rounded-lg bg-white"
      />
    </div>
  );
}
