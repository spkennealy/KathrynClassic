import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { getLeaderboardYear, formatDateRange } from '../../utils/tournamentUtils';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tournamentYear, setTournamentYear] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [tournamentDates, setTournamentDates] = useState(null);

  useEffect(() => {
    loadAvailableYears();
  }, []);

  useEffect(() => {
    if (tournamentYear) {
      fetchLeaderboard();
    }
  }, [tournamentYear]);

  const loadAvailableYears = async () => {
    try {
      // Get leaderboard year (shows previous year until day before tournament)
      const leaderboardYear = await getLeaderboardYear();
      setTournamentYear(leaderboardYear);

      // Get all years that have leaderboard data
      const { data, error } = await supabase
        .from('golf_teams')
        .select('tournament_id, tournaments(year)')
        .order('tournaments(year)', { ascending: false });

      if (error) throw error;

      // Extract unique years
      const years = [...new Set(data.map(item => item.tournaments?.year).filter(Boolean))];
      setAvailableYears(years);
    } catch (err) {
      console.error('Error loading available years:', err);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);

      // Get tournament by year
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .select('id, start_date, end_date')
        .eq('year', tournamentYear)
        .single();

      if (tournamentError) throw tournamentError;

      if (!tournament) {
        setLeaderboard([]);
        setTournamentDates(null);
        setLoading(false);
        return;
      }

      // Store tournament dates
      if (tournament.start_date && tournament.end_date) {
        setTournamentDates({
          start: tournament.start_date,
          end: tournament.end_date
        });
      } else {
        setTournamentDates(null);
      }

      // Fetch leaderboard data using the view
      const { data, error } = await supabase
        .from('leaderboard_view')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('position', { ascending: true });

      if (error) throw error;
      setLeaderboard(data || []);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  const formatScore = (scoreToPar) => {
    if (scoreToPar === 0) return 'E';
    if (scoreToPar > 0) return `+${scoreToPar}`;
    return scoreToPar.toString();
  };

  const getScoreColor = (scoreToPar) => {
    if (scoreToPar < 0) return 'text-red-600'; // Under par (red like Masters)
    if (scoreToPar === 0) return 'text-gray-900'; // Even par
    return 'text-gray-900'; // Over par
  };

  const formatPosition = (position, isTied) => {
    return isTied ? `T${position}` : position;
  };

  const getPlaceEmoji = (position) => {
    if (position === 1) return '🏆';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return null;
  };

  return (
    <div className="bg-primary-50 min-h-screen">
      {/* Main Content */}
      <div className="py-12 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-primary-600 font-serif mb-3 sm:mb-4">
              Leaderboard
            </h1>
            <p className="text-base sm:text-lg text-gray-600 font-serif">
              Official tournament standings
            </p>

            {/* Tournament Dates */}
            {tournamentDates && (
              <p className="mt-2 text-base text-gray-700 font-serif font-medium">
                {formatDateRange(tournamentDates.start, tournamentDates.end)}
              </p>
            )}

            {/* Year Selector */}
            {availableYears.length > 1 && (
              <div className="mt-6 flex justify-center">
                <select
                  value={tournamentYear}
                  onChange={(e) => setTournamentYear(parseInt(e.target.value))}
                  className="rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-base font-serif px-4 py-2"
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year} Tournament
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Leaderboard */}
          {loading ? (
            <div className="text-center">
              <p className="text-xl text-gray-600 font-serif">Loading leaderboard...</p>
            </div>
          ) : leaderboard.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              {/* Desktop Table Header - hidden on mobile */}
              <div className="bg-primary-600 text-white hidden md:block">
                <div className="grid grid-cols-12 gap-4 px-6 py-4 font-semibold text-sm uppercase tracking-wide">
                  <div className="col-span-1 flex items-center justify-center">Pos</div>
                  <div className="col-span-3 flex items-center">Team</div>
                  <div className="col-span-4 flex items-center justify-center">Players</div>
                  <div className="col-span-2 flex items-center justify-center">To Par</div>
                  <div className="col-span-1 flex items-center justify-center">Total</div>
                  <div className="col-span-1 flex items-center justify-center">Thru</div>
                </div>
              </div>

              {/* Mobile Header */}
              <div className="bg-primary-600 text-white md:hidden px-4 py-3">
                <p className="font-semibold text-sm uppercase tracking-wide text-center">Tournament Standings</p>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {leaderboard.map((team, index) => {
                  // Group players into pairs for display
                  const playerPairs = [];
                  if (team.players) {
                    for (let i = 0; i < team.players.length; i += 2) {
                      playerPairs.push(team.players.slice(i, i + 2));
                    }
                  }

                  return (
                    <div key={team.team_id}>
                      {/* Desktop Row */}
                      <div
                        className={`hidden md:grid grid-cols-12 gap-4 px-6 py-4 hover:bg-primary-50 transition-colors ${
                          index === 0 ? 'bg-yellow-50' : ''
                        }`}
                      >
                        {/* Position */}
                        <div className="col-span-1 flex items-center justify-center">
                          <div className="flex flex-row items-center justify-end gap-2 min-w-[4rem]">
                            {getPlaceEmoji(team.position) && (
                              <span className="text-2xl">{getPlaceEmoji(team.position)}</span>
                            )}
                            <span className="text-lg font-bold text-gray-900 font-serif w-8 text-center">
                              {formatPosition(team.position, team.is_tied)}
                            </span>
                          </div>
                        </div>

                        {/* Team Name */}
                        <div className="col-span-3 flex items-center">
                          {team.team_name && (
                            <div className="text-sm font-semibold text-primary-600 uppercase tracking-wide">
                              {team.team_name}
                            </div>
                          )}
                        </div>

                        {/* Players (2 per line) */}
                        <div className="col-span-4 flex items-center">
                          <div className="space-y-1 w-full">
                            {playerPairs.map((pair, pairIdx) => (
                              <div key={pairIdx} className="text-sm text-gray-900 font-serif">
                                {pair.map((player, idx) => (
                                  <span key={idx}>
                                    {player.name}
                                    {player.handicap && (
                                      <span className="text-xs text-gray-500"> ({player.handicap})</span>
                                    )}
                                    {idx < pair.length - 1 && <span className="text-gray-400 mx-2">•</span>}
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Score to Par */}
                        <div className="col-span-2 flex items-center justify-center">
                          <span className={`text-2xl font-bold font-serif ${getScoreColor(team.score_to_par)}`}>
                            {formatScore(team.score_to_par)}
                          </span>
                        </div>

                        {/* Total Score */}
                        <div className="col-span-1 flex items-center justify-center">
                          <span className="text-lg text-gray-900 font-serif">
                            {team.total_score}
                          </span>
                        </div>

                        {/* Status */}
                        <div className="col-span-1 flex items-center justify-center">
                          <span className="text-base text-gray-600 font-serif font-semibold">
                            {team.status || 'F'}
                          </span>
                        </div>
                      </div>

                      {/* Mobile Card */}
                      <div
                        className={`md:hidden px-4 py-4 ${
                          index === 0 ? 'bg-yellow-50' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Fixed-width position column for alignment */}
                          <div className="w-14 flex-shrink-0 flex items-center justify-center gap-1 pt-0.5">
                            {getPlaceEmoji(team.position) && (
                              <span className="text-lg">{getPlaceEmoji(team.position)}</span>
                            )}
                            <span className="text-lg font-bold text-gray-900 font-serif">
                              {formatPosition(team.position, team.is_tied)}
                            </span>
                          </div>

                          {/* Center: Team + Players */}
                          <div className="flex-1 min-w-0 text-center">
                            {team.team_name && (
                              <div className="text-xs font-semibold text-primary-600 uppercase tracking-wide">
                                {team.team_name}
                              </div>
                            )}
                            <div className="mt-1">
                              {team.players && (() => {
                                const pairs = [];
                                for (let i = 0; i < team.players.length; i += 2) {
                                  pairs.push(team.players.slice(i, i + 2));
                                }
                                return pairs.map((pair, pairIdx) => (
                                  <div key={pairIdx} className="text-xs text-gray-700 font-serif leading-5">
                                    {pair.map((player, idx) => (
                                      <span key={idx}>
                                        {player.name}
                                        {player.handicap && (
                                          <span className="text-xs text-gray-400"> ({player.handicap})</span>
                                        )}
                                        {idx < pair.length - 1 && <span className="text-gray-300 mx-1">•</span>}
                                      </span>
                                    ))}
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>

                          {/* Right: Score */}
                          <div className="flex flex-col items-end flex-shrink-0">
                            <span className={`text-2xl font-bold font-serif ${getScoreColor(team.score_to_par)}`}>
                              {formatScore(team.score_to_par)}
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs text-gray-500 font-serif">{team.total_score}</span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-500 font-serif font-semibold">{team.status || 'F'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer Note */}
              <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 text-center font-serif border-t border-gray-200">
                <p>Scramble format • F = Finished • T = Tied</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-12 text-center">
              <p className="text-lg sm:text-xl text-gray-600 font-serif">
                No leaderboard data available for {tournamentYear}
              </p>
              <p className="text-sm text-gray-500 mt-2 font-serif">
                Scores will be posted during the tournament
              </p>
            </div>
          )}

          {/* Legend */}
          {leaderboard.length > 0 && (
            <div className="mt-6 sm:mt-8 bg-white rounded-xl shadow p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 font-serif">
                Scoring Legend
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm font-serif">
                <div>
                  <span className="font-semibold text-red-600">Under Par</span> - Red numbers
                </div>
                <div>
                  <span className="font-semibold">E</span> - Even par
                </div>
                <div>
                  <span className="font-semibold">+#</span> - Over par
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
