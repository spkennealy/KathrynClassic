import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { getLeaderboardYear, formatDateRange } from '../../utils/tournamentUtils';
import Select from '../Admin/Select';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tournamentYear, setTournamentYear] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [tournamentDates, setTournamentDates] = useState(null);
  // Pre-round pairings: once tee times are set for a round that hasn't been
  // played yet, the "position" column doesn't mean anything — swap it for
  // when/where each team starts instead.
  const [teeTimeInfo, setTeeTimeInfo] = useState({ show: false, format: 'standard', shotgunTime: null });

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
      // Only tournaments whose pairings have been published. Asking `tournaments`
      // directly rather than deriving years from golf_teams keeps this honest for
      // a logged-in admin too — RLS would otherwise hand them the draft years.
      const { data, error } = await supabase
        .from('tournaments')
        .select('year')
        .not('teams_published_at', 'is', null)
        .is('deleted_at', null)
        .order('year', { ascending: false });

      if (error) throw error;

      const years = [...new Set((data || []).map((t) => t.year).filter(Boolean))];
      setAvailableYears(years);

      // Open on the most recent published year, so publishing a new year's teams
      // immediately makes it the default view.
      if (years.length > 0) {
        setTournamentYear(years[0]);
      } else {
        // Nothing published yet — fall back to the old date-driven choice so the
        // page still has something to ask for.
        setTournamentYear(await getLeaderboardYear());
      }
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

      // Show the actual golf tournament date (not the whole weekend range).
      // Fall back to the tournament's start/end range if no golf event exists.
      const { data: golfEvent } = await supabase
        .from('tournament_events')
        .select('event_date, tee_time_format')
        .eq('tournament_id', tournament.id)
        .eq('event_type', 'golf_tournament')
        .order('event_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (golfEvent?.event_date) {
        // start === end makes formatDateRange render a single date.
        setTournamentDates({ start: golfEvent.event_date, end: golfEvent.event_date });
      } else if (tournament.start_date && tournament.end_date) {
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

      // Pull in tee times for this round, if any have been set.
      const { data: teeTimes } = await supabase
        .from('tee_times_view')
        .select('team_id, tee_time, hole_number')
        .eq('tournament_id', tournament.id);

      const teeTimeByTeam = new Map((teeTimes || []).filter((t) => t.team_id).map((t) => [t.team_id, t]));

      // The round hasn't been played yet if its date is still ahead of today —
      // that's when standings are meaningless and pairings are what matters.
      // But a score on the board beats the calendar: if a team has already
      // posted, someone's out there playing (an early/test entry, whatever),
      // so switch over to standings immediately rather than waiting on the
      // date to catch up.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const anyScorePosted = (data || []).some((t) => t.total_score != null);
      const roundNotYetPlayed =
        golfEvent?.event_date && new Date(`${golfEvent.event_date}T00:00:00`) > today && !anyScorePosted;
      const showTeeTimes = Boolean(roundNotYetPlayed && teeTimeByTeam.size > 0);
      const format = golfEvent?.tee_time_format || 'standard';
      // A shotgun start is one shared time for the whole field — surface it once
      // up top rather than repeating it in every row (the earliest tee time
      // covers it even if entries drift by a minute or two).
      const shotgunTime = format === 'shotgun'
        ? (teeTimes || []).reduce((earliest, t) => {
            if (!t.tee_time) return earliest;
            return !earliest || new Date(t.tee_time) < new Date(earliest) ? t.tee_time : earliest;
          }, null)
        : null;
      setTeeTimeInfo({ show: showTeeTimes, format, shotgunTime });

      let merged = (data || []).map((team) => {
        const tt = teeTimeByTeam.get(team.team_id);
        return { ...team, tee_time: tt?.tee_time ?? null, hole_number: tt?.hole_number ?? null };
      });

      if (showTeeTimes) {
        // Chronological for a standard round (everyone's on hole 1, so the
        // time is the only thing that varies); by starting hole for a shotgun
        // (everyone starts at once, so the hole is what varies).
        const sortKey = format === 'shotgun'
          ? (t) => t.hole_number ?? Infinity
          : (t) => (t.tee_time ? new Date(t.tee_time).getTime() : Infinity);
        merged = [...merged].sort((a, b) => sortKey(a) - sortKey(b));
      }

      setLeaderboard(merged);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  // A year is played under a handicap or it isn't — the view says which, and the
  // leaderboard shows one score column or two accordingly. Falls back to gross if
  // the database predates the net-score view.
  const usesHandicap = leaderboard.some((team) => team.handicap_applied);
  const standingsToPar = (team) => team.standings_to_par ?? team.score_to_par;
  // 12-column grid: Pos 1 + Team 3 + Players + score columns.
  const playersSpan = usesHandicap ? 'col-span-4' : 'col-span-5';
  const toParSpan = usesHandicap ? 'col-span-1' : 'col-span-2';

  const formatScore = (scoreToPar) => {
    if (scoreToPar == null) return '';
    if (scoreToPar === 0) return 'E';
    if (scoreToPar > 0) return `+${scoreToPar}`;
    return scoreToPar.toString();
  };

  // When a year scratches the field's lowest team to 0 (Admin → Rules), the
  // handicap actually used for scoring differs from the raw formula number —
  // show both, raw in gray leading into the adjusted number in black, so the
  // adjustment is visible rather than just its result. Years without the
  // adjustment (or a team with no handicap at all) just get the one number.
  const renderHandicap = (team) => {
    if (team.team_handicap == null) return '';
    if (team.scratch_to_lowest && team.team_handicap_raw != null && team.team_handicap_raw !== team.team_handicap) {
      return (
        <>
          <span className="text-gray-400 dark:text-gray-500">{team.team_handicap_raw}</span>
          <span className="text-gray-400 dark:text-gray-500 mx-0.5">→</span>
          <span className="text-gray-900 dark:text-gray-100 font-semibold">{team.team_handicap}</span>
        </>
      );
    }
    return team.team_handicap;
  };

  const getScoreColor = (scoreToPar) => {
    if (scoreToPar == null) return 'text-gray-400 dark:text-gray-500';
    if (scoreToPar < 0) return 'text-red-600'; // Under par (red like Masters)
    if (scoreToPar === 0) return 'text-gray-900 dark:text-gray-100'; // Even par
    return 'text-gray-900 dark:text-gray-100'; // Over par
  };

  const formatPosition = (position, isTied) => {
    // No score yet — the team's still out on the course, not ranked.
    if (position == null) return 'TBD';
    return isTied ? `T${position}` : position;
  };

  const formatTeeClock = (teeTime) => {
    if (!teeTime) return null;
    return new Date(teeTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // What goes in the "Pos" column's place while showing pairings: a shotgun
  // start cares about the hole (the time is the same for everyone), a
  // standard round cares about the time (the hole is 1 for everyone).
  const teeTimeDisplay = (team) => {
    if (teeTimeInfo.format === 'shotgun') {
      return team.hole_number != null ? `Hole ${team.hole_number}` : null;
    }
    return formatTeeClock(team.tee_time);
  };

  const getPlaceEmoji = (position) => {
    if (position === 1) return '🏆';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return null;
  };

  const renderPlayers = (players, { size = 'sm' } = {}) => {
    if (!players?.length) return null;

    const textClass =
      size === 'xs'
        ? 'text-xs text-gray-700 dark:text-gray-300 font-serif leading-5'
        : 'text-sm text-gray-900 dark:text-gray-100 font-serif';

    // Two players per line with a dot between them. The row is a plain flex row —
    // NOT flex-wrap — so the pair can never break between the dot and the second
    // name, which is what used to strand a "•" at the start of a line. A pair too
    // wide for the column wraps inside each name instead, leaving the dot put.
    const pairs = [];
    for (let i = 0; i < players.length; i += 2) {
      pairs.push(players.slice(i, i + 2));
    }

    const renderPlayer = (player) => (
      <>
        {player.name}
        {player.handicap != null && (
          <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({player.handicap})</span>
        )}
      </>
    );

    return (
      <div className={`w-full space-y-1 text-left ${textClass}`}>
        {pairs.map((pair, pairIdx) => (
          <div key={pairIdx} className="flex items-baseline gap-x-2">
            <span>{renderPlayer(pair[0])}</span>
            {pair[1] && (
              <>
                <span className="text-gray-400 dark:text-gray-500" aria-hidden="true">•</span>
                <span>{renderPlayer(pair[1])}</span>
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-primary-50 dark:bg-night-900 min-h-screen">
      {/* Main Content */}
      <div className="pt-6 pb-12 sm:pt-10 sm:pb-24 lg:pb-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-primary-600 dark:text-primary-400 font-serif mb-3 sm:mb-4">
              Leaderboard
            </h1>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 font-serif">
              Official tournament standings
            </p>

            {/* Tournament Dates */}
            {tournamentDates && (
              <p className="mt-2 text-base text-gray-700 dark:text-gray-300 font-serif font-medium">
                {formatDateRange(tournamentDates.start, tournamentDates.end)}
              </p>
            )}

            {/* Shotgun Start Time — one shared time for the whole field */}
            {teeTimeInfo.show && teeTimeInfo.format === 'shotgun' && teeTimeInfo.shotgunTime && (
              <p className="mt-1 text-base text-primary-600 dark:text-primary-400 font-serif font-semibold">
                Shotgun Start: {formatTeeClock(teeTimeInfo.shotgunTime)}
              </p>
            )}

            {/* Year Selector */}
            {availableYears.length > 1 && (
              <div className="mt-6 flex justify-center">
                {/* Was a native <select>, whose option list the OS renders — it
                    ignored the site's styling entirely. */}
                <Select
                  value={String(tournamentYear ?? '')}
                  onChange={(e) => setTournamentYear(parseInt(e.target.value, 10))}
                  className="w-48"
                  triggerClassName="w-full justify-between rounded-lg border border-primary-200 dark:border-night-600 bg-white dark:bg-night-800 px-4 py-2 text-base font-serif text-gray-900 dark:text-gray-100 shadow-sm hover:border-primary-400"
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year} Tournament
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          {/* Leaderboard */}
          {loading ? (
            <div className="text-center">
              <p className="text-xl text-gray-600 dark:text-gray-400 font-serif">Loading leaderboard...</p>
            </div>
          ) : leaderboard.length > 0 ? (
            <div className="bg-white dark:bg-night-800 rounded-2xl shadow-lg overflow-hidden">
              {/* Desktop Table Header - hidden on mobile */}
              <div className="bg-primary-600 dark:bg-primary-800 text-white hidden md:block">
                <div className="grid grid-cols-12 gap-4 px-6 py-4 font-semibold text-xs uppercase tracking-wider">
                  <div className="col-span-1 text-center">
                    {teeTimeInfo.show ? (teeTimeInfo.format === 'shotgun' ? 'Hole' : 'Tee Time') : 'Pos'}
                  </div>
                  <div className="col-span-3 text-center">Team</div>
                  <div className={`${playersSpan} text-left`}>Players</div>
                  {usesHandicap && <div className="col-span-1 text-center">Hcp</div>}
                  <div className="col-span-1 text-center">{usesHandicap ? 'Gross' : 'Total'}</div>
                  {usesHandicap && <div className="col-span-1 text-center">Net</div>}
                  <div className={`${toParSpan} text-center`}>To Par</div>
                </div>
              </div>

              {/* Mobile Header */}
              <div className="bg-primary-600 dark:bg-primary-800 text-white md:hidden px-4 py-3">
                <p className="font-semibold text-sm uppercase tracking-wide text-center">Tournament Standings</p>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200 dark:divide-night-700">
                {leaderboard.map((team, index) => (
                    <div key={team.team_id}>
                      {/* Desktop Row */}
                      <div
                        className={`hidden md:grid grid-cols-12 gap-4 px-6 py-4 hover:bg-primary-50 dark:hover:bg-night-700 transition-colors ${
                          index === 0 && !teeTimeInfo.show ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                        }`}
                      >
                        {/* Position — or, before the round's been played, the tee time / starting hole */}
                        <div className="col-span-1 flex items-center justify-center gap-1">
                          {teeTimeInfo.show ? (
                            <span className="text-base font-bold text-gray-900 dark:text-gray-100 font-serif">
                              {teeTimeDisplay(team) || '—'}
                            </span>
                          ) : (
                            <>
                              {getPlaceEmoji(team.position) && (
                                <span className="text-xl leading-none">{getPlaceEmoji(team.position)}</span>
                              )}
                              <span className="text-lg font-bold text-gray-900 dark:text-gray-100 font-serif">
                                {formatPosition(team.position, team.is_tied)}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Team Name — centred in its column; the player list beside it
                            stays left-aligned so its lines keep a straight edge. */}
                        <div className="col-span-3 flex items-center justify-center">
                          <div className="text-sm font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wide text-center">
                            {team.team_name}
                          </div>
                        </div>

                        {/* Players */}
                        <div className={`${playersSpan} flex items-center`}>
                          {renderPlayers(team.players)}
                        </div>

                        {/* Team Handicap */}
                        {usesHandicap && (
                          <div className="col-span-1 flex items-center justify-center">
                            <span className="text-sm text-gray-500 dark:text-gray-400 font-serif">
                              {renderHandicap(team)}
                            </span>
                          </div>
                        )}

                        {/* Gross */}
                        <div className="col-span-1 flex items-center justify-center">
                          <span className="text-base text-gray-500 dark:text-gray-400 font-serif">
                            {team.total_score ?? ''}
                          </span>
                        </div>

                        {/* Net */}
                        {usesHandicap && (
                          <div className="col-span-1 flex items-center justify-center">
                            <span className="text-lg font-semibold text-gray-900 dark:text-gray-100 font-serif">
                              {team.net_score ?? ''}
                            </span>
                          </div>
                        )}

                        {/* To par — the number standings are ranked on, so it carries
                            the most weight. Status rides underneath when a team is
                            still out on the course. */}
                        <div className={`${toParSpan} flex flex-col items-center justify-center`}>
                          <span className={`text-2xl font-bold font-serif ${getScoreColor(standingsToPar(team))}`}>
                            {formatScore(standingsToPar(team))}
                          </span>
                          {team.status && team.status !== 'F' && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-serif">
                              thru {team.status}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mobile Card */}
                      <div
                        className={`md:hidden px-4 py-4 ${
                          index === 0 && !teeTimeInfo.show ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Fixed-width position column for alignment */}
                          <div className="w-14 flex-shrink-0 flex items-center justify-center gap-1 pt-0.5">
                            {teeTimeInfo.show ? (
                              <span className="text-sm font-bold text-gray-900 dark:text-gray-100 font-serif text-center">
                                {teeTimeDisplay(team) || '—'}
                              </span>
                            ) : (
                              <>
                                {getPlaceEmoji(team.position) && (
                                  <span className="text-lg">{getPlaceEmoji(team.position)}</span>
                                )}
                                <span className="text-lg font-bold text-gray-900 dark:text-gray-100 font-serif">
                                  {formatPosition(team.position, team.is_tied)}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Center: Team + Players */}
                          <div className="flex-1 min-w-0 text-left">
                            {team.team_name && (
                              <div className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wide">
                                {team.team_name}
                              </div>
                            )}
                            <div className="mt-1">{renderPlayers(team.players, { size: 'xs' })}</div>
                          </div>

                          {/* Right: Score */}
                          <div className="flex flex-col items-end flex-shrink-0 text-right">
                            <span className={`text-2xl font-bold font-serif ${getScoreColor(standingsToPar(team))}`}>
                              {formatScore(standingsToPar(team))}
                            </span>
                            {team.total_score != null && (
                              <span className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 font-serif">
                                {usesHandicap ? (
                                  <>
                                    {team.team_handicap != null && <>hcp {renderHandicap(team)} · </>}
                                    net {team.net_score ?? team.total_score} · gross {team.total_score}
                                  </>
                                ) : (
                                  team.total_score
                                )}
                              </span>
                            )}
                            {team.status && team.status !== 'F' && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-serif">
                                thru {team.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Footer Note */}
              <div className="bg-gray-50 dark:bg-night-900 px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center font-serif border-t border-gray-200 dark:border-night-700">
                <p>
                  {teeTimeInfo.show ? (
                    teeTimeInfo.format === 'shotgun'
                      ? `Shotgun start${teeTimeInfo.shotgunTime ? ` at ${formatTeeClock(teeTimeInfo.shotgunTime)}` : ''} • Starting holes are subject to change`
                      : 'Tee times are subject to change'
                  ) : (
                    <>
                      Scramble format • T = Tied
                      {usesHandicap && ' • Net = gross − team handicap • Standings are by net score'}
                    </>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-night-800 rounded-2xl shadow-lg p-6 sm:p-12 text-center">
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 font-serif">
                No leaderboard data available for {tournamentYear}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 font-serif">
                Scores will be posted during the tournament
              </p>
            </div>
          )}

          {/* Legend */}
          {leaderboard.length > 0 && (
            <div className="mt-6 sm:mt-8 bg-white dark:bg-night-800 rounded-xl shadow p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 font-serif">
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
