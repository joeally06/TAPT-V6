import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AdminLayout from '../components/AdminLayout';
import { BulkSelectionBar } from '../components/admin/BulkSelectionBar';
import { PageSelectCheckbox } from '../components/admin/PageSelectCheckbox';
import {
  DeleteRegistrationButton,
  PageHeading,
  RegistrantCell,
  SearchBox,
  StatCard,
  TableCard,
  ToolbarButton
} from '../components/admin/RegistrationListParts';
import { PaginationBar } from '../components/admin/PaginationBar';
import { RegistrationPanel, RegistrationSplit, PanelFields, PanelSection } from '../components/admin/RegistrationPanel';
import { RegistrationEmailActions } from '../components/admin/RegistrationEmailActions';
import { PaymentTimeline } from '../components/admin/PaymentTimeline';
import { toCsv, downloadCsv, dateStamp } from '../lib/csv';
import {
  TD_CLASS,
  TH_CLASS,
  chipClass,
  formatCellDate,
  fullDate,
  openBarClass,
  rowClass,
  rowClickHandler
} from '../lib/registrationList';
import { fetchRowsForExport } from '../lib/registrationExport';
import { buildTimeline } from '../lib/registrationEmails';
import { useEmailLog } from '../lib/useEmailLog';
import { useRowSelection } from '../lib/useRowSelection';
import { useLatestRequest } from '../lib/useLatestRequest';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { getErrorMessage } from '../lib/registrationPayments';
import {
  LUNCHEON_REGIONS,
  applyLuncheonFilters,
  fetchLuncheonForExport,
  getDisplayRegions,
  useLuncheonSummary,
  type LuncheonRegistration
} from '../lib/luncheonRegistrations';

const PAGE_SIZE = 20;

const CSV_HEADERS = ['Name', 'Email', 'District/Organization', 'Number of Attendees', 'Selected Regions', 'Submitted'];

