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
      // First get all finalized tournaments
      const { data: tournamentsData, error: tournamentsError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('is_finalized', true)
        .order('year', { ascending: false });

      if (tournamentsError) throw tournamentsError;

      // Then get winners and calculate stats for each tournament
      const tournamentsWithStats = await Promise.all(
        (tournamentsData || []).map(async (tournament) => {
          // Get tournament winner from leaderboard (position 1)
          const { data: winningTeam } = await supabase
            .from('golf_teams')
            .select(`
              id,
              team_name,
              golf_team_players (
                player_name,
                player_order
              )
            `)
            .eq('tournament_id', tournament.id)
            .eq('position', 1)
            .limit(1)
            .single();

          // Format winner information
          let championInfo = null;
          if (winningTeam) {
            // Sort players by order
            const players = (winningTeam.golf_team_players || [])
              .sort((a, b) => a.player_order - b.player_order)
              .map(p => p.player_name);

            championInfo = {
              team_name: winningTeam.team_name,
              players: players
            };
          }

          // Fallback to tournament_awards if no leaderboard data
          if (!championInfo) {
            const { data: awards } = await supabase
              .from('tournament_awards')
              .select(`
                winner_name,
                contact_id,
                contacts (
                  first_name,
                  last_name
                )
              `)
              .eq('tournament_id', tournament.id)
              .eq('award_category', 'tournament_winner')
              .limit(1);

            if (awards?.[0]) {
              championInfo = {
                winner_name: awards[0].contacts
                  ? `${awards[0].contacts.first_name} ${awards[0].contacts.last_name}`
                  : awards[0].winner_name
              };
            }
          }

          // Calculate golfer count from registrations
          // Get all registrations for this tournament
          const { data: registrations } = await supabase
            .from('registrations')
            .select(`
              id,
              registration_events (
                tournament_event_id,
                child_count,
                tournament_events (
                  event_type
                )
              )
            `)
            .eq('tournament_id', tournament.id);

          // Count unique golfers (those who registered for golf_tournament event)
          const golfers = registrations?.filter(reg =>
            reg.registration_events?.some(re =>
              re.tournament_events?.event_type === 'golf_tournament'
            )
          ) || [];
          const golferCount = golfers.length;

          // Calculate total attendees (adults + children across all events)
          // Count unique adults and max children per registration (to avoid counting same children multiple times)
          let totalAdults = 0;
          let totalChildren = 0;

          registrations?.forEach(reg => {
            // Count each adult once
            totalAdults += 1;

            // For children, take the maximum count across all events
            // (assumes same children attend multiple events)
            const maxChildren = Math.max(
              0,
              ...(reg.registration_events?.map(re => re.child_count || 0) || [0])
            );
            totalChildren += maxChildren;
          });

          const totalAttendees = totalAdults + totalChildren;

          // Calculate money raised from registrations if not manually set
          // Use manual value if available, otherwise calculate
          let moneyRaised = tournament.total_raised;

          if (!moneyRaised) {
            // Get pricing from tournament events
            const { data: events } = await supabase
              .from('tournament_events')
              .select('id, event_type, adult_price, child_price')
              .eq('tournament_id', tournament.id);

            // Calculate revenue from registrations
            let calculatedRevenue = 0;
            registrations?.forEach(reg => {
              reg.registration_events?.forEach(re => {
                const event = events?.find(e => e.id === re.tournament_event_id);
                if (event) {
                  // Adult price
                  calculatedRevenue += event.adult_price || 0;
                  // Child price * child count
                  calculatedRevenue += (event.child_price || 0) * (re.child_count || 0);
                }
              });
            });

            moneyRaised = calculatedRevenue;
          }

          return {
            ...tournament,
            champion: championInfo,
            golfer_count: golferCount,
            total_attendees: totalAttendees,
            total_raised: moneyRaised
          };
        })
      );

      setTournaments(tournamentsWithStats);
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
            <div className="space-y-12">
              {tournaments.map((tournament, index) => (
                <div key={index} className="space-y-6">
                  {/* Year Header */}
                  <div className="text-center">
                    <div className="inline-flex items-center gap-3">
                      <h2 className="text-3xl font-bold text-primary-600 font-serif">
                        {tournament.year} Tournament
                      </h2>
                      <div className="text-4xl">🏆</div>
                    </div>
                  </div>

                  {/* Tournament Summary Block */}
                  <div className="bg-white rounded-2xl shadow-lg p-8">
                    {tournament.tournament_summary ? (
                      <div className="prose prose-lg max-w-none">
                        <p className="text-base leading-7 text-gray-700 font-serif whitespace-pre-line">
                          {tournament.tournament_summary}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-gray-500 font-serif italic">
                          Tournament summary will be added after the event concludes.
                        </p>
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-gray-200">
                      {/* Champion */}
                      <div className="text-center">
                        <div className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-2">
                          Champion
                        </div>
                        <div className="text-lg font-bold text-gray-900 font-serif">
                          {tournament.champion ? (
                            <div className="space-y-1">
                              {tournament.champion.team_name && (
                                <div className="text-sm font-semibold text-primary-600 uppercase">
                                  {tournament.champion.team_name}
                                </div>
                              )}
                              {tournament.champion.players ? (
                                <div className="text-base">
                                  {tournament.champion.players.join(', ')}
                                </div>
                              ) : tournament.champion.winner_name ? (
                                <div>{tournament.champion.winner_name}</div>
                              ) : (
                                'TBD'
                              )}
                            </div>
                          ) : (
                            'TBD'
                          )}
                        </div>
                      </div>

                      {/* Money Raised */}
                      <div className="text-center">
                        <div className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-2">
                          Money Raised
                        </div>
                        <div className="text-lg font-bold text-gray-900 font-serif">
                          {tournament.total_raised !== null && tournament.total_raised !== undefined
                            ? `$${Math.round(tournament.total_raised).toLocaleString()}`
                            : '$0'}
                        </div>
                      </div>

                      {/* Golfers */}
                      <div className="text-center">
                        <div className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-2">
                          Golfers
                        </div>
                        <div className="text-lg font-bold text-gray-900 font-serif">
                          {tournament.golfer_count !== null && tournament.golfer_count !== undefined
                            ? tournament.golfer_count
                            : '0'}
                        </div>
                      </div>

                      {/* Total Attendees */}
                      <div className="text-center">
                        <div className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-2">
                          Total Attendees
                        </div>
                        <div className="text-lg font-bold text-gray-900 font-serif">
                          {tournament.total_attendees !== null && tournament.total_attendees !== undefined
                            ? tournament.total_attendees
                            : '0'}
                        </div>
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
