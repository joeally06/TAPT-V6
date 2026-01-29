import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Trash2, Search, Calendar, MapPin, Users, Building, User, RefreshCw, Mail } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

interface RegionalLuncheonRegistration {
  id: string;
  name: string;
  email: string;
  district_organization: string;
  number_of_attendees: number;
  preferred_region: string;
  created_at: string;
}

const AdminRegionalLuncheonRegistrations: React.FC = () => {
  const [registrations, setRegistrations] = useState<RegionalLuncheonRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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

  return (
    <AdminLayout>
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
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 text-blue-600 mr-2" />
                          <span className="text-sm text-gray-900">{reg.preferred_region}</span>
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
                          <button
                            onClick={() => setConfirmDelete(reg.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete registration"
                          >
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
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
              const csv = [
                ['Name', 'Email', 'District/Organization', 'Number of Attendees', 'Preferred Region', 'Submitted'],
                ...filteredRegistrations.map(reg => [
                  reg.name,
                  reg.email,
                  reg.district_organization,
                  reg.number_of_attendees,
                  reg.preferred_region,
                  new Date(reg.created_at).toLocaleString()
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
