import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle, Clock, Inbox } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { useAuth } from '../context/AuthContext';
import { fetchAdminCounts, type AdminCounts } from '../lib/adminCounts';
import {
  buildAttentionItems,
  daysUntil,
  deadlineParts,
  describeActivity,
  describeDaysUntil,
  fetchDashboard,
  formatMoney,
  relativeTime,
  type AttentionTone,
  type DashboardData
} from '../lib/dashboard';

const TONE_STYLES: Record<AttentionTone, { icon: React.ComponentType<{ className?: string }>; box: string }> = {
  red: { icon: AlertCircle, box: 'bg-red-100 text-red-700' },
  amber: { icon: Clock, box: 'bg-amber-100 text-amber-800' },
  blue: { icon: Inbox, box: 'bg-blue-100 text-blue-700' }
};

const CARD = 'rounded-lg bg-white shadow-sm';
const SECTION_TITLE = 'text-lg font-semibold text-gray-900';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // undefined: older function without this data. null: the function could not build it.
  const [dashboard, setDashboard] = useState<DashboardData | null | undefined>(undefined);
  const [counts, setCounts] = useState<AdminCounts>({});

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/admin/login');
      return;
    }
    if (user.role !== 'admin') {
      navigate('/');
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const [dashboardResult, countsResult] = await Promise.allSettled([fetchDashboard(), fetchAdminCounts()]);
      if (cancelled) return;

      if (dashboardResult.status === 'fulfilled') {
        setDashboard(dashboardResult.value);
      } else {
        console.error('Error fetching dashboard:', dashboardResult.reason);
        setError('Failed to load the dashboard figures.');
      }
      if (countsResult.status === 'fulfilled') setCounts(countsResult.value);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, navigate]);

  const attention = useMemo(() => buildAttentionItems(counts, dashboard ?? null), [counts, dashboard]);

  // Forms that still close today or later (the function also sends yesterday's UTC date, for evening viewers)
  const upcoming = useMemo(
    () => (dashboard?.closing ?? []).filter((item) => daysUntil(item.closes_at) >= 0),
    [dashboard]
  );

  const totals = useMemo(() => {
    const programs = dashboard?.programs ?? [];
    const sum = (pick: (p: (typeof programs)[number]) => number) => programs.reduce((total, p) => total + pick(p), 0);
    const paid = sum((p) => p.paid);
    const awaiting = sum((p) => p.awaiting);
    return {
      registered: sum((p) => p.registered),
      newThisWeek: sum((p) => p.newThisWeek),
      paid,
      awaiting,
      paidShare: paid + awaiting > 0 ? (paid / (paid + awaiting)) * 100 : 0,
      collected: sum((p) => p.collected),
      outstanding: sum((p) => p.outstanding)
    };
  }, [dashboard]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {error && (
        <div className="mb-6 border-l-4 border-red-400 bg-red-50 p-4" role="alert">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
            <p className="ml-3 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {!error && dashboard === undefined && (
        <p className="mb-6 rounded-md bg-blue-50 p-3 text-sm text-blue-800">
          Payment totals, deadlines and recent activity appear once the updated dashboard function is deployed.
        </p>
      )}

      {!error && dashboard === null && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-900" role="status">
          Some dashboard figures could not be loaded. Try again in a moment.
        </p>
      )}

      {/* Needs your attention */}
      <section aria-labelledby="attention-heading" className={`${CARD} mb-6`}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 id="attention-heading" className={SECTION_TITLE}>
            Needs your attention
          </h2>
          {attention.length > 0 && <span className="text-sm text-gray-500">{attention.length} to look at</span>}
        </div>
        {attention.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-6 text-sm text-gray-700">
            <CheckCircle className="h-5 w-5 text-green-600" aria-hidden="true" />
            Nothing needs your attention right now.
          </div>
        ) : (
          <ul>
            {attention.map((item) => {
              const { icon: Icon, box } = TONE_STYLES[item.tone];
              return (
                <li key={item.key} className="flex items-center gap-3 border-b border-gray-100 px-5 py-3 last:border-b-0">
                  <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${box}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    {item.detail && <p className="text-xs text-gray-600">{item.detail}</p>}
                  </div>
                  <Link
                    to={item.path}
                    className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {item.linkLabel}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {dashboard && (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className={`${CARD} p-5`}>
              <p className="text-sm font-medium text-gray-600">Registered</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-tapt-navy">{totals.registered}</p>
              <p className="mt-1 text-sm text-gray-600">
                {totals.newThisWeek > 0 ? `${totals.newThisWeek} new in the last 7 days` : 'None new in the last 7 days'}
              </p>
              <p className="mt-1 text-xs text-gray-500">Conference, Tech Conference and Exhibitors</p>
            </div>

            <div className={`${CARD} p-5`}>
              <p className="text-sm font-medium text-gray-600">Payments</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-tapt-navy">
                {totals.paid} <span className="text-base font-normal text-gray-600">paid</span>
              </p>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-amber-200"
                role="img"
                aria-label={`${totals.paid} paid and ${totals.awaiting} awaiting payment`}
              >
                <div className="h-full bg-green-600" style={{ width: `${totals.paidShare}%` }} />
              </div>
              <p className="mt-2 text-sm text-gray-600">{totals.awaiting} awaiting payment</p>
            </div>

            <div className={`${CARD} p-5`}>
              <p className="text-sm font-medium text-gray-600">Money collected</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-tapt-navy">{formatMoney(totals.collected)}</p>
              <p className="mt-1 text-sm text-gray-600">{formatMoney(totals.outstanding)} still outstanding</p>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Programs */}
            <section aria-labelledby="programs-heading" className={`${CARD} lg:col-span-2`}>
              <div className="border-b border-gray-100 px-5 py-3">
                <h2 id="programs-heading" className={SECTION_TITLE}>
                  Programs
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th scope="col" className="px-5 py-2">Program</th>
                      <th scope="col" className="px-3 py-2 text-right">Registered</th>
                      <th scope="col" className="px-3 py-2 text-right">Paid</th>
                      <th scope="col" className="px-3 py-2 text-right">Awaiting</th>
                      <th scope="col" className="px-5 py-2 text-right">Collected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dashboard.programs.map((program) => (
                      <tr key={program.key}>
                        <th scope="row" className="px-5 py-3 text-left font-medium">
                          <Link to={program.path} className="text-tapt-blue hover:text-tapt-navy hover:underline">
                            {program.label}
                          </Link>
                        </th>
                        <td className="px-3 py-3 text-right tabular-nums">{program.registered}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{program.paid}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{program.awaiting}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{formatMoney(program.collected)}</td>
                      </tr>
                    ))}
                    {dashboard.others.map((program) => (
                      <tr key={program.key}>
                        <th scope="row" className="px-5 py-3 text-left font-medium">
                          <Link to={program.path} className="text-tapt-blue hover:text-tapt-navy hover:underline">
                            {program.label}
                          </Link>
                        </th>
                        <td className="px-3 py-3 text-right tabular-nums">{program.count}</td>
                        <td className="px-3 py-3 text-right text-gray-400"><span aria-hidden="true">–</span><span className="sr-only">Not applicable</span></td>
                        <td className="px-3 py-3 text-right text-gray-400"><span aria-hidden="true">–</span><span className="sr-only">Not applicable</span></td>
                        <td className="px-5 py-3 text-right text-gray-400"><span aria-hidden="true">–</span><span className="sr-only">Not applicable</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-gray-100 px-5 py-2 text-xs text-gray-500">
                Figures are for the current cycle and start again after a year-end rollover. Registered also counts
                payments that failed or were refunded, so Paid and Awaiting can add up to less.
              </p>
            </section>

            {/* Coming up */}
            <section aria-labelledby="coming-up-heading" className={CARD}>
              <div className="border-b border-gray-100 px-5 py-3">
                <h2 id="coming-up-heading" className={SECTION_TITLE}>
                  Coming up
                </h2>
              </div>
              {upcoming.length === 0 ? (
                <p className="px-5 py-6 text-sm text-gray-600">No forms close in the next 30 days.</p>
              ) : (
                <ul>
                  {upcoming.map((item) => {
                    const days = daysUntil(item.closes_at);
                    const soon = days <= 7;
                    const { day, month } = deadlineParts(item.closes_at);
                    return (
                      <li key={`${item.label}-${item.name ?? ''}-${item.closes_at}`} className="border-b border-gray-100 last:border-b-0">
                        <Link to={item.path} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                          <time
                            dateTime={item.closes_at}
                            className={`w-11 flex-shrink-0 rounded-md py-1 text-center leading-tight ${
                              soon ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-tapt-navy'
                            }`}
                          >
                            <span className="block font-heading text-base font-bold">{day}</span>
                            <span className="block text-[10px] font-bold uppercase">{month}</span>
                          </time>
                          <span className="min-w-0 text-sm">
                            <span className="block font-medium text-gray-900">{item.label} closes</span>
                            <span className="block text-xs text-gray-600">
                              {describeDaysUntil(days)}
                              {item.name ? ` · ${item.name}` : ''}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Recent activity */}
          <section aria-labelledby="activity-heading" className={CARD}>
            <div className="border-b border-gray-100 px-5 py-3">
              <h2 id="activity-heading" className={SECTION_TITLE}>
                Recent activity
              </h2>
            </div>
            {dashboard.activity.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-600">No recent activity.</p>
            ) : (
              <ul className="px-5 py-1">
                {dashboard.activity.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-baseline justify-between gap-4 border-b border-dashed border-gray-200 py-2 text-sm last:border-b-0"
                  >
                    <span className="min-w-0 break-words text-gray-800">{describeActivity(entry.action, entry.actor)}</span>
                    <time dateTime={entry.at} className="flex-shrink-0 text-xs text-gray-500">
                      {relativeTime(entry.at)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AdminLayout>
  );
};

export default AdminDashboard;
