// Display helpers for registrations.payment_status (pending / partially_paid /
// paid / past_due / canceled / voided). The status is derived from recorded
// payments (see Financials/PaymentModal.js); it is never edited directly.

export const paymentStatusLabel = (status) => String(status || 'pending').replace(/_/g, ' ');

export const paymentStatusClasses = (status) => {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800';
    case 'partially_paid':
      return 'bg-amber-100 text-amber-800';
    case 'past_due':
      return 'bg-red-100 text-red-800';
    case 'canceled':
    case 'voided':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-yellow-100 text-yellow-800';
  }
};

// What a registrant actually owes: event cost minus any credit memo (never below 0).
export const amountDue = (total, credit = 0) =>
  Math.max((Number(total) || 0) - (Number(credit) || 0), 0);

// payment_status is derived, never typed in: paid once payments cover the amount
// due (a fully credited registration is settled too), partially_paid once any
// payment is recorded, otherwise pending. A registration with no cost stays pending.
export const derivePaymentStatus = ({ paid, total, credit = 0 }) => {
  const p = Number(paid) || 0;
  const t = Number(total) || 0;
  if (t > 0 && p >= amountDue(t, credit)) return 'paid';
  if (p > 0) return 'partially_paid';
  return 'pending';
};
