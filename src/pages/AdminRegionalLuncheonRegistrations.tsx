import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Trash2, Search, Calendar, MapPin, Users, Building, User, RefreshCw, Mail, Eye, X, Send, Loader2 } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

interface RegionalLuncheonRegistration {
  id: string;
  name: string;
  email: string;
  district_organization: string;
  number_of_attendees: number;
  preferred_region: string;
  selected_regions?: string[];
  created_at: string;
}

const AdminRegionalLuncheonRegistrations: React.FC = () => {
  const [registrations, setRegistrations] = useState<RegionalLuncheonRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [viewRegistration, setViewRegistration] = useState<RegionalLuncheonRegistration | null>(null);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const regions = ['West Region', 'Middle Region', 'Cookeville Region', 'Greeneville Region', 'East Region'];

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('regional_luncheon_registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching registrations:', error);
        return;
      }

      setRegistrations(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('regional_luncheon_registrations')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting registration:', error);
        alert('Failed to delete registration');
        return;
      }

      setRegistrations(registrations.filter(reg => reg.id !== id));
      setConfirmDelete(null);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to delete registration');
    }
  };

  const filteredRegistrations = registrations.filter(reg => {
    const matchesSearch = 
      reg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.district_organization.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRegion = filterRegion === 'all' || reg.preferred_region === filterRegion;

    return matchesSearch && matchesRegion;
  });

  // Calculate statistics
  const stats = {
    total: registrations.length,
    byRegion: regions.map(region => ({
      name: region,
      count: registrations.filter(r => r.preferred_region === region).length,
      attendees: registrations
        .filter(r => r.preferred_region === region)
        .reduce((sum, r) => sum + r.number_of_attendees, 0)
    })),
    totalAttendees: registrations.reduce((sum, r) => sum + r.number_of_attendees, 0)
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    );
  }

  // Get regions to display (use selected_regions if available, otherwise preferred_region)
  const getDisplayRegions = (reg: RegionalLuncheonRegistration): string[] => {
    if (reg.selected_regions && Array.isArray(reg.selected_regions) && reg.selected_regions.length > 0) {
      return reg.selected_regions;
    }
    return reg.preferred_region ? [reg.preferred_region] : [];
  };

  // Resend confirmation email
  const handleResendEmail = async (registrationId: string) => {
    setResendingEmail(true);
    setEmailSent(false);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('You must be logged in to perform this action');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resend-regional-luncheon-confirmation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ registrationId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to resend email');
      }

      setEmailSent(true);
      // Reset success message after 3 seconds
      setTimeout(() => setEmailSent(false), 3000);
    } catch (error) {
      console.error('Error resending email:', error);
      alert(error instanceof Error ? error.message : 'Failed to resend confirmation email');
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <AdminLayout>
      {/* View Registration Modal */}
      {viewRegistration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-blue-600 rounded-t-lg">
              <h3 className="text-xl font-bold text-white">Registration Details</h3>
              <button
                onClick={() => setViewRegistration(null)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Name */}
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="text-gray-900 font-medium">{viewRegistration.name}</p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <a 
                    href={`mailto:${viewRegistration.email}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {viewRegistration.email}
                  </a>
                </div>
              </div>

              {/* Organization */}
              <div className="flex items-start gap-3">
                <Building className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">District/Organization</p>
                  <p className="text-gray-900 font-medium">{viewRegistration.district_organization}</p>
                </div>
              </div>

              {/* Number of Attendees */}
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Number of Attendees</p>
                  <p className="text-gray-900 font-medium">{viewRegistration.number_of_attendees} {viewRegistration.number_of_attendees > 1 ? 'people' : 'person'}</p>
                </div>
              </div>

              {/* Selected Regions */}
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Registered Region(s)</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {getDisplayRegions(viewRegistration).map((region, idx) => (
                      <span 
                        key={idx}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                      >
                        {region}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Submitted Date */}
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Submitted</p>
                  <p className="text-gray-900 font-medium">
                    {new Date(viewRegistration.created_at).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>

              {/* Registration ID */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-400">Registration ID: {viewRegistration.id}</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              {emailSent && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirmation email sent successfully!
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => handleResendEmail(viewRegistration.id)}
                  disabled={resendingEmail}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Resend Confirmation
                    </>
                  )}
                </button>
                <a
                  href={`mailto:${viewRegistration.email}`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  New Email
                </a>
                <button
                  onClick={() => setViewRegistration(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Regional Luncheon Registrations</h1>
            <p className="text-gray-600 mt-1">April 2026</p>
          </div>
          <button
            onClick={fetchRegistrations}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Registrations</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <Calendar className="w-12 h-12 text-blue-600 opacity-20" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Attendees</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalAttendees}</p>
              </div>
              <Users className="w-12 h-12 text-green-600 opacity-20" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Average Group Size</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.total > 0 ? (stats.totalAttendees / stats.total).toFixed(1) : '0'}
                </p>
              </div>
              <User className="w-12 h-12 text-purple-600 opacity-20" />
            </div>
          </div>
        </div>

        {/* Regional Breakdown */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Registration by Region</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {stats.byRegion.map(region => (
              <div key={region.name} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <p className="font-semibold text-sm text-gray-900">{region.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-gray-900">{region.count}</p>
                  <p className="text-xs text-gray-500">{region.attendees} attendees</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="inline w-4 h-4 mr-1" />
                Search
              </label>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or organization..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="md:w-64">
              <label htmlFor="filterRegion" className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="inline w-4 h-4 mr-1" />
                Filter by Region
              </label>
              <select
                id="filterRegion"
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Regions</option>
                {regions.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Registrations Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    District/Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attendees
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preferred Region
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      {searchTerm || filterRegion !== 'all' 
                        ? 'No registrations match your filters'
                        : 'No registrations yet'}
                    </td>
                  </tr>
                ) : (
                  filteredRegistrations.map((reg) => (
                    <tr key={reg.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="w-4 h-4 text-gray-400 mr-2" />
                          <div className="text-sm font-medium text-gray-900">{reg.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Mail className="w-4 h-4 text-gray-400 mr-2" />
                          <a 
                            href={`mailto:${reg.email}`}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            {reg.email}
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <Building className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                          <div className="text-sm text-gray-900">{reg.district_organization}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Users className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">{reg.number_of_attendees}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <div className="text-sm text-gray-900">
                            {getDisplayRegions(reg).length > 1 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {getDisplayRegions(reg).length} regions
                              </span>
                            ) : (
                              reg.preferred_region
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(reg.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {confirmDelete === reg.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleDelete(reg.id)}
                              className="text-red-600 hover:text-red-900 font-semibold"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => setViewRegistration(reg)}
                              className="text-blue-600 hover:text-blue-900"
                              title="View registration details"
                            >
                              <Eye className="w-4 h-4 inline" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(reg.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete registration"
                            >
                              <Trash2 className="w-4 h-4 inline" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Export Button */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <button
            onClick={() => {
              // Helper to escape CSV values that contain commas or quotes
              const escapeCSV = (value: string | number): string => {
                const str = String(value);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                  return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
              };

              const csv = [
                ['Name', 'Email', 'District/Organization', 'Number of Attendees', 'Selected Regions', 'Submitted'],
                ...filteredRegistrations.map(reg => [
                  escapeCSV(reg.name),
                  escapeCSV(reg.email),
                  escapeCSV(reg.district_organization),
                  reg.number_of_attendees,
                  escapeCSV(getDisplayRegions(reg).join('; ')),
                  escapeCSV(new Date(reg.created_at).toLocaleString())
                ])
              ].map(row => row.join(',')).join('\n');

              const blob = new Blob([csv], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `regional-luncheon-registrations-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
            }}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Export to CSV ({filteredRegistrations.length} registrations)
          </button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminRegionalLuncheonRegistrations;
