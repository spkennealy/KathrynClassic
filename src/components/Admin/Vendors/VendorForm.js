import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import Select from '../Select';
import { normalizePhone, isValidPhone } from '../../../utils/phone';
import { normalizeEmail, isValidEmail } from '../../../utils/email';
import { logAudit, diffFields } from '../../../utils/audit';

const VENDOR_FIELDS = [
  'name', 'contact_name', 'phone', 'email', 'website', 'category', 'address', 'details',
];

// Shared with expenses so a vendor's category lines up with the expense it lands on.
export const VENDOR_CATEGORY_OPTIONS = [
  'Venue',
  'Food & Beverage',
  'Golf / Course',
  'Prizes & Awards',
  'Marketing',
  'Supplies',
  'Gifts / Swag',
  'Other',
];

// Store websites with a scheme so the list can link straight out to them.
const normalizeWebsite = (raw) => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export default function VendorForm({ vendor, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: vendor?.name || '',
    contact_name: vendor?.contact_name || '',
    phone: vendor?.phone || '',
    email: vendor?.email || '',
    website: vendor?.website || '',
    category: vendor?.category || '',
    address: vendor?.address || '',
    details: vendor?.details || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Vendor name is required.');
      return;
    }
    if (formData.email.trim() && !isValidEmail(formData.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (formData.phone.trim() && !isValidPhone(formData.phone)) {
      setError('Please enter a valid phone number.');
      return;
    }

    setLoading(true);

    try {
      const vendorData = {
        name: formData.name.trim(),
        contact_name: formData.contact_name.trim() || null,
        phone: normalizePhone(formData.phone),
        email: normalizeEmail(formData.email) || null,
        website: normalizeWebsite(formData.website),
        category: formData.category || null,
        address: formData.address.trim() || null,
        details: formData.details.trim() || null,
      };

      if (vendor) {
        const { error: updateError } = await supabase
          .from('vendors')
          .update(vendorData)
          .eq('id', vendor.id);
        if (updateError) throw updateError;

        const changes = diffFields(vendor, vendorData, VENDOR_FIELDS);
        if (changes) {
          await logAudit({
            action: 'vendor.updated',
            entityType: 'vendor',
            entityId: vendor.id,
            entityLabel: vendorData.name,
            changes,
          });
        }
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('vendors')
          .insert([vendorData])
          .select('id')
          .single();
        if (insertError) throw insertError;

        await logAudit({
          action: 'vendor.created',
          entityType: 'vendor',
          entityId: inserted?.id,
          entityLabel: vendorData.name,
          changes: vendorData,
        });
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving vendor:', err);
      // The partial unique index on lower(name) is the likely failure here.
      setError(
        err.code === '23505'
          ? 'A vendor with that name already exists.'
          : err.message || 'Failed to save vendor'
      );
    } finally {
      setLoading(false);
    }
  };

  // Inputs get their visual styling from the global `.admin-content` rules.
  const inputClass = 'mt-1 block w-full';

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-start sm:items-center justify-center p-4 overflow-y-auto z-50">
      <div className="bg-white dark:bg-night-800 rounded-lg shadow-xl max-w-2xl w-full modal-panel overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-night-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {vendor ? 'Edit Vendor' : 'Add Vendor'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="vendor-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Vendor Name <span className="text-red-500">*</span>
            </label>
            <input
              id="vendor-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="vendor-contact" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Main Contact
              </label>
              <input
                id="vendor-contact"
                type="text"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="Who we deal with there"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="vendor-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Category
              </label>
              <Select
                id="vendor-category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="mt-1"
              >
                <option value="">Select...</option>
                {VENDOR_CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="vendor-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Phone
              </label>
              <input
                id="vendor-phone"
                type="tel"
                spellCheck={false}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="vendor-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                id="vendor-email"
                type="email"
                spellCheck={false}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="vendor-website" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Website
            </label>
            <input
              id="vendor-website"
              type="text"
              spellCheck={false}
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="example.com"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="vendor-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Address
            </label>
            <textarea
              id="vendor-address"
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="vendor-details" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Additional Details
            </label>
            <textarea
              id="vendor-details"
              rows={3}
              value={formData.details}
              onChange={(e) => setFormData({ ...formData, details: e.target.value })}
              placeholder="Pricing notes, contract terms, anything worth remembering next year"
              className={inputClass}
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
              {loading ? 'Saving...' : vendor ? 'Save Changes' : 'Create Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
