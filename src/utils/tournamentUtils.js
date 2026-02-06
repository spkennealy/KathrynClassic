import { supabase } from '../supabaseClient';

/**
 * Determines which tournament year to display based on current date
 * Logic:
 * - If current year tournament exists and hasn't passed, show current year
 * - If current year tournament has passed or doesn't exist, show next year
 * - If next year doesn't exist, fall back to most recent past tournament
 */
export const getCurrentTournamentYear = async () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();

  try {
    // Check if current year tournament exists
    const { data: currentYearTournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('year', currentYear)
      .single();

    // If current year tournament exists and hasn't ended yet, use it
    if (currentYearTournament && new Date(currentYearTournament.end_date) >= currentDate) {
      return currentYear;
    }

    // Check for next year's tournament
    const { data: nextYearTournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('year', currentYear + 1)
      .single();

    if (nextYearTournament) {
      return currentYear + 1;
    }

    // Fall back to most recent tournament
    const { data: mostRecentTournament } = await supabase
      .from('tournaments')
      .select('*')
      .order('year', { ascending: false })
      .limit(1)
      .single();

    return mostRecentTournament ? mostRecentTournament.year : currentYear;
  } catch (error) {
    console.error('Error determining tournament year:', error);
    return currentYear;
  }
};

/**
 * Fetches tournament data for a specific year
 */
export const getTournamentData = async (year) => {
  try {
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('year', year)
      .single();

    if (tournamentError) throw tournamentError;

    return tournament;
  } catch (error) {
    console.error('Error fetching tournament data:', error);
    return null;
  }
};

/**
 * Fetches events for a specific tournament year
 */
export const getTournamentEvents = async (year) => {
  try {
    // Get tournament first
    const tournament = await getTournamentData(year);
    if (!tournament) return [];

    // Get events for this tournament
    const { data: events, error: eventsError } = await supabase
      .from('tournament_events')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('event_date', { ascending: true });

    if (eventsError) throw eventsError;

    return events || [];
  } catch (error) {
    console.error('Error fetching tournament events:', error);
    return [];
  }
};

/**
 * Format date for display
 */
export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Format time for display
 */
export const formatTime = (timeString) => {
  if (!timeString) return '';

  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minutes} ${ampm}`;
};

/**
 * Format date range
 */
export const formatDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const options = { month: 'long', day: 'numeric', year: 'numeric' };

  if (start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString('en-US', options);
  }

  return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { day: 'numeric' })}, ${end.getFullYear()}`;
};

/**
 * Determines which year's leaderboard to display
 * Logic: Show previous year's leaderboard until the day before the current tournament starts
 */
export const getLeaderboardYear = async () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();

  try {
    // Check if current year tournament exists
    const { data: currentYearTournament } = await supabase
      .from('tournaments')
      .select('id, year, start_date')
      .eq('year', currentYear)
      .single();

    if (currentYearTournament && currentYearTournament.start_date) {
      // Get the day before the tournament starts
      const tournamentStart = new Date(currentYearTournament.start_date);
      const dayBeforeTournament = new Date(tournamentStart);
      dayBeforeTournament.setDate(dayBeforeTournament.getDate() - 1);

      // If today is before the day before the tournament, show previous year
      if (currentDate < dayBeforeTournament) {
        // Get previous year's tournament
        const { data: previousYearTournament } = await supabase
          .from('tournaments')
          .select('year')
          .eq('year', currentYear - 1)
          .single();

        if (previousYearTournament) {
          return currentYear - 1;
        }
      }

      // Otherwise show current year
      return currentYear;
    }

    // If no current year tournament, fall back to most recent tournament
    const { data: mostRecentTournament } = await supabase
      .from('tournaments')
      .select('year')
      .order('year', { ascending: false })
      .limit(1)
      .single();

    return mostRecentTournament ? mostRecentTournament.year : currentYear;
  } catch (error) {
    console.error('Error determining leaderboard year:', error);

    // Fall back to most recent tournament
    try {
      const { data: mostRecentTournament } = await supabase
        .from('tournaments')
        .select('year')
        .order('year', { ascending: false })
        .limit(1)
        .single();

      return mostRecentTournament ? mostRecentTournament.year : currentYear;
    } catch (fallbackError) {
      return currentYear;
    }
  }
};
