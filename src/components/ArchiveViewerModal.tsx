import React, { useState, useEffect } from 'react';
import { X, Download, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ArchivedRegistration {
  id: string;
  school_district: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  total_attendees: number;
  total_amount: number;
  created_at: string;
  archived_at: string;
  archive_id: string;
}

interface ArchivedAttendee {
  id: string;
  registration_id: string;
  first_name: string;
  last_name: string;
  email: string;
  archived_at: string;
  archive_id: string;
}

interface ArchiveViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'conference' | 'tech-conference';
}

const ArchiveViewerModal: React.FC<ArchiveViewerModalProps> = ({
  isOpen,
  onClose,
  type
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [archives, setArchives] = useState<ArchivedRegistration[]>([]);
  const [attendees, setAttendees] = useState<Record<string, ArchivedAttendee[]>>({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchArchiveYears();
    }
  }, [isOpen, type]);

  useEffect(() => {
    if (selectedYear) {
      fetchArchives(selectedYear);
    }
  }, [selectedYear, type]);

  const fetchArchiveYears = async () => {
    try {
      setLoading(true);
      setError(null);

      const tableName = type === 'conference' 
        ? 'conference_registrations_archive' 
        : 'tech_conference_registrations_archive';

      const { data, error } = await supabase
        .from(tableName)
        .select('archived_at');

      if (error) throw error;

      const uniqueYears = [...new Set(data.map(item => 
        new Date(item.archived_at).getFullYear()
      ))].sort((a, b) => b - a);

      setYears(uniqueYears);
      if (uniqueYears.length > 0) {
        setSelectedYear(uniqueYears[0]);
      }
    } catch (error: any) {
      console.error('Error fetching archive years:', error);
      setError('Failed to load archive years');
    } finally {
      setLoading(false);
    }
  };

  const fetchArchives = async (year: number) => {
    try {
      setLoading(true);
      setError(null);

      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const registrationsTable = type === 'conference' 
        ? 'conference_registrations_archive' 
        : 'tech_conference_registrations_archive';

      const attendeesTable = type === 'conference'
        ? 'conference_attendees_archive'
        : 'tech_conference_attendees_archive';

      // Fetch registrations
      const { data: registrations, error: regError } = await supabase
        .from(registrationsTable)
        .select('*')
        .gte('archived_at', startDate)
        .lte('archived_at', endDate)
        .order('archived_at', { ascending: false });

      if (regError) throw regError;

      // Fetch attendees for all registrations
      const archiveIds = [...new Set(registrations.map(reg => reg.archive_id))];
      
      const { data: attendeesData, error: attError } = await supabase
        .from(attendeesTable)
        .select('*')
        .in('archive_id', archiveIds);

      if (attError) throw attError;

      // Group attendees by registration_id
      const attendeesByRegistration = attendeesData.reduce((acc, attendee) => {
        if (!acc[attendee.registration_id]) {
          acc[attendee.registration_id] = [];
        }
        acc[attendee.registration_id].push(attendee);
        return acc;
      }, {} as Record<string, ArchivedAttendee[]>);

      setArchives(registrations);
      setAttendees(attendeesByRegistration);
    } catch (error: any) {
      console.error('Error fetching archives:', error);
      setError('Failed to load archives');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!archives.length) return;

    const headers = [
      'Archive Date',
      'School District',
      'Primary Contact',
      'Email',
      'Phone',
      'Total Attendees',
      'Total Amount',
      'Additional Attendees'
    ];

    const csvData = archives.map(reg => {
      const regAttendees = attendees[reg.id] || [];
      const additionalAttendees = regAttendees
        .map(a => `${a.first_name} ${a.last_name} (${a.email})`)
        .join('; ');

      return [
        new Date(reg.archived_at).toLocaleDateString(),
        reg.school_district,
        `${reg.first_name} ${reg.last_name}`,
        reg.email,
        reg.phone,
        reg.total_attendees,
        `$${reg.total_amount.toFixed(2)}`,
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
    link.setAttribute('download', `${type}-archives-${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredArchives = archives.filter(reg => {
    const searchStr = searchTerm.toLowerCase();
    return (
      reg.school_district.toLowerCase().includes(searchStr) ||
      reg.first_name.toLowerCase().includes(searchStr) ||
      reg.last_name.toLowerCase().includes(searchStr) ||
      reg.email.toLowerCase().includes(searchStr)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl mx-4 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">
              {type === 'conference' ? 'Conference' : 'Tech Conference'} Archives
            </h2>
            <button
              onClick={onClose}
              aria-label="Close archives modal"
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-6 flex-grow overflow-auto">
          {error ? (
            <div className="text-center text-red-600">
              <p>{error}</p>
            </div>
          ) : loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <select
                    value={selectedYear || ''}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  >
                    {years.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search archives..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                    />
                  </div>
                </div>

                <button
                  onClick={exportToCSV}
                  disabled={!archives.length}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Export to CSV
                </button>
              </div>

              {filteredArchives.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No archives found for the selected year.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Archive Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          School District
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Primary Contact
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Attendees
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Amount
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Additional Attendees
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredArchives.map((reg) => (
                        <tr key={reg.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(reg.archived_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {reg.school_district}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {reg.first_name} {reg.last_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {reg.email}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {reg.total_attendees}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ${reg.total_amount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <ul className="list-disc list-inside">
                              {(attendees[reg.id] || []).map((attendee, index) => (
                                <li key={attendee.id}>
                                  {attendee.first_name} {attendee.last_name} ({attendee.email})
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArchiveViewerModal;