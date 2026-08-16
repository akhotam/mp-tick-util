import Papa from 'papaparse';
import { CSV_COLUMNS, type RawTick, type Snapshot } from './types.ts';

/**
 * Notes can contain embedded newlines inside quoted fields, so line-based
 * splitting corrupts rows. Always go through a real CSV parser.
 */
export function parseCsv(name: string, text: string, lastModified?: number): Snapshot {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
  });

  const header = result.meta.fields ?? [];
  const missing = CSV_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    throw new Error(
      `${name} doesn't look like a Mountain Project tick export — missing column(s): ${missing.join(', ')}`,
    );
  }

  const rows: RawTick[] = result.data.map((row) => {
    const tick = {} as RawTick;
    for (const column of CSV_COLUMNS) tick[column] = row[column] ?? '';
    return tick;
  });

  return { name, rows, lastModified };
}

/** The numeric route ID in a Mountain Project URL — stable across renames. */
export function routeId(url: string): string {
  return /\/route\/(\d+)\//.exec(url)?.[1] ?? url;
}
