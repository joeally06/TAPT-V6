import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Download, Search, ChevronDown, ChevronUp, Trash2, Eye, Send, Loader2, Mail, CheckCircle, XCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
import AdminLayout from '../components/AdminLayout';

interface HallOfFameNomination {
  id: string;
  supervisor_first_name: string;
  supervisor_last_name: string;
  supervisor_email: string;
  nominee_first_name: string;
  nominee_last_name: string;
  nominee_city: string;
  district: string;
  region: string;
  grand_division?: string;
  nominator_role?: string;
  nomination_reason: string;
  is_tapt_member: boolean;
  years_of_service: number;
  status: string;
  created_at: string;
  // 2026 Attestation fields
  clean_driving_record?: boolean;
  district_is_tapt_member?: boolean;
  // Dynamic year fields (stored with the nomination)
  conference_year_1?: number;
  conference_year_2?: number;
  conference_year_3?: number;
  district_attended_year_1?: boolean;
  district_attended_year_2?: boolean;
  district_attended_year_3?: boolean;
  nominator_is_officially_listed?: boolean;
  acknowledge_documentation?: boolean;
  acknowledge_attendance?: boolean;
  // Admin verification audit fields
  admin_verified_by?: string;
  admin_verified_at?: string;
  // Rejection reason
  rejection_reason?: string;
}

const PAGE_SIZE = 20;

