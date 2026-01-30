import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Archive, Search, Download } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { useAuth } from '../context/AuthContext';

interface ArchiveItem {
  id: string;
  archive_id: string;
  archived_at: string;
  [key: string]: any;
}

export const AdminArchives: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiveType, setArchiveType] = useState<'conference' | 'tech-conference' | 'hall-of-fame' | 'exhibitor' | 'student-scholarship'>('conference');
  const [archives, setArchives] = useState<Record<string, ArchiveItem[]>>({});
  const [searchTerm, setSearchTerm] = useState('');

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
      fetchArchives();
    }
    // eslint-disable-next-line
  }, [authLoading, user]);

  const fetchArchives = async () => {
    try {
      setLoading(true);
      setError(null);

      const tables = {
        conference: 'conference_registrations_archive',
        'tech-conference': 'tech_conference_registrations_archive',
        'hall-of-fame': 'hall_of_fame_nominations_archive',
        'exhibitor': 'exhibitor_registrations_archive',
        'student-scholarship': 'student_scholarship_applications_archive'
      };

      const archiveData: Record<string, ArchiveItem[]> = {};

      for (const [key, table] of Object.entries(tables)) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .order('archived_at', { ascending: false });

        if (error) throw error;

        // Group by archive_id
        const grouped = (data || []).reduce((acc: Record<string, ArchiveItem[]>, item) => {
          const archiveId = item.archive_id;
          if (!acc[archiveId]) {
            acc[archiveId] = [];
          }
          acc[archiveId].push(item);
          return acc;
        }, {});

        archiveData[key] = Object.values(grouped).flat();
      }

      setArchives(archiveData);
    } catch (error: any) {
      console.error('Error fetching archives:', error);
      setError('Failed to load archives');
    } finally {
      setLoading(false);
    }
  };

  const exportArchive = (archiveId: string) => {
    const archiveItems = archives[archiveType].filter(item => item.archive_id === archiveId);
    const csvContent = convertToCSV(archiveItems);
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${archiveType}-archive-${archiveId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const convertToCSV = (items: ArchiveItem[]) => {
    if (items.length === 0) return '';
    
    // Define headers based on archive type
    let headers: string;
    
    switch (archiveType) {
      case 'conference':
      case 'tech-conference':
        headers = ['School District', 'Name', 'Email', 'Phone', 'Total Attendees', 'Total Amount', 'Archived Date'].join(',');
        break;
      case 'hall-of-fame':
        headers = ['Nominee', 'District', 'Region', 'Years of Service', 'Status', 'Archived Date'].join(',');
        break;
      case 'exhibitor':
        headers = ['Business Name', 'Contact Name', 'Email', 'Phone', 'City', 'State', 'Archived Date'].join(',');
        break;
      case 'student-scholarship':
        headers = ['Name', 'Email', 'High School', 'School District', 'Status', 'Archived Date'].join(',');
        break;
      default:
        headers = Object.keys(items[0])
          .filter(key => !['id', 'archive_id'].includes(key))
          .join(',');
    }
      
    // Map rows based on archive type
    const rows = items.map(item => {
      switch (archiveType) {
        case 'conference':
        case 'tech-conference':
          return [
            `"${item.school_district || ''}"`,
            `"${item.first_name || ''} ${item.last_name || ''}"`,
            `"${item.email || ''}"`,
            `"${item.phone || ''}"`,
            `"${item.total_attendees || 0}"`,
            `"${item.total_amount || 0}"`,
            `"${new Date(item.archived_at).toLocaleDateString() || ''}"`,
          ].join(',');
        case 'hall-of-fame':
          return [
            `"${item.nominee_first_name || ''} ${item.nominee_last_name || ''}"`,
            `"${item.district || ''}"`,
            `"${item.region || ''}"`,
            `"${item.years_of_service || ''}"`,
            `"${item.status || ''}"`,
            `"${new Date(item.archived_at).toLocaleDateString() || ''}"`,
          ].join(',');
        case 'exhibitor':
          return [
            `"${item.business_name || ''}"`,
            `"${item.first_name || ''} ${item.last_name || ''}"`,
            `"${item.email || ''}"`,
            `"${item.phone || ''}"`,
            `"${item.city || ''}"`,
            `"${item.state || ''}"`,
            `"${new Date(item.archived_at).toLocaleDateString() || ''}"`,
          ].join(',');
        case 'student-scholarship':
          // Handle the JSONB structure for full_name
          const fullName = item.full_name ? 
            `${item.full_name.first || ''} ${item.full_name.last || ''}` : '';
          return [
            `"${fullName}"`,
            `"${item.email || ''}"`,
            `"${item.high_school || ''}"`,
            `"${item.school_district || ''}"`,
            `"${item.application_status || ''}"`,
            `"${new Date(item.archived_at).toLocaleDateString() || ''}"`,
          ].join(',');
        default:
          return Object.entries(item)
            .filter(([key]) => !['id', 'archive_id'].includes(key))
            .map(([_, value]) => `"${value}"`)
            .join(',');
      }
    });
    
    return [headers, ...rows].join('\n');
  };

  const getArchiveTitle = (type: string) => {
    switch (type) {
      case 'conference':
        return 'Conference Registrations';
      case 'tech-conference':
        return 'Tech Conference Registrations';
      case 'hall-of-fame':
        return 'Hall of Fame Nominations';
      case 'exhibitor':
        return 'Exhibitor Registrations';
      case 'student-scholarship':
        return 'Student Scholarship Applications';
      default:
        return '';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Archives</h1>
          <p className="mt-1 text-gray-600">View and manage archived data</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Archive Type Selector */}
        <div className="mb-6">
          <div className="flex space-x-4">
            {[
              { id: 'conference', label: 'Conference' },
              { id: 'tech-conference', label: 'Tech Conference' },
              { id: 'hall-of-fame', label: 'Hall of Fame' },
              { id: 'exhibitor', label: 'Exhibitor' },
              { id: 'student-scholarship', label: 'Student Scholarship' }
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setArchiveType(type.id as typeof archiveType)}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  archiveType === type.id
                    ? 'bg-primary text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search archives..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
        </div>

        {/* Archives List */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
              <p className="mt-2 text-gray-600">Loading archives...</p>
            </div>
          ) : archives[archiveType]?.length === 0 ? (
            <div className="p-8 text-center">
              <Archive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Archives Found</h3>
              <p className="mt-1 text-gray-500">There are no archived {getArchiveTitle(archiveType).toLowerCase()} yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Archive Date
                    </th>
                    {archiveType === 'conference' || archiveType === 'tech-conference' ? (
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        School Districts
                      </th>
                    ) : archiveType === 'hall-of-fame' ? (
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nominations
                      </th>
                    ) : archiveType === 'exhibitor' ? (
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Businesses
                      </th>
                    ) : (
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Applications
                      </th>
                    )}
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(
                    archives[archiveType].reduce((acc: Record<string, ArchiveItem[]>, item) => {
                      if (!acc[item.archive_id]) {
                        acc[item.archive_id] = [];
                      }
                      acc[item.archive_id].push(item);
                      return acc;
                    }, {})
                  ).map(([archiveId, items]) => (
                    <tr key={archiveId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(items[0].archived_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {items.length} items
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => exportArchive(archiveId)}
                          className="text-primary hover:text-primary/80"
                        >
                          <Download className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminArchives;