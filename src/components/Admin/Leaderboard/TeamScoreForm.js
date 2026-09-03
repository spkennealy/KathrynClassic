import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../supabaseClient';
import { logAudit } from '../../../utils/audit';

const FRONT_NINE = Array.from({ length: 9 }, (_, i) => i + 1);
const BACK_NINE = Array.from({ length: 9 }, (_, i) => i + 10);

// Strokes-vs-par mark, CBS-broadcast style: birdie/eagle get a red circle
// (doubled for eagle-or-better), bogey/double get a square (doubled for
// double-bogey-or-worse). Par gets no mark; no score yet is blank.
const markFor = (strokes, par) => {
  if (strokes == null || strokes === '') return 'empty';
  const diff = strokes - par;
  if (diff <= -2) return 'eagle';
  if (diff === -1) return 'birdie';
  if (diff === 0) return 'par';
  if (diff === 1) return 'bogey';
  return 'double';
};

// Real scorecard convention: shape says how good/bad, fill says how much.
// Circle = under par, square = over par; hollow = one stroke, filled = two
// or more. Par itself carries no mark at all.
// `!` (important) is required here: a global admin-wide input style
// (`.admin-content input:not(...)`) has higher CSS specificity than a bare
// utility class, so without it these shape/fill overrides silently lose.
const MARK_RING = {
  eagle: '!rounded-full !bg-white !border-2 !border-white !text-primary-900',
  birdie: '!rounded-full !border-2 !border-white !bg-transparent !text-white',
  par: '!rounded-none !border-2 !border-transparent !bg-transparent !text-white',
  bogey: '!rounded-none !border-2 !border-white !bg-transparent !text-white',
  double: '!rounded-none !bg-white !border-2 !border-white !text-primary-900',
  empty: '!rounded-none !border-2 !border-transparent !bg-transparent !text-white',
};

// Two of the marks fill the cell white (eagle/double), so the caret needs to
// be dark there instead of the white it is everywhere else, or it vanishes
// against the fill exactly like the digit did before.
const CARET_COLOR = {
  eagle: '#0B3730',
  birdie: '#ffffff',
  par: '#ffffff',
  bogey: '#ffffff',
  double: '#0B3730',
  empty: '#ffffff',
};

const CELL_WIDTH = 'w-9';
const ROW_LABEL_WIDTH = 'w-14';

// Just the hole number now — mulligans live in the stepper under the score.
function HoleNumberLabel({ holeNumber }) {
  return (
    <span className={`${CELL_WIDTH} h-5 flex items-center justify-center text-xs font-semibold text-white`}>
      {holeNumber}
    </span>
  );
}

const MULLIGAN_ROW_HEIGHT = 'h-3';

