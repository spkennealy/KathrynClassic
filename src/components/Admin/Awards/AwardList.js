import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';

export default function AwardList() {
  const [awards, setAwards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [tournaments, setTournaments] = useState([]);

  useEffect(() => {
    fetchTournaments();
    fetchAwards();
  }, []);

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, year')
        .order('year', { ascending: false });

      if (error) throw error;
      setTournaments(data || []);
    } catch (err) {
      console.error('Error fetching tournaments:', err);
    }
  };

  const fetchAwards = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('tournament_awards')
        .select(`
          *,
          tournaments (
            year
          ),
          contacts (
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAwards(data || []);
    } catch (err) {
      console.error('Error fetching awards:', err);
      setError('Failed to load awards');
    } finally {
      setLoading(false);
    }
  };

  const getAwardCategories = () => {
    const categories = new Set(awards.map(a => a.award_category).filter(Boolean));
    return Array.from(categories).sort();
  };

  const filteredAwards = awards.filter(award => {
    const yearMatch = selectedYear === 'all' || award.tournaments?.year === parseInt(selectedYear);
    const categoryMatch = selectedCategory === 'all' || award.award_category === selectedCategory;
    return yearMatch && categoryMatch;
  });

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading awards...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Awards</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage tournament awards and winners
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="year-filter" className="text-sm font-medium text-gray-700">
              Year:
            </label>
            <select
              id="year-filter"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="all">All Years</option>
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.year}>
                  {tournament.year}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="category-filter" className="text-sm font-medium text-gray-700">
              Category:
            </label>
            <select
              id="category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="all">All Categories</option>
              {getAwardCategories().map((category) => (
                <option key={category} value={category}>
                  {category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center text-sm text-gray-600 ml-auto">
            Showing {filteredAwards.length} awards
          </div>
        </div>
      </div>

      {/* Awards Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                Winner
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Award Category
              </th>
              <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">
                Year
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Prize Amount
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredAwards.map((award) => {
              const winnerName = award.contacts
                ? `${award.contacts.first_name} ${award.contacts.last_name}`
                : award.winner_name;

              return (
                <tr key={award.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                    <div className="font-medium text-gray-900">{winnerName}</div>
                    {award.contacts?.email && (
                      <div className="text-gray-500 text-xs">{award.contacts.email}</div>
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                      {award.award_category?.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-center">
                    {award.tournaments?.year}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {award.prize_amount ? (
                      <span className="font-medium text-green-600">
                        ${award.prize_amount.toLocaleString()}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {award.notes || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredAwards.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              No awards found
              {(selectedYear !== 'all' || selectedCategory !== 'all') && ' with selected filters'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
