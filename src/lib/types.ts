/** The 15 columns Mountain Project emits, in export order. */
export const CSV_COLUMNS = [
  'Date',
  'Route',
  'Rating',
  'Notes',
  'URL',
  'Pitches',
  'Location',
  'Avg Stars',
  'Your Stars',
  'Style',
  'Lead Style',
  'Route Type',
  'Your Rating',
  'Length',
  'Rating Code',
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

/** One row of an export, verbatim. Every value is a string, exactly as exported. */
export type RawTick = Record<CsvColumn, string>;

/**
 * Fields that make up a tick's identity. A change to any of these reads as a
 * delete plus an add, because MP exports carry no tick ID to follow.
 */
export const IDENTITY_FIELDS = ['Date', 'URL', 'Style', 'Lead Style', 'Pitches'] as const;

/**
 * Fields that may change between exports without changing which tick it is,
 * and whose changes are worth recording. `URL` appears here as well as in
 * IDENTITY_FIELDS: identity uses only the numeric route ID within it, but the
 * slug changes when a route is renamed.
 */
export const TRACKED_FIELDS: CsvColumn[] = [
  'Route',
  'Rating',
  'Notes',
  'URL',
  'Location',
  'Route Type',
  'Your Rating',
  'Length',
  'Rating Code',
];

/**
 * Community metadata that drifts on its own as other climbers rate a route.
 * Across the six sample exports these account for 103 of 106 field changes —
 * recording them would bury the three real edits in noise. The newest value is
 * still kept; only the change history is skipped.
 */
export const UNTRACKED_FIELDS: CsvColumn[] = ['Avg Stars', 'Your Stars'];

export interface TickEdit {
  /** A CSV column name, or `deleted` for a disappearance/reappearance. */
  field: string;
  from: string;
  to: string;
  /** Snapshot in which the change first showed up. */
  at: string;
}

export interface TickRecord {
  /** `Date|routeId|Style|LeadStyle|Pitches|occurrence` */
  id: string;
  raw: RawTick;
  first_seen: string;
  last_seen: string;
  /** True when the tick has vanished from Mountain Project's exports. */
  deleted: boolean;
  deleted_at: string | null;
  edits: TickEdit[];
}

export interface Logbook {
  version: 1;
  /** Snapshot filenames, oldest first. */
  snapshots: string[];
  ticks: TickRecord[];
}

/** A parsed export, ready to merge. */
export interface Snapshot {
  name: string;
  rows: RawTick[];
  /** File mtime where known — used to order exports whose names don't. */
  lastModified?: number;
}

export interface SnapshotDiff {
  name: string;
  /** Rows in the snapshot itself. */
  total: number;
  added: number;
  edited: number;
  deleted: number;
  resurrected: number;
}

export interface MergeResult {
  logbook: Logbook;
  diffs: SnapshotDiff[];
  warnings: string[];
}
