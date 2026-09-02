import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { logAudit } from '../../../utils/audit';
import EmailEditor from '../Communications/EmailEditor';
import Select from '../Select';
import {
  DEFAULT_HANDICAP_FORMULA,
  computeTeamHandicap,
  describeTeamHandicap,
  isHandicapEnabled,
  isScratchToLowestEnabled,
} from '../../../utils/handicap';

// Worked example shown under the formula editor, so an admin can see what the
// weights they typed actually produce before saving.
const EXAMPLE_HANDICAPS = [7, 11, 16, 18];

// Percentages are friendlier to type than decimals; the stored formula keeps
// decimals so the maths stays exact.
const toPercent = (weight) => String(Math.round((Number(weight) || 0) * 1000) / 10);
const fromPercent = (percent) => (Number(percent) || 0) / 100;

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
  // Structured team handicap for this year, kept beside the prose. null = played
  // straight up, which is how 2025 is stored.
  const [handicapFormula, setHandicapFormula] = useState(null);
  const [handicapUnavailable, setHandicapUnavailable] = useState(false);
  const loadedHandicapRef = useRef(null);
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
      // handicap_formula arrives with a migration; if this database doesn't have it
      // yet, fall back to the prose so the page still works and say why the formula
      // panel is missing.
      let { data, error: err } = await supabase
        .from('tournament_rules')
        .select('id, body_html, handicap_formula')
        .eq('tournament_id', tId)
        .maybeSingle();
      if (err && err.code === '42703') {
        setHandicapUnavailable(true);
        ({ data, error: err } = await supabase
          .from('tournament_rules')
          .select('id, body_html')
          .eq('tournament_id', tId)
          .maybeSingle());
      } else if (!err) {
        setHandicapUnavailable(false);
      }
      if (err) throw err;
      setRowId(data?.id || null);
      setBodyHtml(data?.body_html || '');
      loadedBodyRef.current = data?.body_html || '';
      setHandicapFormula(data?.handicap_formula || null);
      loadedHandicapRef.current = data?.handicap_formula || null;
    } catch (err) {
      setError(err.message || 'Failed to load rules');
      setRowId(null);
      setBodyHtml('');
      setHandicapFormula(null);
      loadedHandicapRef.current = null;
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

  const handicapEnabled = isHandicapEnabled(handicapFormula);
  const scratchToLowest = isScratchToLowestEnabled(handicapFormula);
  const exampleResult = computeTeamHandicap(EXAMPLE_HANDICAPS, handicapFormula);

  const toggleHandicap = (enabled) => {
    setHandicapFormula(
      enabled
        ? { ...DEFAULT_HANDICAP_FORMULA, ...(handicapFormula || {}), enabled: true }
        : null
    );
  };

  const updateTier = (players, patch) => {
    setHandicapFormula(prev => ({
      ...prev,
      tiers: (prev?.tiers || []).map(t => (t.players === players ? { ...t, ...patch } : t)),
    }));
  };

  const toggleScratchToLowest = (checked) => {
    setHandicapFormula(prev => ({ ...prev, scratch_to_lowest: checked }));
  };

  const updateWeight = (players, index, percent) => {
    const tier = (handicapFormula?.tiers || []).find(t => t.players === players);
    if (!tier) return;
    const weights = [...tier.weights];
    weights[index] = fromPercent(percent);
    updateTier(players, { weights });
  };

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
          .update({
            body_html: bodyHtml,
            ...(handicapUnavailable ? {} : { handicap_formula: handicapFormula }),
            updated_at: new Date().toISOString(),
          })
          .eq('id', rowId);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase
          .from('tournament_rules')
          .insert({
            tournament_id: tournamentId,
            body_html: bodyHtml,
            ...(handicapUnavailable ? {} : { handicap_formula: handicapFormula }),
          })
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
      // The handicap drives scoring, so a change to it is worth its own audit line.
      const previousHandicap = JSON.stringify(loadedHandicapRef.current ?? null);
      const nextHandicap = JSON.stringify(handicapFormula ?? null);
      if (previousHandicap !== nextHandicap) {
        changes = { ...changes, handicap_formula: { from: previousHandicap, to: nextHandicap } };
      }
      await logAudit({
        action: wasNew ? 'tournament_rules.created' : 'tournament_rules.updated',
        entityType: 'tournament_rules',
        entityId: savedId || undefined,
        entityLabel: `Tournament Rules ${selectedYear || ''}`.trim(),
        changes,
      });
      loadedBodyRef.current = bodyHtml;
      loadedHandicapRef.current = handicapFormula;
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

              {handicapUnavailable ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20 p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Team handicaps aren't set up on this database yet. Run the{' '}
                    <code>add_handicap_formula</code> migration to configure a per-year formula
                    here.
                  </p>
                </div>
              ) : (
              <div className="border border-gray-200 dark:border-night-700 rounded-lg p-4">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={handicapEnabled}
                    onChange={(e) => toggleHandicap(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Apply a team handicap for {selectedYear}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      Team Builder uses this to work out each team's strokes. Leave it off for a
                      year played straight up. Describe it for players in the rules content above —
                      this panel only drives the calculation.
                    </span>
                  </span>
                </label>

                {handicapEnabled && (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Weights are applied to a team's handicaps sorted lowest to highest, so
                      stronger players count for more. Extra strokes are added afterwards to
                      compensate short teams, and only the final total is rounded (half-strokes up).
                    </p>
                    <div className="overflow-x-auto">
                      <table className="text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            <th className="pr-3 pb-1 font-medium">Team size</th>
                            <th className="pr-3 pb-1 font-medium">Weights, lowest handicap first (%)</th>
                            <th className="pb-1 font-medium">+ strokes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(handicapFormula.tiers || []).map((tier) => (
                            <tr key={tier.players}>
                              <td className="pr-3 py-1 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {tier.players} players
                              </td>
                              <td className="pr-3 py-1">
                                <div className="flex gap-1.5">
                                  {(tier.weights || []).map((weight, i) => (
                                    <input
                                      key={i}
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={toPercent(weight)}
                                      onChange={(e) => updateWeight(tier.players, i, e.target.value)}
                                      className="w-16 rounded-md border border-gray-300 dark:border-night-600 py-1 px-2 text-sm bg-white dark:bg-night-700 text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:outline-none focus:ring-0"
                                    />
                                  ))}
                                </div>
                              </td>
                              <td className="py-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={tier.flat ?? 0}
                                  onChange={(e) =>
                                    updateTier(tier.players, { flat: Number(e.target.value) || 0 })
                                  }
                                  className="w-16 rounded-md border border-gray-300 dark:border-night-600 py-1 px-2 text-sm bg-white dark:bg-night-700 text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:outline-none focus:ring-0"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Example</span> — a team of{' '}
                      {EXAMPLE_HANDICAPS.join(', ')}:{' '}
                      {exampleResult
                        ? describeTeamHandicap(exampleResult)
                        : 'no weights set for a team of this size.'}
                    </p>

                    <label className="flex items-start gap-2 cursor-pointer pt-2 border-t border-gray-100 dark:border-night-700">
                      <input
                        type="checkbox"
                        checked={scratchToLowest}
                        onChange={(e) => toggleScratchToLowest(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span>
                        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Scratch the lowest team handicap to 0
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          After the formula above runs, the team with the smallest handicap in the
                          field is set to 0 and every other team's handicap is reduced by that same
                          amount. Teams end up compared to the strongest team rather than to par.
                          Leave it off to use each team's handicap as calculated. Team Builder shows
                          the number before this adjustment; the leaderboard shows it after.
                        </span>
                      </span>
                    </label>
                  </div>
                )}
              </div>
              )}

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
