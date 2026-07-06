import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../supabaseClient';

const STATUS_STYLES = {
  sent: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
  sending: 'bg-blue-100 text-blue-800',
};

export default function CampaignHistory() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('email_campaigns')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        if (err) throw err;
        setCampaigns(data || []);
      } catch (err) {
        setError(err.message || 'Failed to load campaigns');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setLoadingRecipients(true);
    setRecipients([]);
    const { data } = await supabase
      .from('email_campaign_recipients')
      .select('*')
      .eq('campaign_id', id)
      .order('name');
    setRecipients(data || []);
    setLoadingRecipients(false);
  };

  const fmtDate = (d) => (d ? new Date(d).toLocaleString() : '—');

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading history…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Email history</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Every campaign sent from the portal.</p>
        </div>
        <Link to="/admin/communications" className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700">
          ← New email
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-night-800 shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50 dark:bg-night-700">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Sent</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Tournament</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Subject</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Template</th>
              <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">Recipients</th>
              <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">Status</th>
              <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-night-700">
            {campaigns.map((c) => (
              <React.Fragment key={c.id}>
                <tr className="hover:bg-gray-50 dark:hover:bg-night-700">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 dark:text-gray-400">{fmtDate(c.sent_at || c.created_at)}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{c.tournament_year || '—'}</td>
                  <td className="px-3 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{c.subject}</td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{c.template_name || '—'}</td>
                  <td className="px-3 py-4 text-sm text-center text-gray-500 dark:text-gray-400">{c.recipient_count}</td>
                  <td className="px-3 py-4 text-sm text-center">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status] || 'bg-gray-100 text-gray-800'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-sm text-right">
                    <button onClick={() => toggleExpand(c.id)} className="text-primary-600 dark:text-primary-400 hover:text-primary-900 font-medium">
                      {expandedId === c.id ? 'Hide' : 'View'}
                    </button>
                  </td>
                </tr>
                {expandedId === c.id && (
                  <tr className="bg-gray-50 dark:bg-night-900">
                    <td colSpan={7} className="px-4 py-3">
                      {c.error && <p className="text-sm text-red-700 mb-2">Error: {c.error}</p>}
                      {loadingRecipients ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Loading recipients…</p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto">
                          <table className="min-w-full text-sm">
                            <tbody>
                              {recipients.map((r) => (
                                <tr key={r.id}>
                                  <td className="py-1 pr-4 text-gray-900 dark:text-gray-100">{r.name || '—'}</td>
                                  <td className="py-1 pr-4 text-gray-500 dark:text-gray-400">{r.email}</td>
                                  <td className="py-1">
                                    <span className={`text-xs ${r.status === 'failed' ? 'text-red-600' : r.status === 'skipped' ? 'text-amber-600' : 'text-green-600'}`}>{r.status}</span>
                                    {r.error && (
                                      <span className={`text-xs ml-2 ${r.status === 'failed' ? 'text-red-500' : 'text-gray-400'}`}>{r.error}</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {recipients.length === 0 && (
                                <tr><td className="py-2 text-gray-500 dark:text-gray-400">No recipient records.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {campaigns.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500 dark:text-gray-400">No emails sent yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
