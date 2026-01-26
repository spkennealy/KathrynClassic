import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function TournamentHistory() {
  const [tournaments, setTournaments] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [tournamentDetails, setTournamentDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      fetchTournamentDetails(selectedYear);
    }
  }, [selectedYear]);

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('year', { ascending: false });

      if (error) throw error;

      setTournaments(data || []);
      if (data && data.length > 0) {
        setSelectedYear(data[0].year);
      }
    } catch (err) {
      console.error('Error fetching tournaments:', err);
      setError('Failed to load tournament history');
    } finally {
      setLoading(false);
    }
  };

  const fetchTournamentDetails = async (year) => {
    try {
      // Get tournament
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('year', year)
        .single();

      if (tournamentError) throw tournamentError;

      // Get awards
      const { data: awards, error: awardsError } = await supabase
        .from('tournament_awards')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('award_category');

      if (awardsError) throw awardsError;

      setTournamentDetails({
        ...tournament,
        awards: awards || []
      });
    } catch (err) {
      console.error('Error fetching tournament details:', err);
    }
  };

  if (loading) {
    return (
      <div className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center">
            <p className="text-lg text-gray-600">Loading tournament history...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center">
            <p className="text-lg text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (tournaments.length === 0) {
    return (
      <div className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Tournament History</h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Past tournament results will be displayed here after each year's event.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getAwardIcon = (category) => {
    switch (category) {
      case 'tournament_winner':
        return '🏆';
      case 'longest_drive':
        return '💪';
      case 'closest_to_pin':
        return '🎯';
      default:
        return '🏅';
    }
  };

  const getAwardTitle = (category) => {
    switch (category) {
      case 'tournament_winner':
        return 'Tournament Winner';
      case 'longest_drive':
        return 'Longest Drive';
      case 'closest_to_pin':
        return 'Closest to the Pin';
      default:
        return category.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
  };

  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Tournament History</h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Celebrating the success of past Kathryn Classic tournaments and the impact we've made together.
          </p>
        </div>

        {/* Year selector */}
        <div className="flex justify-center gap-4 mb-12 flex-wrap">
          {tournaments.map((tournament) => (
            <button
              key={tournament.year}
              onClick={() => setSelectedYear(tournament.year)}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                selectedYear === tournament.year
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tournament.year}
            </button>
          ))}
        </div>

        {tournamentDetails && (
          <div className="mx-auto max-w-4xl">
            {/* Tournament Summary */}
            <div className="rounded-lg bg-gradient-to-br from-primary-50 to-primary-100 p-8 mb-8 shadow-lg ring-1 ring-primary-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                {tournamentDetails.year} Tournament Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary-600">
                    {formatCurrency(tournamentDetails.total_raised)}
                  </div>
                  <div className="text-sm font-medium text-gray-700 mt-2">Raised for CJD Foundation</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary-600">
                    {tournamentDetails.total_attendees}
                  </div>
                  <div className="text-sm font-medium text-gray-700 mt-2">Total Attendees</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900 mt-3">
                    {formatDate(tournamentDetails.start_date)}
                  </div>
                  {tournamentDetails.start_date !== tournamentDetails.end_date && (
                    <div className="text-sm text-gray-600">
                      to {formatDate(tournamentDetails.end_date)}
                    </div>
                  )}
                  <div className="text-sm font-medium text-gray-700 mt-1">Tournament Dates</div>
                </div>
              </div>
              {tournamentDetails.notes && (
                <div className="mt-6 p-4 bg-white rounded-lg">
                  <p className="text-gray-700 text-center italic">{tournamentDetails.notes}</p>
                </div>
              )}
            </div>

            {/* Tournament Awards */}
            {tournamentDetails.awards && tournamentDetails.awards.length > 0 && (
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Tournament Awards</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {tournamentDetails.awards.map((award, index) => (
                    <div key={index} className="rounded-lg bg-gray-50 p-6 shadow-sm ring-1 ring-gray-200">
                      <div className="flex items-start gap-4">
                        <div className="text-4xl">{getAwardIcon(award.award_category)}</div>
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900">
                            {getAwardTitle(award.award_category)}
                          </h4>
                          <p className="text-xl font-bold text-primary-600 mt-2">
                            {award.winner_name}
                          </p>
                          {award.details && (
                            <p className="text-sm text-gray-600 mt-1">{award.details}</p>
                          )}
                          {award.distance && (
                            <p className="text-sm font-medium text-gray-700 mt-1">
                              Distance: {award.distance}
                            </p>
                          )}
                          {award.hole_number && (
                            <p className="text-sm text-gray-600 mt-1">
                              Hole #{award.hole_number}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tournamentDetails.awards && tournamentDetails.awards.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600">Award details for this tournament will be added soon.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