// The mulligan stepper for one hole: sits invisible under the score until you
// hover, except once a mulligan's actually logged there — then it stays
// visible so the count doesn't hide once you move on.
function MulliganStepper({ holeNumber, count, atLimit, onDelta }) {
  const visible = count > 0;
  return (
    <div
      className={`flex items-center justify-center gap-0.5 ${MULLIGAN_ROW_HEIGHT} mt-0.5 transition-opacity ${
        visible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}
    >
      <button
        type="button"
        tabIndex={-1}
        onClick={() => onDelta(holeNumber, -1)}
        className="text-orange-300 text-[9px] leading-none w-2.5 hover:text-orange-200"
        title="Remove a mulligan on this hole"
      >
        −
      </button>
      <span className="text-orange-300 text-[9px] leading-none font-bold">
        M{count > 0 ? count : ''}
      </span>
      <button
        type="button"
        tabIndex={-1}
        disabled={atLimit}
        onClick={() => onDelta(holeNumber, 1)}
        className={`text-[9px] leading-none w-2.5 ${
          atLimit ? 'text-primary-600 cursor-not-allowed' : 'text-orange-300 hover:text-orange-200'
        }`}
        title={atLimit ? 'All purchased mulligans are already used' : 'Add a mulligan on this hole'}
      >
        +
      </button>
    </div>
  );
}

// A single hole's strokes input, styled with its scoring mark — a real
// scorecard's circle/square convention. Par and handicap live in their own
// rows above, not repeated per cell.
//
// This is deliberately `type="text"` rather than `type="number"`: at this
// cell's small size, Chrome's native number spinner kept reserving layout
// space it wouldn't fully give up even with the spin buttons hidden, which
// rendered the digit invisible behind it. A plain text input with a numeric
// keyboard hint sidesteps that whole class of bug.
function ScoreInput({ holeNumber, par, strokes, mulligans, mulligansAtLimit, onChange, onMulliganDelta }) {
  const mark = markFor(strokes, par);
  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
    onChange(holeNumber, digits === '' ? null : parseInt(digits, 10));
  };
  return (
    <div className={`${CELL_WIDTH} flex flex-col items-center group`}>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={strokes ?? ''}
        onChange={handleChange}
        style={{ caretColor: CARET_COLOR[mark] }}
        className={`!w-7 !h-7 !p-0 leading-none text-center text-sm font-bold bg-transparent focus:outline-none focus:ring-2 focus:ring-primary-300 ${MARK_RING[mark]}`}
      />
      <MulliganStepper holeNumber={holeNumber} count={mulligans} atLimit={mulligansAtLimit} onDelta={onMulliganDelta} />
    </div>
  );
}

export default function TeamScoreForm({ team, tournamentId, onClose, onSave }) {
  const [holes, setHoles] = useState(null); // [{hole_number, par, stroke_index}] once loaded; null while loading
  const [strokes, setStrokes] = useState({}); // { [holeNumber]: number|null }
  const [mulligansByHole, setMulligansByHole] = useState({}); // { [holeNumber]: count }, purely record-keeping
  const [mulligans, setMulligans] = useState(team?.mulligans_purchased ?? 0);
  const [courseInfo, setCourseInfo] = useState(null); // { golf_course, golf_course_logo_url }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHoles = async () => {
      const { data, error: holesError } = await supabase
        .from('tournament_holes')
        .select('hole_number, par, stroke_index')
        .eq('tournament_id', tournamentId)
        .order('hole_number');
      if (holesError) {
        console.error('Error fetching course layout:', holesError);
        setHoles([]);
        return;
      }
      setHoles(data || []);
    };
    fetchHoles();

    const fetchCourseInfo = async () => {
      const { data, error: courseError } = await supabase
        .from('tournaments')
        .select('golf_course, golf_course_logo_url')
        .eq('id', tournamentId)
        .maybeSingle();
      if (courseError) {
        console.error('Error fetching course info:', courseError);
        return;
      }
      setCourseInfo(data || null);
    };
    fetchCourseInfo();
  }, [tournamentId]);

  useEffect(() => {
    const fetchScores = async () => {
      if (!team?.team_id) return;
      const { data, error: scoresError } = await supabase
        .from('golf_hole_scores')
        .select('hole_number, strokes, mulligans_used')
        .eq('team_id', team.team_id);
      if (scoresError) {
        console.error('Error fetching hole scores:', scoresError);
        return;
      }
      const byHole = {};
      const mulligansMap = {};
      (data || []).forEach((row) => {
        byHole[row.hole_number] = row.strokes;
        if (row.mulligans_used) mulligansMap[row.hole_number] = row.mulligans_used;
      });
      setStrokes(byHole);
      setMulligansByHole(mulligansMap);
    };
    fetchScores();
  }, [team]);

  const parByHole = useMemo(() => {
    const map = {};
    (holes || []).forEach((h) => { map[h.hole_number] = h.par; });
    return map;
  }, [holes]);

  const strokeIndexByHole = useMemo(() => {
    const map = {};
    (holes || []).forEach((h) => { map[h.hole_number] = h.stroke_index; });
    return map;
  }, [holes]);

  const holesPlayed = Object.values(strokes).filter((s) => s != null).length;
  const totalScore = Object.values(strokes).reduce((sum, s) => sum + (s || 0), 0);
  const parThruPlayed = FRONT_NINE.concat(BACK_NINE)
    .filter((h) => strokes[h] != null)
    .reduce((sum, h) => sum + (parByHole[h] || 0), 0);
  const scoreToPar = holesPlayed > 0 ? totalScore - parThruPlayed : null;
  const thruLabel = holesPlayed === 18 ? 'F' : holesPlayed === 0 ? '-' : `Thru ${holesPlayed}`;

  const handleHoleChange = (holeNumber, value) => {
    setStrokes((prev) => ({ ...prev, [holeNumber]: value }));
  };

  const mulligansPurchased = parseInt(mulligans, 10) || 0;
  const totalMulligansUsed = Object.values(mulligansByHole).reduce((s, c) => s + c, 0);

  const handleMulliganDelta = (holeNumber, delta) => {
    // Can't log using more mulligans than were actually purchased.
    if (delta > 0 && totalMulligansUsed >= mulligansPurchased) return;
    setMulligansByHole((prev) => {
      const next = Math.max(0, (prev[holeNumber] || 0) + delta);
      const updated = { ...prev };
      if (next === 0) delete updated[holeNumber];
      else updated[holeNumber] = next;
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // A hole is worth saving if it has a stroke count, a mulligan or two, or
      // both — a mulligan logged before the strokes are typed in shouldn't
      // get silently dropped.
      const holeNumbersToSave = new Set([
        ...Object.entries(strokes).filter(([, s]) => s != null).map(([h]) => parseInt(h, 10)),
        ...Object.keys(mulligansByHole).map((h) => parseInt(h, 10)),
      ]);
      const holeRows = Array.from(holeNumbersToSave).map((holeNumber) => ({
        team_id: team.team_id,
        hole_number: holeNumber,
        strokes: strokes[holeNumber] ?? null,
        mulligans_used: mulligansByHole[holeNumber] || 0,
      }));

      // Replace this team's hole scores wholesale — simplest way to also
      // handle a hole being cleared back out.
      const { error: deleteError } = await supabase
        .from('golf_hole_scores')
        .delete()
        .eq('team_id', team.team_id);
      if (deleteError) throw deleteError;

      if (holeRows.length > 0) {
        const { error: insertError } = await supabase.from('golf_hole_scores').insert(holeRows);
        if (insertError) throw insertError;
      }

      const teamData = {
        total_score: holesPlayed > 0 ? totalScore : null,
        score_to_par: scoreToPar,
        status: holesPlayed > 0 ? thruLabel : null,
        mulligans_purchased: parseInt(mulligans, 10) || 0,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('golf_teams')
        .update(teamData)
        .eq('id', team.team_id);
      if (updateError) throw updateError;

      await recalculatePositions();

      await logAudit({
        action: 'golf_team.score_saved',
        entityType: 'golf_team',
        entityId: team.team_id,
        entityLabel: team.team_name || 'Unnamed team',
        changes: {
          total_score: teamData.total_score,
          score_to_par: teamData.score_to_par,
          status: teamData.status,
          mulligans_purchased: teamData.mulligans_purchased,
        },
        metadata: { holes_played: holesPlayed },
      });

      onSave();
    } catch (err) {
      console.error('Error saving score:', err);
      setError(err.message || 'Failed to save score');
    } finally {
      setLoading(false);
    }
  };

  const recalculatePositions = async () => {
    try {
      const { data: viewRows, error: fetchError } = await supabase
        .from('leaderboard_view')
        .select('team_id, score_to_par, standings_to_par')
        .eq('tournament_id', tournamentId);
      if (fetchError) throw fetchError;

      const rows = (viewRows || [])
        .map((row) => ({ id: row.team_id, score_to_par: row.standings_to_par ?? row.score_to_par }))
        .sort((a, b) => {
          if (a.score_to_par == null) return b.score_to_par == null ? 0 : 1;
          if (b.score_to_par == null) return -1;
          return a.score_to_par - b.score_to_par;
        });
      if (rows.length === 0) return;

      let currentPosition = 1;
      let previousScore = null;
      let teamsAtPosition = 0;
      const updates = rows.map((row, index) => {
        if (previousScore === null || row.score_to_par !== previousScore) {
          currentPosition = index + 1;
          teamsAtPosition = 1;
          previousScore = row.score_to_par;
        } else {
          teamsAtPosition++;
        }
        const next = rows[index + 1];
        // A team with no score yet has no position or tie standing — the
        // grouping above treats consecutive nulls as "equal", which would
        // otherwise mark every unscored team tied with the next.
        if (row.score_to_par == null) {
          return { id: row.id, position: null, is_tied: false };
        }
        const isTied = teamsAtPosition > 1 || (next && next.score_to_par === row.score_to_par);
        return { id: row.id, position: currentPosition, is_tied: isTied };
      });

      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('golf_teams')
          .update({ position: update.position, is_tied: update.is_tied, updated_at: new Date().toISOString() })
          .eq('id', update.id);
        if (updateError) throw updateError;
      }
    } catch (err) {
      console.error('Error recalculating positions:', err);
    }
  };

  const layoutReady = holes !== null && holes.length === 18;

  // One nine's worth of rows — Hole / Par / Handicap / Score, each titled,
  // with the OUT or IN summary folded into the same rows on the right. A
  // plain helper (not a component) so it can close over this render's state
  // without remounting the inputs on every keystroke.
  const renderNine = (nineHoles, outInLabel) => {
    const parTotal = nineHoles.reduce((s, h) => s + (parByHole[h] || 0), 0);
    const strokesTotal = nineHoles.reduce((s, h) => s + (strokes[h] || 0), 0);
    const anyStrokesEntered = nineHoles.some((h) => strokes[h] != null);

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className={`${ROW_LABEL_WIDTH} text-[10px] text-primary-300 uppercase tracking-wide`}>Hole</span>
          {nineHoles.map((h) => (
            <HoleNumberLabel key={h} holeNumber={h} />
          ))}
          <span className="text-[10px] text-primary-300 uppercase tracking-wide w-12 text-center border-l border-primary-700 pl-2 ml-1">
            {outInLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`${ROW_LABEL_WIDTH} text-[10px] text-primary-400 uppercase tracking-wide`}>Par</span>
          {nineHoles.map((h) => (
            <span key={h} className={`${CELL_WIDTH} text-center text-xs text-primary-400`}>{parByHole[h]}</span>
          ))}
          <span className="text-xs text-primary-400 w-12 text-center border-l border-primary-700 pl-2 ml-1">
            {parTotal}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`${ROW_LABEL_WIDTH} text-[10px] text-primary-400 uppercase tracking-wide`}>Hcp</span>
          {nineHoles.map((h) => (
            <span key={h} className={`${CELL_WIDTH} text-center text-xs text-primary-400`}>
              {strokeIndexByHole[h] ?? '-'}
            </span>
          ))}
          <span className="w-12 border-l border-primary-700 pl-2 ml-1" />
        </div>
        <div className="flex items-start gap-2">
          <span className={`${ROW_LABEL_WIDTH} text-[10px] text-primary-300 uppercase tracking-wide pt-1.5`}>Score</span>
          {nineHoles.map((h) => (
            <ScoreInput
              key={h}
              holeNumber={h}
              par={parByHole[h]}
              strokes={strokes[h]}
              mulligans={mulligansByHole[h] || 0}
              mulligansAtLimit={totalMulligansUsed >= mulligansPurchased}
              onChange={handleHoleChange}
              onMulliganDelta={handleMulliganDelta}
            />
          ))}
          <span className="w-12 h-7 flex items-center justify-center text-sm font-bold text-white border-l border-primary-700 pl-2 ml-1">
            {anyStrokesEntered ? strokesTotal : '-'}
          </span>
        </div>
      </div>
    );
  };

  // Portal: keeps `fixed inset-0` clear of the caller's space-y-* sibling margin.
  return createPortal(
    <div className="admin-content fixed inset-0 bg-gray-500 bg-opacity-75 flex items-start sm:items-center justify-center p-4 overflow-y-auto z-50">
      <div className="bg-white dark:bg-night-800 rounded-lg shadow-xl max-w-3xl w-full modal-panel overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-night-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {team?.team_name || 'Team'} — Scorecard
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            {holes === null ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
            ) : !layoutReady ? (
              <div className="rounded-lg border border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  This tournament's course layout (par and handicap per hole) hasn't been set up yet.
                  Set it up in <strong>Admin → Tournaments → Edit</strong>, then come back here to enter scores.
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-primary-900 p-4 overflow-x-auto">
                <div className="min-w-max">
                  {/* Hole rows on the left; the logo fills the space beside
                      OUT/IN, matching that block's height exactly — it does
                      not extend down into the totals footer below. */}
                  <div className="flex items-stretch gap-4">
                    <div className="space-y-4">
                      {renderNine(FRONT_NINE, 'Out')}
                      {renderNine(BACK_NINE, 'In')}
                    </div>
                    {courseInfo?.golf_course_logo_url && (
                      <div className="flex-1 flex items-center justify-center">
                        <img
                          src={courseInfo.golf_course_logo_url}
                          alt={courseInfo.golf_course || 'Course logo'}
                          className="h-full max-h-[140px] w-full max-w-[160px] object-contain bg-white rounded p-2"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-6 pt-2 mt-3 border-t border-primary-700">
                    <div className="flex-1 text-center text-[10px] text-primary-300 uppercase tracking-widest">
                      {courseInfo?.golf_course}
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-primary-300 uppercase tracking-wide">Thru</div>
                      <div className="text-lg font-bold text-white">{thruLabel}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-primary-300 uppercase tracking-wide">Tot</div>
                      <div className="text-lg font-bold text-white">{holesPlayed > 0 ? totalScore : '-'}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-primary-300 uppercase tracking-wide">To Par</div>
                      <div className={`text-lg font-bold ${scoreToPar < 0 ? 'text-red-500' : 'text-white'}`}>
                        {scoreToPar == null ? '-' : scoreToPar === 0 ? 'E' : scoreToPar > 0 ? `+${scoreToPar}` : scoreToPar}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="mulligans" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Mulligans Purchased
              </label>
              <input
                type="number"
                id="mulligans"
                min={0}
                value={mulligans}
                onChange={(e) => setMulligans(e.target.value)}
                className="no-spinner mt-1 block w-32"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 border border-gray-300 dark:border-night-600 rounded-md shadow-sm hover:bg-gray-50 dark:bg-night-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !layoutReady}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Score'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
