import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, CheckCircle, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import AdminLayout from '../AdminLayout';
import ArchiveViewerModal from '../ArchiveViewerModal';
import { PaymentSummaryStrip } from './PaymentSummaryStrip';
import { PaymentFilterChips } from './PaymentFilterChips';
import {
  DeleteRegistrationButton,
  PageHeading,
  RegistrantCell,
  SearchBox,
  TableCard,
  ToolbarButton
} from './RegistrationListParts';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { BulkSelectionBar } from './BulkSelectionBar';
import { PageSelectCheckbox } from './PageSelectCheckbox';
import { PaginationBar } from './PaginationBar';
import { MarkPaidPanel } from './MarkPaidPanel';
import { RegistrationPanel, RegistrationSplit, PanelFields, PanelSection } from './RegistrationPanel';
import { RegistrationEmailActions } from './RegistrationEmailActions';
import { BulkMarkPaidDialog, BulkRemindersDialog } from './BulkRegistrationDialogs';
import { formatMoney } from '../../lib/dashboard';
import {
  TD_CLASS,
  TH_CLASS,
  formatCellDate,
  fullDate,
  openBarClass,
  paymentMethodLabel,
  rowClass,
  rowClickHandler
} from '../../lib/registrationList';
import { toCsv, downloadCsv, dateStamp } from '../../lib/csv';
import { fetchRowsForExport } from '../../lib/registrationExport';
import { buildTimeline, describeWhen } from '../../lib/registrationEmails';
import { useEmailLog, useLastReminders } from '../../lib/useEmailLog';
import { useRowSelection } from '../../lib/useRowSelection';
import { usePaymentSummary } from '../../lib/usePaymentSummary';
import { useLatestRequest } from '../../lib/useLatestRequest';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import {
  applyPaymentFilter,
  buildSearchFilter,
  formatShortDate,
  getErrorMessage,
  getPaymentState,
  type PaymentFilter
} from '../../lib/registrationPayments';

export interface PaymentRegistrationAttendee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface PaymentRegistration {
  id: string;
  school_district: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  job_title?: string | null;
  // Where invoices and payment reminders go, when it is not the registrant
  billing_email?: string | null;
  total_attendees: number;
  total_amount: number | null;
  created_at: string;
  attendees?: PaymentRegistrationAttendee[];
  meal_selections?: Array<{ id: string; label: string; price: number }> | null;
  payment_method: string | null;
  payment_status: string | null;
  po_number: string | null;
  paypal_transaction_id: string | null;
  paypal_payer_email: string | null;
  payment_completed_at: string | null;
}

export interface PaymentRegistrationsConfig {
  type: 'conference' | 'tech_conference';
  table: 'conference_registrations' | 'tech_conference_registrations';
  attendeesTable: 'conference_attendees' | 'tech_conference_attendees';
  archiveType: 'conference' | 'tech-conference';
  title: string;
  description: string;
  // For the downloaded file name, for example "conference-registrations"
  filePrefix: string;
  searchColumns: string[];
  csvHeaders: string[];
  csvRow: (registration: PaymentRegistration) => unknown[];
  // Extra labelled values for the panel (job title, meal tickets)
  extraContactFields?: (registration: PaymentRegistration) => { label: string; value: React.ReactNode }[];
  extraPaymentFields?: (registration: PaymentRegistration) => { label: string; value: React.ReactNode }[];
}

const PAGE_SIZE = 20;

