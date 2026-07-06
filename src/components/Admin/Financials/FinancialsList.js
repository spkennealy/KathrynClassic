import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../supabaseClient';
import ExpenseForm from './ExpenseForm';
import ConfirmDialog from '../ConfirmDialog';

const formatCurrency = (value) =>
  (Number(value) || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });

const todayStr = () => new Date().toISOString().split('T')[0];

// Derive a display status from amount_paid vs total cost.
const getPaymentDisplay = (amountPaid, totalCost) => {
  const paid = Number(amountPaid) || 0;
  const total = Number(totalCost) || 0;
  if (paid >= total && total > 0) return { label: 'Paid', classes: 'bg-green-100 text-green-800', rank: 2 };
  if (paid > 0) return { label: 'Partial', classes: 'bg-amber-100 text-amber-800', rank: 1 };
  return { label: 'Unpaid', classes: 'bg-yellow-100 text-yellow-800', rank: 0 };
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

// Sortable columns → how to extract a comparable value from a registrant row.
const getSortValue = (r, key) => {
  switch (key) {
    case 'name':
      return `${r.last_name || ''} ${r.first_name || ''}`.trim().toLowerCase();
    case 'registration_date':
      return r.registration_date ? new Date(r.registration_date).getTime() : 0;
    case 'status':
      return getPaymentDisplay(r.amount_paid, r.total_cost).rank;
    case 'balance':
      return (Number(r.total_cost) || 0) - (Number(r.amount_paid) || 0);
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

// --- Record Payment modal ---
function PaymentModal({ registrant, onClose, onSave }) {
  const totalCost = Number(registrant.total_cost) || 0;
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
    const payment_status = paid >= totalCost && totalCost > 0
      ? 'paid'
      : paid > 0
        ? 'partially_paid'
        : 'pending';
    try {
      const { error: updateError } = await supabase
        .from('registrations')
        .update({
          amount_paid: paid,
          payment_date: paid > 0 ? paymentDate : null,
          notes: notes.trim() || null,
          payment_status,
        })
        .eq('id', registrant.registration_id);
      if (updateError) throw updateError;
      onSave();
      onClose();
    } catch (err) {
      console.error('Error recording payment:', err);
      setError(err.message || 'Failed to record payment');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-night-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-night-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Record Payment</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {registrant.first_name} {registrant.last_name} &middot; Total {formatCurrency(totalCost)}
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
              onClick={() => setAmountPaid(String(totalCost))}
              className="mt-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:text-primary-300"
            >
              Set to total ({formatCurrency(totalCost)})
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
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
            onClick={() => save(totalCost)}
            disabled={loading || totalCost <= 0}
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
    </div>
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
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [expenseToDelete, setExpenseToDelete] = useState(null);

  const [statusFilter, setStatusFilter] = useState('all'); // all | unpaid | partial | paid
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
          .select('*')
          .eq('tournament_id', selectedTournament.id)
          .is('deleted_at', null)
          .order('expense_date', { ascending: false }),
        supabase
          .from('donations')
          .select('id, amount, created_at, tournament_id'),
      ]);

      if (regRes.error) throw regRes.error;
      if (expRes.error) throw expRes.error;
      if (donRes.error) throw donRes.error;

      setRegistrants(regRes.data || []);
      setExpenses(expRes.data || []);

      // Attribute donations to the year: by tournament_id, or by created_at year for legacy rows.
      const yearNum = parseInt(selectedYear, 10);
      const filteredDonations = (donRes.data || []).filter((d) =>
        d.tournament_id
          ? d.tournament_id === selectedTournament.id
          : new Date(d.created_at).getFullYear() === yearNum
      );
      setDonations(filteredDonations);
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
    const totalDue = registrants.reduce((s, r) => s + (Number(r.total_cost) || 0), 0);
    const totalPaid = registrants.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0);
    const totalDonations = donations.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return {
      registrations: registrants.length,
      totalDue,
      totalPaid,
      totalDonations,
      totalExpenses,
      outstanding: totalDue - totalPaid,
      net: totalPaid + totalDonations - totalExpenses,
    };
  }, [registrants, donations, expenses]);

  // Apply status filter + search to the registrant table (not the cards).
  const filteredRegistrants = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return registrants.filter((r) => {
      const status = getPaymentDisplay(r.amount_paid, r.total_cost).label.toLowerCase();
      if (statusFilter !== 'all') {
        if (statusFilter === 'unpaid' && status !== 'unpaid') return false;
        if (statusFilter === 'partial' && status !== 'partial') return false;
        if (statusFilter === 'paid' && status !== 'paid') return false;
      }
      if (term) {
        const haystack = `${r.first_name || ''} ${r.last_name || ''} ${r.email || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [registrants, statusFilter, searchTerm]);

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
  }, [statusFilter, searchTerm, sortKey, sortDir, selectedYear]);

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;
    try {
      const { error: delErr } = await supabase
        .from('expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', expenseToDelete.id);
      if (delErr) throw delErr;
      setExpenseToDelete(null);
      await fetchData();
    } catch (err) {
      console.error('Error deleting expense:', err);
      setError(err.message || 'Failed to delete expense');
      setExpenseToDelete(null);
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
            Registration revenue, payments, and expenses by tournament year
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tournament Year</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="block rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          >
            {tournaments.map((t) => (
              <option key={t.id} value={t.year}>
                {t.year}{t.registration_status === 'open' ? ' (open)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
          </p>
        </div>
        <div className="overflow-hidden rounded-lg bg-white dark:bg-night-800 px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Amount Paid</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-green-600">
            {formatCurrency(totals.totalPaid)}
          </dd>
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

      {/* Registrants table */}
      <div className="bg-white dark:bg-night-800 shadow rounded-lg overflow-x-auto">
        <div className="px-4 py-4 sm:px-6 border-b border-gray-200 dark:border-night-700 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Registrants</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Name or email..."
                className="block w-full sm:w-56 rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Payment status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-night-600 shadow-sm dark:bg-night-700 dark:text-gray-100 dark:placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="all">All</option>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partially paid</option>
                <option value="paid">Fully paid</option>
              </select>
            </div>
          </div>
        </div>
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50 dark:bg-night-700">
            <tr>
              <SortHeader label="Name" columnKey="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} thClass="pl-4 pr-3" />
              <SortHeader label="Registered" columnKey="registration_date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} thClass="px-3" />
              <SortHeader label="Total Cost" columnKey="total_cost" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" thClass="px-3" />
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
              const balance = totalCost - paid;
              const status = getPaymentDisplay(paid, totalCost);
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
                    <button
                      onClick={() => setPaymentRegistrant(r)}
                      className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:text-primary-300 font-medium"
                    >
                      Record Payment
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {filteredRegistrants.length > 0 && (
            <tfoot className="bg-gray-50 dark:bg-night-700 border-t border-gray-200 dark:border-night-700">
              <tr>
                <td className="py-3 pl-4 pr-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {statusFilter === 'all' && !searchTerm ? 'Totals' : 'Filtered totals'}
                </td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">
                  {formatCurrency(filteredRegistrants.reduce((s, r) => s + (Number(r.total_cost) || 0), 0))}
                </td>
                <td className="px-3 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">
                  {formatCurrency(filteredRegistrants.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0))}
                </td>
                <td className="px-3 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">
                  {formatCurrency(filteredRegistrants.reduce((s, r) => s + ((Number(r.total_cost) || 0) - (Number(r.amount_paid) || 0)), 0))}
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

      {/* Expenses */}
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
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Method</th>
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
                <td className="px-3 py-4 text-sm text-gray-900 dark:text-gray-100">{e.description}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{e.category || '—'}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{e.vendor || '—'}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{e.payment_method || '—'}</td>
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
                <td colSpan={5} className="py-3 pl-4 pr-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
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

      {/* Modals */}
      {paymentRegistrant && (
        <PaymentModal
          registrant={paymentRegistrant}
          onClose={() => setPaymentRegistrant(null)}
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
    </div>
  );
}
