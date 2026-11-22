import React from 'react';
import { Loader2, Search, Trash2 } from 'lucide-react';

// The pieces the four registration pages (Conference, Tech Conference, Exhibitor, Regional Luncheon) share, so they
// look and behave the same.

export const SearchBox: React.FC<{
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ id, label, placeholder, value, onChange }) => (
  <div className="relative min-w-[14rem] flex-1">
    <label htmlFor={id} className="sr-only">
      {label}
    </label>
    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
    <input
      id={id}
      type="search"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="w-full rounded-lg border-gray-300 py-1.5 pl-8 text-sm shadow-sm focus:border-primary focus:ring-primary"
    />
  </div>
);

// A small outlined button for the toolbar (Export CSV, View archives)
export const ToolbarButton: React.FC<{
  onClick: () => void;
  icon?: React.ReactNode;
  busy?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ onClick, icon, busy = false, disabled = false, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={busy || disabled}
    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
  >
    {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
    {children}
  </button>
);

export const StatCard: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
    <p className="text-[11px] font-semibold text-gray-500">{label}</p>
    <p className="font-heading text-lg font-semibold tabular-nums text-tapt-navy">{value}</p>
    {note && <p className="text-xs text-gray-500">{note}</p>}
  </div>
);

// The bordered card around a table, with the loading and empty messages
export const TableCard: React.FC<{
  loading: boolean;
  isEmpty: boolean;
  emptyText: string;
  children: React.ReactNode;
}> = ({ loading, isEmpty, emptyText, children }) => (
  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white" aria-busy={loading}>
    {loading ? (
      <div role="status" className="p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="mt-2 text-gray-600">Loading registrations...</p>
      </div>
    ) : isEmpty ? (
      <div className="p-8 text-center">
        <p className="text-gray-500">{emptyText}</p>
      </div>
    ) : (
      <div className="overflow-x-auto">{children}</div>
    )}
  </div>
);

// The name in a row: a real button (keyboard and screen readers), with grey lines under it
export const RegistrantCell: React.FC<{
  name: string;
  lines: (string | null | undefined | false)[];
  open: boolean;
  onOpen: () => void;
}> = ({ name, lines, open, onOpen }) => (
  <>
    <button
      type="button"
      data-row-open=""
      onClick={onOpen}
      aria-current={open ? 'true' : undefined}
      className="text-left font-semibold text-gray-900 hover:text-primary hover:underline"
    >
      {name}
    </button>
    {lines.filter(Boolean).map((line, index) => (
      <span key={index} className="block text-xs text-gray-500">
        {line}
      </span>
    ))}
  </>
);

// Last block in a panel
export const DeleteRegistrationButton: React.FC<{ onClick: () => void; busy: boolean; error?: string | null }> = ({
  onClick,
  busy,
  error = null
}) => (
  <div className="space-y-2 border-t border-gray-200 pt-3">
    {error && (
      <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-700">
        {error}
      </p>
    )}
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-2 text-sm font-medium text-red-700 hover:text-red-900 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
      Delete registration
    </button>
  </div>
);

// The page title block: title and one grey line
export const PageHeading: React.FC<{ title: string; subtitle?: string | null }> = ({ title, subtitle }) => (
  <div>
    <h1 className="font-heading text-2xl font-bold text-gray-900">{title}</h1>
    {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
  </div>
);
