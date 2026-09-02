// Team handicap calculation.
//
// Whether a team handicap applies — and how it's worked out — is a property of a
// given year's rules, not of the app, so the formula is stored per tournament in
// `tournament_rules.handicap_formula` and edited in Admin → Rules. 2025 had no
// team handicap at all (no formula row), 2026 uses a weighted allowance. Keeping
// it as data means an old year keeps showing the numbers it was actually played
// under, even after the rules change.
//
// Formula shape:
//   {
//     enabled: true,
//     scratch_to_lowest: false,
//     tiers: [
//       { players: 4, weights: [0.25, 0.20, 0.15, 0.10], flat: 0 },
//       { players: 3, weights: [0.30, 0.25, 0.15],       flat: 3 },
//       { players: 2, weights: [0.40, 0.30],             flat: 6 }
//     ]
//   }
//
// Weights line up with the team's handicaps sorted lowest to highest, so the
// stronger players carry more of the allowance. `flat` is added afterwards to
// compensate short teams. Only the final total is rounded.
//
// `scratch_to_lowest` is a separate, year-by-year toggle on top of the formula
// above: when on, the field's lowest team handicap is set to 0 (scratch) and
// that same amount is subtracted from every other team's handicap, so teams
// are compared by how far below the strongest team they are rather than by
// the raw formula output. It only makes sense across every team in a
// tournament at once, so — unlike the rest of this file — it isn't applied by
// computeTeamHandicap() (which only ever sees one team). It's applied instead
// where all teams are already gathered: the `leaderboard_view` SQL view
// mirrors this same adjustment for the numbers players actually see.

// The 2026 allowance, used as the starting point when an admin turns the handicap
// on for a year that doesn't have one yet.
export const DEFAULT_HANDICAP_FORMULA = {
  enabled: true,
  scratch_to_lowest: false,
  tiers: [
    { players: 4, weights: [0.25, 0.2, 0.15, 0.1], flat: 0 },
    { players: 3, weights: [0.3, 0.25, 0.15], flat: 3 },
    { players: 2, weights: [0.4, 0.3], flat: 6 },
  ],
};

// Half-strokes round up. The epsilon keeps a total that should land exactly on .5
// from rounding down when binary floating point lands a hair under it.
export const roundStrokes = (value) => Math.floor(value + 0.5 + 1e-9);

export const isHandicapEnabled = (formula) =>
  Boolean(formula && formula.enabled && Array.isArray(formula.tiers) && formula.tiers.length > 0);

export const isScratchToLowestEnabled = (formula) =>
  Boolean(isHandicapEnabled(formula) && formula.scratch_to_lowest);

// Returns { strokes, exact, flat, parts } for the given handicaps, or null when the
// year has no handicap, the team has no usable handicaps, or the team's size isn't
// covered by the formula (a lone player, say).
export function computeTeamHandicap(handicaps, formula) {
  if (!isHandicapEnabled(formula)) return null;

  const values = (handicaps || [])
    .map(h => (h === '' || h == null ? NaN : Number(h)))
    .filter(h => Number.isFinite(h))
    .sort((a, b) => a - b);
  if (values.length === 0) return null;

  const tier = formula.tiers.find(t => Number(t.players) === values.length);
  if (!tier || !Array.isArray(tier.weights)) return null;

  const parts = values.map((handicap, i) => {
    const weight = Number(tier.weights[i]) || 0;
    return { handicap, weight, value: handicap * weight };
  });
  const flat = Number(tier.flat) || 0;
  const exact = parts.reduce((sum, p) => sum + p.value, 0) + flat;

  return { strokes: roundStrokes(exact), exact, flat, parts };
}

const trimNumber = (n) => String(Number(n.toFixed(2)));

// "25% of 7 (1.75) + 20% of 11 (2.2) + 15% of 16 (2.4) + 10% of 18 (1.8) = 8.15 → 8 strokes"
// Used as the tooltip on a team handicap badge so the number can be checked by eye.
export function describeTeamHandicap(result) {
  if (!result) return '';
  const terms = result.parts.map(
    p => `${trimNumber(p.weight * 100)}% of ${trimNumber(p.handicap)} (${trimNumber(p.value)})`
  );
  if (result.flat) terms.push(`${trimNumber(result.flat)} added for a short team`);
  return `${terms.join(' + ')} = ${trimNumber(result.exact)} → ${result.strokes} stroke${
    result.strokes === 1 ? '' : 's'
  }`;
}
