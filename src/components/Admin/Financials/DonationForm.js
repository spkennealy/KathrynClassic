import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../supabaseClient';
import { logAudit, diffFields } from '../../../utils/audit';
import DatePicker from '../DatePicker';
import Select from '../Select';

const DONATION_FIELDS = [
  'contact_id', 'company', 'is_anonymous', 'amount', 'donation_date',
  'donation_type', 'payment_method', 'source', 'message',
];

// What kind of gift it was.
const DONATION_TYPE_OPTIONS = ['Monetary', 'Sponsorship', 'Auction', 'Raffle', 'Other'];

// Types where the money isn't from a person or company (e.g. 50/50 raffle
// proceeds), so a donor isn't required.
export const DONOR_OPTIONAL_TYPES = ['Raffle'];

// How the money arrived.
const PAYMENT_METHOD_OPTIONS = ['Cash', 'Check', 'Card', 'Venmo', 'Zelle', 'Other'];

// Where the donation happened.
const SOURCE_OPTIONS = ['CJD Foundation Website', 'Kathryn Classic Event', 'Other'];

const todayStr = () => new Date().toISOString().split('T')[0];

export default function DonationForm({ donation, tournamentId, onClose, onSave }) {
  const isEditMode = !!donation;
  const [formData, setFormData] = useState({
    contact_id: donation?.contact_id || '',
    company: donation?.company || '',
    is_anonymous: donation?.is_anonymous ?? false,
    amount: donation?.amount ?? '',
    donation_date: donation?.donation_date || todayStr(),
    donation_type: donation?.donation_type || 'Monetary',
    payment_method: donation?.payment_method || '',
    source: donation?.source || '',
    message: donation?.message || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [contacts, setContacts] = useState([]);
  const donorOptional = DONOR_OPTIONAL_TYPES.includes(formData.donation_type);

  const fetchContacts = useCallback(async () => {
    try {
      const { data, error: contactError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name')
        .is('deleted_at', null)
        .order('last_name');
      if (contactError) throw contactError;
      setContacts(data || []);
    } catch (err) {
      console.error('Error loading donation form contacts:', err);
      setError('Failed to load contacts');
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.amount === '' || isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) < 0) {
      setError('Please enter a valid amount');
      setLoading(false);
      return;
    }
    if (!formData.donation_type) {
      setError('Donation type is required');
      setLoading(false);
      return;
    }
    // Otherwise a donation with no donor at all is unusable in reporting — require
    // at least one of contact / company / explicitly anonymous.
    if (
      !donorOptional &&
      !formData.contact_id &&
      !formData.company.trim() &&
      !formData.is_anonymous
    ) {
      setError('Pick a contact, enter a company, or mark the donation anonymous. (Raffle donations don\'t need a donor.)');
      setLoading(false);
      return;
    }

    const payload = {
      tournament_id: tournamentId,
      contact_id: formData.contact_id || null,
      company: formData.company.trim() || null,
      is_anonymous: formData.is_anonymous,
      amount: parseFloat(formData.amount),
      donation_date: formData.donation_date || null,
      donation_type: formData.donation_type,
      payment_method: formData.payment_method || null,
      source: formData.source || null,
      message: formData.message.trim() || null,
    };

    // Human label for the audit log, matching how the table renders the donor.
    const contact = contacts.find((c) => c.id === formData.contact_id);
    const label = payload.is_anonymous
      ? 'Anonymous'
      : contact
        ? `${contact.first_name} ${contact.last_name}`
        : payload.company || payload.donation_type || 'Donation';

    try {
      if (isEditMode) {
        const { error: updateError } = await supabase
          .from('donations')
          .update(payload)
          .eq('id', donation.id);
        if (updateError) throw updateError;

        const changes = diffFields(donation, payload, DONATION_FIELDS);
        if (changes) {
          await logAudit({
            action: 'donation.updated',
            entityType: 'donation',
            entityId: donation.id,
            entityLabel: label,
            changes,
          });
        }
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('donations')
          .insert([payload])
          .select('id')
          .single();
        if (insertError) throw insertError;

        await logAudit({
          action: 'donation.created',
          entityType: 'donation',
          entityId: inserted?.id,
          entityLabel: label,
          changes: payload,
        });
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving donation:', err);
      setError(err.message || 'Failed to save donation');
    } finally {
      setLoading(false);
    }
  };

  // Portal: keeps `fixed inset-0` clear of the caller's space-y-* sibling margin.
  return createPortal(
    <div className="admin-content fixed inset-0 bg-gray-500 bg-opacity-75 flex items-start sm:items-center justify-center p-4 overflow-y-auto z-50">
      <div className="bg-white dark:bg-night-800 rounded-lg shadow-xl max-w-lg w-full modal-panel overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-night-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {isEditMode ? 'Edit Donation' : 'Add Donation'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="mt-1 block w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
              <div className="mt-1">
                <DatePicker
                  value={formData.donation_date}
                  onChange={(e) => setFormData({ ...formData, donation_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Donor
              {donorOptional && (
                <span className="ml-1 font-normal text-gray-500 dark:text-gray-400">(optional for {formData.donation_type.toLowerCase()} proceeds)</span>
              )}
            </label>
            <Select
              value={formData.contact_id}
              onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
              className="mt-1"
              searchable
            >
              <option value="">Select...</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company</label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="For a business or organization"
              className="mt-1 block w-full"
            />
          </div>

          <div className="rounded-md bg-gray-50 dark:bg-night-700 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={formData.is_anonymous}
                onChange={(e) => setFormData({ ...formData, is_anonymous: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Anonymous donation
            </label>
            <p className="mt-1 ml-6 text-xs text-gray-500 dark:text-gray-400">
              Hides the donor's name wherever donations are shown publicly. The contact stays linked.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Type <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.donation_type}
                onChange={(e) => setFormData({ ...formData, donation_type: e.target.value })}
                className="mt-1"
              >
                {DONATION_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Method</label>
              <Select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="mt-1"
              >
                <option value="">Select...</option>
                {PAYMENT_METHOD_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Source</label>
            <Select
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              className="mt-1"
            >
              <option value="">Select...</option>
              {SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
            <textarea
              rows={2}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="mt-1 block w-full"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
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
              {loading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Add Donation'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
