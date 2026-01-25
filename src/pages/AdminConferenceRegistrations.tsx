import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Download, Search, ChevronDown, ChevronUp, Edit, Trash2, Eye, ArrowLeft } from 'lucide-react';
import ArchiveViewerModal from '../components/ArchiveViewerModal';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 20;

const AdminConferenceRegistrations: React.FC = () => {
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [clearing, setClearing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Refactor: Use Edge Function for clearing all conference registrations
  const handleClearTable = async () => {
    setClearing(true);
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-conference-registrations`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify({ clear: true })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to clear conference registrations');
      }
      setSuccess('All conference registrations cleared successfully!');
      fetchRegistrations();
    } catch (error: any) {
      setError(`Failed to clear conference registrations: ${error.message}`);
    } finally {
      setClearing(false);
    }
  };

  const exportToCSV = () => {
    if (!registrations.length) return;

    const headers = [
      'Registration Date',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'School District',
      'Job Title',
      'Total Attendees',
      'Total Amount',
      'Payment Method',
      'Payment Status',
      'PO Number',
      'PayPal Transaction ID',
      'PayPal Payer Email',
      'Payment Completed At',
      'Additional Attendees'
    ];

    const csvData = registrations.map((reg: any) => {
      const additionalAttendees = reg.attendees
        ? reg.attendees.map((a: any) => `${a.first_name} ${a.last_name} (${a.email})`).join('; ')
        : '';

      return [
        new Date(reg.created_at).toLocaleDateString(),
        reg.first_name || '',
        reg.last_name || '',
        reg.email || '',
        reg.phone || '',
        reg.school_district || '',
        reg.job_title || '',
        reg.total_attendees || 0,
        `$${(reg.total_amount || 0).toFixed(2)}`,
        reg.payment_method || '',
        reg.payment_status || '',
        reg.po_number || '',
        reg.paypal_transaction_id || '',
        reg.paypal_payer_email || '',
        reg.payment_completed_at ? new Date(reg.payment_completed_at).toLocaleString() : '',
        additionalAttendees
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
    link.setAttribute('download', `conference-registrations-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
        .from('conference_registrations')
        .select(`*, attendees:conference_attendees(*)`, { count: 'exact' })
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
            <h1 className="text-3xl font-bold">Conference Registrations</h1>
          </div>
          <p className="mt-2">Manage and track conference registrations</p>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        {/* Table content would go here */}

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

        <ArchiveViewerModal
          isOpen={showArchiveModal}
          onClose={() => setShowArchiveModal(false)}
          type="conference"
        />
      </div>
    </div>
  );
};

export default AdminConferenceRegistrations;

export { AdminConferenceRegistrations }