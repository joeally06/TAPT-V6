import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AdminLayout from '../components/AdminLayout';
import { CheckCircle, XCircle, DollarSign, Search, Filter, AlertCircle } from 'lucide-react';

interface PendingPayment {
  id: string;
  type: 'conference' | 'tech_conference' | 'exhibitor';
  school_district?: string;
  business_name?: string;
  first_name: string;
  last_name: string;
  email: string;
  total_amount: number;
  po_number: string;
  created_at: string;
  payment_status: string;
}

export default function AdminPaymentManagement() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'conference' | 'tech_conference' | 'exhibitor'>('all');
  const [processing, setProcessing] = useState<string | null>(null);

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
      fetchPendingPayments();
    }
  }, [authLoading, user, navigate]);

  const fetchPendingPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch pending conference registrations
      const { data: conferenceData, error: conferenceError } = await supabase
        .from('conference_registrations')
        .select('*')
        .eq('payment_method', 'po')
        .eq('payment_status', 'pending')
        .order('created_at', { ascending: false });

      if (conferenceError) throw conferenceError;

      // Fetch pending tech conference registrations
      const { data: techData, error: techError } = await supabase
        .from('tech_conference_registrations')
        .select('*')
        .eq('payment_method', 'po')
        .eq('payment_status', 'pending')
        .order('created_at', { ascending: false });

      if (techError) throw techError;

      // Fetch pending exhibitor registrations
      const { data: exhibitorData, error: exhibitorError } = await supabase
        .from('exhibitor_registrations')
        .select('*')
        .eq('payment_method', 'po')
        .eq('payment_status', 'pending')
        .order('created_at', { ascending: false });

      if (exhibitorError) throw exhibitorError;

      // Combine and format all pending payments
      const allPending: PendingPayment[] = [
        ...(conferenceData || []).map(item => ({
          id: item.id,
          type: 'conference' as const,
          school_district: item.school_district,
          first_name: item.first_name,
          last_name: item.last_name,
          email: item.email,
          total_amount: item.total_amount || 0,
          po_number: item.po_number || '',
          created_at: item.created_at,
          payment_status: item.payment_status
        })),
        ...(techData || []).map(item => ({
          id: item.id,
          type: 'tech_conference' as const,
          school_district: item.school_district,
          first_name: item.first_name,
          last_name: item.last_name,
          email: item.email,
          total_amount: item.total_amount || 0,
          po_number: item.po_number || '',
          created_at: item.created_at,
          payment_status: item.payment_status
        })),
        ...(exhibitorData || []).map(item => ({
          id: item.id,
          type: 'exhibitor' as const,
          business_name: item.business_name,
          first_name: item.first_name,
          last_name: item.last_name,
          email: item.email,
          total_amount: item.total_amount || 0,
          po_number: item.po_number || '',
          created_at: item.created_at,
          payment_status: item.payment_status
        }))
      ];

      setPendingPayments(allPending);
    } catch (error: any) {
      console.error('Error fetching pending payments:', error);
      setError('Failed to load pending payments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const markAsPaid = async (payment: PendingPayment) => {
    if (!confirm(
      `Mark payment as completed for ${payment.first_name} ${payment.last_name}?\n\n` +
      `PO Number: ${payment.po_number}\n` +
      `Amount: $${payment.total_amount.toFixed(2)}\n\n` +
      `A payment receipt will be automatically emailed to ${payment.email}\n\n` +
      `This action cannot be undone.`
    )) {
      return;
    }

    try {
      setProcessing(payment.id);
      setError(null);
      setSuccess(null);

      const tableName = payment.type === 'conference' 
        ? 'conference_registrations'
        : payment.type === 'tech_conference'
        ? 'tech_conference_registrations'
        : 'exhibitor_registrations';

      // Update payment status in database
      const { error: updateError } = await supabase
        .from(tableName)
        .update({
          payment_status: 'completed',
          payment_completed_at: new Date().toISOString()
        })
        .eq('id', payment.id);

      if (updateError) throw updateError;

      console.log('✅ Payment status updated, waiting for commit...');

      // Wait a moment for database to commit the transaction
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('📧 Sending receipt email...');

      // Send payment receipt email via Edge Function
      try {
        const { data, error: emailError } = await supabase.functions.invoke('send-payment-receipt', {
          body: {
            registrationId: payment.id,
            registrationType: payment.type
          }
        });

        if (emailError) {
          console.error('⚠️ Email function error:', emailError);
          throw emailError;
        }
        
        if (data && !data.success) {
          console.error('⚠️ Email send failed:', data);
          throw new Error(data.error || 'Email send failed');
        }
        
        console.log('✅ Payment receipt email sent successfully:', data);
      } catch (emailError: any) {
        // Log error but don't fail the whole operation
        console.error('⚠️ Failed to send payment receipt email:', emailError);
        console.warn('Payment was marked as paid, but email notification failed');
        // Still show success for payment, but note email issue
        setSuccess(
          `Payment marked as completed for ${payment.first_name} ${payment.last_name}. ` +
          `However, there was an issue sending the email receipt. Please contact the registrant manually.`
        );
        setPendingPayments(prev => prev.filter(p => p.id !== payment.id));
        setTimeout(() => setSuccess(null), 8000);
        setProcessing(null);
        return;
      }

      setSuccess(
        `Payment marked as completed for ${payment.first_name} ${payment.last_name}. ` +
        `A receipt has been emailed to ${payment.email}.`
      );
      
      // Remove from pending list
      setPendingPayments(prev => prev.filter(p => p.id !== payment.id));

      // Auto-clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);

    } catch (error: any) {
      console.error('Error marking payment as paid:', error);
      setError(`Failed to update payment status: ${error.message || 'Unknown error'}`);
    } finally {
      setProcessing(null);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'conference': return 'Annual Conference';
      case 'tech_conference': return 'Tech Conference';
      case 'exhibitor': return 'Exhibitor';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'conference': return 'bg-blue-100 text-blue-800';
      case 'tech_conference': return 'bg-purple-100 text-purple-800';
      case 'exhibitor': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredPayments = pendingPayments.filter(payment => {
    const matchesSearch = searchTerm === '' || 
      payment.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.school_district?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.business_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterType === 'all' || payment.type === filterType;

    return matchesSearch && matchesFilter;
  });

  if (loading || authLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-secondary mb-2">Payment Management</h1>
          <p className="text-gray-600">Review and process pending purchase order payments</p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <XCircle className="h-5 w-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <CheckCircle className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-green-800">Success</h3>
                <p className="text-sm text-green-700 mt-1">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="inline h-4 w-4 mr-1" />
                Search
              </label>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, PO number..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              />
            </div>

            {/* Filter by Type */}
            <div>
              <label htmlFor="filter" className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="inline h-4 w-4 mr-1" />
                Filter by Type
              </label>
              <select
                id="filter"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              >
                <option value="all">All Types</option>
                <option value="conference">Annual Conference</option>
                <option value="tech_conference">Tech Conference</option>
                <option value="exhibitor">Exhibitor</option>
              </select>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Total Pending</p>
                <p className="text-3xl font-bold text-secondary">{filteredPayments.length}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                <p className="text-3xl font-bold text-primary">
                  ${filteredPayments.reduce((sum, p) => sum + p.total_amount, 0).toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Average Amount</p>
                <p className="text-3xl font-bold text-gray-700">
                  ${filteredPayments.length > 0 
                    ? (filteredPayments.reduce((sum, p) => sum + p.total_amount, 0) / filteredPayments.length).toFixed(2)
                    : '0.00'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Payments Table */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {filteredPayments.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || filterType !== 'all' 
                  ? 'No matching pending payments'
                  : 'No pending payments'
                }
              </h3>
              <p className="text-gray-500">
                {searchTerm || filterType !== 'all' 
                  ? 'Try adjusting your search or filter criteria'
                  : 'All purchase order payments have been processed'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name / Organization
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PO Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(payment.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getTypeColor(payment.type)}`}>
                          {getTypeLabel(payment.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {payment.first_name} {payment.last_name}
                        </div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {payment.school_district || payment.business_name || payment.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                          {payment.po_number}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ${payment.total_amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => markAsPaid(payment)}
                          disabled={processing === payment.id}
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {processing === payment.id ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1.5" />
                              Mark as Paid
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info Box */}
        {pendingPayments.length > 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Payment Processing Guidelines:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Verify the PO number matches the physical payment received</li>
                  <li>Confirm the payment amount matches the registration total</li>
                  <li>Once marked as paid, the status cannot be changed back to pending</li>
                  <li>Payment timestamp will be automatically recorded</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
