import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { BellRing, CheckCircle, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AdminLayout from '../components/AdminLayout';
import { PaymentSummaryStrip } from '../components/admin/PaymentSummaryStrip';
import { PaymentFilterChips } from '../components/admin/PaymentFilterChips';
import {
  DeleteRegistrationButton,
  PageHeading,
  RegistrantCell,
  SearchBox,
  TableCard,
  ToolbarButton
} from '../components/admin/RegistrationListParts';
import { PaymentStatusBadge } from '../components/admin/PaymentStatusBadge';
import { BulkSelectionBar } from '../components/admin/BulkSelectionBar';
import { MarkPaidPanel } from '../components/admin/MarkPaidPanel';
import { PageSelectCheckbox } from '../components/admin/PageSelectCheckbox';
import { PaginationBar } from '../components/admin/PaginationBar';
import { RegistrationPanel, RegistrationSplit, PanelFields, PanelSection } from '../components/admin/RegistrationPanel';
import { RegistrationEmailActions } from '../components/admin/RegistrationEmailActions';
import { BulkMarkPaidDialog, BulkRemindersDialog } from '../components/admin/BulkRegistrationDialogs';
import { formatMoney } from '../lib/dashboard';
import {
  TD_CLASS,
  TH_CLASS,
  formatCellDate,
  fullDate,
  openBarClass,
  paymentMethodLabel,
  rowClass,
  rowClickHandler
} from '../lib/registrationList';
import { toCsv, downloadCsv, dateStamp } from '../lib/csv';
import { fetchRowsForExport } from '../lib/registrationExport';
import { buildTimeline, describeWhen } from '../lib/registrationEmails';
import { useEmailLog, useLastReminders } from '../lib/useEmailLog';
import { useRowSelection } from '../lib/useRowSelection';
import {
  applyPaymentFilter,
  buildSearchFilter,
  formatShortDate,
  getErrorMessage,
  getPaymentState,
  type PaymentFilter
} from '../lib/registrationPayments';
import { usePaymentSummary } from '../lib/usePaymentSummary';
import { useLatestRequest } from '../lib/useLatestRequest';
import { useDebouncedValue } from '../lib/useDebouncedValue';

interface ExhibitorParticipant {
  id: string;
  first_name: string;
  last_name: string;
  role: string | null;
  created_at: string;
}

interface ExhibitorRegistration {
  id: string;
  business_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  mobile_phone: string | null;
  street_address: string;
  street_address2: string | null;
  city: string;
  state: string;
  zip_code: string;
  booth_requirements: string | null;
  products_description: string | null;
  additional_comments: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  total_amount: number | null;
  // Payment fields
  payment_method: string | null;
  payment_status: string | null;
  po_number: string | null;
  paypal_transaction_id: string | null;
  paypal_payer_email: string | null;
  payment_completed_at: string | null;
  // Participants
  participants?: ExhibitorParticipant[];
}

const PAGE_SIZE = 20;
const SELECT = '*, participants:exhibitor_participants(*)';

const AdminExhibitorRegistrations: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [registrations, setRegistrations] = useState<ExhibitorRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [panelRegistration, setPanelRegistration] = useState<ExhibitorRegistration | null>(null);
  const [sortField, setSortField] = useState<keyof ExhibitorRegistration>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [bulkDialog, setBulkDialog] = useState<'reminders' | 'markPaid' | null>(null);
  const { summary, failed: summaryFailed, reload: loadSummary } = usePaymentSummary(
    'exhibitor_registrations',
    !authLoading && user?.role === 'admin'
  );
  const startRequest = useLatestRequest();
  // The search box updates at once; the server is asked once typing pauses
  const searchQuery = useDebouncedValue(searchTerm, 250);
  const { selected, toggle, togglePage, clear: clearSelection, deselect } = useRowSelection();
  const pageIds = registrations.map((registration) => registration.id);
  const { reminders, reload: reloadReminders } = useLastReminders('exhibitor', pageIds);
  const { entries: emailLog, loading: emailLogLoading, reload: reloadEmailLog } = useEmailLog(
    'exhibitor',
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
  }, [authLoading, user, page, sortField, sortDirection, searchQuery, paymentFilter]);

  const fetchRegistrations = async () => {
    const isCurrent = startRequest();
    try {
      setLoading(true);
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase.from('exhibitor_registrations').select(SELECT, { count: 'exact' });

      const searchFilter = buildSearchFilter(searchQuery, [
        'business_name',
        'first_name',
        'last_name',
        'email',
        'products_description'
      ]);
      if (searchFilter) query = query.or(searchFilter);
      query = applyPaymentFilter(query, paymentFilter);

      // The chosen sort first, then id, so rows do not repeat or go missing between pages
      const { data, error: fetchError, count } = await query
        .order(sortField, { ascending: sortDirection === 'asc' })
        .order('id', { ascending: true })
        .range(from, to);

      if (fetchError) throw fetchError;
      if (!isCurrent()) return;
      setRegistrations((data ?? []) as ExhibitorRegistration[]);
      setTotalCount(count || 0);
      setError(null);
    } catch (err) {
      console.error('Error fetching registrations:', err);
      if (isCurrent()) setError('Failed to load registrations');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  };

  const refreshAll = () => {
    loadSummary();
    fetchRegistrations();
    reloadReminders();
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

  const handleSort = (field: keyof ExhibitorRegistration) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDeleteRegistration = async (registration: ExhibitorRegistration) => {
    if (!confirm(`Are you sure you want to delete the registration for ${registration.business_name}?`)) return;

    setDeleting(registration.id);
    setDeleteError(null);
    try {
      setError(null);
      setSuccess(null);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is not defined');

      // A fresh session token, not the one the page loaded with
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session) throw new Error('You must be logged in to do this');

      const response = await fetch(`${supabaseUrl}/functions/v1/admin-exhibitor-registrations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: registration.id })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete exhibitor registration');
      }

      setSuccess('Registration deleted successfully!');
      deselect([registration.id]);
      if (panelRegistration?.id === registration.id) setPanelRegistration(null);
      refreshAll();
    } catch (err) {
      console.error('Error deleting registration:', err);
      setError(`Failed to delete registration: ${getErrorMessage(err)}`);
      setDeleteError(`Could not delete this registration: ${getErrorMessage(err)}`);
    } finally {
      setDeleting(null);
    }
  };

  const exportToCSV = async (onlyIds?: Set<string>) => {
    try {
      setExporting(true);
      setError(null);
      const rows = await fetchRowsForExport<ExhibitorRegistration>('exhibitor_registrations', SELECT, onlyIds);
      if (rows.length === 0) return;

      const headers = [
        'Business Name',
        'Contact Name',
        'Email',
        'Phone',
        'Mobile Phone',
        'Address',
        'City',
        'State',
        'ZIP',
        'Booth Requirements',
        'Products Description',
        'Additional Comments',
        'Registration Date',
        'Total Amount',
        'Payment Method',
        'Payment Status',
        'PO Number',
        'PayPal Transaction ID',
        'PayPal Payer Email',
        'Payment Completed At',
        'Additional Participants Count',
        'Participant Names'
      ];

      const csvData = rows.map((reg) => {
        const participantNames =
          reg.participants?.map((p) => `${p.first_name} ${p.last_name}${p.role ? ` (${p.role})` : ''}`).join('; ') || '';

        return [
          reg.business_name,
          `${reg.first_name} ${reg.last_name}`,
          reg.email,
          reg.phone,
          reg.mobile_phone || '',
          `${reg.street_address}${reg.street_address2 ? ', ' + reg.street_address2 : ''}`,
          reg.city,
          reg.state,
          reg.zip_code,
          reg.booth_requirements || '',
          reg.products_description || '',
          reg.additional_comments || '',
          new Date(reg.created_at).toLocaleDateString(),
          `$${(Number(reg.total_amount) || 0).toFixed(2)}`,
          reg.payment_method || '',
          reg.payment_status || '',
          reg.po_number || '',
          reg.paypal_transaction_id || '',
          reg.paypal_payer_email || '',
          reg.payment_completed_at ? new Date(reg.payment_completed_at).toLocaleString() : '',
          reg.participants?.length || 0,
          participantNames
        ];
      });

      downloadCsv(`exhibitor-registrations${onlyIds ? '-selected' : ''}-${dateStamp()}.csv`, toCsv(headers, csvData));
    } catch (err) {
      console.error('Error exporting registrations:', err);
      setError('Failed to export registrations');
    } finally {
      setExporting(false);
    }
  };

  // A function, not a component, so the button keeps keyboard focus when the table re-renders after a sort
  const sortHeader = (field: keyof ExhibitorRegistration, label: string, align: 'left' | 'right' = 'left') => {
    const active = field === sortField;
    return (
      <th
        scope="col"
        className={`${TH_CLASS} ${align === 'right' ? 'text-right' : ''}`}
        aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button
          type="button"
          onClick={() => handleSort(field)}
          className={`flex items-center gap-1 uppercase tracking-wider ${align === 'right' ? 'ml-auto' : ''}`}
        >
          {label}
          {active && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />)}
        </button>
      </th>
    );
  };

  const bulkActions = [
    { key: 'reminders', label: 'Send reminders', icon: <BellRing className="h-4 w-4" aria-hidden="true" />, onClick: () => setBulkDialog('reminders') },
    { key: 'mark-paid', label: 'Mark paid', icon: <CheckCircle className="h-4 w-4" aria-hidden="true" />, onClick: () => setBulkDialog('markPaid') }
  ];

  const panelState = panelRegistration ? getPaymentState(panelRegistration) : null;

  // A delete error belongs to the registration it happened on
  useEffect(() => {
    setDeleteError(null);
  }, [panelRegistration?.id]);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <PageHeading title="Exhibitor Registrations" subtitle="Manage and track exhibitor registrations" />

        {error && (
          <div role="alert" className="rounded-md bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div role="status" className="rounded-md bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">{success}</p>
          </div>
        )}

        <PaymentSummaryStrip summary={summary} unavailable={summaryFailed} />

        <div className="flex flex-wrap items-center gap-2">
          <SearchBox
            id="registration-search"
            label="Search registrations"
            placeholder="Search business, contact or email"
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
            <TableCard loading={loading} isEmpty={registrations.length === 0} emptyText="No registrations found">
              <table className="min-w-full text-sm">
                <caption className="sr-only">Exhibitor registrations</caption>
                <thead>
                  <tr>
                    <th scope="col" className={`${TH_CLASS} w-10`}>
                      <PageSelectCheckbox ids={pageIds} selected={selected} onToggle={togglePage} />
                    </th>
                    {sortHeader('business_name', 'Business')}
                    {sortHeader('payment_status', 'Payment')}
                    {sortHeader('total_amount', 'Amount', 'right')}
                    {sortHeader('created_at', 'Registered')}
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((registration) => {
                    const state = getPaymentState(registration);
                    const isOpen = panelRegistration?.id === registration.id;
                    const open = () => setPanelRegistration(registration);
                    const participantCount = registration.participants?.length ?? 0;
                    return (
                      <tr
                        key={registration.id}
                        onClick={rowClickHandler(open)}
                        className={rowClass(selected.has(registration.id), isOpen)}
                      >
                        <td className={`${TD_CLASS} w-10 ${openBarClass(isOpen)}`}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${registration.business_name}`}
                            checked={selected.has(registration.id)}
                            onChange={() => toggle(registration.id)}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </td>
                        <td className={TD_CLASS}>
                          <RegistrantCell
                            name={registration.business_name}
                            lines={[
                              `${registration.first_name} ${registration.last_name}`,
                              participantCount > 0 && `${participantCount} ${participantCount === 1 ? 'participant' : 'participants'}`
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
                          {registration.total_amount === null || registration.total_amount === undefined
                            ? '—'
                            : formatMoney(Number(registration.total_amount) || 0)}
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
            title={panelRegistration?.business_name ?? ''}
            subtitle={panelRegistration ? `${panelRegistration.first_name} ${panelRegistration.last_name}` : undefined}
            onClose={() => setPanelRegistration(null)}
            top={
              panelRegistration && (
                <MarkPaidPanel
                  key={panelRegistration.id}
                  registration={panelRegistration}
                  type="exhibitor"
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
                  type="exhibitor"
                  registrationId={panelRegistration.id}
                  email={panelRegistration.email}
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
                <PanelSection title="Business">
                  <PanelFields
                    fields={[
                      { label: 'Business name', value: panelRegistration.business_name },
                      {
                        label: 'Address',
                        value: (
                          <>
                            {panelRegistration.street_address}
                            {panelRegistration.street_address2 && <span>, {panelRegistration.street_address2}</span>}
                            <br />
                            {panelRegistration.city}, {panelRegistration.state} {panelRegistration.zip_code}
                          </>
                        )
                      }
                    ]}
                  />
                </PanelSection>

                <PanelSection title="Contact">
                  <PanelFields
                    fields={[
                      { label: 'Name', value: `${panelRegistration.first_name} ${panelRegistration.last_name}` },
                      {
                        label: 'Email',
                        value: (
                          <a href={`mailto:${panelRegistration.email}`} className="text-primary hover:underline">
                            {panelRegistration.email}
                          </a>
                        )
                      },
                      { label: 'Phone', value: panelRegistration.phone },
                      ...(panelRegistration.mobile_phone ? [{ label: 'Mobile', value: panelRegistration.mobile_phone }] : [])
                    ]}
                  />
                </PanelSection>

                <PanelSection title="Booth requirements">
                  <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                    {panelRegistration.booth_requirements || <span className="italic text-gray-500">No specific requirements provided</span>}
                  </p>
                </PanelSection>

                <PanelSection title="Products and services">
                  <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                    {panelRegistration.products_description || <span className="italic text-gray-500">No description provided</span>}
                  </p>
                </PanelSection>

                <PanelSection title="Additional comments">
                  <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                    {panelRegistration.additional_comments || <span className="italic text-gray-500">No additional comments</span>}
                  </p>
                </PanelSection>

                {panelRegistration.participants && panelRegistration.participants.length > 0 && (
                  <PanelSection title={`Additional booth participants (${panelRegistration.participants.length})`}>
                    <ul className="space-y-2 rounded-lg bg-gray-50 p-3 text-sm">
                      {panelRegistration.participants.map((participant, index) => (
                        <li key={participant.id}>
                          <span className="font-medium text-gray-900">
                            {index + 1}. {participant.first_name} {participant.last_name}
                          </span>
                          {participant.role && <span className="ml-2 text-gray-500">({participant.role})</span>}
                        </li>
                      ))}
                    </ul>
                  </PanelSection>
                )}

                <PanelSection title="Payment details">
                  <PanelFields
                    fields={[
                      {
                        label: 'Total amount',
                        value:
                          panelRegistration.total_amount === null || panelRegistration.total_amount === undefined
                            ? ''
                            : formatMoney(Number(panelRegistration.total_amount) || 0)
                      },
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

                <PanelSection title="Registration">
                  <PanelFields
                    fields={[
                      { label: 'Registered', value: new Date(panelRegistration.created_at).toLocaleString() },
                      ...(panelRegistration.updated_at && panelRegistration.updated_at !== panelRegistration.created_at
                        ? [{ label: 'Last updated', value: new Date(panelRegistration.updated_at).toLocaleString() }]
                        : [])
                    ]}
                  />
                </PanelSection>

                <DeleteRegistrationButton
                  onClick={() => handleDeleteRegistration(panelRegistration)}
                  busy={deleting === panelRegistration.id}
                  error={deleteError}
                />
              </>
            )}
          </RegistrationPanel>
        </RegistrationSplit>

        <BulkRemindersDialog
          open={bulkDialog === 'reminders'}
          type="exhibitor"
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
          type="exhibitor"
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

export default AdminExhibitorRegistrations;
