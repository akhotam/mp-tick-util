import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { merge, orderSnapshots } from './merge.ts';
import { parseCsv } from './parse.ts';
import type { Snapshot } from './types.ts';

/**
 * The committed fixtures in `data/`: two synthetic exports built to exercise
 * the merge engine end to end. `ticks 2.csv` is `ticks.csv` plus four new
 * ticks, minus the two from 2026-01-05 (a deletion upstream), with one note
 * rewritten (a tracked edit) and one Avg Stars nudged (drift that is not).
 *
 * Snapshots beyond these two are built in-test from the newest one, so the
 * delete / edit / resurrect paths stay testable without more fixture files.
 */
const FILES = ['ticks.csv', 'ticks 2.csv'];

const load = (name: string): Snapshot => parseCsv(name, readFileSync(`data/${name}`, 'utf8'));
const all = (): Snapshot[] => FILES.map(load);
/** The newest export, the one later snapshots are derived from. */
const latest = (): Snapshot => all()[1];

describe('parse', () => {
  it('keeps rows intact when Notes contain embedded newlines', () => {
    const snapshot = load('ticks 2.csv');
    expect(snapshot.rows).toHaveLength(18);
    expect(snapshot.rows.some((r) => r.Notes.includes('\n'))).toBe(true);
    expect(snapshot.rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.Date))).toBe(true);
  });
});

describe('merge', () => {
  it('folds both exports into one logbook, flagging what vanished instead of dropping it', () => {
    const { logbook } = merge(null, all());

    expect(logbook.ticks).toHaveLength(20);
    expect(logbook.snapshots).toEqual(FILES);

    // The two ticks missing from ticks 2.csv are still here, marked — that flag
    // is the whole point of the tool.
    expect(logbook.ticks.filter((t) => t.deleted).map((t) => t.raw.Route)).toEqual([
      'Fake Buttress',
      'Ghost Crack',
    ]);
    expect(logbook.ticks.every((t) => t.first_seen && t.last_seen)).toBe(true);
  });

  it('accounts for every row of every export', () => {
    const { diffs } = merge(null, all());

    expect(diffs.map((d) => d.total)).toEqual([16, 18]);
    expect(diffs.map((d) => d.added)).toEqual([16, 4]);
    expect(diffs.map((d) => d.deleted)).toEqual([0, 2]);
    expect(diffs.every((d) => d.resurrected === 0)).toBe(true);
    // Every added row is accounted for: no silent collapsing of repeat laps.
    expect(diffs.reduce((sum, d) => sum + d.added, 0)).toBe(20);
  });

  it('warns when a snapshot drops an implausible share of the logbook', () => {
    // The guard is 5% of the accumulated logbook, which on a 20-tick fixture is
    // one tick — so even these two real deletions trip it. On a real logbook
    // the same warning is what catches an out-of-order or partial export.
    const { warnings } = merge(null, all());

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('ticks 2.csv dropped 2 of 20 ticks');
    expect(warnings[0]).toContain('merged out of order');
  });

  it('records real edits and ignores community rating drift', () => {
    const { logbook, diffs } = merge(null, all());
    const edits = logbook.ticks.flatMap((t) => t.edits);
    const fields = edits.filter((e) => e.field !== 'deleted');

    // One note rewritten between the two exports, and nothing else.
    expect(fields).toEqual([
      {
        field: 'Notes',
        from: 'w/ Priya. Committing move at the crux',
        to: 'w/ Priya. Committing move at the crux, felt easier the second time',
        at: 'ticks 2.csv',
      },
    ]);
    // Stars Drift Route's Avg Stars moved 2.0 → 2.5; none of it is logbook history.
    expect(edits.some((e) => e.field === 'Avg Stars')).toBe(false);
    expect(diffs.reduce((sum, d) => sum + d.edited, 0)).toBe(1);

    // The drifting value is still updated to the newest export's number.
    const drifted = logbook.ticks.find((t) => t.raw.Route === 'Stars Drift Route');
    expect(drifted?.raw['Avg Stars']).toBe('2.5');
  });

  it('preserves repeat laps of the same route on the same day', () => {
    const { logbook } = merge(null, all());
    const repeats = logbook.ticks.filter((t) => !t.id.endsWith('|0'));

    expect(repeats).toHaveLength(1);
    // Two laps of Sample Slab on one day stay two ticks.
    const laps = logbook.ticks.filter((t) => t.id.startsWith('2026-01-12|900000103|'));
    expect(laps).toHaveLength(2);
    expect(new Set(laps.map((t) => t.id)).size).toBe(2);
    expect(laps.map((t) => t.raw.Notes)).toEqual(['w/ Theo.', 'w/ Theo. Second lap']);
  });

  it('is independent of the order files are handed to it', () => {
    const shuffled = [1, 0].map((i) => all()[i]);
    expect(merge(null, shuffled).logbook).toEqual(merge(null, all()).logbook);
  });

  it('flags a vanished tick instead of dropping it, and un-flags it if it returns', () => {
    const snapshots = all();
    const newest = snapshots[1];
    const victim = newest.rows[0];
    const without: Snapshot = {
      name: 'ticks 3.csv',
      rows: newest.rows.filter((r) => r !== victim),
    };

    const gone = merge(null, [...snapshots, without]).logbook;
    const flagged = gone.ticks.find(
      (t) => t.raw.Route === victim.Route && t.raw.Date === victim.Date,
    );
    expect(gone.ticks).toHaveLength(20); // still there, just marked
    expect(flagged?.deleted).toBe(true);
    expect(flagged?.deleted_at).toBe('ticks 3.csv');
    expect(flagged?.edits).toContainEqual({
      field: 'deleted',
      from: 'false',
      to: 'true',
      at: 'ticks 3.csv',
    });

    const back: Snapshot = { name: 'ticks 4.csv', rows: newest.rows };
    const result = merge(null, [...snapshots, without, back]);
    const revived = result.logbook.ticks.find((t) => t.id === flagged!.id);
    expect(revived?.deleted).toBe(false);
    expect(revived?.deleted_at).toBe(null);
    expect(result.diffs.at(-1)?.resurrected).toBe(1);
  });

  it('records what changed when an existing tick is edited upstream', () => {
    const snapshots = all();
    const newest = snapshots[1];
    const edited: Snapshot = {
      name: 'ticks 3.csv',
      rows: newest.rows.map((r, i) => (i === 0 ? { ...r, Notes: 'rewritten' } : r)),
    };

    const { logbook, diffs } = merge(null, [...snapshots, edited]);
    const tick = logbook.ticks.find((t) => t.raw.Notes === 'rewritten');

    expect(diffs.at(-1)?.edited).toBe(1);
    expect(diffs.at(-1)?.deleted).toBe(0);
    expect(tick?.edits).toContainEqual({
      field: 'Notes',
      from: newest.rows[0].Notes,
      to: 'rewritten',
      at: 'ticks 3.csv',
    });
  });

  it('continues from a previously exported logbook without re-reading old CSVs', () => {
    const snapshots = all();
    const first = merge(null, snapshots.slice(0, 1)).logbook;
    expect(first.ticks).toHaveLength(16);

    const continued = merge(first, [snapshots[1]]);
    const fromScratch = merge(null, snapshots);

    expect(continued.logbook.ticks).toHaveLength(20);
    expect(continued.diffs.at(-1)?.added).toBe(4);
    expect(continued.diffs.at(-1)?.deleted).toBe(2);
    expect(continued.logbook.snapshots).toEqual(FILES);
    expect(continued.logbook.ticks.map((t) => t.id)).toEqual(
      fromScratch.logbook.ticks.map((t) => t.id),
    );
  });

  it('never drops ticks, even when a snapshot is a partial export', () => {
    const snapshots = all();
    const truncated: Snapshot = { name: 'ticks 3.csv', rows: snapshots[1].rows.slice(0, 4) };
    const { warnings, logbook, diffs } = merge(null, [...snapshots, truncated]);

    // 20 accumulated, 4 present in the partial export, 2 already flagged by
    // ticks 2.csv and not re-counted.
    expect(diffs.at(-1)?.deleted).toBe(14);
    expect(warnings.at(-1)).toContain('ticks 3.csv dropped 14 of 20 ticks');
    expect(logbook.ticks).toHaveLength(20); // nothing lost even so
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

  it('orders the committed exports oldest first', () => {
    expect(orderSnapshots([latest(), load('ticks.csv')]).map((s) => s.name)).toEqual(FILES);
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
