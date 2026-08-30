import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { logAudit } from '../../../utils/audit';
import TeamForm from './TeamForm';
import ConfirmDialog from '../ConfirmDialog';

export default function TeamList() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamToDelete, setTeamToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);

      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          golf_teams (
            id,
            team_number,
            total_score,
            score_to_par,
            position,
            deleted_at,
            tournaments ( year, teams_published_at ),
            golf_team_players ( player_name, handicap, player_order )
          )
        `)
        .order('name');

      if (teamsError) throw teamsError;

      const transformedTeams = (teamsData || []).map(team => {
        // Soft-deleted participations are filtered here rather than in the query:
        // they're hidden from the card, but they still hold a foreign key to the
        // team, so the delete rules below have to account for them.
        const allParticipations = (team.golf_teams || []).sort(
          (a, b) => (b.tournaments?.year || 0) - (a.tournaments?.year || 0)
        );
        const participations = allParticipations.filter(p => !p.deleted_at);
        const mostRecent = participations[0];
        // A team that has played a published year is tournament history and can't
        // be deleted. One that exists only in draft years (or not at all) is still
        // scratch work, so it can go along with those draft participations —
        // including any sitting in the recycle bin, which would otherwise block
        // the delete with a foreign key error.
        const publishedYears = allParticipations
          .filter(p => p.tournaments?.teams_published_at)
          .map(p => p.tournaments.year)
          .filter(Boolean);
        const draftParticipations = allParticipations.filter(p => !p.tournaments?.teams_published_at);
        return {
          team_id: team.id,
          team_name: team.name,
          tournament_years: participations.map(p => p.tournaments?.year).filter(Boolean),
          published_years: [...new Set(publishedYears)],
          draft_years: draftParticipations
            .filter(p => !p.deleted_at)
            .map(p => p.tournaments?.year)
            .filter(Boolean),
          draft_participation_ids: draftParticipations.map(p => p.id),
          has_published: publishedYears.length > 0,
          member_count: mostRecent?.golf_team_players?.length || 0,
          members: mostRecent?.golf_team_players
            ?.sort((a, b) => a.player_order - b.player_order)
            .map(p => ({
              player_name: p.player_name,
              handicap: p.handicap,
              position: p.player_order,
            })) || [],
        };
      });

      setTeams(transformedTeams);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setSelectedTeam(null);
    setShowForm(true);
  };

  const handleEdit = (team) => {
    setSelectedTeam(team);
    setShowForm(true);
  };

  // golf_teams.team_id is ON DELETE RESTRICT, so a team can only be removed once
  // it has no participations left. Draft ones are scratch work and go with it;
  // a team that has played a published year keeps its history and isn't deletable
  // at all (the button is hidden — unpublish that year first).
  const handleDelete = async () => {
    if (!teamToDelete || teamToDelete.has_published) return;
    setDeleting(true);
    setError(null);
    try {
      if (teamToDelete.draft_participation_ids.length > 0) {
        const { error: partErr } = await supabase
          .from('golf_teams')
          .delete()
          .in('id', teamToDelete.draft_participation_ids);
        if (partErr) throw partErr;
      }

      const { error: teamErr } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamToDelete.team_id);
      if (teamErr) throw teamErr;

      await logAudit({
        action: 'team.deleted',
        entityType: 'team',
        entityId: teamToDelete.team_id,
        entityLabel: teamToDelete.team_name,
        changes: { name: teamToDelete.team_name },
        metadata: {
          permanent: true,
          draft_years_removed: teamToDelete.draft_years,
        },
      });

      setTeamToDelete(null);
      fetchTeams();
    } catch (err) {
      console.error('Error deleting team:', err);
      setError('Failed to delete team: ' + err.message);
      setTeamToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    setShowForm(false);
    setSelectedTeam(null);
  };

  const handleSave = () => {
    fetchTeams();
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading teams...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Teams</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage golf teams and their members
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Team
        </button>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <div key={team.team_id} className="bg-white dark:bg-night-800 overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{team.team_name}</h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {team.member_count} {team.member_count === 1 ? 'player' : 'players'}
                </span>
              </div>

              {team.tournament_years && team.tournament_years.length > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Tournaments:{' '}
                  {team.tournament_years
                    .map(year => (team.draft_years.includes(year) ? `${year} (draft)` : year))
                    .join(', ')}
                </p>
              )}

              {/* Team Members */}
              <div className="space-y-2 mb-4">
                {team.members && team.members.length > 0 ? (
                  team.members.map((member, index) => (
                    <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">{member.position}.</span> {member.player_name}
                      {member.handicap && <span className="text-gray-400 ml-2">({member.handicap})</span>}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">No members assigned</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(team)}
                  className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 dark:border-night-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 hover:bg-gray-50 dark:bg-night-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Edit
                </button>
                {team.has_published ? (
                  <span
                    className="inline-flex items-center px-3 py-2 text-sm text-gray-400"
                    title={`Played in published tournaments (${team.published_years.join(', ')}). Unpublish that year in Team Builder to remove the team.`}
                  >
                    Published
                  </span>
                ) : (
                  <button
                    onClick={() => setTeamToDelete(team)}
                    disabled={deleting}
                    className="inline-flex justify-center items-center px-3 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white dark:bg-night-800 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {teams.length === 0 && !loading && (
        <div className="text-center py-12 bg-white dark:bg-night-800 rounded-lg shadow">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No teams</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating a new team.</p>
          <div className="mt-6">
            <button
              onClick={handleAdd}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Team
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(teamToDelete)}
        onClose={() => setTeamToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Team"
        message={
          teamToDelete
            ? `Permanently delete "${teamToDelete.team_name}"?${
                teamToDelete.draft_years.length > 0
                  ? ` Its draft ${teamToDelete.draft_years.length === 1 ? 'entry' : 'entries'} for ${teamToDelete.draft_years.join(', ')} will be removed too, and those players go back to the unassigned pool in Team Builder.`
                  : ''
              } This can't be undone.`
            : ''
        }
        confirmText={deleting ? 'Deleting…' : 'Delete'}
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />

      {/* Team Form Modal */}
      {showForm && (
        <TeamForm
          team={selectedTeam}
          onClose={handleClose}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
