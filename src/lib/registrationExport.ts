import { supabase } from './supabase';

const PAGE_SIZE = 1000;
// 100 ids make a request address of about 4 KB, which is safe for the API gateway
export const ID_CHUNK = 100;

export const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

// Rows for a CSV export. With ids, only those rows are fetched; without, the whole table is read in pages so the
// 1000-row default cannot cut it short.
export const fetchRowsForExport = async <T,>(
  table: string,
  select: string,
  ids?: Set<string>
): Promise<T[]> => {
  if (ids) {
    const rows: T[] = [];
    for (const part of chunk(Array.from(ids), ID_CHUNK)) {
      const { data, error } = await supabase.from(table).select(select).in('id', part);
      if (error) throw error;
      rows.push(...((data ?? []) as unknown as T[]));
    }
    return rows;
  }

  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
};
