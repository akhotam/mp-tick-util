/**
 * Rebuilds public/logbook.json from every export in data/.
 *
 * Always a full rebuild, never incremental: the logbook is a pure function of
 * the CSVs, so re-running is idempotent and `git diff` shows only real changes.
 *
 *   npm run ingest
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { merge } from '../src/lib/merge.ts';
import { parseCsv } from '../src/lib/parse.ts';
import type { Snapshot } from '../src/lib/types.ts';

const DATA_DIR = 'data';
const OUTPUT = 'public/logbook.json';

const files = readdirSync(DATA_DIR).filter((f) => f.toLowerCase().endsWith('.csv'));
if (files.length === 0) {
  console.error(`No CSV exports found in ${DATA_DIR}/.`);
  process.exit(1);
}

const snapshots: Snapshot[] = files.map((name) => {
  const path = join(DATA_DIR, name);
  return parseCsv(name, readFileSync(path, 'utf8'), statSync(path).mtimeMs);
});

const { logbook, diffs, warnings } = merge(null, snapshots);

console.log(`\nMerged ${diffs.length} exports, oldest first:\n`);
console.log(`  ${'export'.padEnd(16)}${pad('rows')}${pad('added')}${pad('edited')}${pad('deleted')}${pad('back')}`);
for (const d of diffs) {
  console.log(
    `  ${d.name.padEnd(16)}${pad(d.total)}${pad(d.added)}${pad(d.edited)}${pad(d.deleted)}${pad(d.resurrected)}`,
  );
}

const latest = diffs.at(-1)!;
const newest = logbook.snapshots.at(-1)!;
describe('Added', logbook.ticks.filter((t) => t.first_seen === newest));
describe(
  'Gone from Mountain Project',
  logbook.ticks.filter((t) => t.deleted_at === newest),
);

const edits = logbook.ticks.flatMap((t) => t.edits.filter((e) => e.at === newest).map((e) => ({ t, e })));
if (edits.length > 0) {
  console.log(`\nEdited (${edits.length}):`);
  for (const { t, e } of edits) {
    console.log(`  ${t.raw.Date}  ${t.raw.Route} — ${e.field}: ${short(e.from)} → ${short(e.to)}`);
  }
}

if (latest.added > 0 && latest.deleted > 0) {
  console.log(
    `\n  Note: ${newest} both added and removed ticks. Editing a tick's date or style on\n` +
      `  Mountain Project looks exactly like that, since exports carry no tick ID.`,
  );
}

for (const warning of warnings) console.log(`\n  WARNING: ${warning}`);

writeFileSync(OUTPUT, `${JSON.stringify(logbook, null, 2)}\n`);

const deleted = logbook.ticks.filter((t) => t.deleted).length;
console.log(
  `\nWrote ${OUTPUT}: ${logbook.ticks.length} ticks` +
    (deleted > 0 ? `, ${deleted} of them deleted upstream but kept here.` : '.') +
    `\nCommit it to keep the backup: git add ${DATA_DIR} ${OUTPUT}\n`,
);

function pad(value: string | number): string {
  return String(value).padStart(9);
}

function short(value: string): string {
  const flat = value.replace(/\s+/g, ' ');
  return flat.length > 60 ? `${flat.slice(0, 57)}…` : flat;
}

function describe(label: string, ticks: { raw: { Date: string; Route: string; Rating: string } }[]) {
  if (ticks.length === 0) return;
  console.log(`\n${label} (${ticks.length}):`);
  for (const t of ticks) console.log(`  ${t.raw.Date}  ${t.raw.Route} (${t.raw.Rating})`);
}
