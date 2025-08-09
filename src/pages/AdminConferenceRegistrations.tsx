import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Download, Search, Trash2, Eye, ArrowLeft, X } from 'lucide-react';
import ArchiveViewerModal from '../components/ArchiveViewerModal';
import { useAuth } from '../context/AuthContext';

interface ConferenceAttendee {
  id: string;
  registration_id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

interface ConferenceRegistration {
  id: string;
  school_district: string;
  first_name: string;
  last_name: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  email: string;
  phone: string;
  total_attendees: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
  attendees?: ConferenceAttendee[];
}

const PAGE_SIZE = 20;

const AdminConferenceRegistrations: React.FC = () => {
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [clearing, setClearing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [registrations, setRegistrations] = useState<ConferenceRegistration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<ConferenceRegistration | null>(null);
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

  const handleViewDetails = (registration: ConferenceRegistration) => {
    setSelectedRegistration(registration);
    setShowDetailsModal(true);
  };

  const handleDeleteRegistration = async (id: string) => {
    if (!confirm('Are you sure you want to delete this registration? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('conference_registrations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccess('Registration deleted successfully!');
      fetchRegistrations();
      
      // Close modal if the deleted registration was being viewed
      if (selectedRegistration?.id === id) {
        setShowDetailsModal(false);
        setSelectedRegistration(null);
      }
    } catch (error: any) {
      setError(`Failed to delete registration: ${error.message}`);
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
      'Address',
      'City',
      'State',
      'Zip Code',
      'Total Attendees',
      'Total Amount',
      'Additional Attendees'
    ];

    const csvData = registrations.map((reg: ConferenceRegistration) => {
      const additionalAttendees = reg.attendees
        ? reg.attendees.map((a: ConferenceAttendee) => `${a.first_name} ${a.last_name} (${a.email})`).join('; ')
        : '';

      return [
        new Date(reg.created_at).toLocaleDateString(),
        reg.school_district,
        `${reg.first_name} ${reg.last_name}`,
        reg.email,
        reg.phone,
        reg.street_address,
        reg.city,
        reg.state,
        reg.zip_code,
        reg.total_attendees,
        `$${reg.total_amount ? Number(reg.total_amount).toFixed(2) : '0.00'}`,
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

  // Filter registrations based on search term
  const filteredRegistrations = registrations.filter((registration: ConferenceRegistration) =>
    searchTerm === '' ||
    registration.school_district?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    registration.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    registration.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    registration.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    registration.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

        {/* Error and Success Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            {success}
          </div>
        )}

        {/* Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="mt-2 text-sm font-medium text-gray-900">No registrations found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'No registrations match your search criteria.' : 'No conference registrations have been submitted yet.'}
              </p>
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
                      Location
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
                  {filteredRegistrations.map((registration: ConferenceRegistration) => (
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
                        <div>{registration.city}, {registration.state}</div>
                        <div className="text-xs text-gray-400">{registration.zip_code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {registration.total_attendees}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${registration.total_amount ? Number(registration.total_amount).toFixed(2) : '0.00'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleViewDetails(registration)}
                          className="text-primary hover:text-primary/80 mr-3"
                          title="View Details"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRegistration(registration.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete Registration"
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

        <ArchiveViewerModal
          isOpen={showArchiveModal}
          onClose={() => setShowArchiveModal(false)}
          type="conference"
        />

        {/* Registration Details Modal */}
        {showDetailsModal && selectedRegistration && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-bold text-secondary">
                  Conference Registration Details
                </h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              {/* Registration Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">Primary Contact</h4>
                  <div className="bg-gray-50 p-4 rounded-md space-y-2">
                    <p><span className="font-medium">Name:</span> {selectedRegistration.first_name} {selectedRegistration.last_name}</p>
                    <p><span className="font-medium">Email:</span> {selectedRegistration.email}</p>
                    <p><span className="font-medium">Phone:</span> {selectedRegistration.phone}</p>
                    <p><span className="font-medium">School District:</span> {selectedRegistration.school_district}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">Address Information</h4>
                  <div className="bg-gray-50 p-4 rounded-md space-y-2">
                    <p><span className="font-medium">Street:</span> {selectedRegistration.street_address}</p>
                    <p><span className="font-medium">City:</span> {selectedRegistration.city}</p>
                    <p><span className="font-medium">State:</span> {selectedRegistration.state}</p>
                    <p><span className="font-medium">Zip Code:</span> {selectedRegistration.zip_code}</p>
                  </div>
                </div>
              </div>

              {/* Registration Details */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-700 mb-3">Registration Details</h4>
                <div className="bg-gray-50 p-4 rounded-md grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p><span className="font-medium">Total Attendees:</span> {selectedRegistration.total_attendees}</p>
                  </div>
                  <div>
                    <p><span className="font-medium">Total Amount:</span> ${selectedRegistration.total_amount ? Number(selectedRegistration.total_amount).toFixed(2) : '0.00'}</p>
                  </div>
                  <div>
                    <p><span className="font-medium">Registration Date:</span> {new Date(selectedRegistration.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Attendees List */}
              {selectedRegistration.attendees && selectedRegistration.attendees.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-700 mb-3">Conference Attendees ({selectedRegistration.attendees.length})</h4>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="grid gap-3">
                      {selectedRegistration.attendees.map((attendee: ConferenceAttendee, index: number) => (
                        <div key={attendee.id} className="flex items-center justify-between py-2 px-3 bg-white rounded border">
                          <div>
                            <span className="font-medium">{index + 1}. {attendee.first_name} {attendee.last_name}</span>
                            <span className="text-gray-500 ml-2">({attendee.email})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Action buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    // Export single registration to CSV
                    const headers = ['Registration Date', 'School District', 'Primary Contact', 'Email', 'Phone', 'Address', 'City', 'State', 'Zip Code', 'Total Attendees', 'Total Amount', 'Attendees'];
                    const attendeesList = selectedRegistration.attendees?.map(a => `${a.first_name} ${a.last_name} (${a.email})`).join('; ') || '';
                    const csvData = [
                      [
                        new Date(selectedRegistration.created_at).toLocaleDateString(),
                        selectedRegistration.school_district,
                        `${selectedRegistration.first_name} ${selectedRegistration.last_name}`,
                        selectedRegistration.email,
                        selectedRegistration.phone,
                        selectedRegistration.street_address,
                        selectedRegistration.city,
                        selectedRegistration.state,
                        selectedRegistration.zip_code,
                        selectedRegistration.total_attendees,
                        `$${selectedRegistration.total_amount ? Number(selectedRegistration.total_amount).toFixed(2) : '0.00'}`,
                        attendeesList
                      ]
                    ];
                    
                    const csvContent = [
                      headers.join(','),
                      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
                    ].join('\n');
                    
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `conference-registration-${selectedRegistration.first_name}-${selectedRegistration.last_name}.csv`;
                    link.click();
                  }}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Export This Registration
                </button>
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

export default AdminConferenceRegistrations;

export { AdminConferenceRegistrations }