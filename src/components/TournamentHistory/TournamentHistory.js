import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function TournamentHistory() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          tournament_awards!inner (
            winner_name
          )
        `)
        .eq('tournament_awards.award_category', 'tournament_winner')
        .order('year', { ascending: false });

      if (error) throw error;
      setTournaments(data || []);
    } catch (err) {
      console.error('Error fetching tournaments:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-primary-50 min-h-screen">
      {/* Main Content */}
      <div className="py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold tracking-tight text-primary-600 sm:text-5xl font-serif">
              Tournament History
            </h1>
          </div>

          {/* Tournament History Cards */}
          {loading ? (
            <div className="text-center">
              <p className="text-xl text-gray-600 font-serif">Loading tournament history...</p>
            </div>
          ) : tournaments.length > 0 ? (
            <div className="space-y-8">
              {tournaments.map((tournament, index) => (
                <div key={index} className="bg-white rounded-2xl shadow-lg p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-3xl font-bold text-primary-600 font-serif">
                      {tournament.year} Tournament
                    </h2>
                    <div className="text-5xl">🏆</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Champion */}
                    <div className="bg-primary-50 rounded-xl p-6">
                      <div className="text-sm font-semibold text-primary-600 uppercase tracking-wide mb-2">
                        Champion
                      </div>
                      <div className="text-2xl font-bold text-gray-900 font-serif">
                        {tournament.tournament_awards?.[0]?.winner_name || 'TBD'}
                      </div>
                    </div>

                    {/* Money Raised */}
                    <div className="bg-primary-50 rounded-xl p-6">
                      <div className="text-sm font-semibold text-primary-600 uppercase tracking-wide mb-2">
                        Money Raised
                      </div>
                      <div className="text-2xl font-bold text-gray-900 font-serif">
                        {tournament.money_raised
                          ? `$${tournament.money_raised.toLocaleString()}`
                          : 'TBD'}
                      </div>
                    </div>

                    {/* Golfers */}
                    <div className="bg-primary-50 rounded-xl p-6">
                      <div className="text-sm font-semibold text-primary-600 uppercase tracking-wide mb-2">
                        Golfers
                      </div>
                      <div className="text-2xl font-bold text-gray-900 font-serif">
                        {tournament.golfer_count || 'TBD'}
                      </div>
                    </div>

                    {/* Total Attendees */}
                    <div className="bg-primary-50 rounded-xl p-6">
                      <div className="text-sm font-semibold text-primary-600 uppercase tracking-wide mb-2">
                        Total Attendees
                      </div>
                      <div className="text-2xl font-bold text-gray-900 font-serif">
                        {tournament.attendee_count || 'TBD'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center bg-white rounded-2xl shadow-lg p-16">
              <p className="text-xl text-gray-600 font-serif">
                Tournament history will be displayed here after each annual event.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
