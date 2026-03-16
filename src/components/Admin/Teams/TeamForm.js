import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';

export default function TeamForm({ team, onClose, onSave }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isCreateMode = !team;

  useEffect(() => {
    if (team) {
      setName(team.team_name || '');
    }
  }, [team]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!name.trim()) {
        setError('Team name is required');
        setLoading(false);
        return;
      }

      if (isCreateMode) {
        const { error: insertError } = await supabase
          .from('teams')
          .insert({ name: name.trim() });

        if (insertError) throw insertError;
      } else {
        const { error: updateError } = await supabase
          .from('teams')
          .update({ name: name.trim() })
          .eq('id', team.team_id);

        if (updateError) throw updateError;
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving team:', err);
      setError(err.message || 'Failed to save team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isCreateMode ? 'New Team' : 'Edit Team'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Use Leaderboard Management to add a team to a tournament and enter scores.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Team Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              placeholder="e.g., The Eagles, Dream Team"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? 'Saving...' : (isCreateMode ? 'Create Team' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
