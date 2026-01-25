import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Download, Search, ChevronDown, ChevronUp, Edit, Trash2, Eye, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ExhibitorRegistration {
  id: string;
  business_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  mobile_phone: string | null;
  street_address: string;
  street_address2: string | null;
  city: string;
  state: string;
  zip_code: string;
  booth_requirements: string | null;
  products_description: string | null;
  additional_comments: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  // Payment fields
  payment_method: string | null;
  payment_status: string | null;
  po_number: string | null;
  paypal_transaction_id: string | null;
  paypal_payer_email: string | null;
  payment_completed_at: string | null;
}

const PAGE_SIZE = 20;

const AdminExhibitorRegistrations: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [registrations, setRegistrations] = useState<ExhibitorRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedRegistration, setSelectedRegistration] = useState<ExhibitorRegistration | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [sortField, setSortField] = useState<keyof ExhibitorRegistration>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/admin/login');
        return;
      }
      if (user.role !== 'admin') {
        navigate('/');
        return;
      }
      fetchRegistrations();
    }
    // eslint-disable-next-line
  }, [authLoading, user, page, sortField, sortDirection]);

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from('exhibitor_registrations')
        .select('*', { count: 'exact' })
        .order(sortField, { ascending: sortDirection === 'asc' })
        .range(from, to);

      if (error) throw error;
      setRegistrations(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error('Error fetching registrations:', error);
      setError('Failed to load registrations');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleClearTable = async () => {
    if (!confirm('Are you sure you want to clear all exhibitor registrations? This action cannot be undone.')) {
      return;
    }

    try {
      setClearing(true);
      setError(null);
      setSuccess(null);

      // Get the Supabase URL from environment variables
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not defined');
      }

      // Call the Edge Function to clear registrations
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-exhibitor-registrations`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify({ clear: true })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear exhibitor registrations');
      }

      setSuccess('Exhibitor registrations cleared successfully!');
      setRegistrations([]);
      setTotalCount(0);
    } catch (error: any) {
      console.error('Error clearing registrations:', error);
      setError(`Failed to clear registrations: ${error.message}`);
    } finally {
      setClearing(false);
    }
  };

  const handleSort = (field: keyof ExhibitorRegistration) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDeleteRegistration = async (id: string) => {
    if (!confirm('Are you sure you want to delete this registration?')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      // Get the Supabase URL from environment variables
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not defined');
      }

      // Call the Edge Function to delete registration
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-exhibitor-registrations`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify({ id })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete exhibitor registration');
      }

      setSuccess('Registration deleted successfully!');
      
      // Remove the deleted registration from the list
      setRegistrations(prev => prev.filter(reg => reg.id !== id));
      setTotalCount(prev => prev - 1);
      
      // Close the modal if the deleted registration was being viewed
      if (selectedRegistration?.id === id) {
        setSelectedRegistration(null);
        setShowDetailsModal(false);
      }
    } catch (error: any) {
      console.error('Error deleting registration:', error);
      setError(`Failed to delete registration: ${error.message}`);
    }
  };

  const exportToCSV = () => {
    if (!registrations.length) return;

    const headers = [
      'Business Name',
      'Contact Name',
      'Email',
      'Phone',
      'Mobile Phone',
      'Address',
      'City',
      'State',
      'ZIP',
      'Booth Requirements',
      'Products Description',
      'Additional Comments',
      'Registration Date',
      'Payment Method',
      'Payment Status',
      'PO Number',
      'PayPal Transaction ID',
      'PayPal Payer Email',
      'Payment Completed At'
    ];

    const csvData = registrations.map(reg => {
      return [
        reg.business_name,
        `${reg.first_name} ${reg.last_name}`,
        reg.email,
        reg.phone,
        reg.mobile_phone || '',
        `${reg.street_address}${reg.street_address2 ? ', ' + reg.street_address2 : ''}`,
        reg.city,
        reg.state,
        reg.zip_code,
        reg.booth_requirements || '',
        reg.products_description || '',
        reg.additional_comments || '',
        new Date(reg.created_at).toLocaleDateString(),
        reg.payment_method || '',
        reg.payment_status || '',
        reg.po_number || '',
        reg.paypal_transaction_id || '',
        reg.paypal_payer_email || '',
        reg.payment_completed_at ? new Date(reg.payment_completed_at).toLocaleString() : ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `exhibitor-registrations-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRegistrations = registrations.filter(reg => {
    const searchStr = searchTerm.toLowerCase();
    return (
      reg.business_name.toLowerCase().includes(searchStr) ||
      reg.first_name.toLowerCase().includes(searchStr) ||
      reg.last_name.toLowerCase().includes(searchStr) ||
      reg.email.toLowerCase().includes(searchStr) ||
      (reg.products_description && reg.products_description.toLowerCase().includes(searchStr))
    );
  });

  const SortIcon = ({ field }: { field: keyof ExhibitorRegistration }) => {
    if (field !== sortField) return null;
    return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  return (
    <div className="pt-16">
      {/* Hero Section */}
      <section className="bg-secondary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate('/admin')}
              className="inline-flex items-center text-white hover:text-gray-200 transition-colors"
            >
              <ArrowLeft className="h-6 w-6 mr-2" />
              Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold">Exhibitor Registrations</h1>
          </div>
          <p className="mt-2">Manage and track exhibitor registrations</p>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4">
            <p className="text-green-700">{success}</p>
          </div>
        )}

        {/* Controls */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search registrations..."
              value={searchTerm}
              onChange={handleSearch}
              className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={handleClearTable}
              disabled={clearing || registrations.length === 0}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              {clearing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-5 w-5" />
                  Clear All
                </>
              )}
            </button>

            <button
              onClick={exportToCSV}
              disabled={registrations.length === 0}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              <Download className="h-5 w-5 mr-2" />
              Export to CSV
            </button>
          </div>
        </div>

        {/* Registrations Table */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
              <p className="mt-2 text-gray-600">Loading registrations...</p>
            </div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No registrations found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('business_name')}
                    >
                      <div className="flex items-center">
                        Business Name
                        <SortIcon field="business_name" />
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('last_name')}
                    >
                      <div className="flex items-center">
                        Contact
                        <SortIcon field="last_name" />
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('email')}
                    >
                      <div className="flex items-center">
                        Email
                        <SortIcon field="email" />
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('created_at')}
                    >
                      <div className="flex items-center">
                        Registration Date
                        <SortIcon field="created_at" />
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRegistrations.map((registration) => (
                    <tr key={registration.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {registration.business_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {registration.first_name} {registration.last_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {registration.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {registration.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(registration.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedRegistration(registration);
                            setShowDetailsModal(true);
                          }}
                          className="text-primary hover:text-primary/80 mr-3"
                          title="View details"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRegistration(registration.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete registration"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        <div className="flex justify-between items-center mt-4">
          <div>
            Showing {registrations.length ? (page - 1) * PAGE_SIZE + 1 : 0}
            -{(page - 1) * PAGE_SIZE + registrations.length} of {totalCount}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
            >
              Previous
            </button>
            <span>Page {page}</span>
            <button
              onClick={() => setPage((p) => (p * PAGE_SIZE < totalCount ? p + 1 : p))}
              disabled={page * PAGE_SIZE >= totalCount}
              className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        {/* Details Modal */}
        {showDetailsModal && selectedRegistration && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-secondary">Registration Details</h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Business Information</h4>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-lg font-semibold text-gray-900">{selectedRegistration.business_name}</p>
                    <p className="text-gray-600 mt-2">
                      {selectedRegistration.street_address}
                      {selectedRegistration.street_address2 && <span>, {selectedRegistration.street_address2}</span>}
                      <br />
                      {selectedRegistration.city}, {selectedRegistration.state} {selectedRegistration.zip_code}
                    </p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Contact Information</h4>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedRegistration.first_name} {selectedRegistration.last_name}
                    </p>
                    <p className="text-gray-600 mt-1">
                      <a href={`mailto:${selectedRegistration.email}`} className="text-primary hover:underline">
                        {selectedRegistration.email}
                      </a>
                    </p>
                    <p className="text-gray-600 mt-1">
                      <span className="font-medium">Phone:</span> {selectedRegistration.phone}
                    </p>
                    {selectedRegistration.mobile_phone && (
                      <p className="text-gray-600 mt-1">
                        <span className="font-medium">Mobile:</span> {selectedRegistration.mobile_phone}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="font-medium text-gray-700 mb-2">Booth Requirements</h4>
                <div className="bg-gray-50 p-4 rounded-md">
                  {selectedRegistration.booth_requirements ? (
                    <p className="text-gray-700">{selectedRegistration.booth_requirements}</p>
                  ) : (
                    <p className="text-gray-500 italic">No specific requirements provided</p>
                  )}
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="font-medium text-gray-700 mb-2">Products/Services Description</h4>
                <div className="bg-gray-50 p-4 rounded-md">
                  {selectedRegistration.products_description ? (
                    <p className="text-gray-700">{selectedRegistration.products_description}</p>
                  ) : (
                    <p className="text-gray-500 italic">No description provided</p>
                  )}
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="font-medium text-gray-700 mb-2">Additional Comments</h4>
                <div className="bg-gray-50 p-4 rounded-md">
                  {selectedRegistration.additional_comments ? (
                    <p className="text-gray-700">{selectedRegistration.additional_comments}</p>
                  ) : (
                    <p className="text-gray-500 italic">No additional comments</p>
                  )}
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="font-medium text-gray-700 mb-2">Registration Information</h4>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-gray-600">
                    <span className="font-medium">Registration Date:</span> {new Date(selectedRegistration.created_at).toLocaleString()}
                  </p>
                  {selectedRegistration.updated_at && selectedRegistration.updated_at !== selectedRegistration.created_at && (
                    <p className="text-gray-600 mt-1">
                      <span className="font-medium">Last Updated:</span> {new Date(selectedRegistration.updated_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => handleDeleteRegistration(selectedRegistration.id)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="mr-2 h-5 w-5" />
                  Delete Registration
                </button>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminExhibitorRegistrations;