import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Download, Search, ChevronDown, ChevronUp, Trash2, Eye, Mail, CheckCircle, XCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
import AdminLayout from '../components/AdminLayout';

interface RegionalDirectorNomination {
  id: string;
  candidate_first_name: string;
  candidate_last_name: string;
  candidate_title?: string;
  candidate_school_district: string;
  candidate_region: string;
  candidate_phone: string;
  candidate_email: string;
  nominator_first_name: string;
  nominator_last_name: string;
  nominator_title: string;
  nominator_school_district: string;
  nominator_email: string;
  nominator_phone: string;
  nominator_certification: boolean;
  active_member_good_standing: boolean;
  affiliated_with_district_in_region: boolean;
  district_approval_and_support: boolean;
  travel_expenses_assumed: boolean;
  commits_to_three_year_term: boolean;
  impartial_regarding_vendors: boolean;
  candidate_certification: boolean;
  candidate_signature_name: string;
  candidate_signature_date: string;
  status: string;
  rejection_reason?: string;
  admin_verified_by?: string;
  admin_verified_at?: string;
  created_at: string;
}

const PAGE_SIZE = 20;

export const AdminRegionalDirectorNominations: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [nominations, setNominations] = useState<RegionalDirectorNomination[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof RegionalDirectorNomination>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedNomination, setSelectedNomination] = useState<RegionalDirectorNomination | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [adminVerified, setAdminVerified] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionInput, setShowRejectionInput] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate('/admin/login'); return; }
      if (user.role !== 'admin') { navigate('/'); return; }
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
        .from('regional_director_nominations')
        .select('*', { count: 'exact' })
        .order(sortField, { ascending: sortDirection === 'asc' })
        .range(from, to);

      if (error) throw error;
      setNominations(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      setError('Failed to load nominations. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof RegionalDirectorNomination) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleStatusUpdate = async (nominationId: string, newStatus: string) => {
    if (newStatus === 'approved' && !adminVerified) {
      alert('You must verify that all attestations have been confirmed before approving.');
      return;
    }
    if (newStatus === 'rejected' && !rejectionReason.trim()) {
      alert('Please provide a reason for rejecting this nomination.');
      return;
    }

    setUpdatingStatus(nominationId);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-regional-director-nomination`, {
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

      const updatedNomination: Partial<RegionalDirectorNomination> = {
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
      setRejectionReason('');
    } catch (error: any) {
      alert(`Failed to update status: ${error.message}`);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleResendEmails = async (nominationId: string) => {
    setResendingEmail(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-regional-director-nomination`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: nominationId })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to resend emails');

      const { emailResults } = result;
      const sent = [
        emailResults?.nominator && 'nominator',
        emailResults?.candidate && 'candidate'
      ].filter(Boolean);

      if (sent.length > 0) {
        setSuccess(`Notification emails resent to ${sent.join(' and ')}.`);
      } else {
        setError('Emails could not be sent. Please check the email configuration.');
      }
    } catch (error: any) {
      alert(`Failed to resend emails: ${error.message}`);
    } finally {
      setResendingEmail(false);
    }
  };

  const handleDelete = async (nominationId: string) => {
    if (!confirm('Are you sure you want to delete this nomination?')) return;
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-regional-director-nomination`, {
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
      alert('Failed to delete nomination. Please try again.');
    }
  };

  const handleClearTable = async () => {
    if (!confirm('Are you sure you want to clear all Regional Director nominations? This action cannot be undone.')) return;
    setClearing(true);
    setError(null);
    setSuccess(null);
    try {
      const { error } = await supabase
        .from('regional_director_nominations')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;
      setNominations([]);
      setSuccess('Regional Director nominations cleared successfully!');
    } catch (error: any) {
      setError(`Failed to clear nominations: ${error.message}`);
    } finally {
      setClearing(false);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const margin = 14;
    const maxLineWidth = doc.internal.pageSize.width - 2 * margin;

    doc.setFontSize(18);
    doc.text('Regional Director / Board Member Nominations', margin, 20);
    doc.setFontSize(12);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, 30);

    const columns = ['Candidate', 'District', 'Region', 'Nominator Title', 'Status'];
    const data = filteredNominations.map(n => [
      `${n.candidate_first_name} ${n.candidate_last_name}`,
      n.candidate_school_district,
      n.candidate_region,
      n.nominator_title,
      n.status
    ]);

    autoTable(doc, {
      head: [columns],
      body: data,
      startY: 40,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [71, 32, 183], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 247] }
    });

    let yPos = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(14);
    doc.text('Detailed Nominations', margin, yPos);
    yPos += 10;

    filteredNominations.forEach((n, index) => {
      if (yPos > doc.internal.pageSize.height - 40) { doc.addPage(); yPos = 20; }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${n.candidate_first_name} ${n.candidate_last_name}`, margin, yPos);
      yPos += 7;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`District: ${n.candidate_school_district}`, margin, yPos); yPos += 5;
      doc.text(`Region: ${n.candidate_region}`, margin, yPos); yPos += 5;
      doc.text(`Status: ${n.status}`, margin, yPos); yPos += 5;
      doc.text(`Email: ${n.candidate_email}`, margin, yPos); yPos += 5;
      doc.text(`Phone: ${n.candidate_phone}`, margin, yPos); yPos += 7;

      doc.setFont('helvetica', 'bold');
      doc.text('Certifications & Attestations:', margin, yPos); yPos += 5;
      doc.setFont('helvetica', 'normal');
      const attestations = [
        ['Nominator Certification', n.nominator_certification],
        ['Active Member in Good Standing', n.active_member_good_standing],
        ['Affiliated with District in Region', n.affiliated_with_district_in_region],
        ['District Approval & Support', n.district_approval_and_support],
        ['Travel Expenses Assumed', n.travel_expenses_assumed],
        ['Commits to Three-Year Term', n.commits_to_three_year_term],
        ['Impartial Regarding Vendors', n.impartial_regarding_vendors],
        ['Candidate Certification', n.candidate_certification],
      ];
      attestations.forEach(([label, val]) => {
        const check = val ? '[YES]' : '[NO]';
        doc.text(`  ${check} ${label}`, margin, yPos); yPos += 5;
      });
      yPos += 3;

      doc.setFont('helvetica', 'italic');
      doc.text(`Nominated by: ${n.nominator_first_name} ${n.nominator_last_name} (${n.nominator_title})`, margin, yPos);
      yPos += 5;
      doc.text(`Email: ${n.nominator_email}`, margin, yPos);
      yPos += 15;
    });

    doc.save(`regional-director-nominations-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const filteredNominations = nominations.filter(n => {
    const s = searchTerm.toLowerCase();
    return (
      n.candidate_first_name.toLowerCase().includes(s) ||
      n.candidate_last_name.toLowerCase().includes(s) ||
      n.candidate_school_district.toLowerCase().includes(s) ||
      n.nominator_first_name.toLowerCase().includes(s) ||
      n.nominator_last_name.toLowerCase().includes(s) ||
      n.candidate_region.toLowerCase().includes(s)
    );
  });

  const SortIcon = ({ field }: { field: keyof RegionalDirectorNomination }) => {
    if (field !== sortField) return null;
    return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Regional Director Nominations</h1>
          <p className="mt-1 text-gray-600">Manage and review Regional Director / Board Member nominations</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3"><p className="text-sm text-red-700">{error}</p></div>
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
              <div className="ml-3"><p className="text-sm text-green-700">{success}</p></div>
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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleClearTable}
              disabled={clearing}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="mr-2 h-5 w-5" />
              {clearing ? 'Clearing...' : 'Clear All'}
            </button>
            <button
              onClick={exportToPDF}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
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
            <div className="p-8 text-center text-gray-600"><p>No nominations found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      { key: 'candidate_last_name', label: 'Candidate' },
                      { key: 'candidate_school_district', label: 'District' },
                      { key: 'candidate_region', label: 'Region' },
                      { key: 'nominator_title', label: 'Nominator Title' },
                      { key: 'status', label: 'Status' },
                      { key: 'created_at', label: 'Date' }
                    ].map(({ key, label }) => (
                      <th
                        key={key}
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                        onClick={() => handleSort(key as keyof RegionalDirectorNomination)}
                      >
                        <div className="flex items-center">
                          {label}
                          <SortIcon field={key as keyof RegionalDirectorNomination} />
                        </div>
                      </th>
                    ))}
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredNominations.map((nomination) => (
                    <tr key={nomination.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {nomination.candidate_first_name} {nomination.candidate_last_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{nomination.candidate_school_district}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{nomination.candidate_region}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{nomination.nominator_title}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          nomination.status === 'approved' ? 'bg-green-100 text-green-800'
                            : nomination.status === 'rejected' ? 'bg-red-100 text-red-800'
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
                            setAdminVerified(false);
                            setRejectionReason('');
                            setShowRejectionInput(false);
                            setShowDetailsModal(true);
                          }}
                          className="text-primary hover:text-primary/80 mr-3"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        <button onClick={() => handleDelete(nomination.id)} className="text-red-600 hover:text-red-800">
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

        {/* Pagination */}
        <div className="flex justify-between items-center mt-4">
          <div>
            Showing {nominations.length ? (page - 1) * PAGE_SIZE + 1 : 0}
            -{(page - 1) * PAGE_SIZE + nominations.length} of {totalCount}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50">Previous</button>
            <span>Page {page}</span>
            <button onClick={() => setPage(p => (p * PAGE_SIZE < totalCount ? p + 1 : p))} disabled={page * PAGE_SIZE >= totalCount} className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50">Next</button>
          </div>
        </div>

        {/* Details Modal */}
        {showDetailsModal && selectedNomination && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-secondary">Nomination Details</h3>
                <button
                  onClick={() => { setShowDetailsModal(false); setAdminVerified(false); setRejectionReason(''); setShowRejectionInput(false); }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Candidate Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-500">Candidate Name</h4>
                  <p className="mt-1">{selectedNomination.candidate_first_name} {selectedNomination.candidate_last_name}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-500">School District</h4>
                  <p className="mt-1">{selectedNomination.candidate_school_district}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-500">Region</h4>
                  <p className="mt-1">{selectedNomination.candidate_region}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-500">Email</h4>
                  <p className="mt-1">{selectedNomination.candidate_email}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-500">Phone</h4>
                  <p className="mt-1">{selectedNomination.candidate_phone}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-500">Status</h4>
                  {(selectedNomination.status === 'approved' || selectedNomination.status === 'rejected') ? (
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${
                        selectedNomination.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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
                        className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 ${
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
                        className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 ${
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

              {/* Rejection Reason Input */}
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
                      className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 ${
                        (updatingStatus === selectedNomination.id || !rejectionReason.trim()) ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      Confirm Rejection
                    </button>
                    <button
                      onClick={() => { setShowRejectionInput(false); setRejectionReason(''); }}
                      className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                  {!rejectionReason.trim() && (
                    <p className="mt-2 text-xs text-red-600">Please provide a reason for rejecting this nomination</p>
                  )}
                </div>
              )}

              {/* Display existing rejection reason */}
              {selectedNomination.status === 'rejected' && selectedNomination.rejection_reason && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-800 mb-2">Rejection Reason</h4>
                  <p className="text-red-700 text-sm whitespace-pre-wrap">{selectedNomination.rejection_reason}</p>
                </div>
              )}

              {/* Certifications & Attestations */}
              <div className="mt-6 bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-3">Certifications & Attestations</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {[
                    { key: 'nominator_certification', label: 'Nominator Certification' },
                    { key: 'active_member_good_standing', label: 'Active Member in Good Standing' },
                    { key: 'affiliated_with_district_in_region', label: 'Affiliated with District in Region' },
                    { key: 'district_approval_and_support', label: 'District Approval & Support' },
                    { key: 'travel_expenses_assumed', label: 'Travel Expenses Assumed' },
                    { key: 'commits_to_three_year_term', label: 'Commits to Three-Year Term' },
                    { key: 'impartial_regarding_vendors', label: 'Impartial Regarding Vendors' },
                    { key: 'candidate_certification', label: 'Candidate Certification' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      {(selectedNomination as any)[key] ?
                        <CheckCircle className="h-4 w-4 text-green-600" /> :
                        <XCircle className="h-4 w-4 text-red-500" />}
                      <span>{label}</span>
                    </div>
                  ))}
                </div>

                {/* Candidate Signature */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="font-medium text-gray-700 mb-2">Candidate Signature</h4>
                  <p className="text-sm text-gray-600">
                    <strong>Name:</strong> {selectedNomination.candidate_signature_name} &nbsp;|&nbsp;
                    <strong>Date:</strong> {new Date(selectedNomination.candidate_signature_date).toLocaleDateString()}
                  </p>
                </div>

                {/* Admin Verification */}
                {selectedNomination.status !== 'approved' && selectedNomination.status !== 'rejected' && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={adminVerified}
                        onChange={(e) => {
                          setAdminVerified(e.target.checked);
                          if (e.target.checked) { setShowRejectionInput(false); setRejectionReason(''); }
                        }}
                        className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">
                        <strong>Admin Verification:</strong> I have reviewed and verified that this candidate meets all the attestation requirements. I confirm the candidate is eligible for Regional Director / Board Member nomination.
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

                {/* Approved audit info */}
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

              {/* Nominator Info */}
              <div className="mt-6">
                <h4 className="font-medium text-gray-500">Nominated By</h4>
                <div className="mt-2 bg-gray-50 rounded-lg p-4">
                  <p className="font-medium">{selectedNomination.nominator_first_name} {selectedNomination.nominator_last_name}</p>
                  <p className="text-gray-600">{selectedNomination.nominator_email}</p>
                  <p className="text-gray-500 text-sm mt-1">{selectedNomination.nominator_title}</p>
                  <p className="text-gray-500 text-sm">{selectedNomination.nominator_school_district}</p>
                  <p className="text-gray-500 text-sm">{selectedNomination.nominator_phone}</p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                {(selectedNomination.status === 'approved' || selectedNomination.status === 'rejected') && (
                  <button
                    onClick={() => handleResendEmails(selectedNomination.id)}
                    disabled={resendingEmail}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {resendingEmail ? 'Sending...' : 'Resend Notification Emails'}
                  </button>
                )}
                <button
                  onClick={() => { setShowDetailsModal(false); setAdminVerified(false); setRejectionReason(''); }}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
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

export default AdminRegionalDirectorNominations;
