import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../supabaseClient';
import { logAudit, diffFields } from '../../../utils/audit';
import { formatCurrency } from '../../../utils/currency';
import { derivePaymentStatus } from '../../../utils/paymentStatus';
import DatePicker from '../DatePicker';

const todayStr = () => new Date().toISOString().split('T')[0];

const CREDIT_FIELDS = ['credit_memo_amount', 'credit_memo_date', 'credit_memo_reason', 'payment_status'];

// Add, edit, or remove the credit memo on a registration: an amount that can't be
// collected and comes off what the registrant owes. Only the unpaid part of the
// cost can be credited. Saving re-derives payment_status (a fully credited
// registration is settled).
//
// `registrant` is a row from the admin_financials_details view (needs
// registration_id, first_name, last_name, total_cost, amount_paid, payment_status,
// credit_memo_amount, credit_memo_date, credit_memo_reason).
export default function CreditMemoModal({ registrant, onClose, onSave }) {
  const totalCost = Number(registrant.total_cost) || 0;
  const paid = Number(registrant.amount_paid) || 0;
  const existing = Number(registrant.credit_memo_amount) || 0;
  const maxCredit = Math.max(totalCost - paid, 0);

  const [amount, setAmount] = useState(existing > 0 ? String(existing) : '');
  const [memoDate, setMemoDate] = useState(registrant.credit_memo_date || todayStr());
  const [reason, setReason] = useState(registrant.credit_memo_reason || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const save = async (overrideAmount) => {
    setLoading(true);
    setError(null);
    const raw = overrideAmount != null ? overrideAmount : parseFloat(amount || '0');
    if (isNaN(raw) || raw < 0) {
      setError('Please enter a valid amount');
      setLoading(false);
      return;
    }
    const credit = Math.round(raw * 100) / 100;
    if (credit > maxCredit) {
      setError(`A credit memo can't be more than the unpaid balance (${formatCurrency(maxCredit)}).`);
      setLoading(false);
      return;
    }

    try {
      const newValues = {
        credit_memo_amount: credit,
        credit_memo_date: credit > 0 ? memoDate : null,
        credit_memo_reason: credit > 0 ? reason.trim() || null : null,
        payment_status: derivePaymentStatus({ paid, total: totalCost, credit }),
      };
      const { error: updateError } = await supabase
        .from('registrations')
        .update(newValues)
        .eq('id', registrant.registration_id);
      if (updateError) throw updateError;

      const changes = diffFields(
        {
          credit_memo_amount: existing,
          credit_memo_date: registrant.credit_memo_date,
          credit_memo_reason: registrant.credit_memo_reason,
          payment_status: registrant.payment_status,
        },
        newValues,
        CREDIT_FIELDS
      );
      if (changes) {
        await logAudit({
          action:
            credit === 0
              ? 'registration.credit_memo_removed'
              : existing > 0
                ? 'registration.credit_memo_updated'
                : 'registration.credit_memo_added',
          entityType: 'registration',
          entityId: registrant.registration_id,
          entityLabel: `${registrant.first_name} ${registrant.last_name}`,
          changes,
        });
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving credit memo:', err);
      setError(err.message || 'Failed to save credit memo');
      setLoading(false);
    }
  };

  // Portal: keeps `fixed inset-0` clear of the caller's space-y-* sibling margin.
  return createPortal(
    <div className="admin-content fixed inset-0 bg-gray-500 bg-opacity-75 flex items-start sm:items-center justify-center p-4 overflow-y-auto z-50">
      <div className="bg-white dark:bg-night-800 rounded-lg shadow-xl max-w-md w-full modal-panel overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-night-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {existing > 0 ? 'Edit Credit Memo' : 'Add Credit Memo'}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {registrant.first_name} {registrant.last_name} &middot; Total {formatCurrency(totalCost)} &middot; Paid{' '}
            {formatCurrency(paid)}
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <p className="text-sm text-gray-600 dark:text-gray-400">
            Use a credit memo for an amount you can&rsquo;t collect. It comes off what this registrant owes, so it
            drops out of the amount due and outstanding totals. It isn&rsquo;t counted as income.
          </p>

          <div>
            <label htmlFor="credit_memo_amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Credit Amount
            </label>
            <input
              id="credit_memo_amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
            <button
              type="button"
              onClick={() => setAmount(String(maxCredit))}
              disabled={maxCredit <= 0}
              className="mt-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:text-primary-300 disabled:opacity-50"
            >
              Credit the full unpaid balance ({formatCurrency(maxCredit)})
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Credit Date</label>
            <div className="mt-1">
              <DatePicker value={memoDate} onChange={(e) => setMemoDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label htmlFor="credit_memo_reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Reason
            </label>
            <textarea
              id="credit_memo_reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Could not collect payment"
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-night-700 flex justify-between gap-3">
          {existing > 0 ? (
            <button
              type="button"
              onClick={() => save(0)}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-white dark:bg-night-800 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50"
            >
              Remove Credit Memo
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 border border-gray-300 dark:border-night-600 rounded-md shadow-sm hover:bg-gray-50 dark:bg-night-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => save()}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
