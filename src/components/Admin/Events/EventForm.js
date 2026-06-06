import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';

export default function EventForm({ event, onClose, onSave }) {
  const [formData, setFormData] = useState({
    tournament_id: '',
    event_name: '',
    event_type: '',
    event_date: '',
    start_time: '',
    location: '',
    map_link: '',
    host: '',
    adult_price: '',
    child_price: '',
    description: '',
    price_tbd: false,
    adult_price_min: '',
    adult_price_max: '',
    child_price_min: '',
    child_price_max: '',
    photo_url: '',
  });
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [existingPhotos, setExistingPhotos] = useState([]);

  useEffect(() => {
    fetchTournaments();
    if (event) {
      setFormData({
        tournament_id: event.tournament_id || '',
        event_name: event.event_name || '',
        event_type: event.event_type || '',
        event_date: event.event_date || '',
        start_time: event.start_time || '',
        location: event.location || '',
        map_link: event.map_link || '',
        host: event.host || '',
        adult_price: event.adult_price || '',
        child_price: event.child_price || '',
        description: event.description || '',
        price_tbd: event.price_tbd || false,
        adult_price_min: event.adult_price_min || '',
        adult_price_max: event.adult_price_max || '',
        child_price_min: event.child_price_min || '',
        child_price_max: event.child_price_max || '',
        photo_url: event.photo_url || '',
      });
    }
  }, [event]);

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

  const LOCAL_PHOTOS = [
    { url: '/shedule_photos/pml_golf_course.jpg', label: 'PML Golf Course' },
    { url: '/shedule_photos/pml_lodge.jpg', label: 'PML Lodge' },
  ];

  const loadExistingPhotos = async () => {
    setShowPhotoPicker(true);
    if (existingPhotos.length > 0) return;

    try {
      const { data, error } = await supabase.storage.from('event-photos').list();
      const uploaded = error || !data ? [] : data
        .filter(f => f.name !== '.emptyFolderPlaceholder')
        .map(f => ({
          url: supabase.storage.from('event-photos').getPublicUrl(f.name).data.publicUrl,
          label: f.name,
        }));

      setExistingPhotos([...LOCAL_PHOTOS, ...uploaded]);
    } catch {
      setExistingPhotos(LOCAL_PHOTOS);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPhotoUploading(true);
    setPhotoError(null);

    try {
      const ext = file.name.split('.').pop();
      const fileName = `event-${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from('event-photos')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('event-photos')
        .getPublicUrl(data.path);

      setFormData(prev => ({ ...prev, photo_url: publicUrl }));
    } catch (err) {
      console.error('Error uploading photo:', err);
      setPhotoError('Failed to upload photo. Make sure the "event-photos" storage bucket exists in Supabase.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const eventData = {
        tournament_id: formData.tournament_id,
        event_name: formData.event_name,
        event_type: formData.event_type,
        event_date: formData.event_date,
        start_time: formData.start_time || null,
        location: formData.location || null,
        map_link: formData.map_link || null,
        host: formData.host || null,
        photo_url: formData.photo_url || null,
        adult_price: formData.price_tbd ? 0 : (formData.adult_price ? parseFloat(formData.adult_price) : 0),
        child_price: formData.price_tbd ? 0 : (formData.child_price ? parseFloat(formData.child_price) : 0),
        description: formData.description || null,
        price_tbd: formData.price_tbd,
        adult_price_min: formData.price_tbd && formData.adult_price_min ? parseFloat(formData.adult_price_min) : null,
        adult_price_max: formData.price_tbd && formData.adult_price_max ? parseFloat(formData.adult_price_max) : null,
        child_price_min: formData.price_tbd && formData.child_price_min ? parseFloat(formData.child_price_min) : null,
        child_price_max: formData.price_tbd && formData.child_price_max ? parseFloat(formData.child_price_max) : null,
      };

      if (event) {
        // Update existing event
        const { error } = await supabase
          .from('tournament_events')
          .update(eventData)
          .eq('id', event.id);

        if (error) throw error;
      } else {
        // Create new event
        const { error } = await supabase
          .from('tournament_events')
          .insert([eventData]);

        if (error) throw error;
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving event:', err);
      setError(err.message || 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const eventTypes = [
    { value: 'golf_tournament', label: 'Golf Tournament' },
    { value: 'welcome_dinner', label: 'Welcome Dinner' },
    { value: 'beach_day', label: 'Beach Day' },
    { value: 'awards_dinner', label: 'Awards Dinner' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-night-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-night-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {event ? 'Edit Event' : 'Add Event'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="tournament_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Tournament <span className="text-red-500">*</span>
              </label>
              <select
                id="tournament_id"
                required
                value={formData.tournament_id}
                onChange={(e) => setFormData({ ...formData, tournament_id: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="">Select a tournament</option>
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.year}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="event_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Event Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="event_name"
                  required
                  value={formData.event_name}
                  onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                  placeholder="e.g., The Kathryn Class Golf Tournament"
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="event_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Event Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="event_type"
                  required
                  value={formData.event_type}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                >
                  <option value="">Select type</option>
                  {eventTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="event_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Event Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="event_date"
                  required
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Start Time
                </label>
                <input
                  type="time"
                  id="start_time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Cape May National Golf Club"
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="host" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Host
                </label>
                <input
                  type="text"
                  id="host"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  placeholder="e.g., Jane Smith"
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="map_link" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Google Maps Link
              </label>
              <input
                type="url"
                id="map_link"
                value={formData.map_link}
                onChange={(e) => setFormData({ ...formData, map_link: e.target.value })}
                placeholder="https://maps.google.com/..."
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>

            <div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="price_tbd"
                  checked={formData.price_tbd}
                  onChange={(e) => setFormData({ ...formData, price_tbd: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 dark:border-night-600 text-primary-600 dark:text-primary-400 focus:ring-primary-500"
                />
                <label htmlFor="price_tbd" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Price TBD — we will contact registrants with final cost
                </label>
              </div>
            </div>

            {!formData.price_tbd ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="adult_price" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Adult Price ($) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="adult_price"
                    required
                    min="0"
                    step="0.01"
                    value={formData.adult_price}
                    onChange={(e) => setFormData({ ...formData, adult_price: e.target.value })}
                    placeholder="0.00"
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="child_price" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Child Price ($) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="child_price"
                    required
                    min="0"
                    step="0.01"
                    value={formData.child_price}
                    onChange={(e) => setFormData({ ...formData, child_price: e.target.value })}
                    placeholder="0.00"
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-4 space-y-4">
                <p className="text-sm text-amber-800 font-medium">Optional: Estimate range shown to registrants</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Adult Price Min ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.adult_price_min}
                      onChange={(e) => setFormData({ ...formData, adult_price_min: e.target.value })}
                      placeholder="0.00"
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Adult Price Max ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.adult_price_max}
                      onChange={(e) => setFormData({ ...formData, adult_price_max: e.target.value })}
                      placeholder="0.00"
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Child Price Min ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.child_price_min}
                      onChange={(e) => setFormData({ ...formData, child_price_min: e.target.value })}
                      placeholder="0.00"
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Child Price Max ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.child_price_max}
                      onChange={(e) => setFormData({ ...formData, child_price_max: e.target.value })}
                      placeholder="0.00"
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event Photo</label>
              <div className="mt-1 flex items-start gap-4">
                {formData.photo_url && (
                  <div className="relative flex-shrink-0">
                    <img
                      src={formData.photo_url}
                      alt="Event"
                      className="w-24 h-24 rounded-lg object-cover border border-gray-200 dark:border-night-700"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, photo_url: '' }))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 border border-gray-300 dark:border-night-600 rounded-md shadow-sm hover:bg-gray-50 dark:bg-night-700">
                      <span>{photoUploading ? 'Uploading...' : 'Upload New'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        disabled={photoUploading}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={loadExistingPhotos}
                      className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 border border-gray-300 dark:border-night-600 rounded-md shadow-sm hover:bg-gray-50 dark:bg-night-700"
                    >
                      Choose Existing
                    </button>
                  </div>
                  {photoError && <p className="text-xs text-red-600">{photoError}</p>}
                  {!formData.photo_url && !photoError && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">JPG, PNG, or WebP recommended</p>
                  )}
                </div>
              </div>

              {showPhotoPicker && (
                <div className="mt-3 border border-gray-200 dark:border-night-700 rounded-lg p-3 bg-gray-50 dark:bg-night-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Select a photo</span>
                    <button
                      type="button"
                      onClick={() => setShowPhotoPicker(false)}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300"
                    >
                      Close
                    </button>
                  </div>
                  {existingPhotos.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Loading...</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                      {existingPhotos.map((photo) => (
                        <button
                          key={photo.url}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, photo_url: photo.url }));
                            setShowPhotoPicker(false);
                          }}
                          className={`relative rounded-lg overflow-hidden border-2 transition-colors ${
                            formData.photo_url === photo.url
                              ? 'border-primary-500'
                              : 'border-transparent hover:border-primary-300'
                          }`}
                        >
                          <img
                            src={photo.url}
                            alt={photo.label}
                            className="w-full h-20 object-cover"
                          />
                          <span className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-40 text-white text-xs px-1 py-0.5 truncate">
                            {photo.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description of the event"
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 border border-gray-300 dark:border-night-600 rounded-md shadow-sm hover:bg-gray-50 dark:bg-night-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
