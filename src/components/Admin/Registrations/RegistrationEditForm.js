import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';

export default function RegistrationEditForm({ registration, onClose, onSave }) {
  const [formData, setFormData] = useState({
    contact_id: '',
    tournament_id: '',
    payment_status: 'pending',
    golf_handicap: '',
    preferred_teammates: '',
  });
  const [contacts, setContacts] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState({});
  const [registrationEvents, setRegistrationEvents] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  const [newContactData, setNewContactData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const isCreateMode = !registration;

  useEffect(() => {
    // Always fetch contacts for both create and edit modes
    fetchContacts();

    if (isCreateMode) {
      // Fetch tournaments for create mode
      fetchTournaments();
    } else {
      // Edit mode - populate with existing data
      setFormData({
        contact_id: registration.contact_id || '',
        tournament_id: registration.tournament_id || '',
        payment_status: registration.payment_status || 'pending',
        golf_handicap: registration.golf_handicap || '',
        preferred_teammates: registration.preferred_teammates || '',
      });

      // Set initial search term to current contact name
      if (registration.first_name && registration.last_name) {
        setContactSearchTerm(`${registration.first_name} ${registration.last_name}`);
      }

      fetchEventsForRegistration();
    }
  }, [registration, isCreateMode]);

  // Fetch events when tournament is selected in create mode
  useEffect(() => {
    if (isCreateMode && formData.tournament_id) {
      fetchEventsForTournament(formData.tournament_id);
    }
  }, [formData.tournament_id, isCreateMode]);

  const fetchContacts = async () => {
    try {
      // Fetch all contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email')
        .order('last_name');

      if (contactsError) throw contactsError;
      setContacts(contactsData || []);
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setError(err.message || 'Failed to load contacts');
    }
  };

  const fetchTournaments = async () => {
    try {
      // Fetch all tournaments
      const { data: tournamentsData, error: tournamentsError } = await supabase
        .from('tournaments')
        .select('id, year')
        .order('year', { ascending: false });

      if (tournamentsError) throw tournamentsError;
      setTournaments(tournamentsData || []);

      // Set default tournament to most recent in create mode
      if (isCreateMode && tournamentsData && tournamentsData.length > 0) {
        setFormData(prev => ({ ...prev, tournament_id: tournamentsData[0].id }));
      }
    } catch (err) {
      console.error('Error fetching tournaments:', err);
      setError(err.message || 'Failed to load tournaments');
    }
  };

  const fetchEventsForTournament = async (tournamentId) => {
    try {
      const { data: tournamentEvents, error: eventsError } = await supabase
        .from('tournament_events')
        .select('id, event_name, event_type')
        .eq('tournament_id', tournamentId)
        .order('event_date');

      if (eventsError) throw eventsError;
      setEvents(tournamentEvents || []);
    } catch (err) {
      console.error('Error fetching events:', err);
    }
  };

  const handleCreateNewContact = async () => {
    // Validate new contact data
    if (!newContactData.first_name || !newContactData.last_name) {
      setError('First name and last name are required for new contact');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check if contact with this email already exists
      if (newContactData.email) {
        const { data: existingContact, error: searchError } = await supabase
          .from('contacts')
          .select('*')
          .eq('email', newContactData.email)
          .single();

        if (existingContact && !searchError) {
          // Contact already exists, select it instead
          handleSelectContact(existingContact);
          setNewContactData({ first_name: '', last_name: '', email: '', phone: '' });
          setShowNewContactForm(false);
          setError(null);
          alert(`Contact with email ${newContactData.email} already exists. Selected existing contact: ${existingContact.first_name} ${existingContact.last_name}`);
          return;
        }
      }

      // Create new contact
      const { data: newContact, error: insertError } = await supabase
        .from('contacts')
        .insert({
          first_name: newContactData.first_name,
          last_name: newContactData.last_name,
          email: newContactData.email || null,
          phone: newContactData.phone || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Refresh contacts list
      await fetchContacts();

      // Select the newly created contact
      handleSelectContact(newContact);

      // Reset form and hide
      setNewContactData({ first_name: '', last_name: '', email: '', phone: '' });
      setShowNewContactForm(false);
      setError(null);
    } catch (err) {
      console.error('Error creating contact:', err);

      // Handle duplicate email error specifically
      if (err.message && err.message.includes('contacts_email_key')) {
        setError(`A contact with email "${newContactData.email}" already exists. Please search for and select the existing contact instead.`);
      } else {
        setError(err.message || 'Failed to create contact');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectContact = (contact) => {
    setFormData(prev => ({ ...prev, contact_id: contact.id }));
    setContactSearchTerm(`${contact.first_name} ${contact.last_name}`);
    setShowContactDropdown(false);
  };

  const handleContactSearchChange = (value) => {
    setContactSearchTerm(value);
    setShowContactDropdown(true);
    // Clear selection if user is typing
    if (value !== contactSearchTerm) {
      setFormData(prev => ({ ...prev, contact_id: '' }));
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const searchLower = contactSearchTerm.toLowerCase();
    const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
    const email = contact.email?.toLowerCase() || '';
    return fullName.includes(searchLower) || email.includes(searchLower);
  });

  const fetchEventsForRegistration = async () => {
    try {
      // Fetch all events for this tournament
      const { data: tournamentEvents, error: eventsError } = await supabase
        .from('tournament_events')
        .select('id, event_name, event_type')
        .eq('tournament_id', registration.tournament_id)
        .order('event_date');

      if (eventsError) throw eventsError;
      setEvents(tournamentEvents || []);

      // Fetch existing registration_events
      const { data: regEvents, error: regEventsError } = await supabase
        .from('registration_events')
        .select('tournament_event_id, child_count')
        .eq('registration_id', registration.registration_id);

      if (regEventsError) throw regEventsError;

      // Convert to maps for easier access
      const eventsMap = {};
      const selectedMap = {};
      regEvents.forEach(re => {
        eventsMap[re.tournament_event_id] = re.child_count;
        selectedMap[re.tournament_event_id] = true; // Event is selected if registration_event exists
      });
      setRegistrationEvents(eventsMap);
      setSelectedEvents(selectedMap);
    } catch (err) {
      console.error('Error fetching registration events:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Build the events array from selected events
      const selectedEventTypes = events
        .filter(event => selectedEvents[event.id])
        .map(event => event.event_type);

      // Validation: At least one event must be selected
      if (selectedEventTypes.length === 0) {
        setError('Please select at least one event');
        setLoading(false);
        return;
      }

      // Validation: Contact required in create mode
      if (isCreateMode && !formData.contact_id) {
        setError('Please select a contact');
        setLoading(false);
        return;
      }

      // Validation: Golf handicap required if golf tournament is selected
      const isGolfSelected = selectedEventTypes.includes('golf_tournament');
      if (isGolfSelected && !formData.golf_handicap) {
        setError('Golf handicap is required when golf tournament is selected. Enter 20 if you don\'t have one.');
        setLoading(false);
        return;
      }

      let registrationId;

      if (isCreateMode) {
        // Create new registration
        const { data: newReg, error: insertError } = await supabase
          .from('registrations')
          .insert({
            contact_id: formData.contact_id,
            tournament_id: formData.tournament_id,
            payment_status: formData.payment_status,
            golf_handicap: formData.golf_handicap || null,
            preferred_teammates: formData.preferred_teammates || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        registrationId = newReg.id;
      } else {
        // Update existing registration
        const { error: updateError } = await supabase
          .from('registrations')
          .update({
            contact_id: formData.contact_id,
            payment_status: formData.payment_status,
            golf_handicap: formData.golf_handicap || null,
            preferred_teammates: formData.preferred_teammates || null,
          })
          .eq('id', registration.registration_id);

        if (updateError) throw updateError;
        registrationId = registration.registration_id;
      }

      // Handle registration_events for each tournament event
      for (const event of events) {
        const isSelected = selectedEvents[event.id];
        const childCount = parseInt(registrationEvents[event.id]) || 0;

        if (isCreateMode) {
          // In create mode, only insert selected events
          if (isSelected) {
            const { error: insertEvError } = await supabase
              .from('registration_events')
              .insert({
                registration_id: registrationId,
                tournament_event_id: event.id,
                child_count: childCount,
              });

            if (insertEvError) throw insertEvError;
          }
        } else {
          // In edit mode, check if registration_event exists
          const { data: existing, error: checkError } = await supabase
            .from('registration_events')
            .select('*')
            .eq('registration_id', registrationId)
            .eq('tournament_event_id', event.id)
            .single();

          if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
          }

          if (isSelected) {
            // Event is selected - insert or update registration_event
            if (existing) {
              // Update existing
              const { error: updateEvError } = await supabase
                .from('registration_events')
                .update({ child_count: childCount })
                .eq('registration_id', registrationId)
                .eq('tournament_event_id', event.id);

              if (updateEvError) throw updateEvError;
            } else {
              // Insert new
              const { error: insertEvError } = await supabase
                .from('registration_events')
                .insert({
                  registration_id: registrationId,
                  tournament_event_id: event.id,
                  child_count: childCount,
                });

              if (insertEvError) throw insertEvError;
            }
          } else {
            // Event is not selected - delete registration_event if it exists
            if (existing) {
              const { error: deleteError } = await supabase
                .from('registration_events')
                .delete()
                .eq('registration_id', registrationId)
                .eq('tournament_event_id', event.id);

              if (deleteError) throw deleteError;
            }
          }
        }
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving registration:', err);
      setError(err.message || 'Failed to save registration');
    } finally {
      setLoading(false);
    }
  };

  const handleEventToggle = (eventId) => {
    setSelectedEvents({
      ...selectedEvents,
      [eventId]: !selectedEvents[eventId],
    });
  };

  const handleChildCountChange = (eventId, value) => {
    setRegistrationEvents({
      ...registrationEvents,
      [eventId]: value,
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isCreateMode ? 'New Registration' : 'Edit Registration'}
          </h2>
          {!isCreateMode && (
            <p className="mt-1 text-sm text-gray-500">
              Tournament: {registration.tournament_year}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Contact Selection - shown in both create and edit modes */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="contact_id" className="block text-sm font-medium text-gray-700">
                  Contact <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewContactForm(!showNewContactForm)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  {showNewContactForm ? 'Cancel' : '+ New Contact'}
                </button>
              </div>

              {showNewContactForm ? (
                <div className="bg-gray-50 p-4 rounded-md space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newContactData.first_name}
                        onChange={(e) => setNewContactData({ ...newContactData, first_name: e.target.value })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newContactData.last_name}
                        onChange={(e) => setNewContactData({ ...newContactData, last_name: e.target.value })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={newContactData.email}
                      onChange={(e) => setNewContactData({ ...newContactData, email: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={newContactData.phone}
                      onChange={(e) => setNewContactData({ ...newContactData, phone: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateNewContact}
                    disabled={loading}
                    className="w-full px-3 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    Create and Select
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    id="contact_id"
                    required
                    value={contactSearchTerm}
                    onChange={(e) => handleContactSearchChange(e.target.value)}
                    onFocus={() => setShowContactDropdown(true)}
                    onBlur={() => setTimeout(() => setShowContactDropdown(false), 200)}
                    placeholder="Search by name or email..."
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    autoComplete="off"
                  />
                  {showContactDropdown && contactSearchTerm && (
                    <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                      {filteredContacts.length > 0 ? (
                        filteredContacts.map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => handleSelectContact(contact)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                          >
                            <div className="font-medium text-gray-900">
                              {contact.first_name} {contact.last_name}
                            </div>
                            {contact.email && (
                              <div className="text-sm text-gray-500">{contact.email}</div>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-sm text-gray-500">
                          No contacts found
                        </div>
                      )}
                    </div>
                  )}
                  {!formData.contact_id && contactSearchTerm && (
                    <p className="mt-1 text-xs text-gray-500">
                      Please select a contact from the dropdown
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Tournament Selection - only shown in create mode */}
            {isCreateMode && (
              <div>
                <label htmlFor="tournament_id" className="block text-sm font-medium text-gray-700">
                  Tournament <span className="text-red-500">*</span>
                </label>
                <select
                  id="tournament_id"
                  required
                  value={formData.tournament_id}
                  onChange={(e) => setFormData({ ...formData, tournament_id: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                >
                  <option value="">Select a tournament...</option>
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.year}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="payment_status" className="block text-sm font-medium text-gray-700">
                Payment Status <span className="text-red-500">*</span>
              </label>
              <select
                id="payment_status"
                required
                value={formData.payment_status}
                onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            <div>
              <label htmlFor="golf_handicap" className="block text-sm font-medium text-gray-700">
                Golf Handicap
                {events.some(event => event.event_type === 'golf_tournament' && selectedEvents[event.id]) && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </label>
              <input
                type="number"
                id="golf_handicap"
                step="0.1"
                value={formData.golf_handicap}
                onChange={(e) => setFormData({ ...formData, golf_handicap: e.target.value })}
                placeholder={events.some(event => event.event_type === 'golf_tournament' && selectedEvents[event.id]) ? "Required for golf (e.g., 18.5)" : "e.g., 18.5"}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="preferred_teammates" className="block text-sm font-medium text-gray-700">
                Preferred Teammates
              </label>
              <textarea
                id="preferred_teammates"
                rows={2}
                value={formData.preferred_teammates}
                onChange={(e) => setFormData({ ...formData, preferred_teammates: e.target.value })}
                placeholder="Names of preferred golf teammates"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>

            {events.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Events Attending
                </label>
                <div className="space-y-2 bg-gray-50 p-4 rounded-md">
                  {events.map((event) => (
                    <div key={event.id} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`select-event-${event.id}`}
                        checked={selectedEvents[event.id] || false}
                        onChange={() => handleEventToggle(event.id)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`select-event-${event.id}`} className="ml-3 text-sm text-gray-700">
                        {event.event_name}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Select which events this attendee is registered for
                </p>
              </div>
            )}

            {events.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Child Counts by Event
                </label>
                <div className="space-y-3 bg-gray-50 p-4 rounded-md">
                  {events.map((event) => (
                    <div key={event.id} className="flex items-center justify-between">
                      <label htmlFor={`event-${event.id}`} className="text-sm text-gray-700">
                        {event.event_name}
                      </label>
                      <input
                        type="number"
                        id={`event-${event.id}`}
                        min="0"
                        value={registrationEvents[event.id] || 0}
                        onChange={(e) => handleChildCountChange(event.id, e.target.value)}
                        className="w-20 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Enter the number of children attending each event
                </p>
              </div>
            )}
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
              {loading ? 'Saving...' : (isCreateMode ? 'Create Registration' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
