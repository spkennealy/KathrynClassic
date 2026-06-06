import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';

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

export default function ExpenseForm({ expense, tournamentId, onClose, onSave }) {
  const isEditMode = !!expense;
  const [formData, setFormData] = useState({
    description: expense?.description || '',
    category: expense?.category || '',
    vendor: expense?.vendor || '',
    amount: expense?.amount ?? '',
    expense_date: expense?.expense_date || todayStr(),
    payment_method: expense?.payment_method || '',
    notes: expense?.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      vendor: formData.vendor.trim() || null,
      amount: parseFloat(formData.amount),
      expense_date: formData.expense_date || null,
      payment_method: formData.payment_method || null,
      notes: formData.notes.trim() || null,
    };

    try {
      if (isEditMode) {
        const { error: updateError } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', expense.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('expenses')
          .insert([payload]);
        if (insertError) throw insertError;
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

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-night-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
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
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
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
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
              <input
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="">Select...</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Method</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="">Select...</option>
                {PAYMENT_METHOD_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vendor / Payee</label>
            <input
              type="text"
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
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
    </div>
  );
}
