import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Download, Search, ChevronDown, ChevronUp, Trash2, Eye, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import AdminLayout from '../components/AdminLayout';

interface ScholarshipApplication {
  id: string;
  full_name: {
    first: string;
    last: string;
  };
  email: string;
  high_school: string;
  school_district: string;
  major_area: string;
  application_status: string;
  created_at: string;
}

const PAGE_SIZE = 20;

const AdminStudentScholarshipApplications: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState<ScholarshipApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedApplication, setSelectedApplication] = useState<ScholarshipApplication | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [sortField, setSortField] = useState<keyof ScholarshipApplication>('created_at');
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
      fetchApplications();
    }
    // eslint-disable-next-line
  }, [authLoading, user, page, sortField, sortDirection]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      // For sorting by name, we need special handling since it's in a JSONB field
      let orderBy = sortField;
      if (sortField === 'full_name') {
        orderBy = 'full_name->last';
      }
      
      const { data, error, count } = await supabase
        .from('student_scholarship_applications')
        .select('*', { count: 'exact' })
        .order(orderBy as string, { ascending: sortDirection === 'asc' })
        .range(from, to);

      if (error) throw error;
      setApplications(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error('Error fetching applications:', error);
      setError('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleClearTable = async () => {
    if (!confirm('Are you sure you want to clear all scholarship applications? This action cannot be undone.')) {
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

      // Call the Edge Function to clear applications
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-student-scholarship-applications`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify({ clear: true })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear scholarship applications');
      }

      setSuccess('Scholarship applications cleared successfully!');
      setApplications([]);
      setTotalCount(0);
    } catch (error: any) {
      console.error('Error clearing applications:', error);
      setError(`Failed to clear applications: ${error.message}`);
    } finally {
      setClearing(false);
    }
  };

  const handleSort = (field: keyof ScholarshipApplication) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDeleteApplication = async (id: string) => {
    if (!confirm('Are you sure you want to delete this application?')) {
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

      // Call the Edge Function to delete application
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-student-scholarship-applications`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify({ id })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete scholarship application');
      }

      setSuccess('Application deleted successfully!');
      
      // Remove the deleted application from the list
      setApplications(prev => prev.filter(app => app.id !== id));
      setTotalCount(prev => prev - 1);
      
      // Close the modal if the deleted application was being viewed
      if (selectedApplication?.id === id) {
        setSelectedApplication(null);
        setShowDetailsModal(false);
      }
    } catch (error: any) {
      console.error('Error deleting application:', error);
      setError(`Failed to delete application: ${error.message}`);
    }
  };

  const exportToPDF = () => {
    if (!applications.length) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 14;
    const maxLineWidth = pageWidth - 2 * margin;
    
    // Add title
    doc.setFontSize(18);
    doc.text('Student Scholarship Applications', margin, 20);
    
    // Add date
    doc.setFontSize(12);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, 30);

    // Define the columns for the summary table
    const columns = [
      'Name',
      'High School',
      'School District',
      'Major',
      'Status',
      'Date'
    ];

    // Prepare the summary data
    const data = applications.map(app => [
      `${app.full_name.first} ${app.full_name.last}`,
      app.high_school,
      app.school_district,
      app.major_area || 'Not specified',
      app.application_status,
      new Date(app.created_at).toLocaleDateString()
    ]);

    // Add the summary table using the imported autoTable function
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
    doc.save(`scholarship-applications-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const filteredApplications = applications.filter(app => {
    const searchStr = searchTerm.toLowerCase();
    return (
      app.full_name.first.toLowerCase().includes(searchStr) ||
      app.full_name.last.toLowerCase().includes(searchStr) ||
      app.email.toLowerCase().includes(searchStr) ||
      app.high_school.toLowerCase().includes(searchStr) ||
      app.school_district.toLowerCase().includes(searchStr) ||
      (app.major_area && app.major_area.toLowerCase().includes(searchStr))
    );
  });

  const SortIcon = ({ field }: { field: keyof ScholarshipApplication }) => {
    if (field !== sortField) return null;
    return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Student Scholarship Applications</h1>
          <p className="mt-1 text-gray-600">Manage and review scholarship applications</p>
        </div>

        {/* Main Content */}
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
              placeholder="Search applications..."
              value={searchTerm}
              onChange={handleSearch}
              className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={handleClearTable}
              disabled={clearing || applications.length === 0}
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
              onClick={exportToPDF}
              disabled={applications.length === 0}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              <Download className="h-5 w-5 mr-2" />
              Export to PDF
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
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Applications Found</h3>
              <p className="mt-1 text-gray-500">
                {searchTerm ? 'No applications match your search criteria.' : 'There are no scholarship applications yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('full_name')}
                    >
                      <div className="flex items-center">
                        Applicant Name
                        <SortIcon field="full_name" />
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('high_school')}
                    >
                      <div className="flex items-center">
                        High School
                        <SortIcon field="high_school" />
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('major_area')}
                    >
                      <div className="flex items-center">
                        Major
                        <SortIcon field="major_area" />
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('application_status')}
                    >
                      <div className="flex items-center">
                        Status
                        <SortIcon field="application_status" />
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('created_at')}
                    >
                      <div className="flex items-center">
                        Application Date
                        <SortIcon field="created_at" />
                      </div>
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
                          {application.full_name.first} {application.full_name.last}
                        </div>
                        <div className="text-sm text-gray-500">
                          {application.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{application.high_school}</div>
                        <div className="text-sm text-gray-500">{application.school_district}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {application.major_area || 'Not specified'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {application.application_status}
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

        {/* Pagination Controls */}
        <div className="flex justify-between items-center mt-4">
          <div>
            Showing {applications.length ? (page - 1) * PAGE_SIZE + 1 : 0}
            -{(page - 1) * PAGE_SIZE + applications.length} of {totalCount}
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
        {showDetailsModal && selectedApplication && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-secondary">Scholarship Application Details</h3>
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
              
              {/* Application details would be displayed here */}
              {/* This is a placeholder - the actual implementation would display all fields from the selected application */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Personal Information</h4>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedApplication.full_name.first} {selectedApplication.full_name.last}
                    </p>
                    <p className="text-gray-600 mt-1">
                      <span className="font-medium">Email:</span> {selectedApplication.email}
                    </p>
                    <p className="text-gray-600 mt-1">
                      <span className="font-medium">Status:</span> {selectedApplication.application_status}
                    </p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Academic Information</h4>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-gray-600">
                      <span className="font-medium">High School:</span> {selectedApplication.high_school}
                    </p>
                    <p className="text-gray-600 mt-1">
                      <span className="font-medium">School District:</span> {selectedApplication.school_district}
                    </p>
                    <p className="text-gray-600 mt-1">
                      <span className="font-medium">Major:</span> {selectedApplication.major_area || 'Not specified'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="font-medium text-gray-700 mb-2">Application Information</h4>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-gray-600">
                    <span className="font-medium">Application Date:</span> {new Date(selectedApplication.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => handleDeleteApplication(selectedApplication.id)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="mr-2 h-5 w-5" />
                  Delete Application
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
    </AdminLayout>
  );
};

export default AdminStudentScholarshipApplications;