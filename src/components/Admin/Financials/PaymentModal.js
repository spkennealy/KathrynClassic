import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../supabaseClient';
import { logAudit, diffFields } from '../../../utils/audit';
import { formatCurrency } from '../../../utils/currency';
import { amountDue as computeAmountDue, derivePaymentStatus } from '../../../utils/paymentStatus';
import DatePicker from '../DatePicker';

const todayStr = () => new Date().toISOString().split('T')[0];

// Record / edit the payment on a registration. This is the only place a
// registration's payment_status changes: it's derived from amount_paid vs the
// registration's total cost (paid / partially_paid / pending).
//
// `registrant` is a row from the admin_financials_details view (it needs
// registration_id, first_name, last_name, total_cost, amount_paid, payment_date,
// notes, payment_status).
export default function PaymentModal({ registrant, onClose, onSave }) {
  const totalCost = Number(registrant.total_cost) || 0;
  const creditMemo = Number(registrant.credit_memo_amount) || 0;
  // What's actually owed: event cost less any credit memo.
  const amountDue = computeAmountDue(totalCost, creditMemo);
  const isEdit = (Number(registrant.amount_paid) || 0) > 0;
  const [amountPaid, setAmountPaid] = useState(
    registrant.amount_paid != null ? String(registrant.amount_paid) : ''
  );
  const [paymentDate, setPaymentDate] = useState(registrant.payment_date || todayStr());
  const [notes, setNotes] = useState(registrant.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const save = async (overrideAmount) => {
    setLoading(true);
    setError(null);
    const paid = overrideAmount != null ? overrideAmount : parseFloat(amountPaid || '0');
    if (isNaN(paid) || paid < 0) {
      setError('Please enter a valid amount');
      setLoading(false);
      return;
    }
    const payment_status = derivePaymentStatus({ paid, total: totalCost, credit: creditMemo });
    try {
      const newValues = {
        amount_paid: paid,
        payment_date: paid > 0 ? paymentDate : null,
        notes: notes.trim() || null,
        payment_status,
      };
      const { error: updateError } = await supabase
        .from('registrations')
        .update(newValues)
        .eq('id', registrant.registration_id);
      if (updateError) throw updateError;

      const changes = diffFields(
        {
          amount_paid: registrant.amount_paid,
          payment_date: registrant.payment_date,
          notes: registrant.notes,
          payment_status: registrant.payment_status,
        },
        newValues,
        ['amount_paid', 'payment_date', 'notes', 'payment_status']
      );
      if (changes) {
        await logAudit({
          action: 'registration.payment_recorded',
          entityType: 'registration',
          entityId: registrant.registration_id,
          entityLabel: `${registrant.first_name} ${registrant.last_name}`,
          changes,
        });
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Error recording payment:', err);
      setError(err.message || 'Failed to record payment');
      setLoading(false);
    }
  };

  // Portal: keeps `fixed inset-0` clear of the caller's space-y-* sibling margin.
  return createPortal(
    <div className="admin-content fixed inset-0 bg-gray-500 bg-opacity-75 flex items-start sm:items-center justify-center p-4 overflow-y-auto z-50">
      <div className="bg-white dark:bg-night-800 rounded-lg shadow-xl max-w-md w-full modal-panel overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-night-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{isEdit ? 'Edit Payment' : 'Record Payment'}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {registrant.first_name} {registrant.last_name} &middot;{' '}
            {creditMemo > 0
              ? `Due ${formatCurrency(amountDue)} (${formatCurrency(totalCost)} less ${formatCurrency(creditMemo)} credit memo)`
              : `Total ${formatCurrency(totalCost)}`}
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount Paid</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="0.00"
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
            <button
              type="button"
              onClick={() => setAmountPaid(String(amountDue))}
              className="mt-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:text-primary-300"
            >
              Set to amount due ({formatCurrency(amountDue)})
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Date</label>
            <div className="mt-1">
              <DatePicker value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-night-700 flex justify-between gap-3">
          <button
            type="button"
            onClick={() => save(amountDue)}
            disabled={loading || amountDue <= 0}
            className="px-4 py-2 text-sm font-medium text-primary-700 dark:text-primary-300 bg-primary-50 border border-primary-200 rounded-md hover:bg-primary-100 dark:bg-primary-900/40 disabled:opacity-50"
          >
            Mark Fully Paid
          </button>
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
