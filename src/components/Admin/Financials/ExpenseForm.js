import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../supabaseClient';
import { logAudit, diffFields } from '../../../utils/audit';
import { normalizePhone } from '../../../utils/phone';
import { normalizeEmail } from '../../../utils/email';
import DatePicker from '../DatePicker';
import Select from '../Select';

const EXPENSE_FIELDS = [
  'description', 'category', 'vendor_id', 'tournament_event_id',
  'paid_by_contact_id', 'amount', 'expense_date', 'payment_method',
  'is_paid', 'paid_date', 'notes',
];

const CATEGORY_OPTIONS = [
  'Venue',
  'Food & Beverage',
  'Golf / Course',
  'Prizes & Awards',
  'Marketing',
  'Supplies',
  'Gifts / Swag',
  'Other',
];

const PAYMENT_METHOD_OPTIONS = ['Card', 'Check', 'Cash', 'Bank Transfer', 'Other'];

const todayStr = () => new Date().toISOString().split('T')[0];

const blankVendor = { name: '', phone: '', email: '' };

export default function ExpenseForm({ expense, tournamentId, onClose, onSave }) {
  const isEditMode = !!expense;
  const [formData, setFormData] = useState({
    description: expense?.description || '',
    category: expense?.category || '',
    vendor_id: expense?.vendor_id || '',
    tournament_event_id: expense?.tournament_event_id || '',
    paid_by_contact_id: expense?.paid_by_contact_id || '',
    amount: expense?.amount ?? '',
    expense_date: expense?.expense_date || todayStr(),
    payment_method: expense?.payment_method || '',
    is_paid: expense?.is_paid ?? false,
    paid_date: expense?.paid_date || '',
    notes: expense?.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Picker options
  const [vendors, setVendors] = useState([]);
  const [events, setEvents] = useState([]);
  const [contacts, setContacts] = useState([]);

  // Inline "create vendor without leaving this form" panel
  const [showNewVendor, setShowNewVendor] = useState(false);
  const [newVendor, setNewVendor] = useState(blankVendor);
  const [creatingVendor, setCreatingVendor] = useState(false);

  const fetchOptions = useCallback(async () => {
    try {
      const [vendorRes, eventRes, contactRes] = await Promise.all([
        supabase.from('vendors').select('id, name').is('deleted_at', null).order('name'),
        tournamentId
          ? supabase
              .from('tournament_events')
              .select('id, event_name, event_type')
              .eq('tournament_id', tournamentId)
              .order('event_date')
          : Promise.resolve({ data: [], error: null }),
        supabase.from('contacts').select('id, first_name, last_name').is('deleted_at', null).order('last_name'),
      ]);

      if (vendorRes.error) throw vendorRes.error;
      if (eventRes.error) throw eventRes.error;
      if (contactRes.error) throw contactRes.error;

      setVendors(vendorRes.data || []);
      setEvents(eventRes.data || []);
      setContacts(contactRes.data || []);
    } catch (err) {
      console.error('Error loading expense form options:', err);
      setError('Failed to load vendors, events or contacts');
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  // Create a vendor inline and select it, so adding an expense for a brand new
  // vendor doesn't mean abandoning the form.
  const handleCreateVendor = async () => {
    const name = newVendor.name.trim();
    if (!name) {
      setError('Vendor name is required');
      return;
    }
    setCreatingVendor(true);
    setError(null);
    try {
      const vendorData = {
        name,
        phone: normalizePhone(newVendor.phone),
        email: normalizeEmail(newVendor.email) || null,
      };
      const { data: inserted, error: insertError } = await supabase
        .from('vendors')
        .insert([vendorData])
        .select('id, name')
        .single();
      if (insertError) throw insertError;

      await logAudit({
        action: 'vendor.created',
        entityType: 'vendor',
        entityId: inserted.id,
        entityLabel: inserted.name,
        changes: vendorData,
      });

      setVendors(prev => [...prev, inserted].sort((a, b) => a.name.localeCompare(b.name)));
      setFormData(prev => ({ ...prev, vendor_id: inserted.id }));
      setNewVendor(blankVendor);
      setShowNewVendor(false);
    } catch (err) {
      console.error('Error creating vendor:', err);
      setError(
        err.code === '23505'
          ? 'A vendor with that name already exists — pick it from the list instead.'
          : err.message || 'Failed to create vendor'
      );
    } finally {
      setCreatingVendor(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.description.trim()) {
      setError('Description is required');
      setLoading(false);
      return;
    }
    if (formData.amount === '' || isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) < 0) {
      setError('Please enter a valid amount');
      setLoading(false);
      return;
    }

    const payload = {
      tournament_id: tournamentId,
      description: formData.description.trim(),
      category: formData.category || null,
      vendor_id: formData.vendor_id || null,
      tournament_event_id: formData.tournament_event_id || null,
      paid_by_contact_id: formData.paid_by_contact_id || null,
      amount: parseFloat(formData.amount),
      expense_date: formData.expense_date || null,
      payment_method: formData.payment_method || null,
      is_paid: formData.is_paid,
      paid_date: formData.is_paid ? (formData.paid_date || null) : null,
      notes: formData.notes.trim() || null,
    };

    try {
      if (isEditMode) {
        const { error: updateError } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', expense.id);
        if (updateError) throw updateError;

        const changes = diffFields(expense, payload, EXPENSE_FIELDS);
        if (changes) {
          await logAudit({
            action: 'expense.updated',
            entityType: 'expense',
            entityId: expense.id,
            entityLabel: payload.description,
            changes,
          });
        }
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('expenses')
          .insert([payload])
          .select('id')
          .single();
        if (insertError) throw insertError;

        await logAudit({
          action: 'expense.created',
          entityType: 'expense',
          entityId: inserted?.id,
          entityLabel: payload.description,
          changes: payload,
        });
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving expense:', err);
      setError(err.message || 'Failed to save expense');
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
            {isEditMode ? 'Edit Expense' : 'Add Expense'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1 block w-full"
            />
          </div>

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
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
              <Select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="mt-1"
              >
                <option value="">Select...</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event</label>
            <Select
              value={formData.tournament_event_id}
              onChange={(e) => setFormData({ ...formData, tournament_event_id: e.target.value })}
              className="mt-1"
              searchable
            >
              <option value="">Not event-specific</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.event_name}</option>
              ))}
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vendor</label>
              <button
                type="button"
                onClick={() => { setShowNewVendor(!showNewVendor); setNewVendor(blankVendor); }}
                className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium"
              >
                {showNewVendor ? 'Cancel' : '+ New Vendor'}
              </button>
            </div>

            {showNewVendor ? (
              <div className="mt-1 bg-gray-50 dark:bg-night-700 p-4 rounded-md space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newVendor.name}
                    onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                    className="block w-full"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                    <input
                      type="tel"
                      spellCheck={false}
                      value={newVendor.phone}
                      onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                      className="block w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input
                      type="email"
                      spellCheck={false}
                      value={newVendor.email}
                      onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                      className="block w-full"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCreateVendor}
                  disabled={creatingVendor}
                  className="w-full px-3 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  {creatingVendor ? 'Creating...' : 'Create and Select'}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Add the rest of the vendor's details later on the Vendors page.
                </p>
              </div>
            ) : (
              <Select
                value={formData.vendor_id}
                onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                className="mt-1"
                searchable
              >
                <option value="">Select...</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </Select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Paid By</label>
            <Select
              value={formData.paid_by_contact_id}
              onChange={(e) => setFormData({ ...formData, paid_by_contact_id: e.target.value })}
              className="mt-1"
              searchable
            >
              <option value="">Select...</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
              ))}
            </Select>
          </div>

          <div className="rounded-md bg-gray-50 dark:bg-night-700 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={formData.is_paid}
                onChange={(e) => setFormData({
                  ...formData,
                  is_paid: e.target.checked,
                  paid_date: e.target.checked && !formData.paid_date ? todayStr() : formData.paid_date,
                })}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Paid to vendor
            </label>
            {formData.is_paid && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Paid Date</label>
                <DatePicker
                  value={formData.paid_date}
                  onChange={(e) => setFormData({ ...formData, paid_date: e.target.value })}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
              {loading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
