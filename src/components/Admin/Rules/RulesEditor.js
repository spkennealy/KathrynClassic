import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { logAudit } from '../../../utils/audit';
import EmailEditor from '../Communications/EmailEditor';
import Select from '../Select';

// Strip HTML tags to readable plain text (for the audit diff).
const plainText = (html) =>
  (html || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

const DIFF_CAP = 10000;
const capText = (s) => (s.length > DIFF_CAP ? `${s.slice(0, DIFF_CAP)}…` : s);

// Word-level diff of two HTML bodies: returns { from, to } containing only the
// changed region plus a little unchanged context on each side, so the audit shows
// exactly what changed instead of the whole document. Returns null if identical.
const diffContent = (oldHtml, newHtml) => {
  const a = plainText(oldHtml).split(' ').filter(Boolean);
  const b = plainText(newHtml).split(' ').filter(Boolean);

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }

  if (endA === start && endB === start) return null; // no change

  const ctx = 6;
  const preStart = Math.max(0, start - ctx);
  const sufEnd = Math.min(a.length, endA + ctx);
  const lead = preStart > 0 ? '… ' : '';
  const trail = sufEnd < a.length ? ' …' : '';
  const preCtx = a.slice(preStart, start);
  const sufCtx = a.slice(endA, sufEnd);

  return {
    from: capText(lead + [...preCtx, ...a.slice(start, endA), ...sufCtx].join(' ') + trail),
    to: capText(lead + [...preCtx, ...b.slice(start, endB), ...sufCtx].join(' ') + trail),
  };
};

// Per-year editor for the public Tournament Rules page (/rules). Rules are stored one
// row per tournament, so each year's rules are preserved as history — pick a year to
// view/edit it. Mirrors the email-templates editing pattern (EmailEditor + audit log).
export default function RulesEditor() {
  const [tournaments, setTournaments] = useState([]);
  const [tournamentId, setTournamentId] = useState('');
  const [rowId, setRowId] = useState(null); // rules row id for the selected year, or null
  const [bodyHtml, setBodyHtml] = useState('');
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [loadingRules, setLoadingRules] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const loadedBodyRef = useRef(''); // body as last loaded/saved, for the audit diff

  // Load tournaments (newest first) and default to the most recent.
  useEffect(() => {
    (async () => {
      setLoadingTournaments(true);
      try {
        const { data, error: err } = await supabase
          .from('tournaments')
          .select('id, year')
          .order('year', { ascending: false });
        if (err) throw err;
        setTournaments(data || []);
        if (data && data.length > 0) setTournamentId(data[0].id);
      } catch (err) {
        setError(err.message || 'Failed to load tournaments');
      } finally {
        setLoadingTournaments(false);
      }
    })();
  }, []);

  // Load the rules row for the selected tournament.
  const fetchRules = useCallback(async (tId) => {
    if (!tId) return;
    setLoadingRules(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('tournament_rules')
        .select('id, body_html')
        .eq('tournament_id', tId)
        .maybeSingle();
      if (err) throw err;
      setRowId(data?.id || null);
      setBodyHtml(data?.body_html || '');
      loadedBodyRef.current = data?.body_html || '';
    } catch (err) {
      setError(err.message || 'Failed to load rules');
      setRowId(null);
      setBodyHtml('');
    } finally {
      setLoadingRules(false);
    }
  }, []);

  useEffect(() => {
    if (tournamentId) fetchRules(tournamentId);
  }, [tournamentId, fetchRules]);

  const flash = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const selectedYear = tournaments.find((t) => t.id === tournamentId)?.year;

  const handleSave = async () => {
    if (!tournamentId) return;
    setSaving(true);
    setError(null);
    const wasNew = !rowId;
    const previousBody = loadedBodyRef.current;
    try {
      let savedId = rowId;
      if (rowId) {
        const { error: err } = await supabase
          .from('tournament_rules')
          .update({ body_html: bodyHtml, updated_at: new Date().toISOString() })
          .eq('id', rowId);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase
          .from('tournament_rules')
          .insert({ tournament_id: tournamentId, body_html: bodyHtml })
          .select('id')
          .single();
        if (err) throw err;
        savedId = data.id;
        setRowId(data.id);
      }
      let changes;
      if (wasNew) {
        changes = { content: capText(plainText(bodyHtml)) };
      } else {
        const d = diffContent(previousBody, bodyHtml);
        changes = d ? { content: d } : { note: 'Saved with no content changes' };
      }
      await logAudit({
        action: wasNew ? 'tournament_rules.created' : 'tournament_rules.updated',
        entityType: 'tournament_rules',
        entityId: savedId || undefined,
        entityLabel: `Tournament Rules ${selectedYear || ''}`.trim(),
        changes,
      });
      loadedBodyRef.current = bodyHtml;
      flash('Rules saved');
    } catch (err) {
      setError(err.message || 'Failed to save rules');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Tournament Rules</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Edit the rules shown publicly at /rules. Rules are saved per year, so each year's rules
          are kept as history — pick a year to view or edit it.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {loadingTournaments ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      ) : tournaments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Create a tournament first — rules are saved per tournament year.
        </p>
      ) : (
        <div className="bg-white dark:bg-night-800 rounded-lg shadow p-5 space-y-4">
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year</label>
            <Select value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} className="block w-full">
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.year}</option>
              ))}
            </Select>
          </div>

          {loadingRules ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading rules…</p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rules content</label>
                <EmailEditor key={tournamentId} value={bodyHtml} onChange={setBodyHtml} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview</label>
                <div className="border border-gray-200 dark:border-night-700 rounded-lg p-4 bg-white dark:bg-night-800">
                  <div
                    className="rich-content text-sm text-gray-700 dark:text-gray-300"
                    dangerouslySetInnerHTML={{ __html: bodyHtml || '<p class="text-gray-400">Nothing to preview yet.</p>' }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-night-700 pt-4">
                {message && <span className="text-sm text-green-600">{message}</span>}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium rounded-md border border-transparent bg-primary-600 text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving…' : `Save ${selectedYear || ''} rules`.trim()}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
