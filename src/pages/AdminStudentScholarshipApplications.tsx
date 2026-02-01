import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Download, Search, ChevronDown, ChevronUp, Trash2, Eye, FileText, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import AdminLayout from '../components/AdminLayout';

// Tennessee regions for filtering
const TENNESSEE_REGIONS = ['East', 'Middle', 'West'] as const;
type TennesseeRegion = typeof TENNESSEE_REGIONS[number];

interface ScholarshipNomination {
  id: string;
  // Nominator info
  nominator_first_name: string;
  nominator_last_name: string;
  nominator_title: string;
  nominator_email: string;
  nominator_phone: string;
  nominator_district: string;
  region: TennesseeRegion;
  // Student info  
  full_name: {
    first: string;
    last: string;
  };
  email: string | null;
  phone: string | null;
  high_school: string;
  graduation_year: string;
  address: {
    street: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
  };
  essay: string;
  created_at: string;
}

const PAGE_SIZE = 20;

const AdminStudentScholarshipApplications: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [nominations, setNominations] = useState<ScholarshipNomination[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState<TennesseeRegion | ''>('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedNomination, setSelectedNomination] = useState<ScholarshipNomination | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [sortField, setSortField] = useState<keyof ScholarshipNomination>('created_at');
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
      fetchNominations();
    }
    // eslint-disable-next-line
  }, [authLoading, user, page, sortField, sortDirection, regionFilter]);

  const fetchNominations = async () => {
    try {
      setLoading(true);
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      // For sorting by name, we need special handling since it's in a JSONB field
      let orderBy = sortField;
      if (sortField === 'full_name') {
        orderBy = 'full_name->last';
      }
      
      let query = supabase
        .from('student_scholarship_applications')
        .select('*', { count: 'exact' });
      
      // Apply region filter if selected
      if (regionFilter) {
        query = query.eq('region', regionFilter);
      }
      
      const { data, error, count } = await query
        .order(orderBy as string, { ascending: sortDirection === 'asc' })
        .range(from, to);

      if (error) throw error;
      setNominations(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error('Error fetching nominations:', error);
      setError('Failed to load nominations');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleClearTable = async () => {
    if (!confirm('Are you sure you want to clear all scholarship nominations? This action cannot be undone.')) {
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

      // Call the Edge Function to clear nominations
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
        throw new Error(errorData.error || 'Failed to clear scholarship nominations');
      }

      setSuccess('Scholarship nominations cleared successfully!');
      setNominations([]);
      setTotalCount(0);
    } catch (error: any) {
      console.error('Error clearing nominations:', error);
      setError(`Failed to clear nominations: ${error.message}`);
    } finally {
      setClearing(false);
    }
  };

  const handleSort = (field: keyof ScholarshipNomination) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDeleteNomination = async (id: string) => {
    if (!confirm('Are you sure you want to delete this nomination?')) {
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

      // Call the Edge Function to delete nomination
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
        throw new Error(errorData.error || 'Failed to delete scholarship nomination');
      }

      setSuccess('Nomination deleted successfully!');
      
      // Remove the deleted nomination from the list
      setNominations(prev => prev.filter(nom => nom.id !== id));
      setTotalCount(prev => prev - 1);
      
      // Close the modal if the deleted nomination was being viewed
      if (selectedNomination?.id === id) {
        setSelectedNomination(null);
        setShowDetailsModal(false);
      }
    } catch (error: any) {
      console.error('Error deleting nomination:', error);
      setError(`Failed to delete nomination: ${error.message}`);
    }
  };

  const exportToPDF = () => {
    if (!nominations.length) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 14;
    
    // Add title
    doc.setFontSize(18);
    doc.text('Student Scholarship Nominations', margin, 20);
    
    // Add date
    doc.setFontSize(12);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, 30);

    // Define the columns for the summary table
    const columns = [
      'Student Name',
      'High School',
      'Region',
      'Nominator',
      'District',
      'Date'
    ];

    // Prepare the summary data
    const data = nominations.map(nom => [
      `${nom.full_name.first} ${nom.full_name.last}`,
      nom.high_school,
      nom.region || 'N/A',
      `${nom.nominator_first_name} ${nom.nominator_last_name}`,
      nom.nominator_district,
      new Date(nom.created_at).toLocaleDateString()
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
    doc.save(`scholarship-nominations-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Export individual nomination as detailed PDF
  const exportNominationToPDF = (nomination: ScholarshipNomination) => {
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;
    const maxLineWidth = pageWidth - 2 * margin;
    let yPos = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('TAPT Student Scholarship Nomination', margin, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += 15;

    // Nominator Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 32, 183);
    doc.text('Nominator Information', margin, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const nominatorInfo = [
      `Name: ${nomination.nominator_first_name} ${nomination.nominator_last_name}`,
      `Title: ${nomination.nominator_title}`,
      `District: ${nomination.nominator_district}`,
      `Email: ${nomination.nominator_email}`,
      `Phone: ${nomination.nominator_phone}`,
      `Region: ${nomination.region || 'N/A'} Tennessee`
    ];
    nominatorInfo.forEach(line => {
      doc.text(line, margin, yPos);
      yPos += 6;
    });
    yPos += 8;

    // Student Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 32, 183);
    doc.text('Student Information', margin, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const studentInfo = [
      `Name: ${nomination.full_name.first} ${nomination.full_name.last}`,
      `High School: ${nomination.high_school}`,
      `Graduation Year: ${nomination.graduation_year}`,
      nomination.email ? `Email: ${nomination.email}` : null,
      nomination.phone ? `Phone: ${nomination.phone}` : null
    ].filter(Boolean) as string[];
    studentInfo.forEach(line => {
      doc.text(line, margin, yPos);
      yPos += 6;
    });
    yPos += 4;

    // Address
    if (nomination.address) {
      doc.text('Address:', margin, yPos);
      yPos += 6;
      doc.text(`  ${nomination.address.street}`, margin, yPos);
      yPos += 6;
      if (nomination.address.street2) {
        doc.text(`  ${nomination.address.street2}`, margin, yPos);
        yPos += 6;
      }
      doc.text(`  ${nomination.address.city}, ${nomination.address.state} ${nomination.address.zip}`, margin, yPos);
      yPos += 10;
    }

    // Essay Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 32, 183);
    doc.text('Nomination Essay', margin, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    // Word wrap the essay
    const essayLines = doc.splitTextToSize(nomination.essay, maxLineWidth);
    essayLines.forEach((line: string) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, margin, yPos);
      yPos += 6;
    });
    yPos += 10;

    // Submission info
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text(`Submitted: ${new Date(nomination.created_at).toLocaleString()}`, margin, yPos);

    // Save
    const studentName = `${nomination.full_name.first}-${nomination.full_name.last}`.toLowerCase().replace(/\s+/g, '-');
    doc.save(`scholarship-nomination-${studentName}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const filteredNominations = nominations.filter(nom => {
    const searchStr = searchTerm.toLowerCase();
    return (
      nom.full_name.first.toLowerCase().includes(searchStr) ||
      nom.full_name.last.toLowerCase().includes(searchStr) ||
      (nom.email && nom.email.toLowerCase().includes(searchStr)) ||
      nom.high_school.toLowerCase().includes(searchStr) ||
      nom.nominator_first_name.toLowerCase().includes(searchStr) ||
      nom.nominator_last_name.toLowerCase().includes(searchStr) ||
      nom.nominator_district.toLowerCase().includes(searchStr) ||
      nom.nominator_email.toLowerCase().includes(searchStr)
    );
  });

  const SortIcon = ({ field }: { field: keyof ScholarshipNomination }) => {
    if (field !== sortField) return null;
    return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Student Scholarship Nominations</h1>
          <p className="mt-1 text-gray-600">Review nominations submitted by Transportation Directors</p>
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
          <div className="flex flex-1 gap-4 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search nominations..."
                value={searchTerm}
                onChange={handleSearch}
                className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
              />
            </div>
            
            {/* Region Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <select
                value={regionFilter}
                onChange={(e) => {
                  setRegionFilter(e.target.value as TennesseeRegion | '');
                  setPage(1); // Reset to first page when filter changes
                }}
                className="pl-10 pr-8 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
              >
                <option value="">All Regions</option>
                {TENNESSEE_REGIONS.map(region => (
                  <option key={region} value={region}>{region} TN</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={handleClearTable}
              disabled={clearing || nominations.length === 0}
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
              disabled={nominations.length === 0}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              <Download className="h-5 w-5 mr-2" />
              Export to PDF
            </button>
          </div>
        </div>

        {/* Nominations Table */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
              <p className="mt-2 text-gray-600">Loading nominations...</p>
            </div>
          ) : filteredNominations.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Nominations Found</h3>
              <p className="mt-1 text-gray-500">
                {searchTerm || regionFilter ? 'No nominations match your search criteria.' : 'There are no scholarship nominations yet.'}
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
                        Student Name
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
                      onClick={() => handleSort('region')}
                    >
                      <div className="flex items-center">
                        Region
                        <SortIcon field="region" />
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('nominator_last_name')}
                    >
                      <div className="flex items-center">
                        Nominator
                        <SortIcon field="nominator_last_name" />
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('created_at')}
                    >
                      <div className="flex items-center">
                        Submitted
                        <SortIcon field="created_at" />
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredNominations.map((nomination) => (
                    <tr key={nomination.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {nomination.full_name.first} {nomination.full_name.last}
                        </div>
                        <div className="text-sm text-gray-500">
                          {nomination.email || 'No email provided'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{nomination.high_school}</div>
                        <div className="text-sm text-gray-500">Class of {nomination.graduation_year}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          nomination.region === 'East' ? 'bg-blue-100 text-blue-800' :
                          nomination.region === 'Middle' ? 'bg-green-100 text-green-800' :
                          nomination.region === 'West' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {nomination.region || 'N/A'} TN
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{nomination.nominator_first_name} {nomination.nominator_last_name}</div>
                        <div className="text-sm text-gray-500">{nomination.nominator_district}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(nomination.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedNomination(nomination);
                            setShowDetailsModal(true);
                          }}
                          className="text-primary hover:text-primary/80 mr-3"
                          title="View details"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteNomination(nomination.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete nomination"
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
            Showing {nominations.length ? (page - 1) * PAGE_SIZE + 1 : 0}
            -{(page - 1) * PAGE_SIZE + nominations.length} of {totalCount}
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
        {showDetailsModal && selectedNomination && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-secondary">Scholarship Nomination Details</h3>
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
              
              {/* Nominator Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Nominator Information</h4>
                  <div className="bg-blue-50 p-4 rounded-md">
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedNomination.nominator_first_name} {selectedNomination.nominator_last_name}
                    </p>
                    <p className="text-gray-600 mt-1">
                      <span className="font-medium">Title:</span> {selectedNomination.nominator_title}
                    </p>
                    <p className="text-gray-600 mt-1">
                      <span className="font-medium">District:</span> {selectedNomination.nominator_district}
                    </p>
                    <p className="text-gray-600 mt-1">
                      <span className="font-medium">Email:</span> {selectedNomination.nominator_email}
                    </p>
                    <p className="text-gray-600 mt-1">
                      <span className="font-medium">Phone:</span> {selectedNomination.nominator_phone}
                    </p>
                    <p className="text-gray-600 mt-1">
                      <span className="font-medium">Region:</span>{' '}
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        selectedNomination.region === 'East' ? 'bg-blue-100 text-blue-800' :
                        selectedNomination.region === 'Middle' ? 'bg-green-100 text-green-800' :
                        selectedNomination.region === 'West' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedNomination.region || 'N/A'} Tennessee
                      </span>
                    </p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Student Information</h4>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedNomination.full_name.first} {selectedNomination.full_name.last}
                    </p>
                    <p className="text-gray-600 mt-1">
                      <span className="font-medium">High School:</span> {selectedNomination.high_school}
                    </p>
                    <p className="text-gray-600 mt-1">
                      <span className="font-medium">Graduation Year:</span> {selectedNomination.graduation_year}
                    </p>
                    {selectedNomination.email && (
                      <p className="text-gray-600 mt-1">
                        <span className="font-medium">Email:</span> {selectedNomination.email}
                      </p>
                    )}
                    {selectedNomination.phone && (
                      <p className="text-gray-600 mt-1">
                        <span className="font-medium">Phone:</span> {selectedNomination.phone}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Address */}
              {selectedNomination.address && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-700 mb-2">Student Address</h4>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-gray-600">
                      {selectedNomination.address.street}
                      {selectedNomination.address.street2 && <><br />{selectedNomination.address.street2}</>}
                      <br />
                      {selectedNomination.address.city}, {selectedNomination.address.state} {selectedNomination.address.zip}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Essay */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-700 mb-2">Nomination Essay</h4>
                <div className="bg-yellow-50 p-4 rounded-md">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedNomination.essay}</p>
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="font-medium text-gray-700 mb-2">Submission Information</h4>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-gray-600">
                    <span className="font-medium">Submitted:</span> {new Date(selectedNomination.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => exportNominationToPDF(selectedNomination)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Export PDF
                </button>
                <button
                  onClick={() => handleDeleteNomination(selectedNomination.id)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="mr-2 h-5 w-5" />
                  Delete Nomination
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