const AdminRegionalLuncheonRegistrations: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [registrations, setRegistrations] = useState<LuncheonRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [region, setRegion] = useState('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);
  const [panelRegistration, setPanelRegistration] = useState<LuncheonRegistration | null>(null);

  const startRequest = useLatestRequest();
  // The search box updates at once; the server is asked once typing pauses
  const searchQuery = useDebouncedValue(searchTerm, 250);
  const { selected, toggle, togglePage, clear: clearSelection, deselect } = useRowSelection();
  const isAdmin = !authLoading && user?.role === 'admin';
  const { summary, failed: summaryFailed, reload: loadSummary } = useLuncheonSummary(isAdmin);
  const { entries: emailLog, loading: emailLogLoading, reload: reloadEmailLog } = useEmailLog(
    'regional_luncheon',
    panelRegistration?.id ?? null
  );
  const pageIds = registrations.map((registration) => registration.id);

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
      fetchRegistrations();
    }
    // eslint-disable-next-line
  }, [authLoading, user, page, searchQuery, region]);

  // The event these registrations are for (the one that is active now)
  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from('regional_luncheon_settings')
      .select('name')
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => setEventName(data?.name ?? null));
  }, [isAdmin]);

  const fetchRegistrations = async () => {
    const isCurrent = startRequest();
    try {
      setLoading(true);
      const from = (page - 1) * PAGE_SIZE;
      const query = applyLuncheonFilters(
        supabase.from('regional_luncheon_registrations').select('*', { count: 'exact' }),
        { search: searchQuery, region }
      );
      // A fixed order keeps rows from repeating or going missing between pages
      const { data, error: fetchError, count } = await query
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (fetchError) throw fetchError;
      if (!isCurrent()) return;
      setRegistrations((data ?? []) as LuncheonRegistration[]);
      setTotalCount(count || 0);
      setError('');
    } catch (err) {
      console.error('Error fetching registrations:', err);
      if (isCurrent()) setError('Failed to load registrations');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1);
    clearSelection();
  };

  const handleRegion = (next: string) => {
    setRegion(next);
    setPage(1);
    clearSelection();
  };

  const handleDelete = async (registration: LuncheonRegistration) => {
    if (!confirm(`Delete the registration for ${registration.name}? This cannot be undone.`)) return;
    setDeleting(registration.id);
    setError('');
    setDeleteError(null);
    try {
      const { error: deleteError } = await supabase
        .from('regional_luncheon_registrations')
        .delete()
        .eq('id', registration.id);
      if (deleteError) throw deleteError;
      setSuccess('Registration deleted successfully!');
      deselect([registration.id]);
      if (panelRegistration?.id === registration.id) setPanelRegistration(null);
      loadSummary();
      fetchRegistrations();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Failed to delete registration: ${getErrorMessage(err)}`);
      setDeleteError(`Could not delete this registration: ${getErrorMessage(err)}`);
    } finally {
      setDeleting(null);
    }
  };

  // Ticked rows, or everything matching the current search and region
  const exportToCSV = async (onlyIds?: Set<string>) => {
    try {
      setExporting(true);
      setError('');
      const rows = onlyIds
        ? await fetchRowsForExport<LuncheonRegistration>('regional_luncheon_registrations', '*', onlyIds)
        : await fetchLuncheonForExport({ search: searchQuery, region });
      if (rows.length === 0) return;
      downloadCsv(
        `regional-luncheon-registrations${onlyIds ? '-selected' : ''}-${dateStamp()}.csv`,
        toCsv(
          CSV_HEADERS,
          rows.map((reg) => [
            reg.name,
            reg.email,
            reg.district_organization,
            reg.number_of_attendees,
            getDisplayRegions(reg).join('; '),
            new Date(reg.created_at).toLocaleString()
          ])
        )
      );
    } catch (err) {
      console.error('Error exporting registrations:', err);
      setError('Failed to export registrations');
    } finally {
      setExporting(false);
    }
  };

  // A delete error belongs to the registration it happened on
  useEffect(() => {
    setDeleteError(null);
  }, [panelRegistration?.id]);

  const regionCount = (name: string): number | null => summary?.byRegion.find((r) => r.name === name)?.count ?? null;
  const filtered = searchQuery.trim() !== '' || region !== 'all';

  return (
    <AdminLayout>
      <div className="space-y-4">
        <PageHeading title="Regional Luncheon Registrations" subtitle={eventName} />

        {success && (
          <div role="status" className="rounded-md bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">{success}</p>
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-md bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {summary ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3" role="group" aria-label="Registration summary">
            <StatCard label="Registrations" value={String(summary.total)} />
            <StatCard label="Attendees" value={String(summary.totalAttendees)} />
            <StatCard
              label="Average group size"
              value={summary.total > 0 ? (summary.totalAttendees / summary.total).toFixed(1) : '0'}
            />
          </div>
        ) : summaryFailed ? (
          <p role="status" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Totals could not be loaded. The list below still works.
          </p>
        ) : (
          <div className="h-[62px] animate-pulse rounded-lg bg-gray-200" aria-hidden="true" />
        )}

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox
              id="registration-search"
              label="Search registrations"
              placeholder="Search name, email or organization"
              value={searchTerm}
              onChange={handleSearch}
            />
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by region">
              {['all', ...LUNCHEON_REGIONS].map((name) => {
                const active = name === region;
                const count = name === 'all' ? summary?.total ?? null : regionCount(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleRegion(name)}
                    aria-pressed={active}
                    className={chipClass(active)}
                  >
                    {name === 'all' ? 'All regions' : name}
                    {count !== null && <span className="ml-1.5 tabular-nums opacity-80">({count})</span>}
                  </button>
                );
              })}
            </div>
            <div className="ml-auto flex gap-2">
              <ToolbarButton
                onClick={() => exportToCSV()}
                busy={exporting}
                disabled={totalCount === 0}
                icon={<Download className="h-4 w-4" aria-hidden="true" />}
              >
                {exporting ? 'Exporting...' : filtered ? `Export ${totalCount} matching to CSV` : 'Export all to CSV'}
              </ToolbarButton>
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-500">Someone who signed up for several regions is counted in each of them.</p>
        </div>

        <BulkSelectionBar
          count={selected.size}
          exporting={exporting}
          onExport={() => exportToCSV(selected)}
          onClear={clearSelection}
        />

        <RegistrationSplit panelOpen={panelRegistration !== null}>
          <div className="min-w-0 space-y-3">
            <TableCard
              loading={loading}
              isEmpty={registrations.length === 0}
              emptyText={filtered ? 'No registrations match your filters' : 'No registrations yet'}
            >
              <table className="min-w-full text-sm">
                <caption className="sr-only">Regional luncheon registrations</caption>
                <thead>
                  <tr>
                    <th scope="col" className={`${TH_CLASS} w-10`}>
                      <PageSelectCheckbox ids={pageIds} selected={selected} onToggle={togglePage} />
                    </th>
                    <th scope="col" className={TH_CLASS}>Registrant</th>
                    <th scope="col" className={TH_CLASS}>Regions</th>
                    <th scope="col" className={`${TH_CLASS} text-right`}>Attendees</th>
                    <th scope="col" className={TH_CLASS}>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg) => {
                    const regions = getDisplayRegions(reg);
                    const isOpen = panelRegistration?.id === reg.id;
                    const open = () => setPanelRegistration(reg);
                    return (
                      <tr key={reg.id} onClick={rowClickHandler(open)} className={rowClass(selected.has(reg.id), isOpen)}>
                        <td className={`${TD_CLASS} w-10 ${openBarClass(isOpen)}`}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${reg.name}`}
                            checked={selected.has(reg.id)}
                            onChange={() => toggle(reg.id)}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </td>
                        <td className={TD_CLASS}>
                          <RegistrantCell name={reg.name} lines={[reg.district_organization]} open={isOpen} onOpen={open} />
                        </td>
                        <td className={TD_CLASS}>
                          {regions.length > 1 ? (
                            <span
                              className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800"
                              title={regions.join(', ')}
                            >
                              {regions.length} regions
                              <span className="sr-only">: {regions.join(', ')}</span>
                            </span>
                          ) : (
                            regions[0] ?? ''
                          )}
                        </td>
                        <td className={`${TD_CLASS} text-right tabular-nums`}>{reg.number_of_attendees}</td>
                        <td className={`${TD_CLASS} whitespace-nowrap text-gray-600`} title={fullDate(reg.created_at)}>
                          {formatCellDate(reg.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableCard>

            <PaginationBar page={page} pageSize={PAGE_SIZE} shown={registrations.length} total={totalCount} onPageChange={setPage} />
          </div>

          <RegistrationPanel
            open={panelRegistration !== null}
            title={panelRegistration?.name ?? ''}
            subtitle={panelRegistration?.district_organization}
            onClose={() => setPanelRegistration(null)}
            top={
              panelRegistration && (
                <PanelSection title="History">
                  <PaymentTimeline
                    items={buildTimeline(panelRegistration, emailLog, { payments: false })}
                    loading={emailLogLoading}
                  />
                </PanelSection>
              )
            }
            actions={
              panelRegistration && (
                <RegistrationEmailActions
                  key={panelRegistration.id}
                  type="regional_luncheon"
                  registrationId={panelRegistration.id}
                  email={panelRegistration.email}
                  onEmailSent={reloadEmailLog}
                />
              )
            }
          >
            {panelRegistration && (
              <>
                <PanelSection title="Registration">
                  <PanelFields
                    fields={[
                      { label: 'Name', value: panelRegistration.name },
                      {
                        label: 'Email',
                        value: (
                          <a href={`mailto:${panelRegistration.email}`} className="text-blue-600 hover:text-blue-800">
                            {panelRegistration.email}
                          </a>
                        )
                      },
                      { label: 'District/Organization', value: panelRegistration.district_organization },
                      {
                        label: 'Attendees',
                        value: `${panelRegistration.number_of_attendees} ${panelRegistration.number_of_attendees > 1 ? 'people' : 'person'}`
                      },
                      {
                        label: 'Submitted',
                        value: new Date(panelRegistration.created_at).toLocaleString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      }
                    ]}
                  />
                </PanelSection>

                <PanelSection title="Registered regions">
                  <ul className="flex flex-wrap gap-2">
                    {getDisplayRegions(panelRegistration).map((name) => (
                      <li key={name} className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                        {name}
                      </li>
                    ))}
                  </ul>
                </PanelSection>

                <p className="border-t border-gray-200 pt-3 text-xs text-gray-500">Registration ID: {panelRegistration.id}</p>

                <DeleteRegistrationButton
                  onClick={() => handleDelete(panelRegistration)}
                  busy={deleting === panelRegistration.id}
                  error={deleteError}
                />
              </>
            )}
          </RegistrationPanel>
        </RegistrationSplit>
      </div>
    </AdminLayout>
  );
};

export default AdminRegionalLuncheonRegistrations;
