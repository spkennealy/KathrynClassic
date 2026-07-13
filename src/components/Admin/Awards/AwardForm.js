import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { logAudit, diffFields } from '../../../utils/audit';
import DatePicker from '../DatePicker';
import Select from '../Select';

const AWARD_FIELDS = ['award_category', 'contact_id', 'winner_name', 'award_date', 'event_id', 'prize', 'details', 'photo_url'];

const AWARD_CATEGORIES = [
  { value: 'tournament_winner', label: 'Tournament Winner' },
  { value: 'second_place', label: '2nd Place' },
  { value: 'third_place', label: '3rd Place' },
  { value: 'longest_drive', label: 'Longest Drive' },
  { value: 'closest_to_pin', label: 'Closest to the Pin' },
  { value: 'longest_putt', label: 'Longest Putt' },
  { value: 'most_honest', label: 'Most Honest (Highest Score)' },
  { value: 'hole_in_one', label: 'Hole in One' },
  { value: 'other', label: 'Other' },
];

const PRESET_VALUES = AWARD_CATEGORIES.map((c) => c.value);

// Stored categories are lower_snake_case; show them title-cased in the custom input.
const deslug = (value) =>
  value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

export default function AwardForm({ award, onClose, onSave }) {
  const [formData, setFormData] = useState({
    tournament_id: '',
    award_category: 'tournament_winner',
    custom_category: '',
    contact_id: '',
    award_date: '',
    event_id: '',
    prize: '',
    details: '',
    photo_url: '',
  });
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [tournaments, setTournaments] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState(null);

  useEffect(() => {
    fetchTournaments();
    fetchContacts();
    fetchEvents();

    if (award) {
      const isPreset = PRESET_VALUES.includes(award.award_category);
      setFormData({
        tournament_id: award.tournament_id || '',
        award_category: isPreset ? award.award_category : 'other',
        custom_category: isPreset ? '' : deslug(award.award_category || ''),
        contact_id: award.contact_id || '',
        award_date: award.award_date || '',
        event_id: award.event_id || '',
        prize: award.prize || '',
        details: award.details || '',
        photo_url: award.photo_url || '',
      });
      if (award.contacts) {
        setContactSearchTerm(`${award.contacts.first_name} ${award.contacts.last_name}`);
      } else if (award.winner_name) {
        setContactSearchTerm(award.winner_name);
      }
    }
  }, [award]);

  const fetchTournaments = async () => {
    const { data, error } = await supabase
      .from('tournaments')
      .select('id, year')
      .order('year', { ascending: false });
    if (!error) setTournaments(data || []);
  };

  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email')
      .order('last_name', { ascending: true });
    if (!error) setContacts(data || []);
  };

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('tournament_events')
      .select('id, event_name, tournament_id')
      .order('event_date', { ascending: true });
    if (!error) setEvents(data || []);
  };

  const filteredContacts = contacts
    .filter((c) => {
      const term = contactSearchTerm.toLowerCase();
      return (
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(term) ||
        (c.email || '').toLowerCase().includes(term)
      );
    })
    .slice(0, 50);

  // Only events from the selected tournament can be related to the award.
  const eventsForTournament = events.filter(
    (e) => String(e.tournament_id) === String(formData.tournament_id)
  );

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPhotoUploading(true);
    setPhotoError(null);

    try {
      const ext = file.name.split('.').pop();
      const fileName = `award-${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from('event-photos')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('event-photos')
        .getPublicUrl(data.path);

      setFormData((prev) => ({ ...prev, photo_url: publicUrl }));
    } catch (err) {
      console.error('Error uploading photo:', err);
      setPhotoError('Failed to upload photo. Make sure the "event-photos" storage bucket exists in Supabase.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const category =
      formData.award_category === 'other'
        ? formData.custom_category.trim().toLowerCase().replace(/\s+/g, '_')
        : formData.award_category;

    if (!formData.tournament_id) {
      setError('Please select a tournament year.');
      return;
    }
    if (!category) {
      setError('Please choose or enter what the award is for.');
      return;
    }
    if (!formData.contact_id && !contactSearchTerm.trim()) {
      setError('Please select a contact or enter the winner\'s name.');
      return;
    }

    setLoading(true);

    try {
      const awardData = {
        tournament_id: formData.tournament_id,
        award_category: category,
        // winner_name is NOT NULL, so always store the displayed name; contact_id
        // additionally links to a contact record when one was picked.
        contact_id: formData.contact_id || null,
        winner_name: contactSearchTerm.trim(),
        award_date: formData.award_date || null,
        event_id: formData.event_id || null,
        prize: formData.prize.trim() || null,
        details: formData.details || null,
        photo_url: formData.photo_url || null,
      };

      if (award) {
        const { error } = await supabase
          .from('tournament_awards')
          .update(awardData)
          .eq('id', award.id);
        if (error) throw error;

        const changes = diffFields(award, awardData, AWARD_FIELDS);
        if (changes) {
          await logAudit({
            action: 'award.updated',
            entityType: 'award',
            entityId: award.id,
            entityLabel: `${awardData.award_category} — ${awardData.winner_name}`,
            changes,
          });
        }
      } else {
        const { data: inserted, error } = await supabase
          .from('tournament_awards')
          .insert([awardData])
          .select('id')
          .single();
        if (error) throw error;

        await logAudit({
          action: 'award.created',
          entityType: 'award',
          entityId: inserted?.id,
          entityLabel: `${awardData.award_category} — ${awardData.winner_name}`,
          changes: awardData,
        });
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving award:', err);
      setError(err.message || 'Failed to save award');
    } finally {
      setLoading(false);
    }
  };

  // Inputs get their visual styling from the global `.admin-content` rules; the
  // Select wrapper just needs layout classes.
  const inputClass = 'mt-1 block w-full';

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-night-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-night-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {award ? 'Edit Award' : 'Add Award'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tournament_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Year <span className="text-red-500">*</span>
                </label>
                <Select
                  id="tournament_id"
                  required
                  value={formData.tournament_id}
                  onChange={(e) => setFormData({ ...formData, tournament_id: e.target.value, event_id: '' })}
                  className={inputClass}
                >
                  <option value="">Select a year</option>
                  {tournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.year}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label htmlFor="award_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Date
                </label>
                <DatePicker
                  id="award_date"
                  value={formData.award_date}
                  onChange={(e) => setFormData({ ...formData, award_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label htmlFor="award_category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                What is the award for? <span className="text-red-500">*</span>
              </label>
              <Select
                id="award_category"
                value={formData.award_category}
                onChange={(e) => setFormData({ ...formData, award_category: e.target.value })}
                className={inputClass}
              >
                {AWARD_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
              {formData.award_category === 'other' && (
                <input
                  type="text"
                  value={formData.custom_category}
                  onChange={(e) => setFormData({ ...formData, custom_category: e.target.value })}
                  placeholder="e.g., Best Dressed"
                  className={inputClass}
                />
              )}
            </div>

            <div>
              <label htmlFor="winner" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Winner <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="winner"
                  value={contactSearchTerm}
                  onChange={(e) => {
                    setContactSearchTerm(e.target.value);
                    setShowContactDropdown(true);
                    setFormData((prev) => ({ ...prev, contact_id: '' }));
                  }}
                  onFocus={() => setShowContactDropdown(true)}
                  onBlur={() => setTimeout(() => setShowContactDropdown(false), 200)}
                  placeholder="Search contacts by name or email..."
                  className={inputClass}
                  autoComplete="off"
                />
                {showContactDropdown && contactSearchTerm && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-night-800 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                    {filteredContacts.length > 0 ? (
                      filteredContacts.map((contact) => (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, contact_id: contact.id }));
                            setContactSearchTerm(`${contact.first_name} ${contact.last_name}`);
                            setShowContactDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-night-700 focus:outline-none"
                        >
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {contact.first_name} {contact.last_name}
                          </div>
                          {contact.email && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">{contact.email}</div>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                        No contacts found — this name will be saved as-is.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {formData.contact_id
                  ? 'Linked to an existing contact.'
                  : 'Pick a contact from the list, or just type a name to record it without linking.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="event_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Related Event (optional)
                </label>
                <Select
                  id="event_id"
                  value={formData.event_id}
                  onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
                  disabled={!formData.tournament_id}
                  className={inputClass}
                >
                  <option value="">None</option>
                  {eventsForTournament.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.event_name}
                    </option>
                  ))}
                </Select>
                {!formData.tournament_id && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Select a year first.</p>
                )}
              </div>

              <div>
                <label htmlFor="prize" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Prize (optional)
                </label>
                <input
                  type="text"
                  id="prize"
                  value={formData.prize}
                  onChange={(e) => setFormData({ ...formData, prize: e.target.value })}
                  placeholder="e.g., $100 gift card, trophy, golf balls"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="details" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                id="details"
                rows={3}
                value={formData.details}
                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                placeholder="Describe the award and why it was given"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Photo (optional)</label>
              <div className="mt-1 flex items-start gap-4">
                {formData.photo_url && (
                  <div className="relative flex-shrink-0">
                    <img
                      src={formData.photo_url}
                      alt="Award"
                      className="w-24 h-24 rounded-lg object-cover border border-gray-200 dark:border-night-700"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, photo_url: '' }))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 border border-gray-300 dark:border-night-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-night-700">
                    <span>{photoUploading ? 'Uploading...' : 'Upload Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={photoUploading}
                      className="hidden"
                    />
                  </label>
                  {photoError && <p className="text-xs text-red-600">{photoError}</p>}
                  {!formData.photo_url && !photoError && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">JPG, PNG, or WebP recommended</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 border border-gray-300 dark:border-night-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-night-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? 'Saving...' : award ? 'Update Award' : 'Create Award'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
