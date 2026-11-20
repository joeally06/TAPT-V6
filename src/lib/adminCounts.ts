import { supabase } from './supabase';
import type { NavCountKey } from './adminNav';

export type AdminCounts = Partial<Record<NavCountKey, number>>;

const CACHE_MS = 60_000;
let cache: { at: number; value: AdminCounts } | null = null;
let inFlight: Promise<AdminCounts> | null = null;

// Number of rows waiting for an admin. Undefined when the query fails, so no badge is shown.
const countWhere = async (table: string, column: string, value: string | boolean): Promise<number | undefined> => {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq(column, value);
    return error ? undefined : (count ?? 0);
  } catch {
    return undefined;
  }
};

const sum = (a: number | undefined, b: number | undefined): number | undefined =>
  a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0);

const loadCounts = async (): Promise<AdminCounts> => {
  const [scholarships, hallOfFame, regionalDirector, president, messages, memberships] = await Promise.all([
    countWhere('student_scholarship_applications', 'status', 'pending'),
    countWhere('hall_of_fame_nominations', 'status', 'pending'),
    countWhere('regional_director_nominations', 'status', 'pending'),
    countWhere('president_nominations', 'status', 'pending'),
    countWhere('contact_messages', 'read_status', false),
    countWhere('membership_applications', 'status', 'pending')
  ]);

  return {
    scholarships,
    hallOfFame,
    boardNominations: sum(regionalDirector, president),
    messages,
    memberships
  };
};

// Every admin page mounts the sidebar, so share one request across them for a minute.
export const fetchAdminCounts = (): Promise<AdminCounts> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.value);
  if (!inFlight) {
    inFlight = loadCounts()
      .then((value) => {
        cache = { at: Date.now(), value };
        return value;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
};
