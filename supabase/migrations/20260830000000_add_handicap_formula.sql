-- Team handicaps, stored per tournament year alongside that year's rules.
--
-- Whether a handicap applies is a rules decision that changes year to year: 2025
-- was played straight up, 2026 uses a weighted allowance. Keeping the formula as
-- data on tournament_rules (rather than in app code) means Team Builder computes
-- each year under the rules that year was actually played under, and an admin can
-- change next year's allowance without a deploy.
--
-- Shape:
--   {
--     "enabled": true,
--     "tiers": [
--       {"players": 4, "weights": [0.25, 0.20, 0.15, 0.10], "flat": 0},
--       {"players": 3, "weights": [0.30, 0.25, 0.15],       "flat": 3},
--       {"players": 2, "weights": [0.40, 0.30],             "flat": 6}
--     ]
--   }
--
-- Weights pair with the team's handicaps sorted lowest to highest; `flat` is added
-- after the weighted sum; only the final total is rounded (half-strokes up).
-- NULL, or {"enabled": false}, means the year has no team handicap.

alter table public.tournament_rules
  add column if not exists handicap_formula jsonb;

comment on column public.tournament_rules.handicap_formula is
  'Per-year team handicap formula used by Team Builder. NULL or enabled=false means no team handicap that year.';

-- 2026: weighted allowance across all four players.
update public.tournament_rules tr
set handicap_formula = $json$
{
  "enabled": true,
  "tiers": [
    {"players": 4, "weights": [0.25, 0.20, 0.15, 0.10], "flat": 0},
    {"players": 3, "weights": [0.30, 0.25, 0.15], "flat": 3},
    {"players": 2, "weights": [0.40, 0.30], "flat": 6}
  ]
}
$json$::jsonb,
    updated_at = now()
from public.tournaments t
where t.id = tr.tournament_id
  and t.year = 2026;

-- 2025 was played without a handicap; leaving handicap_formula NULL is what says so.

-- Replace the 2026 "Applying Handicaps" prose with the specifics players need.
-- Only that section is rewritten (up to the next <h2>), so admin edits to the rest
-- of the 2026 rules are preserved. If the section is missing entirely, it's appended.
do $$
declare
  section text := $html$<h2>Applying Handicaps</h2>
  <p>To keep things fair across skill levels, each team receives a handicap allowance calculated from <strong>all four players' handicaps</strong>, weighted so that stronger players count more heavily. Sort your team's handicaps from lowest to highest, then take 25% of the lowest, 20% of the second lowest, 15% of the third lowest, and 10% of the highest. Add those together and round to the nearest whole stroke. For example, a team with handicaps of 7, 11, 16, and 18 gets 1.75 + 2.20 + 2.40 + 1.80 = 8.15, for a team handicap of 8.</p>
  <p>Use exact decimals in the calculation and round only the final total. Half-strokes round up. Teams with three players use 30% / 25% / 15% plus 3 strokes; teams with two players use 40% / 30% plus 6 strokes.</p>
  <p>The team handicap is deducted from the team's gross score to determine the net score used for standings. The handicap will be applied to the hardest hole first and then continue down until all the strokes have been used. In our example, the team would have a stroke on the 8 hardest holes on the course, determined by the hole handicap on the scorecard.</p><p>If your handicap is over 18, those will continue to be applied on the hardest holes. For example, if your team handicap is 20, then you will get two strokes on the 2 hardest holes, plus a stroke on every other hole.</p>
  <p>If you don't have an official handicap, enter your best honest estimate on your registration, or 20 if you have no idea. Because every player's number now affects the team total, please make sure you're submitting your handicap index rather than a course handicap.</p>
$html$;
begin
  update public.tournament_rules tr
  set body_html = case
        when tr.body_html like '%<h2>Applying Handicaps</h2>%'
          then regexp_replace(tr.body_html, '<h2>Applying Handicaps</h2>.*?(?=<h2>|$)', section, 'g')
        else tr.body_html || section
      end,
      updated_at = now()
  from public.tournaments t
  where t.id = tr.tournament_id
    and t.year = 2026;
end $$;
