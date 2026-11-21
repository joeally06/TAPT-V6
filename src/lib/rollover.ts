import { supabase } from './supabase';

// The forms that start a new cycle each year. The `rollover` edge function and the database function
// `rollover_cycle` use these same type names.
export type RolloverType =
  | 'conference'
  | 'tech-conference'
  | 'exhibitor'
  | 'hall-of-fame'
  | 'student-scholarship'
  | 'president-nomination'
  | 'regional-director-nomination'
  | 'regional-luncheon';

export interface RolloverForm {
  // What the admin calls the rows, for the confirm text ("214 registrations")
  rowsTable: string;
  rowsLabel: string;
  // Rows that belong to the main rows and are archived with them
  relatedTable: string | null;
  relatedLabel: string | null;
  // Where the admin can export the current rows before rolling over
  exportHref: string;
}

export const ROLLOVER_FORMS: Record<RolloverType, RolloverForm> = {
  conference: {
    rowsTable: 'conference_registrations',
    rowsLabel: 'registrations',
    relatedTable: 'conference_attendees',
    relatedLabel: 'attendees',
    exportHref: '/admin/conference-registrations'
  },
  'tech-conference': {
    rowsTable: 'tech_conference_registrations',
    rowsLabel: 'registrations',
    relatedTable: 'tech_conference_attendees',
    relatedLabel: 'attendees',
    exportHref: '/admin/tech-conference-registrations'
  },
  exhibitor: {
    rowsTable: 'exhibitor_registrations',
    rowsLabel: 'registrations',
    relatedTable: 'exhibitor_participants',
    relatedLabel: 'booth participants',
    exportHref: '/admin/exhibitor-registrations'
  },
  'hall-of-fame': {
    rowsTable: 'hall_of_fame_nominations',
    rowsLabel: 'nominations',
    relatedTable: null,
    relatedLabel: null,
    exportHref: '/admin/hall-of-fame-nominations'
  },
  'student-scholarship': {
    rowsTable: 'student_scholarship_applications',
    rowsLabel: 'applications',
    relatedTable: null,
    relatedLabel: null,
    exportHref: '/admin/student-scholarship-applications'
  },
  'president-nomination': {
    rowsTable: 'president_nominations',
    rowsLabel: 'nominations',
    relatedTable: null,
    relatedLabel: null,
    exportHref: '/admin/president-nominations'
  },
  'regional-director-nomination': {
    rowsTable: 'regional_director_nominations',
    rowsLabel: 'nominations',
    relatedTable: null,
    relatedLabel: null,
    exportHref: '/admin/regional-director-nominations'
  },
  'regional-luncheon': {
    rowsTable: 'regional_luncheon_registrations',
    rowsLabel: 'registrations',
    relatedTable: null,
    relatedLabel: null,
    exportHref: '/admin/regional-luncheon-registrations'
  }
};

export interface RolloverCounts {
  rows: number;
  related: number;
}

const countRows = async (table: string): Promise<number> => {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
};

// How many rows a rollover would archive right now
export const fetchRolloverCounts = async (type: RolloverType): Promise<RolloverCounts> => {
  const form = ROLLOVER_FORMS[type];
  const [rows, related] = await Promise.all([
    countRows(form.rowsTable),
    form.relatedTable ? countRows(form.relatedTable) : Promise.resolve(0)
  ]);
  return { rows, related };
};

export interface RolloverResult {
  archiveId: string | null;
  archivedRows: number;
  archivedRelatedRows: number;
}

// Calls the `rollover` edge function. The archive, the clearing of the live rows and the new settings all happen
// in one database transaction, so when this throws with a message from the server, nothing was changed.
export const runRollover = async (type: RolloverType, settings: Record<string, unknown>): Promise<RolloverResult> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not defined in the environment');
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session || !session.access_token) {
    throw new Error('No active session or access token is missing');
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/rollover`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type, settings })
    });
  } catch {
    // No answer came back, so the rollover may or may not have run
    throw new Error('Could not reach the server. Reload this page to check whether the rollover went through.');
  }

  let payload: { success?: boolean; error?: string; archiveId?: string | null; archivedRows?: number; archivedRelatedRows?: number } | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!payload) {
    throw new Error(`Rollover did not finish (HTTP ${response.status}). Reload this page to check whether it went through.`);
  }
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `Rollover failed (HTTP ${response.status}).`);
  }

  return {
    archiveId: payload.archiveId ?? null,
    archivedRows: payload.archivedRows ?? 0,
    archivedRelatedRows: payload.archivedRelatedRows ?? 0
  };
};

// "Archived 214 registrations and 380 attendees." (used in the success message)
export const describeRolloverResult = (type: RolloverType, result: RolloverResult): string => {
  const form = ROLLOVER_FORMS[type];
  const parts = [`${result.archivedRows} ${form.rowsLabel}`];
  if (form.relatedLabel) parts.push(`${result.archivedRelatedRows} ${form.relatedLabel}`);
  return result.archivedRows === 0 && result.archivedRelatedRows === 0
    ? 'There was nothing to archive.'
    : `Archived ${parts.join(' and ')}.`;
};

export interface FetchAllPagesOptions {
  orderColumn: string;
  ascending?: boolean;
  // Columns to read (default: all)
  columns?: string;
  // Optional filters: column >= value, column < value, column in (values)
  gte?: [string, string];
  lt?: [string, string];
  inValues?: [string, string[]];
}

// Reads every matching row in pages of 1000, so the default row limit cannot cut the list short.
export const fetchAllPages = async <T = Record<string, unknown>>(
  table: string,
  { orderColumn, ascending = false, columns = '*', gte, lt, inValues }: FetchAllPagesOptions
): Promise<T[]> => {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select(columns);
    if (gte) query = query.gte(gte[0], gte[1]);
    if (lt) query = query.lt(lt[0], lt[1]);
    if (inValues) query = query.in(inValues[0], inValues[1]);
    const { data, error } = await query
      .order(orderColumn, { ascending })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
};