export const AdminHallOfFameNominations: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [nominations, setNominations] = useState<HallOfFameNomination[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof HallOfFameNomination>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedNomination, setSelectedNomination] = useState<HallOfFameNomination | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [adminVerified, setAdminVerified] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionInput, setShowRejectionInput] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resendingStatusEmail, setResendingStatusEmail] = useState(false);
  const [statusEmailSent, setStatusEmailSent] = useState(false);

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
  }, [authLoading, user, page]);

  const fetchNominations = async () => {
    try {
      setLoading(true);
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from('hall_of_fame_nominations')
        .select('*', { count: 'exact' })
        .order(sortField, { ascending: sortDirection === 'asc' })
        .range(from, to);

      if (error) throw error;

      setNominations(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error('Error fetching nominations:', error);
      setError('Failed to load nominations. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof HallOfFameNomination) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleStatusUpdate = async (nominationId: string, newStatus: string) => {
    // Require admin verification before approving
    if (newStatus === 'approved' && !adminVerified) {
      alert('You must verify that all attestations have been confirmed before approving this nomination.');
      return;
    }
    
    // Require rejection reason before rejecting
    if (newStatus === 'rejected' && !rejectionReason.trim()) {
      alert('Please provide a reason for rejecting this nomination.');
      return;
    }
    
    setUpdatingStatus(nominationId);
    try {
      // Get session token for authorization
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      // Use Edge Function for secure status update
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-hof-nomination-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          id: nominationId, 
          status: newStatus,
          adminVerified: newStatus === 'approved' ? adminVerified : undefined,
          rejectionReason: newStatus === 'rejected' ? rejectionReason.trim() : undefined
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update status');
      }
      
      // Update local state with new status and verification/rejection info
      const updatedNomination: Partial<HallOfFameNomination> = {
        status: newStatus,
        admin_verified_by: newStatus === 'approved' ? user?.id : undefined,
        admin_verified_at: newStatus === 'approved' ? new Date().toISOString() : undefined,
        rejection_reason: newStatus === 'rejected' ? rejectionReason.trim() : undefined
      };
      
      setNominations(prev => prev.map(nom => 
        nom.id === nominationId ? { ...nom, ...updatedNomination } : nom
      ));
      if (selectedNomination?.id === nominationId) {
        setSelectedNomination(prev => prev ? { ...prev, ...updatedNomination } : null);
      }
      
      // Clear rejection reason after successful update
      setRejectionReason('');
    } catch (error: any) {
      console.error('Error updating status:', error);
      alert(`Failed to update status: ${error.message}`);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDelete = async (nominationId: string) => {
    if (!confirm('Are you sure you want to delete this nomination?')) return;
    try {
      // Get session token for authorization
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      // Use Edge Function for secure deletion
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-hof-nomination`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: nominationId })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete nomination');
      }
      fetchNominations();
    } catch (error: any) {
      console.error('Error deleting nomination:', error);
      alert('Failed to delete nomination. Please try again.');
    }
  };

  const handleResendEmail = async (nominationId: string) => {
    setResendingEmail(true);
    setEmailSent(false);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resend-hof-confirmation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nominationId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resend confirmation email');
      }

      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 5000);
    } catch (error: any) {
      console.error('Error resending email:', error);
      alert(`Failed to resend email: ${error.message}`);
    } finally {
      setResendingEmail(false);
    }
  };

  const handleResendStatusEmail = async (nominationId: string) => {
    setResendingStatusEmail(true);
    setStatusEmailSent(false);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resend-hof-status-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nominationId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resend status email');
      }

      setStatusEmailSent(true);
      setTimeout(() => setStatusEmailSent(false), 5000);
    } catch (error: any) {
      console.error('Error resending status email:', error);
      alert(`Failed to resend status email: ${error.message}`);
    } finally {
      setResendingStatusEmail(false);
    }
  };

  const handleClearTable = async () => {
    if (!confirm('Are you sure you want to clear all hall of fame nominations? This action cannot be undone.')) {
      return;
    }

    setClearing(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase
        .from('hall_of_fame_nominations')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (error) throw error;

      setNominations([]);
      setSuccess('Hall of Fame nominations cleared successfully!');
    } catch (error: any) {
      console.error('Error clearing nominations:', error);
      setError(`Failed to clear nominations: ${error.message}`);
    } finally {
      setClearing(false);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 14;
    const maxLineWidth = pageWidth - 2 * margin;
    
    // Add title
    doc.setFontSize(18);
    doc.text('Hall of Fame Nominations', margin, 20);
    
    // Add date
    doc.setFontSize(12);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, 30);

    // Define the columns for the summary table
    const columns = [
      'Nominee',
      'District',
      'Region',
      'Years',
      'Status'
    ];

    // Prepare the summary data
    const data = filteredNominations.map(nomination => [
      `${nomination.nominee_first_name} ${nomination.nominee_last_name}`,
      nomination.district,
      nomination.region,
      nomination.years_of_service.toString(),
      nomination.status
    ]);

    // Add the summary table using autoTable function
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

    // Add detailed nominations with reasons
    let yPos = (doc as any).lastAutoTable.finalY + 20;

    doc.setFontSize(14);
    doc.text('Detailed Nominations', margin, yPos);
    yPos += 10;

    filteredNominations.forEach((nomination, index) => {
      // Check if we need a new page
      if (yPos > doc.internal.pageSize.height - 40) {
        doc.addPage();
        yPos = 20;
      }

      // Add nomination details
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${nomination.nominee_first_name} ${nomination.nominee_last_name}`, margin, yPos);
      yPos += 7;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`District: ${nomination.district}`, margin, yPos);
      yPos += 5;
      doc.text(`Region: ${nomination.region}`, margin, yPos);
      yPos += 5;
      doc.text(`Years of Service: ${nomination.years_of_service}`, margin, yPos);
      yPos += 5;
      doc.text(`Status: ${nomination.status}`, margin, yPos);
      yPos += 5;
      doc.text(`TAPT Member: ${nomination.is_tapt_member ? 'Yes' : 'No'}`, margin, yPos);
      yPos += 7;

      // Add nomination reason with word wrap
      doc.setFont('helvetica', 'bold');
      doc.text('Nomination Reason:', margin, yPos);
      yPos += 7;
      doc.setFont('helvetica', 'normal');

      const splitReason = doc.splitTextToSize(nomination.nomination_reason, maxLineWidth);
      doc.text(splitReason, margin, yPos);
      yPos += splitReason.length * 5 + 10;

      // Add nominator info
      doc.setFont('helvetica', 'italic');
      doc.text(`Nominated by: ${nomination.supervisor_first_name} ${nomination.supervisor_last_name}`, margin, yPos);
      yPos += 5;
      doc.text(`Email: ${nomination.supervisor_email}`, margin, yPos);
      yPos += 15;
    });

    // Save the PDF
    doc.save(`hall-of-fame-nominations-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const filteredNominations = nominations.filter(nomination => {
    const searchString = searchTerm.toLowerCase();
    return (
      nomination.nominee_first_name.toLowerCase().includes(searchString) ||
      nomination.nominee_last_name.toLowerCase().includes(searchString) ||
      nomination.district.toLowerCase().includes(searchString) ||
      nomination.supervisor_first_name.toLowerCase().includes(searchString) ||
      nomination.supervisor_last_name.toLowerCase().includes(searchString)
    );
  });

  const SortIcon = ({ field }: { field: keyof HallOfFameNomination }) => {
    if (field !== sortField) return null;
    return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hall of Fame Nominations</h1>
          <p className="mt-1 text-gray-600">Manage and review Hall of Fame nominations</p>
        </div>

        {/* Main Content */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
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
              placeholder="Search nominations..."
              value={searchTerm}
              onChange={handleSearch}
              className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
          
          <div className="flex gap-4">
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
              onClick={exportToPDF}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
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
          ) : error ? (
            <div className="p-8 text-center text-red-600">
              <p>Error loading nominations: {error}</p>
            </div>
          ) : filteredNominations.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              <p>No nominations found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      { key: 'nominee_last_name', label: 'Nominee' },
                      { key: 'district', label: 'District' },
                      { key: 'grand_division', label: 'Grand Division' },
                      { key: 'years_of_service', label: 'Years' },
                      { key: 'nominator_role', label: 'Nominator Role' },
                      { key: 'status', label: 'Status' },
                      { key: 'created_at', label: 'Date' }
                    ].map(({ key, label }) => (
                      <th
                        key={key}
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                        onClick={() => handleSort(key as keyof HallOfFameNomination)}
                      >
                        <div className="flex items-center">
                          {label}
                          <SortIcon field={key as keyof HallOfFameNomination} />
                        </div>
                      </th>
                    ))}
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
                          {nomination.nominee_first_name} {nomination.nominee_last_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {nomination.district}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {nomination.grand_division || nomination.region}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {nomination.years_of_service}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {nomination.nominator_role || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          nomination.status === 'approved' 
                            ? 'bg-green-100 text-green-800' 
                            : nomination.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {nomination.status === 'approved' ? '✓ Approved' : nomination.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(nomination.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedNomination(nomination);
                            setAdminVerified(false); // Reset verification when opening new nomination
                            setRejectionReason(''); // Reset rejection reason
                            setShowRejectionInput(false); // Reset rejection input visibility
                            setShowDetailsModal(true);
                          }}
                          className="text-primary hover:text-primary/80 mr-3"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(nomination.id)}
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-secondary">Nomination Details</h3>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setAdminVerified(false);
                    setRejectionReason('');
                    setShowRejectionInput(false);
                  }}
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
                  <h4 className="font-medium text-gray-500">Nominee</h4>
                  <p className="mt-1">{selectedNomination.nominee_first_name} {selectedNomination.nominee_last_name}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-500">District</h4>
                  <p className="mt-1">{selectedNomination.district}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-500">Grand Division</h4>
                  <p className="mt-1">{selectedNomination.grand_division || selectedNomination.region}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-500">Years of Service</h4>
                  <p className="mt-1">{selectedNomination.years_of_service}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-500">Nominator Role</h4>
                  <p className="mt-1">{selectedNomination.nominator_role || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-500">Status</h4>
                  {/* Show locked status for finalized decisions */}
                  {(selectedNomination.status === 'approved' || selectedNomination.status === 'rejected') ? (
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${
                        selectedNomination.status === 'approved' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedNomination.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                      </span>
                      <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Decision is final and cannot be changed
                      </p>
                    </div>
                  ) : (
                    <div className="mt-1 flex gap-2">
                      <button
                        onClick={() => handleStatusUpdate(selectedNomination.id, 'approved')}
                        disabled={updatingStatus === selectedNomination.id || !adminVerified}
                        className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
                          (updatingStatus === selectedNomination.id || !adminVerified) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title={!adminVerified ? 'You must verify attestations before approving' : ''}
                      >
                        {updatingStatus === selectedNomination.id ? (
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => setShowRejectionInput(true)}
                        disabled={updatingStatus === selectedNomination.id}
                        className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                          updatingStatus === selectedNomination.id ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Rejection Reason Input - only show when Reject button is clicked */}
              {selectedNomination.status === 'pending' && showRejectionInput && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-800 mb-2">Rejection Reason (required)</h4>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter the reason for rejecting this nomination..."
                    rows={3}
                    className="w-full rounded-md border-red-300 focus:ring-red-500 focus:border-red-500 text-sm"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleStatusUpdate(selectedNomination.id, 'rejected')}
                      disabled={updatingStatus === selectedNomination.id || !rejectionReason.trim()}
                      className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                        (updatingStatus === selectedNomination.id || !rejectionReason.trim()) ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {updatingStatus === selectedNomination.id ? (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : null}
                      Confirm Rejection
                    </button>
                    <button
                      onClick={() => {
                        setShowRejectionInput(false);
                        setRejectionReason('');
                      }}
                      className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                  {!rejectionReason.trim() && (
                    <p className="mt-2 text-xs text-red-600">Please provide a reason for rejecting this nomination</p>
                  )}
                </div>
              )}

              {/* Display existing rejection reason for rejected nominations */}
              {selectedNomination.status === 'rejected' && selectedNomination.rejection_reason && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-800 mb-2">Rejection Reason</h4>
                  <p className="text-red-700 text-sm whitespace-pre-wrap">{selectedNomination.rejection_reason}</p>
                </div>
              )}

              <div className="mt-6">
                <h4 className="font-medium text-gray-500">Nomination Reason</h4>
                <p className="mt-1 text-gray-700 whitespace-pre-wrap">{selectedNomination.nomination_reason}</p>
              </div>

              {/* 2026 Attestations Section */}
              {(selectedNomination.clean_driving_record !== undefined) && (
                <div className="mt-6 bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 mb-3">Attestations</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      {selectedNomination.clean_driving_record ? 
                        <CheckCircle className="h-4 w-4 text-green-600" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />}
                      <span>Clean Driving Record</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedNomination.district_is_tapt_member ? 
                        <CheckCircle className="h-4 w-4 text-green-600" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />}
                      <span>District TAPT Member</span>
                    </div>
                    {/* Dynamic year attestations - display the actual years that were attested to */}
                    <div className="flex items-center gap-2">
                      {selectedNomination.district_attended_year_1 ? 
                        <CheckCircle className="h-4 w-4 text-green-600" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />}
                      <span>Attended {selectedNomination.conference_year_1 || 'Year 1'} Conference</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedNomination.district_attended_year_2 ? 
                        <CheckCircle className="h-4 w-4 text-green-600" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />}
                      <span>Attended {selectedNomination.conference_year_2 || 'Year 2'} Conference</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedNomination.district_attended_year_3 ? 
                        <CheckCircle className="h-4 w-4 text-green-600" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />}
                      <span>Attended {selectedNomination.conference_year_3 || 'Year 3'} Conference</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedNomination.nominator_is_officially_listed ? 
                        <CheckCircle className="h-4 w-4 text-green-600" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />}
                      <span>Officially Listed w/ TN DOE</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedNomination.acknowledge_documentation ? 
                        <CheckCircle className="h-4 w-4 text-green-600" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />}
                      <span>Documentation Acknowledged</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedNomination.acknowledge_attendance ? 
                        <CheckCircle className="h-4 w-4 text-green-600" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />}
                      <span>Attendance Acknowledged</span>
                    </div>
                  </div>
                  
                  {/* Admin Verification Checkbox */}
                  {selectedNomination.status !== 'approved' && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={adminVerified}
                          onChange={(e) => {
                            setAdminVerified(e.target.checked);
                            // If checking admin verification, hide rejection input
                            if (e.target.checked) {
                              setShowRejectionInput(false);
                              setRejectionReason('');
                            }
                          }}
                          className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">
                          <strong>Admin Verification:</strong> I have reviewed and verified that this nominee meets all the attestation requirements stated by the nominator. I confirm the nominee has a clean driving record, the district is a TAPT member, and the district has attended the required TAPT conferences.
                        </span>
                      </label>
                      {!adminVerified && (
                        <p className="mt-2 text-sm text-amber-600 flex items-center gap-1">
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          You must verify attestations before approving this nomination
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Show verification audit info for approved nominations */}
                  {selectedNomination.status === 'approved' && selectedNomination.admin_verified_at && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg">
                        <CheckCircle className="h-5 w-5" />
                        <div>
                          <p className="font-medium">Verified and Approved</p>
                          <p className="text-sm text-green-600">
                            Verified on {new Date(selectedNomination.admin_verified_at).toLocaleDateString()} at {new Date(selectedNomination.admin_verified_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6">
                <h4 className="font-medium text-gray-500">Nominated By</h4>
                <div className="mt-2 bg-gray-50 rounded-lg p-4">
                  <p className="font-medium">{selectedNomination.supervisor_first_name} {selectedNomination.supervisor_last_name}</p>
                  <p className="text-gray-600">{selectedNomination.supervisor_email}</p>
                  {selectedNomination.nominator_role && (
                    <p className="text-gray-500 text-sm mt-1">{selectedNomination.nominator_role}</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                {emailSent && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Confirmation email sent successfully!
                  </div>
                )}
                {statusEmailSent && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {selectedNomination.status === 'approved' ? 'Approval' : 'Rejection'} email sent successfully!
                  </div>
                )}
                <div className="flex justify-end gap-3 flex-wrap">
                  <button
                    onClick={() => handleResendEmail(selectedNomination.id)}
                    disabled={resendingEmail}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resendingEmail ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Resend Confirmation
                      </>
                    )}
                  </button>
                  {/* Resend Approval/Rejection Email - only show for approved or rejected nominations */}
                  {(selectedNomination.status === 'approved' || selectedNomination.status === 'rejected') && (
                    <button
                      onClick={() => handleResendStatusEmail(selectedNomination.id)}
                      disabled={resendingStatusEmail}
                      className={`inline-flex items-center px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${
                        selectedNomination.status === 'approved' 
                          ? 'bg-emerald-600 hover:bg-emerald-700' 
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {resendingStatusEmail ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Resend {selectedNomination.status === 'approved' ? 'Approval' : 'Rejection'}
                        </>
                      )}
                    </button>
                  )}
                  <a
                    href={`mailto:${selectedNomination.supervisor_email}`}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    New Email
                  </a>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      setAdminVerified(false);
                      setRejectionReason('');
                      setStatusEmailSent(false);
                    }}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminHallOfFameNominations;