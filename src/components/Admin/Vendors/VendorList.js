import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { logAudit } from '../../../utils/audit';
import { formatPhone } from '../../../utils/phone';
import VendorForm from './VendorForm';
import ConfirmDialog from '../ConfirmDialog';
import Select from '../Select';

// Strip the scheme so the table shows "example.com" rather than the full URL.
const displayWebsite = (url) => (url || '').replace(/^https?:\/\//i, '').replace(/\/$/, '');

export default function VendorList() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState(null);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);

      const { data, error: fetchError } = await supabase
        .from('vendors')
        .select('*')
        .is('deleted_at', null)
        .order('name');

      if (fetchError) throw fetchError;
      setVendors(data || []);
    } catch (err) {
      console.error('Error fetching vendors:', err);
      setError('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const getCategories = () => {
    const categories = new Set(vendors.map(v => v.category).filter(Boolean));
    return Array.from(categories).sort();
  };

  const filteredVendors = vendors.filter(vendor => {
    const categoryMatch = selectedCategory === 'all' || vendor.category === selectedCategory;
    const term = searchTerm.trim().toLowerCase();
    const searchMatch = !term || [
      vendor.name,
      vendor.contact_name,
      vendor.email,
      vendor.phone,
      vendor.website,
    ].some(field => (field || '').toLowerCase().includes(term));
    return categoryMatch && searchMatch;
  });

  const handleAdd = () => {
    setSelectedVendor(null);
    setShowForm(true);
  };

  const handleEdit = (vendor) => {
    setSelectedVendor(vendor);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setSelectedVendor(null);
  };

  const handleSave = () => {
    fetchVendors();
  };

  const handleDeleteClick = (vendor) => {
    setVendorToDelete(vendor);
    setShowDeleteConfirm(true);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setVendorToDelete(null);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error: deleteError } = await supabase
        .from('vendors')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', vendorToDelete.id);

      if (deleteError) throw deleteError;

      await logAudit({
        action: 'vendor.deleted',
        entityType: 'vendor',
        entityId: vendorToDelete.id,
        entityLabel: vendorToDelete.name,
        changes: {
          name: vendorToDelete.name,
          contact_name: vendorToDelete.contact_name,
          category: vendorToDelete.category,
        },
      });

      setShowDeleteConfirm(false);
      setVendorToDelete(null);
      fetchVendors();
    } catch (err) {
      console.error('Error deleting vendor:', err);
      alert('Failed to delete vendor');
      setShowDeleteConfirm(false);
      setVendorToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading vendors...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Vendors</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Suppliers, venues and services used across tournaments
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          Add Vendor
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-night-800 p-4 rounded-lg shadow">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="vendor-search" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Search:
            </label>
            <input
              id="vendor-search"
              type="text"
              spellCheck={false}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Name, contact, email..."
              className="w-64"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="vendor-category-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Category:
            </label>
            <Select
              id="vendor-category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-56"
            >
              <option value="all">All Categories</option>
              {getCategories().map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </Select>
          </div>

          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 ml-auto">
            Showing {filteredVendors.length} vendors
          </div>
        </div>
      </div>

      {/* Vendors Table */}
      <div className="bg-white dark:bg-night-800 shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50 dark:bg-night-700">
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Vendor
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Main Contact
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Phone
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Email
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Website
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Details
              </th>
              <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-night-700 bg-white dark:bg-night-800">
            {filteredVendors.map((vendor) => (
              <tr key={vendor.id} className="hover:bg-gray-50 dark:bg-night-700">
                <td className="py-4 pl-4 pr-3 text-sm">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{vendor.name}</div>
                  {vendor.category && (
                    <span className="mt-1 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                      {vendor.category}
                    </span>
                  )}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {vendor.contact_name || '-'}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {vendor.phone ? (
                    <a href={`tel:${vendor.phone}`} className="hover:text-primary-600">
                      {formatPhone(vendor.phone)}
                    </a>
                  ) : '-'}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {vendor.email ? (
                    <a href={`mailto:${vendor.email}`} className="hover:text-primary-600">
                      {vendor.email}
                    </a>
                  ) : '-'}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {vendor.website ? (
                    <a
                      href={vendor.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {displayWebsite(vendor.website)}
                    </a>
                  ) : '-'}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                  {vendor.details || '-'}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-right space-x-3">
                  <button
                    onClick={() => handleEdit(vendor)}
                    className="text-primary-600 dark:text-primary-400 hover:text-primary-900 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteClick(vendor)}
                    className="text-red-600 hover:text-red-900 font-medium"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredVendors.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No vendors found
              {(searchTerm || selectedCategory !== 'all') && ' with selected filters'}
            </p>
          </div>
        )}
      </div>

      {/* Vendor Form Modal */}
      {showForm && (
        <VendorForm
          vendor={selectedVendor}
          onClose={handleClose}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Vendor"
        message={`Are you sure you want to delete ${vendorToDelete?.name || 'this vendor'}? Expenses linked to it keep their record. This action can be undone from the Recycle Bin.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
