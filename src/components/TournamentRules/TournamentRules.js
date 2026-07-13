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
              <div
                className="rich-content text-base leading-7 text-gray-600 dark:text-gray-300"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400">
                Tournament rules will be posted soon. Check back closer to the event.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
