import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Search, CheckCircle, XCircle, Eye, AlertCircle, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';

interface MembershipApplication {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  organization: string;
  position: string;
  membership_type: string;
  is_new_member: string;
  hear_about_us: string;
  interests: string[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export const AdminMemberships: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState<MembershipApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedApplication, setSelectedApplication] = useState<MembershipApplication | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

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
      fetchApplications();
    }
    // eslint-disable-next-line
  }, [authLoading, user]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('membership_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error: any) {
      console.error('Error fetching applications:', error);
      setError('Failed to load membership applications');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (applicationId: string, newStatus: 'approved' | 'rejected') => {
    try {
      setError(null);
      setSuccess(null);
      
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error(`Session error: ${sessionError.message}`);
      }
      
      if (!session || !session.access_token) {
        throw new Error('No active session');
      }
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not defined');
      }
      
      console.log(`Updating application ${applicationId} status to ${newStatus}`);
      
      // Use Edge Function for secure status update
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-membership-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id: applicationId, status: newStatus })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      }

      setApplications(prev => 
        prev.map(app => 
          app.id === applicationId ? { ...app, status: newStatus } : app
        )
      );

      setSuccess(`Application ${newStatus} successfully`);
    } catch (error: any) {
      console.error('Error updating application status:', error);
      setError(`Error updating application status: ${error.message}`);
    }
  };

  const handleDeleteApplication = async (applicationId: string) => {
    if (!confirm('Are you sure you want to delete this membership application? This action cannot be undone.')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error(`Session error: ${sessionError.message}`);
      }
      
      if (!session || !session.access_token) {
        throw new Error('No active session');
      }
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not defined');
      }
      
      console.log(`Deleting application ${applicationId}`);
      
      // Use Edge Function for secure deletion
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-membership-status`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id: applicationId })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      }

      // Remove the deleted application from state
      setApplications(prev => prev.filter(app => app.id !== applicationId));
      
      // If the deleted application was selected, close the modal
      if (selectedApplication?.id === applicationId) {
        setSelectedApplication(null);
        setShowDetailsModal(false);
      }

      setSuccess('Application deleted successfully');
    } catch (error: any) {
      console.error('Error deleting application:', error);
      setError(`Error deleting application: ${error.message}`);
    }
  };

  const exportToPDF = async () => {
    try {
      // Filter approved applications
      const approvedApplications = applications.filter(app => app.status === 'approved');
      
      if (approvedApplications.length === 0) {
        setError('No approved applications to export');
        return;
      }

      // Create new PDF document
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      
      // Add title
      doc.setFontSize(18);
      doc.text('TAPT Approved Membership Applications', 14, 20);
      
      // Add date
      doc.setFontSize(12);
      doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);

      // Define the columns
      const columns = [
        'Name',
        'Organization',
        'Position',
        'Email',
        'Phone',
        'Type',
        'Approval Date'
      ];

      // Prepare the data
      const data = approvedApplications.map(app => [
        `${app.first_name} ${app.last_name}`,
        app.organization,
        app.position,
        app.email,
        app.phone,
        app.membership_type,
        new Date(app.created_at).toLocaleDateString()
      ]);

      // Add the table using autoTable
      autoTable(doc, {
        head: [columns],
        body: data,
        startY: 40,
        styles: {
          fontSize: 10,
          cellPadding: 3
        },
        headStyles: {
          fillColor: [71, 32, 183], // Primary color
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 247]
        }
      });

      // Save the PDF
      doc.save(`tapt-approved-members-${new Date().toISOString().split('T')[0]}.pdf`);
      
      setSuccess('PDF exported successfully');
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      setError('Failed to export PDF: ' + error.message);
    }
  };

  const filteredApplications = applications.filter(app => {
    const matchesSearch = searchTerm === '' || 
      `${app.first_name} ${app.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.organization.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filter === 'all' || app.status === filter;
    
    return matchesSearch && matchesFilter;
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
            <h1 className="text-3xl font-bold">Membership Applications</h1>
          </div>
          <p className="mt-2">Review and manage membership applications</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
          
          <div className="flex gap-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            >
              <option value="all">All Applications</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            <button
              onClick={exportToPDF}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              <Download className="h-5 w-5 mr-2" />
              Export Approved
            </button>
          </div>
        </div>

        {/* Applications Table */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
              <p className="mt-2 text-gray-600">Loading applications...</p>
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No applications found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Organization
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredApplications.map((application) => (
                    <tr key={application.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {application.first_name} {application.last_name}
                        </div>
                        <div className="text-sm text-gray-500">{application.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {application.organization}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {application.membership_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          application.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : application.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {application.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(application.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedApplication(application);
                            setShowDetailsModal(true);
                          }}
                          className="text-primary hover:text-primary/80 mr-3"
                          title="View details"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        {application.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(application.id, 'approved')}
                              className="text-green-600 hover:text-green-800 mr-3"
                              title="Approve application"
                            >
                              <CheckCircle className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleStatusChange(application.id, 'rejected')}
                              className="text-red-600 hover:text-red-800 mr-3"
                              title="Reject application"
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteApplication(application.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete application"
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

        {/* Details Modal */}
        {showDetailsModal && selectedApplication && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full mx-4 p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-secondary">Application Details</h3>
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
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-500">Name</h4>
                  <p className="mt-1">{selectedApplication.first_name} {selectedApplication.last_name}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-500">Email</h4>
                  <p className="mt-1">{selectedApplication.email}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-500">Phone</h4>
                  <p className="mt-1">{selectedApplication.phone}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-500">Organization</h4>
                  <p className="mt-1">{selectedApplication.organization}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-500">Position</h4>
                  <p className="mt-1">{selectedApplication.position}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-500">Membership Type</h4>
                  <p className="mt-1">{selectedApplication.membership_type}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-500">New Member</h4>
                  <p className="mt-1">{selectedApplication.is_new_member}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-500">Heard About Us</h4>
                  <p className="mt-1">{selectedApplication.hear_about_us}</p>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-medium text-gray-500">Areas of Interest</h4>
                <ul className="mt-1 list-disc list-inside">
                  {selectedApplication.interests.map((interest, index) => (
                    <li key={index}>{interest}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 flex justify-between">
                <div className="flex space-x-3">
                  {selectedApplication.status === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          handleStatusChange(selectedApplication.id, 'approved');
                          setShowDetailsModal(false);
                        }}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="mr-2 h-5 w-5" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          handleStatusChange(selectedApplication.id, 'rejected');
                          setShowDetailsModal(false);
                        }}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                      >
                        <XCircle className="mr-2 h-5 w-5" />
                        Reject
                      </button>
                    </>
                  )}
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      handleDeleteApplication(selectedApplication.id);
                      setShowDetailsModal(false);
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                  >
                    <Trash2 className="mr-2 h-5 w-5" />
                    Delete
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
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMemberships;