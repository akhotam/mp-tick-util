import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { merge, orderSnapshots } from './merge.ts';
import { parseCsv } from './parse.ts';
import type { Snapshot } from './types.ts';

const FILES = [
  'ticks.csv',
  'ticks 2.csv',
  'ticks 3.csv',
  'ticks 4.csv',
  'ticks 5.csv',
  'ticks 6.csv',
];

const load = (name: string): Snapshot => parseCsv(name, readFileSync(`data/${name}`, 'utf8'));
const all = (): Snapshot[] => FILES.map(load);

describe('parse', () => {
  it('keeps rows intact when Notes contain embedded newlines', () => {
    const snapshot = load('ticks 6.csv');
    expect(snapshot.rows).toHaveLength(797);
    expect(snapshot.rows.some((r) => r.Notes.includes('\n'))).toBe(true);
    expect(snapshot.rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.Date))).toBe(true);
  });
});

describe('merge', () => {
  it('folds all six exports into one logbook with nothing lost or deleted', () => {
    const { logbook, warnings } = merge(null, all());

    expect(logbook.ticks).toHaveLength(797);
    expect(logbook.ticks.filter((t) => t.deleted)).toHaveLength(0);
    expect(logbook.snapshots).toEqual(FILES);
    expect(warnings).toEqual([]);
  });

  it('adds exactly the rows each export added — these six only ever grow', () => {
    const { diffs } = merge(null, all());
    const totals = diffs.map((d) => d.total);

    expect(totals).toEqual([769, 771, 778, 781, 783, 797]);
    expect(diffs.map((d) => d.added)).toEqual([769, 2, 7, 3, 2, 14]);
    expect(diffs.every((d) => d.deleted === 0)).toBe(true);
    // Every added row is accounted for: no silent collapsing of repeat laps.
    expect(diffs.reduce((sum, d) => sum + d.added, 0)).toBe(797);
  });

  it('records real edits and ignores community rating drift', () => {
    const { logbook, diffs } = merge(null, all());
    const edits = logbook.ticks.flatMap((t) => t.edits);

    // Two notes rewritten and one route length corrected across six exports.
    expect(edits.map((e) => e.field).sort()).toEqual(['Length', 'Notes', 'Notes']);
    expect(edits).toContainEqual({
      field: 'Length',
      from: '300',
      to: '360',
      at: 'ticks 4.csv',
    });
    // Avg Stars moved on 103 ticks; none of it is logbook history.
    expect(edits.some((e) => e.field === 'Avg Stars')).toBe(false);
    expect(diffs.reduce((sum, d) => sum + d.edited, 0)).toBe(3);

    // The drifting value is still updated to the newest export's number.
    const corrugation = logbook.ticks.find((t) => t.raw.Route === 'Corrugation Corner');
    expect(corrugation?.raw.Length).toBe('360');
  });

  it('preserves repeat laps of the same route on the same day', () => {
    const { logbook } = merge(null, all());
    const repeats = logbook.ticks.filter((t) => !t.id.endsWith('|0'));

    expect(repeats.length).toBe(19);
    // Three laps of Beginner's Crack on one day stay three ticks.
    const laps = logbook.ticks.filter((t) => t.id.startsWith('2026-03-14|105736459|'));
    expect(laps).toHaveLength(3);
    expect(new Set(laps.map((t) => t.id)).size).toBe(3);
  });

  it('is independent of the order files are handed to it', () => {
    const shuffled = [3, 0, 5, 1, 4, 2].map((i) => all()[i]);
    expect(merge(null, shuffled).logbook).toEqual(merge(null, all()).logbook);
  });

  it('flags a vanished tick instead of dropping it, and un-flags it if it returns', () => {
    const snapshots = all();
    const victim = snapshots[5].rows[0];
    const without: Snapshot = {
      name: 'ticks 7.csv',
      rows: snapshots[5].rows.filter((r) => r !== victim),
    };

    const gone = merge(null, [...snapshots, without]).logbook;
    const flagged = gone.ticks.find((t) => t.raw.Route === victim.Route && t.raw.Date === victim.Date);
    expect(gone.ticks).toHaveLength(797); // still there, just marked
    expect(flagged?.deleted).toBe(true);
    expect(flagged?.deleted_at).toBe('ticks 7.csv');
    expect(flagged?.edits).toContainEqual({
      field: 'deleted',
      from: 'false',
      to: 'true',
      at: 'ticks 7.csv',
    });

    const back: Snapshot = { name: 'ticks 8.csv', rows: snapshots[5].rows };
    const result = merge(null, [...snapshots, without, back]);
    const revived = result.logbook.ticks.find((t) => t.id === flagged!.id);
    expect(revived?.deleted).toBe(false);
    expect(revived?.deleted_at).toBe(null);
    expect(result.diffs.at(-1)?.resurrected).toBe(1);
  });

  it('records what changed when an existing tick is edited upstream', () => {
    const snapshots = all();
    const edited: Snapshot = {
      name: 'ticks 7.csv',
      rows: snapshots[5].rows.map((r, i) => (i === 0 ? { ...r, Notes: 'rewritten' } : r)),
    };

    const { logbook, diffs } = merge(null, [...snapshots, edited]);
    const tick = logbook.ticks.find((t) => t.raw.Notes === 'rewritten');

    expect(diffs.at(-1)?.edited).toBe(1);
    expect(tick?.edits).toContainEqual({
      field: 'Notes',
      from: snapshots[5].rows[0].Notes,
      to: 'rewritten',
      at: 'ticks 7.csv',
    });
  });

  it('continues from a previously exported logbook without re-reading old CSVs', () => {
    const snapshots = all();
    const upToFive = merge(null, snapshots.slice(0, 5)).logbook;

    const continued = merge(upToFive, [snapshots[5]]);
    const fromScratch = merge(null, snapshots);

    expect(continued.logbook.ticks).toHaveLength(797);
    expect(continued.diffs.at(-1)?.added).toBe(14);
    expect(continued.diffs.at(-1)?.deleted).toBe(0);
    expect(continued.logbook.ticks.map((t) => t.id)).toEqual(
      fromScratch.logbook.ticks.map((t) => t.id),
    );
  });

  it('warns when a merge would delete an implausible share of the logbook', () => {
    const snapshots = all();
    const truncated: Snapshot = { name: 'ticks 7.csv', rows: snapshots[5].rows.slice(0, 100) };
    const { warnings, logbook } = merge(null, [...snapshots, truncated]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('merged out of order');
    expect(logbook.ticks).toHaveLength(797); // nothing lost even so
  });
});

describe('orderSnapshots', () => {
  const rows = (date: string, n: number) =>
    Array.from({ length: n }, () => ({ Date: date }) as Snapshot['rows'][number]);

  it('reads the export number out of the filename', () => {
    const names = orderSnapshots([
      { name: 'ticks 3.csv', rows: [] },
      { name: 'ticks.csv', rows: [] },
      { name: 'ticks (2).csv', rows: [] },
    ]).map((s) => s.name);

    expect(names).toEqual(['ticks.csv', 'ticks (2).csv', 'ticks 3.csv']);
  });

  it('falls back to file mtime when names do not disambiguate', () => {
    const names = orderSnapshots([
      { name: 'export.csv', rows: [], lastModified: 200 },
      { name: 'copy of export.csv', rows: [], lastModified: 100 },
    ]).map((s) => s.name);

    expect(names).toEqual(['copy of export.csv', 'export.csv']);
  });

  it('falls back to the data itself when neither names nor mtimes help', () => {
    const names = orderSnapshots([
      { name: 'b.csv', rows: rows('2026-08-14', 3) },
      { name: 'a.csv', rows: rows('2026-01-01', 2) },
    ]).map((s) => s.name);

    expect(names).toEqual(['a.csv', 'b.csv']);
  });
});
