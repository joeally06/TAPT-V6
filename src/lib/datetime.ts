const pad = (n: number) => String(n).padStart(2, '0');

// <input type="datetime-local"> works in the admin's local time; the stored value is an ISO string.
export const toLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const fromLocalInput = (value: string): string | null => (value ? new Date(value).toISOString() : null);
