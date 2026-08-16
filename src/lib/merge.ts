import { routeId } from './parse.ts';
import {
  TRACKED_FIELDS,
  type Logbook,
  type MergeResult,
  type RawTick,
  type Snapshot,
  type SnapshotDiff,
  type TickRecord,
} from './types.ts';

/**
 * Folds Mountain Project tick exports into one logbook that never loses a row.
 *
 * LOAD-BEARING ASSUMPTION: every export is MP's *complete* tick list, never a
 * delta. That is what lets absence from a newer snapshot mean "deleted
 * upstream" rather than "not included in this file". If that ever stops being
 * true, deletion flagging becomes meaningless.
 *
 * Deleted ticks are flagged, never dropped — the flag is the whole point of
 * keeping a backup, since MP silently drops routes removed from its database.
 */
export function merge(prior: Logbook | null, snapshots: Snapshot[]): MergeResult {
  const ordered = orderSnapshots(snapshots);
  const acc = new Map<string, TickRecord>();
  for (const tick of prior?.ticks ?? []) acc.set(tick.id, structuredClone(tick));

  const diffs: SnapshotDiff[] = [];
  const warnings: string[] = [];

  for (const snapshot of ordered) {
    const diff: SnapshotDiff = {
      name: snapshot.name,
      total: snapshot.rows.length,
      added: 0,
      edited: 0,
      deleted: 0,
      resurrected: 0,
    };
    const seen = new Set<string>();
    const occurrences = new Map<string, number>();

    for (const row of snapshot.rows) {
      const key = identityKey(row);
      // Repeat laps of one route on one day share a key; match them positionally
      // so multiplicity survives the merge instead of collapsing to one tick.
      const occurrence = occurrences.get(key) ?? 0;
      occurrences.set(key, occurrence + 1);
      const id = `${key}|${occurrence}`;
      seen.add(id);

      const existing = acc.get(id);
      if (!existing) {
        acc.set(id, {
          id,
          raw: row,
          first_seen: snapshot.name,
          last_seen: snapshot.name,
          deleted: false,
          deleted_at: null,
          edits: [],
        });
        diff.added += 1;
        continue;
      }

      if (existing.deleted) {
        existing.edits.push({ field: 'deleted', from: 'true', to: 'false', at: snapshot.name });
        existing.deleted = false;
        existing.deleted_at = null;
        diff.resurrected += 1;
      }

      let changed = false;
      for (const field of TRACKED_FIELDS) {
        if (existing.raw[field] !== row[field]) {
          existing.edits.push({
            field,
            from: existing.raw[field],
            to: row[field],
            at: snapshot.name,
          });
          changed = true;
        }
      }
      if (changed) diff.edited += 1;

      existing.raw = row;
      existing.last_seen = snapshot.name;
    }

    for (const record of acc.values()) {
      if (seen.has(record.id) || record.deleted) continue;
      record.edits.push({ field: 'deleted', from: 'false', to: 'true', at: snapshot.name });
      record.deleted = true;
      record.deleted_at = snapshot.name;
      diff.deleted += 1;
    }

    if (diff.deleted > 0 && diff.deleted > acc.size * 0.05) {
      warnings.push(
        `${snapshot.name} dropped ${diff.deleted} of ${acc.size} ticks. ` +
          `That usually means the exports were merged out of order, or this file is a ` +
          `partial export — not that you lost ${diff.deleted} ticks.`,
      );
    }

    diffs.push(diff);
  }

  const ticks = [...acc.values()].sort(
    (a, b) => a.raw.Date.localeCompare(b.raw.Date) || a.id.localeCompare(b.id),
  );

  const snapshotNames = [...(prior?.snapshots ?? [])];
  for (const snapshot of ordered) {
    if (!snapshotNames.includes(snapshot.name)) snapshotNames.push(snapshot.name);
  }

  // Deliberately no `generated_at`: the logbook is a pure function of its
  // inputs, so re-running ingest rewrites a byte-identical file and `git diff`
  // shows only real changes.
  return { logbook: { version: 1, snapshots: snapshotNames, ticks }, diffs, warnings };
}

function identityKey(row: RawTick): string {
  return [
    row.Date,
    routeId(row.URL),
    row.Style,
    row['Lead Style'],
    row.Pitches,
  ].join('|');
}

/**
 * Deletion flagging depends on knowing which export is newer, so use the first
 * signal that separates every snapshot: the filename's number, then the file
 * mtime, then the shape of the data itself (snapshots are near-supersets, so
 * both the latest date and the row count grow).
 *
 * The resolved order is surfaced in the UI and the CLI output rather than
 * trusted silently — a wrong guess would corrupt deletion flags invisibly.
 */
export function orderSnapshots(snapshots: Snapshot[]): Snapshot[] {
  const strategies: ((s: Snapshot) => string | number)[] = [
    (s) => exportNumber(s.name),
    (s) => s.lastModified ?? NaN,
    (s) => `${maxDate(s)}|${String(s.rows.length).padStart(6, '0')}`,
  ];

  for (const rank of strategies) {
    const values = snapshots.map(rank);
    const usable = values.every((v) => v === v) && new Set(values).size === snapshots.length;
    if (!usable) continue;
    return [...snapshots].sort((a, b) => compare(rank(a), rank(b)));
  }

  return [...snapshots].sort((a, b) => a.name.localeCompare(b.name));
}

/** `ticks.csv` → 1, `ticks 6.csv` → 6, `ticks (3).csv` → 3. */
function exportNumber(name: string): number {
  const base = name.replace(/\.csv$/i, '');
  const digits = base.match(/\d+/g);
  return digits ? Number(digits[digits.length - 1]) : 1;
}

function maxDate(snapshot: Snapshot): string {
  let max = '';
  for (const row of snapshot.rows) if (row.Date > max) max = row.Date;
  return max;
}

function compare(a: string | number, b: string | number): number {
  return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
}
