import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Archive, Search, Download, Loader2 } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { useAuth } from '../context/AuthContext';
import { fetchAllPages } from '../lib/rollover';
import {
  ARCHIVE_TYPES,
  getArchiveType,
  groupBatches,
  groupChildren,
  buildArchiveCsv,
  batchMatchesSearch,
  formatArchiveDate,
  type ArchiveBatch,
  type ArchiveKind,
  type ArchiveRow
} from '../lib/archiveTypes';

export const AdminArchives: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [archiveType, setArchiveType] = useState<ArchiveKind>('conference');
  const [archives, setArchives] = useState<Partial<Record<ArchiveKind, ArchiveRow[]>>>({});
  // Archive tables that could not be read (for example a table the database does not have yet)
  const [failedKinds, setFailedKinds] = useState<ArchiveKind[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cycleNames, setCycleNames] = useState<Record<string, string>>({});
  const [exportingId, setExportingId] = useState<string | null>(null);

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
    setLoading(true);
    setError(null);

    const loaded: Partial<Record<ArchiveKind, ArchiveRow[]>> = {};
    const failed: ArchiveKind[] = [];

    // Every page of every archive, so batches over 1000 rows are not cut short. One archive failing does not hide the rest.
    for (const type of ARCHIVE_TYPES) {
      try {
        loaded[type.kind] = await fetchAllPages<ArchiveRow>(type.table, { orderColumn: 'archived_at' });
      } catch (loadError) {
        console.error(`Error fetching ${type.table}:`, loadError);
        failed.push(type.kind);
      }
    }

    setArchives(loaded);
    setFailedKinds(failed);
    if (failed.length === ARCHIVE_TYPES.length) {
      setError('Failed to load archives');
    }
    await loadCycleNames(loaded);
    setLoading(false);
  };

  // Names of the cycles (settings rows) the archives belong to, for example "2026 Conference"
  const loadCycleNames = async (loaded: Partial<Record<ArchiveKind, ArchiveRow[]>>) => {
    const names: Record<string, string> = {};
    for (const type of ARCHIVE_TYPES) {
      const ids = [
        ...new Set(
          (loaded[type.kind] ?? [])
            .map((row) => row.archived_settings_id)
            .filter((id): id is string => typeof id === 'string' && id !== '')
        )
      ];
      if (ids.length === 0) continue;
      try {
        const { data, error: namesError } = await supabase.from(type.settingsTable).select('id, name').in('id', ids);
        if (namesError) throw namesError;
        for (const row of (data ?? []) as unknown as { id: string; name: string }[]) names[row.id] = row.name;
      } catch (namesError) {
        // The names are only a label; the archives themselves still show
        console.error(`Error loading cycle names from ${type.settingsTable}:`, namesError);
      }
    }
    setCycleNames(names);
  };

  const config = getArchiveType(archiveType);

  const batches = useMemo(() => groupBatches(archives[archiveType] ?? []), [archives, archiveType]);
  const visibleBatches = useMemo(
    () => batches.filter((batch) => batchMatchesSearch(config, batch, searchTerm, batch.settingsId ? cycleNames[batch.settingsId] : null)),
    [batches, config, searchTerm, cycleNames]
  );
  const searching = searchTerm.trim() !== '';

  // Downloads one archive as a CSV. Attendees / booth participants are fetched when needed.
  const exportBatch = async (batch: ArchiveBatch) => {
    setExportingId(batch.archiveId);
    setError(null);
    setNotice(null);
    try {
      let childrenByParent = new Map<string, ArchiveRow[]>();
      if (config.child) {
        try {
          const children = await fetchAllPages<ArchiveRow>(config.child.table, {
            orderColumn: 'archived_at',
            inValues: ['archive_id', [batch.archiveId]]
          });
          childrenByParent = groupChildren(children, config.child.foreignKey);
        } catch (childError) {
          // The download still works without the attendee / participant details, but say so
          console.error(`Error loading ${config.child.table}:`, childError);
          setNotice('The file was downloaded without attendee or booth participant details because they could not be loaded.');
        }
      }

      const csvContent = buildArchiveCsv(config, batch.rows, childrenByParent);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${archiveType}-archive-${batch.archiveId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (exportError) {
      console.error('Error exporting archive:', exportError);
      setError('Could not download this archive. Please try again.');
    } finally {
      setExportingId(null);
    }
  };

  const failedLabels = failedKinds.map((kind) => getArchiveType(kind).tabLabel);

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

        {notice && (
          <div role="status" className="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4">
            <p className="text-amber-800">{notice}</p>
          </div>
        )}

        {failedLabels.length > 0 && failedLabels.length < ARCHIVE_TYPES.length && (
          <div role="status" className="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4">
            <p className="text-amber-800">
              Some archives could not be loaded: {failedLabels.join(', ')}. The database may not have been updated for
              them yet.
            </p>
          </div>
        )}

        {/* Archive Type Selector */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {ARCHIVE_TYPES.map((type) => (
              <button
                key={type.kind}
                onClick={() => setArchiveType(type.kind)}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  archiveType === type.kind
                    ? 'bg-primary text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {type.tabLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <label htmlFor="archive-search" className="sr-only">
              Search archives
            </label>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              id="archive-search"
              type="text"
              placeholder="Search by cycle, date, name, district or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
            />
          </div>
          <p aria-live="polite" className="mt-2 text-sm text-gray-500 min-h-[1.25rem]">
            {searching && !loading ? `${visibleBatches.length} of ${batches.length} archives match` : ''}
          </p>
        </div>

        {/* Archives List */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
              <p className="mt-2 text-gray-600">Loading archives...</p>
            </div>
          ) : failedKinds.includes(archiveType) ? (
            <div className="p-8 text-center">
              <Archive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">These archives could not be loaded</h3>
              <p className="mt-1 text-gray-500">Reload the page to try again.</p>
            </div>
          ) : batches.length === 0 ? (
            <div className="p-8 text-center">
              <Archive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Archives Found</h3>
              <p className="mt-1 text-gray-500">There are no archived {config.title.toLowerCase()} yet.</p>
            </div>
          ) : visibleBatches.length === 0 ? (
            <div className="p-8 text-center">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No archives match your search</h3>
              <p className="mt-1 text-gray-500">Try a different name, district, email, date or cycle.</p>
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
                      Cycle
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {config.countLabel}
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {visibleBatches.map((batch) => (
                    <tr key={batch.archiveId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatArchiveDate(batch.archivedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(batch.settingsId && cycleNames[batch.settingsId]) || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {batch.rows.length} items
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => exportBatch(batch)}
                          disabled={exportingId !== null}
                          aria-label={`Download CSV of the archive from ${formatArchiveDate(batch.archivedAt)}`}
                          className="text-primary hover:text-primary/80 disabled:opacity-50"
                        >
                          {exportingId === batch.archiveId ? (
                            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Download className="h-5 w-5" aria-hidden="true" />
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
      </div>
    </AdminLayout>
  );
};

export default AdminArchives;
