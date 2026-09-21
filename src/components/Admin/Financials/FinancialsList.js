import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../supabaseClient';
import { logAudit } from '../../../utils/audit';
import { formatCurrency } from '../../../utils/currency';
import ExpenseForm from './ExpenseForm';
import DonationForm from './DonationForm';
import PaymentModal from './PaymentModal';
import CreditMemoModal from './CreditMemoModal';
import RowActionsMenu from '../RowActionsMenu';
import { amountDue as computeAmountDue } from '../../../utils/paymentStatus';
import ConfirmDialog from '../ConfirmDialog';
import MultiSelect from '../MultiSelect';
import Select from '../Select';

// Derive a display status from amount_paid vs what's owed (total cost less any
// credit memo).
const getPaymentDisplay = (amountPaid, totalCost, creditMemo = 0) => {
  const paid = Number(amountPaid) || 0;
  const total = Number(totalCost) || 0;
  if (total > 0 && paid >= computeAmountDue(total, creditMemo)) return { label: 'Paid', classes: 'bg-green-100 text-green-800', rank: 2 };
  if (paid > 0) return { label: 'Partial', classes: 'bg-amber-100 text-amber-800', rank: 1 };
  return { label: 'Unpaid', classes: 'bg-yellow-100 text-yellow-800', rank: 0 };
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

// How a donation is attributed: an anonymous gift hides the donor even when a
// contact is linked, otherwise prefer the contact's name and fall back to company.
// Some donations have no donor at all (e.g. 50/50 raffle proceeds).
const hasDonor = (d) => !!(d.is_anonymous || d.contacts || d.company);
const donorName = (d) => {
  if (d.is_anonymous) return 'Anonymous';
  if (d.contacts) return `${d.contacts.first_name} ${d.contacts.last_name}`;
  return d.company || 'No donor';
};

// Sortable columns → how to extract a comparable value from a registrant row.
const getSortValue = (r, key) => {
  switch (key) {
    case 'name':
      return `${r.last_name || ''} ${r.first_name || ''}`.trim().toLowerCase();
    case 'registration_date':
      return r.registration_date ? new Date(r.registration_date).getTime() : 0;
    case 'status':
      return getPaymentDisplay(r.amount_paid, r.total_cost, r.credit_memo_amount).rank;
    case 'balance':
      return computeAmountDue(r.total_cost, r.credit_memo_amount) - (Number(r.amount_paid) || 0);
    case 'credit_memo':
      return Number(r.credit_memo_amount) || 0;
    case 'total_cost':
      return Number(r.total_cost) || 0;
    case 'amount_paid':
      return Number(r.amount_paid) || 0;
    default:
      return 0;
  }
};

// Clickable table header that toggles sort on its column.
function SortHeader({ label, columnKey, sortKey, sortDir, onSort, align = 'left', thClass = '' }) {
  const active = sortKey === columnKey;
  const alignCls = align === 'right' ? 'text-right' : 'text-left';
  return (
    <th className={`py-3.5 text-sm font-semibold text-gray-900 dark:text-gray-100 ${alignCls} ${thClass}`}>
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={`group inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        <span>{label}</span>
        <span className={`text-xs ${active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`}>
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

export default function FinancialsList() {
  const [tournaments, setTournaments] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [registrants, setRegistrants] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [paymentRegistrant, setPaymentRegistrant] = useState(null);
  const [creditRegistrant, setCreditRegistrant] = useState(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [showDonationForm, setShowDonationForm] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState(null);
  const [donationToDelete, setDonationToDelete] = useState(null);

  const [activeTab, setActiveTab] = useState('registrants');

  const [statuses, setStatuses] = useState([]); // subset of ['unpaid','partial','paid']; empty = all
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('registration_date');
  const [sortDir, setSortDir] = useState('desc'); // most recent registration first by default
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Dates default newest-first; everything else defaults A→Z / low→high.
      setSortDir(key === 'registration_date' ? 'desc' : 'asc');
    }
  };

  const selectedTournament = useMemo(
    () => tournaments.find((t) => String(t.year) === String(selectedYear)) || null,
    [tournaments, selectedYear]
  );

  // Fetch tournaments and choose a default year (open registration, else latest).
  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const { data, error: tErr } = await supabase
          .from('tournaments')
          .select('id, year, registration_status')
          .is('deleted_at', null)
          .order('year', { ascending: false });
        if (tErr) throw tErr;
        setTournaments(data || []);
        if (data && data.length > 0) {
          const open = data.find((t) => t.registration_status === 'open');
          setSelectedYear(String((open || data[0]).year));
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching tournaments:', err);
        setError(err.message || 'Failed to load tournaments');
        setLoading(false);
      }
    };
    fetchTournaments();
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedTournament) return;
    setLoading(true);
    setError(null);
    try {
      const [regRes, expRes, donRes] = await Promise.all([
        supabase
          .from('admin_financials_details')
          .select('*')
          .eq('tournament_year', parseInt(selectedYear, 10)),
        supabase
          .from('expenses')
          .select('*, vendors ( id, name ), tournament_events ( id, event_name ), paid_by:contacts ( first_name, last_name )')
          .eq('tournament_id', selectedTournament.id)
          .is('deleted_at', null)
          .order('expense_date', { ascending: false }),
        supabase
          .from('donations')
          .select('*, contacts ( first_name, last_name )')
          .eq('tournament_id', selectedTournament.id)
          .is('deleted_at', null)
          .order('donation_date', { ascending: false }),
      ]);

      if (regRes.error) throw regRes.error;
      if (expRes.error) throw expRes.error;
      if (donRes.error) throw donRes.error;

      setRegistrants(regRes.data || []);
      setExpenses(expRes.data || []);
      setDonations(donRes.data || []);
    } catch (err) {
      console.error('Error fetching financials:', err);
      setError(err.message || 'Failed to load financials');
    } finally {
      setLoading(false);
    }
  }, [selectedTournament, selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Summary cards always reflect the whole year, independent of filters/search.
  const totals = useMemo(() => {
    // Amount due is net of credit memos: credited amounts are written off, not owed.
    const totalDue = registrants.reduce((s, r) => s + computeAmountDue(r.total_cost, r.credit_memo_amount), 0);
    const totalCredits = registrants.reduce((s, r) => s + (Number(r.credit_memo_amount) || 0), 0);
    // Outstanding is what's still left to collect: each registration's positive
    // balance. A registration that has paid more than it now owes (e.g. after a
    // credit memo) doesn't reduce what anyone else owes; it's reported separately.
    const balances = registrants.map(
      (r) => computeAmountDue(r.total_cost, r.credit_memo_amount) - (Number(r.amount_paid) || 0)
    );
    const outstanding = balances.reduce((s, b) => s + Math.max(b, 0), 0);
    const overpaid = balances.reduce((s, b) => s + Math.max(-b, 0), 0);
    const totalPaid = registrants.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0);
    const totalDonations = donations.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const expensesPaid = expenses.reduce((s, e) => s + (e.is_paid ? Number(e.amount) || 0 : 0), 0);
    return {
      registrations: registrants.length,
      totalDue,
      totalCredits,
      totalPaid,
      totalDonations,
      totalExpenses,
      expensesPaid,
      expensesUnpaid: totalExpenses - expensesPaid,
      outstanding,
      overpaid,
      net: totalPaid + totalDonations - totalExpenses,
    };
  }, [registrants, donations, expenses]);

  const tabs = useMemo(
    () => [
      { id: 'registrants', name: 'Registrants', count: registrants.length },
      { id: 'expenses', name: 'Expenses', count: expenses.length },
      { id: 'donations', name: 'Donations', count: donations.length },
    ],
    [registrants, expenses, donations]
  );

  // Apply status filter + search to the registrant table (not the cards).
  const filteredRegistrants = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return registrants.filter((r) => {
      const status = getPaymentDisplay(r.amount_paid, r.total_cost, r.credit_memo_amount).label.toLowerCase();
      if (statuses.length > 0 && !statuses.includes(status)) return false;
      if (term) {
        const haystack = `${r.first_name || ''} ${r.last_name || ''} ${r.email || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [registrants, statuses, searchTerm]);

  // Sort the filtered list, tie-breaking by name for stable ordering.
  const sortedRegistrants = useMemo(() => {
    const arr = [...filteredRegistrants];
    arr.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      let cmp;
      if (typeof av === 'string') cmp = av.localeCompare(bv);
      else cmp = av < bv ? -1 : av > bv ? 1 : 0;
      if (cmp === 0 && sortKey !== 'name') {
        cmp = getSortValue(a, 'name').localeCompare(getSortValue(b, 'name'));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filteredRegistrants, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRegistrants.length / PAGE_SIZE));
  const pagedRegistrants = useMemo(
    () => sortedRegistrants.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sortedRegistrants, currentPage]
  );

  // Reset to first page whenever the filter/search/sort/year changes.
  useEffect(() => {
    setCurrentPage(1);
  }, [statuses, searchTerm, sortKey, sortDir, selectedYear]);

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;
    try {
      const { error: delErr } = await supabase
        .from('expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', expenseToDelete.id);
      if (delErr) throw delErr;
      await logAudit({
        action: 'expense.deleted',
        entityType: 'expense',
        entityId: expenseToDelete.id,
        entityLabel: expenseToDelete.description,
        changes: {
          description: expenseToDelete.description,
          category: expenseToDelete.category,
          vendor: expenseToDelete.vendors?.name || null,
          amount: expenseToDelete.amount,
          expense_date: expenseToDelete.expense_date,
        },
      });
      setExpenseToDelete(null);
      await fetchData();
    } catch (err) {
      console.error('Error deleting expense:', err);
      setError(err.message || 'Failed to delete expense');
      setExpenseToDelete(null);
    }
  };

  const handleDeleteDonation = async () => {
    if (!donationToDelete) return;
    try {
      const { error: delErr } = await supabase
        .from('donations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', donationToDelete.id);
      if (delErr) throw delErr;
      await logAudit({
        action: 'donation.deleted',
        entityType: 'donation',
        entityId: donationToDelete.id,
        entityLabel: hasDonor(donationToDelete) ? donorName(donationToDelete) : donationToDelete.donation_type || 'Donation',
        changes: {
          donor: donorName(donationToDelete),
          donation_type: donationToDelete.donation_type,
          amount: donationToDelete.amount,
          donation_date: donationToDelete.donation_date,
          source: donationToDelete.source,
        },
      });
      setDonationToDelete(null);
      await fetchData();
    } catch (err) {
      console.error('Error deleting donation:', err);
      setError(err.message || 'Failed to delete donation');
      setDonationToDelete(null);
    }
  };

  if (loading && registrants.length === 0 && expenses.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading financials...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Financials</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Registration revenue, payments, donations, and expenses by tournament year
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tournament Year</label>
          <Select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-40"
          >
            {tournaments.map((t) => (
              <option key={t.id} value={t.year}>
                {t.year}{t.registration_status === 'open' ? ' (open)' : ''}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="overflow-hidden rounded-lg bg-white dark:bg-night-800 px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Registrations</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {totals.registrations}
          </dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white dark:bg-night-800 px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Amount Due</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {formatCurrency(totals.totalDue)}
          </dd>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {formatCurrency(totals.outstanding)} outstanding
            {totals.totalCredits > 0 && <> &middot; {formatCurrency(totals.totalCredits)} credited</>}
            {totals.overpaid > 0 && <> &middot; {formatCurrency(totals.overpaid)} overpaid</>}
          </p>
        </div>
        <div className="overflow-hidden rounded-lg bg-white dark:bg-night-800 px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Amount Paid</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-green-600">
            {formatCurrency(totals.totalPaid)}
          </dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white dark:bg-night-800 px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Donations</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-green-600">
            {formatCurrency(totals.totalDonations)}
          </dd>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {donations.length} {donations.length === 1 ? 'donation' : 'donations'}
          </p>
        </div>
        <div className="overflow-hidden rounded-lg bg-white dark:bg-night-800 px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Expenses</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {formatCurrency(totals.totalExpenses)}
          </dd>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {formatCurrency(totals.expensesPaid)} paid &middot;{' '}
            <span className={totals.expensesUnpaid > 0 ? 'text-amber-600 font-medium' : ''}>
              {formatCurrency(totals.expensesUnpaid)} unpaid
            </span>
          </p>
        </div>
        <div className="overflow-hidden rounded-lg bg-white dark:bg-night-800 px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Net (income &minus; expenses)</dt>
          <dd className={`mt-1 text-3xl font-semibold tracking-tight ${totals.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totals.net)}
          </dd>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            incl. {formatCurrency(totals.totalDonations)} donations &middot; {formatCurrency(totals.totalExpenses)} expenses
          </p>
        </div>
      </div>

      {/* Section tabs: the cards above always show the whole year; these switch
          which detail table is shown underneath. */}
      <div className="border-b border-gray-200 dark:border-night-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium
                ${activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:border-night-600 hover:text-gray-700 dark:text-gray-300'
                }
              `}
            >
              {tab.name}
              <span className={`ml-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                activeTab === tab.id ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400' : 'bg-gray-100 dark:bg-night-900 text-gray-900 dark:text-gray-100'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'registrants' && (
        <div className="bg-white dark:bg-night-800 shadow rounded-lg overflow-x-auto">
          <div className="px-4 py-4 sm:px-6 border-b border-gray-200 dark:border-night-700 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Registrants</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search</label>
                <input
                  type="text"
                  spellCheck={false}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Name or email..."
                  className="block w-full sm:w-56 rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>
              <div className="sm:w-48">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Payment status</label>
                <MultiSelect
                  options={[
                    { value: 'unpaid', label: 'Unpaid' },
                    { value: 'partial', label: 'Partially paid' },
                    { value: 'paid', label: 'Fully paid' },
                  ]}
                  selected={statuses}
                  onChange={setStatuses}
                  allLabel="All"
                />
              </div>
            </div>
          </div>
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50 dark:bg-night-700">
              <tr>
                <SortHeader label="Name" columnKey="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} thClass="pl-4 pr-3" />
                <SortHeader label="Registered" columnKey="registration_date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} thClass="px-3" />
                <SortHeader label="Total Cost" columnKey="total_cost" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" thClass="px-3" />
                <SortHeader label="Credit Memo" columnKey="credit_memo" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" thClass="px-3" />
                <SortHeader label="Amount Paid" columnKey="amount_paid" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" thClass="px-3" />
                <SortHeader label="Balance" columnKey="balance" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" thClass="px-3" />
                <SortHeader label="Status" columnKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} thClass="px-3" />
                <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-night-700 bg-white dark:bg-night-800">
              {pagedRegistrants.map((r) => {
                const totalCost = Number(r.total_cost) || 0;
                const paid = Number(r.amount_paid) || 0;
                const credit = Number(r.credit_memo_amount) || 0;
                const balance = computeAmountDue(totalCost, credit) - paid;
                const status = getPaymentDisplay(paid, totalCost, credit);
                return (
                  <tr key={r.registration_id} className="hover:bg-gray-50 dark:bg-night-700">
                    <td className="py-4 pl-4 pr-3 text-sm">
                      <Link
                        to={`/admin/registrations?search=${encodeURIComponent(`${r.first_name} ${r.last_name}`)}`}
                        className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:text-primary-300 hover:underline"
                      >
                        {r.first_name} {r.last_name}
                      </Link>
                      {r.has_tbd_event && (
                        <span className="ml-2 inline-flex rounded px-1.5 text-xs font-medium bg-gray-100 dark:bg-night-900 text-gray-600 dark:text-gray-400">
                          TBD
                        </span>
                      )}
                      {r.events && r.events.length > 0 && (
                        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {r.events.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(r.registration_date)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700 dark:text-gray-300 text-right">
                      {formatCurrency(totalCost)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-4 text-sm text-right ${credit > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-400'}`}
                      title={credit > 0 ? [r.credit_memo_reason, r.credit_memo_date && formatDate(r.credit_memo_date)].filter(Boolean).join(' · ') : undefined}
                    >
                      {credit > 0 ? `\u2212${formatCurrency(credit)}` : '\u2014'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700 dark:text-gray-300 text-right">
                      {formatCurrency(paid)}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-4 text-sm text-right ${balance > 0 ? 'text-red-600' : 'text-gray-500 dark:text-gray-400'}`}>
                      {formatCurrency(balance)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${status.classes}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-right">
                      <RowActionsMenu
                        label={`Actions for ${r.first_name} ${r.last_name}`}
                        items={[
                          { label: paid > 0 ? 'Edit payment' : 'Record payment', onClick: () => setPaymentRegistrant(r) },
                          { label: credit > 0 ? 'Edit credit memo' : 'Add credit memo', onClick: () => setCreditRegistrant(r) },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filteredRegistrants.length > 0 && (
              <tfoot className="bg-gray-50 dark:bg-night-700 border-t border-gray-200 dark:border-night-700">
                <tr>
                  <td className="py-3 pl-4 pr-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {statuses.length === 0 && !searchTerm ? 'Totals' : 'Filtered totals'}
                  </td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">
                    {formatCurrency(filteredRegistrants.reduce((s, r) => s + (Number(r.total_cost) || 0), 0))}
                  </td>
                  <td className="px-3 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">
                    {(() => {
                      const credits = filteredRegistrants.reduce((s, r) => s + (Number(r.credit_memo_amount) || 0), 0);
                      return credits > 0 ? `\u2212${formatCurrency(credits)}` : '\u2014';
                    })()}
                  </td>
                  <td className="px-3 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">
                    {formatCurrency(filteredRegistrants.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0))}
                  </td>
                  <td className="px-3 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">
                    {(() => {
                      const balances = filteredRegistrants.map(
                        (r) => computeAmountDue(r.total_cost, r.credit_memo_amount) - (Number(r.amount_paid) || 0)
                      );
                      const owed = balances.reduce((s, b) => s + Math.max(b, 0), 0);
                      const over = balances.reduce((s, b) => s + Math.max(-b, 0), 0);
                      return (
                        <>
                          {formatCurrency(owed)}
                          {over > 0 && (
                            <div className="text-xs font-normal text-gray-500 dark:text-gray-400">
                              {formatCurrency(over)} overpaid
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
          {filteredRegistrants.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                {registrants.length === 0
                  ? `No registrations for ${selectedYear}`
                  : 'No registrants match your filters'}
              </p>
            </div>
          )}
          {filteredRegistrants.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-gray-200 dark:border-night-700 px-4 py-3 sm:px-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredRegistrants.length)} of {filteredRegistrants.length}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-night-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 hover:bg-gray-50 dark:bg-night-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="inline-flex items-center px-2 text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-night-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-night-800 hover:bg-gray-50 dark:bg-night-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="bg-white dark:bg-night-800 shadow rounded-lg overflow-x-auto">
          <div className="px-4 py-4 sm:px-6 border-b border-gray-200 dark:border-night-700 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Expenses</h2>
            <button
              onClick={() => { setSelectedExpense(null); setShowExpenseForm(true); }}
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <svg className="h-5 w-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Expense
            </button>
          </div>
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50 dark:bg-night-700">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Date</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Description</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Category</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Vendor</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Paid By</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Method</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Status</th>
                <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">Amount</th>
                <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-night-700 bg-white dark:bg-night-800">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 dark:bg-night-700">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 dark:text-gray-400">
                    {e.expense_date ? new Date(e.expense_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {e.description}
                    {e.tournament_events?.event_name && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{e.tournament_events.event_name}</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{e.category || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {e.vendors?.name || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {e.paid_by ? `${e.paid_by.first_name} ${e.paid_by.last_name}` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{e.payment_method || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                      e.is_paid ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {e.is_paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700 dark:text-gray-300 text-right">
                    {formatCurrency(e.amount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right space-x-3">
                    <button
                      onClick={() => { setSelectedExpense(e); setShowExpenseForm(true); }}
                      className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:text-primary-300 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setExpenseToDelete(e)}
                      className="text-red-600 hover:text-red-900 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {expenses.length > 0 && (
              <tfoot className="bg-gray-50 dark:bg-night-700 border-t border-gray-200 dark:border-night-700">
                <tr>
                  <td colSpan={7} className="py-3 pl-4 pr-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Total Expenses
                  </td>
                  <td className="px-3 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">
                    {formatCurrency(totals.totalExpenses)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
          {expenses.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No expenses recorded for {selectedYear}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'donations' && (
        <div className="bg-white dark:bg-night-800 shadow rounded-lg overflow-x-auto">
          <div className="px-4 py-4 sm:px-6 border-b border-gray-200 dark:border-night-700 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Donations</h2>
            <button
              onClick={() => { setSelectedDonation(null); setShowDonationForm(true); }}
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <svg className="h-5 w-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Donation
            </button>
          </div>
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50 dark:bg-night-700">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Date</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Donor</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Type</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Method</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Source</th>
                <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">Amount</th>
                <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-night-700 bg-white dark:bg-night-800">
              {donations.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 dark:bg-night-700">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 dark:text-gray-400">
                    {d.donation_date ? new Date(d.donation_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {hasDonor(d) ? donorName(d) : <span className="italic text-gray-400">No donor</span>}
                    {d.company && !d.is_anonymous && d.contacts && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{d.company}</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{d.donation_type || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{d.payment_method || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{d.source || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700 dark:text-gray-300 text-right">
                    {formatCurrency(d.amount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right space-x-3">
                    <button
                      onClick={() => { setSelectedDonation(d); setShowDonationForm(true); }}
                      className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:text-primary-300 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDonationToDelete(d)}
                      className="text-red-600 hover:text-red-900 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {donations.length > 0 && (
              <tfoot className="bg-gray-50 dark:bg-night-700 border-t border-gray-200 dark:border-night-700">
                <tr>
                  <td colSpan={5} className="py-3 pl-4 pr-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Total Donations
                  </td>
                  <td className="px-3 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">
                    {formatCurrency(totals.totalDonations)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
          {donations.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No donations recorded for {selectedYear}</p>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {paymentRegistrant && (
        <PaymentModal
          registrant={paymentRegistrant}
          onClose={() => setPaymentRegistrant(null)}
          onSave={fetchData}
        />
      )}

      {creditRegistrant && (
        <CreditMemoModal
          registrant={creditRegistrant}
          onClose={() => setCreditRegistrant(null)}
          onSave={fetchData}
        />
      )}

      {showExpenseForm && (
        <ExpenseForm
          expense={selectedExpense}
          tournamentId={selectedTournament?.id}
          onClose={() => { setShowExpenseForm(false); setSelectedExpense(null); }}
          onSave={fetchData}
        />
      )}

      <ConfirmDialog
        isOpen={!!expenseToDelete}
        onClose={() => setExpenseToDelete(null)}
        onConfirm={handleDeleteExpense}
        title="Delete Expense"
        message={`Are you sure you want to delete "${expenseToDelete?.description}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />

      {showDonationForm && (
        <DonationForm
          donation={selectedDonation}
          tournamentId={selectedTournament?.id}
          onClose={() => { setShowDonationForm(false); setSelectedDonation(null); }}
          onSave={fetchData}
        />
      )}

      <ConfirmDialog
        isOpen={!!donationToDelete}
        onClose={() => setDonationToDelete(null)}
        onConfirm={handleDeleteDonation}
        title="Delete Donation"
        message={donationToDelete
          ? `Are you sure you want to delete the ${formatCurrency(donationToDelete.amount)} ${hasDonor(donationToDelete) ? `donation from ${donorName(donationToDelete)}` : `${(donationToDelete.donation_type || '').toLowerCase()} donation with no donor`}? This action cannot be undone.`
          : ''}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
