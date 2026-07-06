import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

// Public opt-out page reached from the "Unsubscribe" link in bulk emails.
// The link carries the contact's secret token (?token=...) and the campaign's
// year (?year=...). The visitor chooses to opt out of just that year's emails
// or all future emails; the choice is recorded via the unsubscribe_by_token RPC.
export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const yearParam = params.get('year');
  const year = yearParam && /^\d{4}$/.test(yearParam) ? parseInt(yearParam, 10) : null;

  const [status, setStatus] = useState('idle'); // idle | working | done | error
  const [doneScope, setDoneScope] = useState(null); // 'year' | 'all'
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const submit = async (scope) => {
    if (!token) {
      setStatus('error');
      setErrorMsg('This unsubscribe link is missing its token. Please use the link from your email.');
      return;
    }
    setStatus('working');
    setErrorMsg('');
    try {
      const { data, error } = await supabase.rpc('unsubscribe_by_token', {
        p_token: token,
        p_scope: scope,
        p_year: scope === 'year' ? year : null,
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) {
        throw new Error(
          data?.error === 'invalid_token'
            ? 'This unsubscribe link is invalid or has expired.'
            : 'We couldn’t process that request. Please try again.'
        );
      }
      setEmail(data.email || '');
      setDoneScope(scope);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    }
  };

  const working = status === 'working';

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-gray-50 dark:bg-night-900">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-night-800 shadow ring-1 ring-gray-200 dark:ring-night-700 p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center">
          Email preferences
        </h1>

        {status === 'done' ? (
          <div className="mt-6 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40">
              <svg className="h-6 w-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-700 dark:text-gray-300">
              {doneScope === 'all'
                ? <>You’ve been unsubscribed from <strong>all</strong> Kathryn Classic emails.</>
                : <>You’ve been unsubscribed from <strong>{year}</strong> Kathryn Classic emails.</>}
            </p>
            {email && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{email}</p>
            )}
            {doneScope === 'year' && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Changed your mind about everything?{' '}
                <button
                  type="button"
                  onClick={() => submit('all')}
                  className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                >
                  Unsubscribe from all emails
                </button>
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="mt-3 text-center text-sm text-gray-600 dark:text-gray-400">
              Choose what you’d like to stop receiving. You can always re-subscribe by contacting us at{' '}
              <a href="mailto:info@kathrynclassic.com" className="text-primary-600 dark:text-primary-400 hover:underline">
                info@kathrynclassic.com
              </a>.
            </p>

            {errorMsg && (
              <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-800">{errorMsg}</p>
              </div>
            )}

            <div className="mt-6 space-y-3">
              {year && (
                <button
                  type="button"
                  onClick={() => submit('year')}
                  disabled={working}
                  className="w-full rounded-lg border border-primary-600 dark:border-primary-400 bg-white dark:bg-night-700 px-4 py-3 text-sm font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-night-600 transition-colors disabled:opacity-50"
                >
                  Unsubscribe from {year} emails only
                </button>
              )}
              <button
                type="button"
                onClick={() => submit('all')}
                disabled={working}
                className="w-full rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {working ? 'Please wait…' : 'Unsubscribe from all emails'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