// The Conference and Tech Conference registration pages: summary, filters, search, a table with ticked rows and bulk
// actions (send reminders, mark paid, export), and a side panel with the registration's history.
export const PaymentRegistrationsPage: React.FC<{ config: PaymentRegistrationsConfig }> = ({ config }) => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [registrations, setRegistrations] = useState<PaymentRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [panelRegistration, setPanelRegistration] = useState<PaymentRegistration | null>(null);
  const [bulkDialog, setBulkDialog] = useState<'reminders' | 'markPaid' | null>(null);

  const startRequest = useLatestRequest();
  // The search box updates at once; the server is asked once typing pauses
  const searchQuery = useDebouncedValue(searchTerm, 250);
  const { selected, toggle, togglePage, clear: clearSelection, deselect } = useRowSelection();
  const { summary, failed: summaryFailed, reload: loadSummary } = usePaymentSummary(
    config.table,
    !authLoading && user?.role === 'admin'
  );
  const pageIds = registrations.map((registration) => registration.id);
  const { reminders, reload: reloadReminders } = useLastReminders(config.type, pageIds);
  const { entries: emailLog, loading: emailLogLoading, reload: reloadEmailLog } = useEmailLog(
    config.type,
    panelRegistration?.id ?? null
  );

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
  }, [authLoading, user, page, searchQuery, paymentFilter]);

  const fetchRegistrations = async () => {
    const isCurrent = startRequest();
    try {
      setLoading(true);
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from(config.table)
        .select(`*, attendees:${config.attendeesTable}(*)`, { count: 'exact' });

      const searchFilter = buildSearchFilter(searchQuery, config.searchColumns);
      if (searchFilter) query = query.or(searchFilter);
      query = applyPaymentFilter(query, paymentFilter);

      // A fixed order keeps rows from repeating or going missing between pages
      const { data, error: fetchError, count } = await query
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to);
      if (fetchError) throw fetchError;
      if (!isCurrent()) return;
      setRegistrations((data ?? []) as PaymentRegistration[]);
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

  const handlePaymentFilter = (filter: PaymentFilter) => {
    setPaymentFilter(filter);
    setPage(1);
    clearSelection();
  };

  const refreshAll = () => {
    loadSummary();
    fetchRegistrations();
    reloadReminders();
  };

  const handleDelete = async (registration: PaymentRegistration) => {
    if (!confirm('Are you sure you want to delete this registration? This action cannot be undone.')) return;
    setDeleting(registration.id);
    setError('');
    setDeleteError(null);
    try {
      const { error: deleteError } = await supabase.from(config.table).delete().eq('id', registration.id);
      if (deleteError) throw deleteError;
      setSuccess('Registration deleted successfully!');
      deselect([registration.id]);
      if (panelRegistration?.id === registration.id) setPanelRegistration(null);
      refreshAll();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Failed to delete registration: ${getErrorMessage(err)}`);
      setDeleteError(`Could not delete this registration: ${getErrorMessage(err)}`);
      setTimeout(() => setError(''), 5000);
    } finally {
      setDeleting(null);
    }
  };

  const exportToCSV = async (onlyIds?: Set<string>) => {
    try {
      setExporting(true);
      setError('');
      const rows = await fetchRowsForExport<PaymentRegistration>(
        config.table,
        `*, attendees:${config.attendeesTable}(*)`,
        onlyIds
      );
      if (rows.length === 0) return;
      downloadCsv(
        `${config.filePrefix}${onlyIds ? '-selected' : ''}-${dateStamp()}.csv`,
        toCsv(config.csvHeaders, rows.map(config.csvRow))
      );
    } catch (err) {
      console.error('Error exporting registrations:', err);
      setError('Failed to export registrations');
    } finally {
      setExporting(false);
    }
  };

  const bulkActions = [
    {
      key: 'reminders',
      label: 'Send reminders',
      icon: <BellRing className="h-4 w-4" aria-hidden="true" />,
      onClick: () => setBulkDialog('reminders')
    },
    {
      key: 'mark-paid',
      label: 'Mark paid',
      icon: <CheckCircle className="h-4 w-4" aria-hidden="true" />,
      onClick: () => setBulkDialog('markPaid')
    }
  ];

  const panelState = panelRegistration ? getPaymentState(panelRegistration) : null;

  // A delete error belongs to the registration it happened on
  useEffect(() => {
    setDeleteError(null);
  }, [panelRegistration?.id]);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <PageHeading title={config.title} subtitle={config.description} />

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

        <PaymentSummaryStrip summary={summary} unavailable={summaryFailed} />

        <div className="flex flex-wrap items-center gap-2">
          <SearchBox
            id="registration-search"
            label="Search registrations"
            placeholder="Search name, district or email"
            value={searchTerm}
            onChange={handleSearch}
          />
          <PaymentFilterChips value={paymentFilter} onChange={handlePaymentFilter} />
          <div className="ml-auto flex gap-2">
            <ToolbarButton
              onClick={() => exportToCSV()}
              busy={exporting}
              disabled={summary?.registered === 0}
              icon={<Download className="h-4 w-4" aria-hidden="true" />}
            >
              {exporting ? 'Exporting...' : 'Export all to CSV'}
            </ToolbarButton>
            <ToolbarButton onClick={() => setShowArchiveModal(true)}>View archives</ToolbarButton>
          </div>
        </div>

        <BulkSelectionBar
          count={selected.size}
          exporting={exporting}
          onExport={() => exportToCSV(selected)}
          onClear={clearSelection}
          actions={bulkActions}
        />

        <RegistrationSplit panelOpen={panelRegistration !== null}>
          <div className="min-w-0 space-y-3">
            <TableCard
              loading={loading}
              isEmpty={registrations.length === 0}
              emptyText="No registrations found"
            >
              <table className="min-w-full text-sm">
                <caption className="sr-only">{config.title}</caption>
                <thead>
                  <tr>
                    <th scope="col" className={`${TH_CLASS} w-10`}>
                      <PageSelectCheckbox ids={pageIds} selected={selected} onToggle={togglePage} />
                    </th>
                    <th scope="col" className={TH_CLASS}>Registrant</th>
                    <th scope="col" className={TH_CLASS}>Payment</th>
                    <th scope="col" className={`${TH_CLASS} text-right`}>Amount</th>
                    <th scope="col" className={TH_CLASS}>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((registration) => {
                    const name = `${registration.first_name} ${registration.last_name}`;
                    const state = getPaymentState(registration);
                    const isOpen = panelRegistration?.id === registration.id;
                    const open = () => setPanelRegistration(registration);
                    return (
                      <tr
                        key={registration.id}
                        onClick={rowClickHandler(open)}
                        className={rowClass(selected.has(registration.id), isOpen)}
                      >
                        <td className={`${TD_CLASS} w-10 ${openBarClass(isOpen)}`}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${name}`}
                            checked={selected.has(registration.id)}
                            onChange={() => toggle(registration.id)}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </td>
                        <td className={TD_CLASS}>
                          <RegistrantCell
                            name={name}
                            lines={[
                              registration.school_district,
                              `${registration.total_attendees} ${registration.total_attendees === 1 ? 'attendee' : 'attendees'}`
                            ]}
                            open={isOpen}
                            onOpen={open}
                          />
                        </td>
                        <td className={TD_CLASS}>
                          <PaymentStatusBadge state={state} method={paymentMethodLabel(registration.payment_method)} />
                          {reminders[registration.id] && !state.isPaid && (
                            <p className="text-xs text-gray-500">Reminded {formatShortDate(reminders[registration.id])}</p>
                          )}
                        </td>
                        <td className={`${TD_CLASS} text-right tabular-nums`}>
                          {formatMoney(Number(registration.total_amount) || 0)}
                        </td>
                        <td className={`${TD_CLASS} whitespace-nowrap text-gray-600`} title={fullDate(registration.created_at)}>
                          {formatCellDate(registration.created_at)}
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
            title={panelRegistration ? `${panelRegistration.first_name} ${panelRegistration.last_name}` : ''}
            subtitle={panelRegistration?.school_district}
            onClose={() => setPanelRegistration(null)}
            top={
              panelRegistration && (
                <MarkPaidPanel
                  key={panelRegistration.id}
                  registration={panelRegistration}
                  type={config.type}
                  timeline={buildTimeline(panelRegistration, emailLog, { payments: true })}
                  timelineLoading={emailLogLoading}
                  onConflict={() => {
                    clearSelection();
                    refreshAll();
                  }}
                  onMarkedPaid={(id, changes) => {
                    setPanelRegistration((previous) => (previous && previous.id === id ? { ...previous, ...changes } : previous));
                    deselect([id]);
                    refreshAll();
                    reloadEmailLog();
                  }}
                />
              )
            }
            actions={
              panelRegistration && (
                <RegistrationEmailActions
                  key={panelRegistration.id}
                  type={config.type}
                  registrationId={panelRegistration.id}
                  email={panelRegistration.email}
                  reminderEmail={panelRegistration.billing_email || panelRegistration.email}
                  canRemind={Boolean(panelState?.canMarkPaid)}
                  onEmailSent={() => {
                    reloadEmailLog();
                    reloadReminders();
                  }}
                />
              )
            }
          >
            {panelRegistration && (
              <>
                <PanelSection title="Registration">
                  <PanelFields
                    fields={[
                      { label: 'Registered', value: new Date(panelRegistration.created_at).toLocaleString() },
                      { label: 'School district', value: panelRegistration.school_district }
                    ]}
                  />
                </PanelSection>

                <PanelSection title="Primary contact">
                  <PanelFields
                    fields={[
                      { label: 'Name', value: `${panelRegistration.first_name} ${panelRegistration.last_name}` },
                      ...(config.extraContactFields?.(panelRegistration) ?? []),
                      { label: 'Email', value: panelRegistration.email },
                      { label: 'Phone', value: panelRegistration.phone }
                    ]}
                  />
                </PanelSection>

                <PanelSection title="Payment details">
                  <PanelFields
                    fields={[
                      { label: 'Total attendees', value: panelRegistration.total_attendees },
                      ...(config.extraPaymentFields?.(panelRegistration) ?? []),
                      { label: 'Total amount', value: formatMoney(Number(panelRegistration.total_amount) || 0) },
                      { label: 'Payment method', value: panelRegistration.payment_method?.toUpperCase() ?? '' },
                      ...(panelRegistration.po_number ? [{ label: 'PO number', value: panelRegistration.po_number }] : []),
                      ...(panelRegistration.paypal_transaction_id
                        ? [{ label: 'PayPal transaction ID', value: panelRegistration.paypal_transaction_id }]
                        : []),
                      ...(panelRegistration.paypal_payer_email
                        ? [{ label: 'PayPal payer email', value: panelRegistration.paypal_payer_email }]
                        : []),
                      ...(panelRegistration.payment_completed_at
                        ? [{ label: 'Payment completed', value: describeWhen(panelRegistration.payment_completed_at) }]
                        : [])
                    ]}
                  />
                </PanelSection>

                {panelRegistration.attendees && panelRegistration.attendees.length > 0 && (
                  <PanelSection title="Additional attendees">
                    <ul className="space-y-2 rounded-lg bg-gray-50 p-3 text-sm">
                      {panelRegistration.attendees.map((attendee, index) => (
                        <li key={attendee.id}>
                          <span className="font-medium text-gray-900">
                            {index + 1}. {attendee.first_name} {attendee.last_name}
                          </span>
                          <span className="ml-2 break-all text-gray-500">({attendee.email})</span>
                        </li>
                      ))}
                    </ul>
                  </PanelSection>
                )}

                <DeleteRegistrationButton
                  onClick={() => handleDelete(panelRegistration)}
                  busy={deleting === panelRegistration.id}
                  error={deleteError}
                />
              </>
            )}
          </RegistrationPanel>
        </RegistrationSplit>

        <ArchiveViewerModal isOpen={showArchiveModal} onClose={() => setShowArchiveModal(false)} type={config.archiveType} />

        <BulkRemindersDialog
          open={bulkDialog === 'reminders'}
          type={config.type}
          ids={Array.from(selected)}
          onClose={() => setBulkDialog(null)}
          onFinished={(processedIds) => {
            deselect(processedIds);
            reloadReminders();
            reloadEmailLog();
          }}
        />
        <BulkMarkPaidDialog
          open={bulkDialog === 'markPaid'}
          type={config.type}
          ids={Array.from(selected)}
          onClose={() => setBulkDialog(null)}
          onFinished={(processedIds) => {
            deselect(processedIds);
            refreshAll();
            reloadEmailLog();
          }}
        />
      </div>
    </AdminLayout>
  );
};

export default PaymentRegistrationsPage;
