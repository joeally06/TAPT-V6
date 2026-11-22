import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { buildSearchFilter } from './registrationPayments';
import { useLatestRequest } from './useLatestRequest';

export const LUNCHEON_REGIONS = ['West Region', 'Middle Region', 'Cookeville Region', 'Greeneville Region', 'East Region'];

export const LUNCHEON_SEARCH_COLUMNS = ['name', 'email', 'district_organization'];

export interface LuncheonRegistration {
  id: string;
  name: string;
  email: string;
  district_organization: string;
  number_of_attendees: number;
  preferred_region: string;
  // Every region the person signed up for (a JSON array)
  selected_regions?: string[] | null;
  created_at: string;
}

type RegionFields = Pick<LuncheonRegistration, 'preferred_region' | 'selected_regions'>;

// The regions a registration is for: all the selected ones, or the preferred region of an older sign-up.
export const getDisplayRegions = (registration: RegionFields): string[] => {
  if (Array.isArray(registration.selected_regions) && registration.selected_regions.length > 0) {
    return registration.selected_regions;
  }
  return registration.preferred_region ? [registration.preferred_region] : [];
};

export interface LuncheonSummary {
  total: number;
  totalAttendees: number;
  // A registration for several regions is counted in each of them
  byRegion: { name: string; count: number; attendees: number }[];
}

export const summarizeLuncheon = (
  rows: Array<RegionFields & Pick<LuncheonRegistration, 'number_of_attendees'>>,
  regions: string[] = LUNCHEON_REGIONS
): LuncheonSummary => {
  const attendeesOf = (row: { number_of_attendees: number }) => Number(row.number_of_attendees) || 0;
  return {
    total: rows.length,
    totalAttendees: rows.reduce((sum, row) => sum + attendeesOf(row), 0),
    byRegion: regions.map((name) => {
      const inRegion = rows.filter((row) => getDisplayRegions(row).includes(name));
      return { name, count: inRegion.length, attendees: inRegion.reduce((sum, row) => sum + attendeesOf(row), 0) };
    })
  };
};

// Anything that can be filtered like a supabase query.
interface FilterableQuery<Q> {
  or(filters: string): Q;
  contains(column: string, value: string): Q;
}

// Search and region filter, run on the server. selected_regions is a JSONB column, so the value is a JSON string:
// supabase-js turns a JavaScript array into a {a,b} array literal, which is a different type.
export const applyLuncheonFilters = <Q extends FilterableQuery<Q>>(
  query: Q,
  { search, region }: { search: string; region: string }
): Q => {
  let result = query;
  const searchFilter = buildSearchFilter(search, LUNCHEON_SEARCH_COLUMNS);
  if (searchFilter) result = result.or(searchFilter);
  if (region !== 'all') result = result.contains('selected_regions', JSON.stringify([region]));
  return result;
};

// Totals for the whole table (read in pages so the 1000-row default cannot cut it short).
export const fetchLuncheonSummary = async (): Promise<LuncheonSummary> => {
  const pageSize = 1000;
  const rows: Array<RegionFields & Pick<LuncheonRegistration, 'number_of_attendees'>> = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('regional_luncheon_registrations')
      .select('preferred_region, selected_regions, number_of_attendees')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return summarizeLuncheon(rows);
};

export const useLuncheonSummary = (enabled: boolean) => {
  const [summary, setSummary] = useState<LuncheonSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const startRequest = useLatestRequest();

  const reload = useCallback(async () => {
    const isCurrent = startRequest();
    try {
      const result = await fetchLuncheonSummary();
      if (!isCurrent()) return;
      setSummary(result);
      setFailed(false);
    } catch (err) {
      console.error('Error loading luncheon totals:', err);
      if (isCurrent()) setFailed(true);
    }
  }, [startRequest]);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  return { summary, failed, reload };
};

// Every registration matching the current search and region, for "Export" (read in pages).
export const fetchLuncheonForExport = async (filters: { search: string; region: string }): Promise<LuncheonRegistration[]> => {
  const pageSize = 1000;
  const rows: LuncheonRegistration[] = [];
  for (let from = 0; ; from += pageSize) {
    const query = applyLuncheonFilters(supabase.from('regional_luncheon_registrations').select('*'), filters);
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as LuncheonRegistration[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
};
