import { merge } from './merge.ts';
import { parseCsv } from './parse.ts';
import type { Logbook, MergeResult, Snapshot } from './types.ts';

/**
 * Turns whatever was dropped on the page into a merged logbook.
 *
 * A `logbook.json` in the drop is the starting point — that's how someone
 * continues from a previous session without keeping every old CSV around.
 * Anything else must be a Mountain Project export.
 */
export async function loadDropped(files: File[], current: Logbook | null): Promise<MergeResult> {
  const csvs = files.filter((f) => f.name.toLowerCase().endsWith('.csv'));
  const jsons = files.filter((f) => f.name.toLowerCase().endsWith('.json'));

  if (csvs.length === 0 && jsons.length === 0) {
    throw new Error('Drop a Mountain Project CSV export, or a logbook.json you downloaded here.');
  }
  if (jsons.length > 1) {
    throw new Error('Only one logbook.json at a time, please.');
  }

  let prior = current;
  if (jsons.length === 1) {
    prior = asLogbook(JSON.parse(await jsons[0].text()), jsons[0].name);
  }

  const snapshots: Snapshot[] = await Promise.all(
    csvs.map(async (file) => parseCsv(file.name, await file.text(), file.lastModified)),
  );

  return merge(prior, snapshots);
}

export function asLogbook(value: unknown, source: string): Logbook {
  const logbook = value as Logbook;
  if (logbook?.version !== 1 || !Array.isArray(logbook.ticks)) {
    throw new Error(`${source} isn't a logbook file written by this app.`);
  }
  return logbook;
}

export function downloadLogbook(logbook: Logbook): void {
  const blob = new Blob([`${JSON.stringify(logbook, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'logbook.json';
  link.click();
  URL.revokeObjectURL(url);
}
