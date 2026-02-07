import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import ConfirmDialog from '../ConfirmDialog';

export default function RecycleBin() {
  const [deletedRecords, setDeletedRecords] = useState({
    registrations: [],
    contacts: [],
    tournaments: [],
    events: [],
    teams: [],
    awards: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState('registrations');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);
  const [recordToRestore, setRecordToRestore] = useState(null);
  const [recordToDelete, setRecordToDelete] = useState(null);

  useEffect(() => {
    fetchDeletedRecords();
  }, []);

  const fetchDeletedRecords = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch deleted registrations
      const { data: regs, error: regsError } = await supabase
        .from('registrations')
        .select(`
          id,
          created_at,
          deleted_at,
          payment_status,
          golf_handicap,
          contacts(first_name, last_name, email),
          tournaments(year)
        `)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (regsError) {
        console.error('Error fetching deleted registrations:', regsError);
        throw new Error(`Registrations: ${regsError.message}`);
      }

      // Fetch deleted contacts
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (contactsError) {
        console.error('Error fetching deleted contacts:', contactsError);
        throw new Error(`Contacts: ${contactsError.message}`);
      }

      // Fetch deleted tournaments
      const { data: tournaments, error: tournamentsError } = await supabase
        .from('tournaments')
        .select('id, year, start_date, end_date, location, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (tournamentsError) {
        console.error('Error fetching deleted tournaments:', tournamentsError);
        throw new Error(`Tournaments: ${tournamentsError.message}`);
      }

      // Fetch deleted events
      const { data: events, error: eventsError } = await supabase
        .from('tournament_events')
        .select('id, event_name, event_type, event_date, deleted_at, tournaments(year)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (eventsError) {
        console.error('Error fetching deleted events:', eventsError);
        throw new Error(`Events: ${eventsError.message}`);
      }

      // Fetch deleted teams
      const { data: teams, error: teamsError } = await supabase
        .from('golf_teams')
        .select('id, team_name, total_score, deleted_at, tournaments(year)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (teamsError) {
        console.error('Error fetching deleted teams:', teamsError);
        throw new Error(`Teams: ${teamsError.message}`);
      }

      // Fetch deleted awards
      const { data: awards, error: awardsError } = await supabase
        .from('tournament_awards')
        .select('id, award_category, award_name, deleted_at, tournaments(year)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (awardsError) {
        console.error('Error fetching deleted awards:', awardsError);
        throw new Error(`Awards: ${awardsError.message}`);
      }

      setDeletedRecords({
        registrations: regs || [],
        contacts: contacts || [],
        tournaments: tournaments || [],
        events: events || [],
        teams: teams || [],
        awards: awards || [],
      });
    } catch (err) {
      console.error('Error fetching deleted records:', err);
      setError(`Failed to load deleted records: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreClick = (record, type) => {
    setRecordToRestore({ ...record, type });
    setShowRestoreConfirm(true);
  };

  const handleRestoreConfirm = async () => {
    try {
      setError(null);

      const tableName = recordToRestore.type === 'events' ? 'tournament_events' : recordToRestore.type;

      // Restore by setting deleted_at to NULL
      const { error: restoreError } = await supabase
        .from(tableName)
        .update({ deleted_at: null })
        .eq('id', recordToRestore.id);

      if (restoreError) throw restoreError;

      // Close dialog and refresh
      setShowRestoreConfirm(false);
      setRecordToRestore(null);
      await fetchDeletedRecords();
    } catch (err) {
      console.error('Error restoring record:', err);
      setError(err.message || 'Failed to restore record');
      setShowRestoreConfirm(false);
      setRecordToRestore(null);
    }
  };

  const handlePermanentDeleteClick = (record, type) => {
    setRecordToDelete({ ...record, type });
    setShowPermanentDeleteConfirm(true);
  };

  const handlePermanentDeleteConfirm = async () => {
    try {
      setError(null);

      const tableName = recordToDelete.type === 'events' ? 'tournament_events' : recordToDelete.type;

      // Permanently delete the record
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', recordToDelete.id);

      if (deleteError) throw deleteError;

      // Close dialog and refresh
      setShowPermanentDeleteConfirm(false);
      setRecordToDelete(null);
      await fetchDeletedRecords();
    } catch (err) {
      console.error('Error permanently deleting record:', err);
      setError(err.message || 'Failed to permanently delete record');
      setShowPermanentDeleteConfirm(false);
      setRecordToDelete(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const tabs = [
    { id: 'registrations', name: 'Registrations', count: deletedRecords.registrations.length },
    { id: 'contacts', name: 'Contacts', count: deletedRecords.contacts.length },
    { id: 'tournaments', name: 'Tournaments', count: deletedRecords.tournaments.length },
    { id: 'events', name: 'Events', count: deletedRecords.events.length },
    { id: 'teams', name: 'Teams', count: deletedRecords.teams.length },
    { id: 'awards', name: 'Awards', count: deletedRecords.awards.length },
  ];

  const renderRecordsList = () => {
    const records = deletedRecords[selectedTab];

    if (records.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500">No deleted {selectedTab} found</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                {selectedTab === 'registrations' && 'Name / Email'}
                {selectedTab === 'contacts' && 'Name / Email'}
                {selectedTab === 'tournaments' && 'Year'}
                {selectedTab === 'events' && 'Event Name'}
                {selectedTab === 'teams' && 'Team Name'}
                {selectedTab === 'awards' && 'Award'}
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Details
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Deleted
              </th>
              <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {selectedTab === 'registrations' && records.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                  <div className="font-medium text-gray-900">
                    {record.contacts?.first_name} {record.contacts?.last_name}
                  </div>
                  <div className="text-gray-500">{record.contacts?.email}</div>
                </td>
                <td className="px-3 py-4 text-sm text-gray-500">
                  {record.tournaments?.year} Tournament • {record.payment_status}
                  {record.golf_handicap && ` • Handicap: ${record.golf_handicap}`}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {formatDate(record.deleted_at)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-right space-x-3">
                  <button
                    onClick={() => handleRestoreClick(record, 'registrations')}
                    className="text-primary-600 hover:text-primary-900 font-medium"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDeleteClick(record, 'registrations')}
                    className="text-red-600 hover:text-red-900 font-medium"
                  >
                    Delete Forever
                  </button>
                </td>
              </tr>
            ))}

            {selectedTab === 'contacts' && records.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                  <div className="font-medium text-gray-900">
                    {record.first_name} {record.last_name}
                  </div>
                  <div className="text-gray-500">{record.email}</div>
                </td>
                <td className="px-3 py-4 text-sm text-gray-500">
                  {record.phone || 'No phone'}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {formatDate(record.deleted_at)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-right space-x-3">
                  <button
                    onClick={() => handleRestoreClick(record, 'contacts')}
                    className="text-primary-600 hover:text-primary-900 font-medium"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDeleteClick(record, 'contacts')}
                    className="text-red-600 hover:text-red-900 font-medium"
                  >
                    Delete Forever
                  </button>
                </td>
              </tr>
            ))}

            {selectedTab === 'tournaments' && records.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                  {record.year}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500">
                  {new Date(record.start_date).toLocaleDateString()} - {new Date(record.end_date).toLocaleDateString()}
                  {record.location && ` • ${record.location}`}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {formatDate(record.deleted_at)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-right space-x-3">
                  <button
                    onClick={() => handleRestoreClick(record, 'tournaments')}
                    className="text-primary-600 hover:text-primary-900 font-medium"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDeleteClick(record, 'tournaments')}
                    className="text-red-600 hover:text-red-900 font-medium"
                  >
                    Delete Forever
                  </button>
                </td>
              </tr>
            ))}

            {selectedTab === 'events' && records.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="py-4 pl-4 pr-3 text-sm">
                  <div className="font-medium text-gray-900">{record.event_name}</div>
                  <div className="text-gray-500">{record.event_type}</div>
                </td>
                <td className="px-3 py-4 text-sm text-gray-500">
                  {record.tournaments?.year} • {new Date(record.event_date).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {formatDate(record.deleted_at)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-right space-x-3">
                  <button
                    onClick={() => handleRestoreClick(record, 'events')}
                    className="text-primary-600 hover:text-primary-900 font-medium"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDeleteClick(record, 'events')}
                    className="text-red-600 hover:text-red-900 font-medium"
                  >
                    Delete Forever
                  </button>
                </td>
              </tr>
            ))}

            {selectedTab === 'teams' && records.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                  {record.team_name}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500">
                  {record.tournaments?.year} • Score: {record.total_score}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {formatDate(record.deleted_at)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-right space-x-3">
                  <button
                    onClick={() => handleRestoreClick(record, 'teams')}
                    className="text-primary-600 hover:text-primary-900 font-medium"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDeleteClick(record, 'teams')}
                    className="text-red-600 hover:text-red-900 font-medium"
                  >
                    Delete Forever
                  </button>
                </td>
              </tr>
            ))}

            {selectedTab === 'awards' && records.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="py-4 pl-4 pr-3 text-sm">
                  <div className="font-medium text-gray-900">{record.award_name}</div>
                  <div className="text-gray-500">{record.award_category}</div>
                </td>
                <td className="px-3 py-4 text-sm text-gray-500">
                  {record.tournaments?.year}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {formatDate(record.deleted_at)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-right space-x-3">
                  <button
                    onClick={() => handleRestoreClick(record, 'awards')}
                    className="text-primary-600 hover:text-primary-900 font-medium"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDeleteClick(record, 'awards')}
                    className="text-red-600 hover:text-red-900 font-medium"
                  >
                    Delete Forever
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading recycle bin...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recycle Bin</h1>
          <p className="mt-2 text-sm text-gray-600">
            Recover or permanently delete soft-deleted records
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`
                whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium
                ${selectedTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }
              `}
            >
              {tab.name}
              {tab.count > 0 && (
                <span className={`ml-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  selectedTab === tab.id ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-900'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Records List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {renderRecordsList()}
      </div>

      {/* Restore Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRestoreConfirm}
        onClose={() => {
          setShowRestoreConfirm(false);
          setRecordToRestore(null);
        }}
        onConfirm={handleRestoreConfirm}
        title="Restore Record"
        message="Are you sure you want to restore this record? It will be visible again in the admin portal and public site."
        confirmText="Restore"
        cancelText="Cancel"
        confirmButtonClass="bg-primary-600 hover:bg-primary-700"
      />

      {/* Permanent Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showPermanentDeleteConfirm}
        onClose={() => {
          setShowPermanentDeleteConfirm(false);
          setRecordToDelete(null);
        }}
        onConfirm={handlePermanentDeleteConfirm}
        title="Permanently Delete Record"
        message="Are you sure you want to permanently delete this record? This action CANNOT be undone!"
        confirmText="Delete Forever"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
}
