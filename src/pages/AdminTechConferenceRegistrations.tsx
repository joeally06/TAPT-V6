import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Download, Search, ChevronDown, ChevronUp, Edit, Trash2, Eye, ArrowLeft } from 'lucide-react';
import ArchiveViewerModal from '../components/ArchiveViewerModal';
import { useAuth } from '../context/AuthContext';

interface TechConferenceAttendee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface TechConferenceRegistration {
  id: string;
  school_district: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  total_attendees: number;
  total_amount: number;
  created_at: string;
  attendees?: TechConferenceAttendee[];
  // Payment fields
  payment_method: string | null;
  payment_status: string | null;
  po_number: string | null;
  paypal_transaction_id: string | null;
  paypal_payer_email: string | null;
  payment_completed_at: string | null;
}

const PAGE_SIZE = 20;

const AdminTechConferenceRegistrations: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [registrations, setRegistrations] = useState<TechConferenceRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

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
  }, [authLoading, user, page]);

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from('tech_conference_registrations')
        .select(`*, attendees:tech_conference_attendees(*)`, { count: 'exact' })
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
    if (!confirm('Are you sure you want to clear all tech conference registrations? This action cannot be undone.')) {
      return;
    }

    try {
      setClearing(true);
      setError(null);
      setSuccess(null);

      // First delete all attendees
      const { error: attendeesError } = await supabase
        .from('tech_conference_attendees')
        .delete()
        .not('id', 'is', null);

      if (attendeesError) throw attendeesError;

      // Then delete all registrations
      const { error: registrationsError } = await supabase
        .from('tech_conference_registrations')
        .delete()
        .not('id', 'is', null);

      if (registrationsError) throw registrationsError;

      setSuccess('Tech conference registrations cleared successfully!');
      setRegistrations([]);
    } catch (error: any) {
      console.error('Error clearing registrations:', error);
      setError(`Failed to clear registrations: ${error.message}`);
    } finally {
      setClearing(false);
    }
  };

  const exportToCSV = () => {
    if (!registrations.length) return;

    const headers = [
      'Registration Date',
      'School District',
      'Primary Contact',
      'Email',
      'Phone',
      'Total Attendees',
      'Total Amount',
      'Additional Attendees',
      'Payment Method',
      'Payment Status',
      'PO Number',
      'PayPal Transaction ID',
      'PayPal Payer Email',
      'Payment Completed At'
    ];

    const csvData = registrations.map(reg => {
      const additionalAttendees = reg.attendees
        ? reg.attendees.map(a => `${a.first_name} ${a.last_name} (${a.email})`).join('; ')
        : '';

      return [
        new Date(reg.created_at).toLocaleDateString(),
        reg.school_district,
        `${reg.first_name} ${reg.last_name}`,
        reg.email,
        reg.phone,
        reg.total_attendees,
        `$${reg.total_amount.toFixed(2)}`,
        additionalAttendees,
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
    link.setAttribute('download', `tech-conference-registrations-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRegistrations = registrations.filter(reg => {
    const searchStr = searchTerm.toLowerCase();
    return (
      reg.school_district.toLowerCase().includes(searchStr) ||
      reg.first_name.toLowerCase().includes(searchStr) ||
      reg.last_name.toLowerCase().includes(searchStr) ||
      reg.email.toLowerCase().includes(searchStr)
    );
  });

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
            <h1 className="text-3xl font-bold">Tech Conference Registrations</h1>
          </div>
          <p className="mt-2">Manage and track tech conference registrations</p>
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
              onClick={() => setShowArchiveModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-secondary hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary"
            >
              View Archives
            </button>

            <button
              onClick={handleClearTable}
              disabled={clearing}
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
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
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
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registration Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      School District
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Primary Contact
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Attendees
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRegistrations.map((registration) => (
                    <tr key={registration.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(registration.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {registration.school_district}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {registration.first_name} {registration.last_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {registration.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {registration.total_attendees}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${registration.total_amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {/* View details */}}
                          className="text-primary hover:text-primary/80 mr-3"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => {/* Delete registration */}}
                          className="text-red-600 hover:text-red-800"
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

        <ArchiveViewerModal
          isOpen={showArchiveModal}
          onClose={() => setShowArchiveModal(false)}
          type="tech-conference"
        />
      </div>
    </div>
  );
};

export default AdminTechConferenceRegistrations;