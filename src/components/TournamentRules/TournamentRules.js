import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

// Public Tournament Rules page. Rules are stored per year (managed in Admin → Rules);
// we show the most recent year that has rules entered.
export default function TournamentRules() {
  const [bodyHtml, setBodyHtml] = useState('');
  const [year, setYear] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('tournament_rules')
        .select('body_html, tournament:tournaments(year)');
      if (error) console.error('Error loading tournament rules:', error);

      // Pick the most recent year that actually has rules content.
      const latest = (data || [])
        .filter((r) => (r.body_html || '').trim() && r.tournament?.year != null)
        .sort((a, b) => b.tournament.year - a.tournament.year)[0];

      if (active) {
        setBodyHtml(latest?.body_html || '');
        setYear(latest?.tournament?.year || null);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className="bg-primary-50 dark:bg-night-900 min-h-screen">
      <div className="pt-10 pb-24 sm:pt-14 sm:pb-32">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold tracking-tight text-primary-600 dark:text-primary-400 sm:text-5xl font-serif">
              Tournament Rules
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400 font-serif">
              Everything you need to know about how The Kathryn Classic{year ? ` ${year}` : ''} is played.
            </p>
          </div>

          {/* Rules content */}
          <div className="bg-white dark:bg-night-800 rounded-2xl shadow-lg p-8 sm:p-12">
            {loading ? (
              <p className="text-center text-gray-500 dark:text-gray-400">Loading…</p>
            ) : bodyHtml ? (
              // `.App` in App.css still carries Create React App's boilerplate
              // `text-align: center`, which every page inherits. Centred body copy
              // gives each line a ragged left edge and scatters list bullets, so the
              // prose reads left-aligned; `.rules-content` (index.css) re-centres the
              // section headings.
              <div
                className="rich-content rules-content text-left text-base leading-7 text-gray-600 dark:text-gray-300"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400">
                Tournament rules will be posted soon. Check back closer to the event.
              </p>
            )}
          </div>

          {/* Scorecard — its own card at the foot of the page. The handicap rules
              above refer to the hole handicap, so players need to be able to read
              the card itself. Rendered as images rather than an embedded PDF:
              mobile browsers routinely refuse to display a PDF in an iframe, and
              the images stay pinchable. The PDF is linked underneath for printing. */}
          <div className="mt-8 bg-white dark:bg-night-800 rounded-2xl shadow-lg p-6 sm:p-10">
            <h2 className="text-center text-xl font-bold text-primary-700 dark:text-primary-400 font-serif">
              Course Scorecard
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              Pine Mountain Lake — hole handicaps are on the front, the course map and
              local rules on the back.
            </p>

            <div className="mt-6 space-y-6">
              {[
                {
                  src: `${process.env.PUBLIC_URL}/scorecard-front.png`,
                  alt: 'Pine Mountain Lake scorecard front: yardages by tee, par, and the men\u2019s and ladies\u2019 handicap for each of the 18 holes.',
                  caption: 'Front — yardages, par, and hole handicaps',
                  width: 1944,
                  height: 1512,
                },
                {
                  src: `${process.env.PUBLIC_URL}/scorecard-back.jpg`,
                  alt: 'Pine Mountain Lake scorecard back: course map of all 18 holes, local rules, and yardage marker guidance.',
                  caption: 'Back — course map and local rules',
                  width: 1400,
                  height: 1089,
                },
              ].map((page) => (
                <figure key={page.src}>
                  {/* White mat so the card reads the same in dark mode. */}
                  <a
                    href={page.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg bg-white p-2 ring-1 ring-gray-200 dark:ring-night-700"
                  >
                    <img
                      src={page.src}
                      alt={page.alt}
                      width={page.width}
                      height={page.height}
                      loading="lazy"
                      className="w-full h-auto rounded"
                    />
                  </a>
                  <figcaption className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                    {page.caption}
                  </figcaption>
                </figure>
              ))}
            </div>

            <p className="mt-6 text-center text-sm">
              <a
                href={`${process.env.PUBLIC_URL}/pml-scorecard.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 underline hover:text-primary-700"
              >
                Open the printable scorecard (PDF)
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
