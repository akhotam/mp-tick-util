import { describe, expect, it } from 'vitest'
import { fixtureSnapshot } from './fixtures.ts'
import { merge, orderSnapshots, tickKey } from './merge.ts'
import type { RawTick, Snapshot, TickRecord } from './types.ts'

const s1 = fixtureSnapshot('ticks.csv')
const s2 = fixtureSnapshot('ticks 2.csv')

function find(ticks: TickRecord[], route: string, date?: string): TickRecord[] {
  return ticks.filter((t) => t.raw.URL.includes(`/${route}`) && (!date || t.raw.Date === date))
}

function subset(snap: Snapshot, keep: (r: RawTick, i: number) => boolean, name = snap.name): Snapshot {
  return { name, rows: snap.rows.filter(keep) }
}

describe('merge fixtures', () => {
  const { logbook, diffs, warnings } = merge(null, [s1, s2])

  it('merges to 32 ticks', () => {
    expect(logbook.ticks).toHaveLength(32)
    expect(logbook.snapshots).toEqual(['ticks.csv', 'ticks 2.csv'])
  })

  it('reports per-snapshot counts', () => {
    expect(diffs).toEqual([
      { name: 'ticks.csv', total: 23, added: 23, edited: 0, deleted: 0, resurrected: 0 },
      { name: 'ticks 2.csv', total: 30, added: 9, edited: 7, deleted: 2, resurrected: 0 },
    ])
  })

  it('warns when export 2 drops more than 5%', () => {
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/^ticks 2\.csv: 2 ticks vanished/)
  })

  it('keeps dropped free solo as deleted record', () => {
    const [solo] = find(logbook.ticks, '109909536')
    expect(solo.deleted).toBe(true)
    expect(solo.deleted_at).toBe('ticks 2.csv')
    expect(solo.last_seen).toBe('ticks.csv')
    expect(solo.edits).toEqual([{ field: 'deleted', from: false, to: true, at: 'ticks 2.csv' }])
  })

  it('treats moved date as delete plus add', () => {
    const aid = find(logbook.ticks, '127378380')
    expect(aid.map((t) => [t.raw.Date, t.deleted])).toEqual([
      ['2026-06-27', false],
      ['2026-06-28', true],
      ['2026-10-01', false],
    ])
  })

  it('logs tracked field edits', () => {
    const edits = logbook.ticks.flatMap((t) => t.edits.filter((e) => e.field !== 'deleted'))
    const byField: Record<string, number> = {}
    for (const e of edits) byField[e.field] = (byField[e.field] ?? 0) + 1
    // Regrade touches Rating and Rating Code on both laps of 5.8+ sport
    expect(byField).toEqual({ Route: 1, URL: 1, Rating: 2, 'Rating Code': 2, Length: 1, 'Your Rating': 1, Location: 1, 'Route Type': 1, Notes: 1 })
    expect(edits).toHaveLength(11)
    expect(edits.every((e) => e.at === 'ticks 2.csv')).toBe(true)

    const [patio] = find(logbook.ticks, '112833955')
    expect(patio.edits).toEqual([
      { field: 'Route', from: 'Patio Cracks Left', to: 'Patio Cracks - Left', at: 'ticks 2.csv' },
      {
        field: 'URL',
        from: 'https://www.mountainproject.com/route/112833955/patio-cracks',
        to: 'https://www.mountainproject.com/route/112833955/patio-cracks-left',
        at: 'ticks 2.csv',
      },
    ])
  })

  it('updates star drift without logging it', () => {
    const [riel] = find(logbook.ticks, '117376550')
    expect(riel.raw['Avg Stars']).toBe('2.1')
    expect(riel.edits).toEqual([])
    const [jim] = find(logbook.ticks, '114814486')
    expect(jim.raw['Your Stars']).toBe('3')
    expect(jim.edits).toEqual([])
  })

  it('keeps repeat laps distinct', () => {
    const malibu = find(logbook.ticks, '200953736')
    expect(malibu.map((t) => t.id)).toEqual([
      `${tickKey(malibu[0].raw)}|0`,
      `${tickKey(malibu[0].raw)}|1`,
    ])
    expect(find(logbook.ticks, '122207267')).toHaveLength(2)
  })

  it('sorts output by date then id', () => {
    const sorted = [...logbook.ticks].sort((a, b) => a.raw.Date.localeCompare(b.raw.Date) || (a.id < b.id ? -1 : 1))
    expect(logbook.ticks.map((t) => t.id)).toEqual(sorted.map((t) => t.id))
  })
})

describe('merge invariants', () => {
  it('produces byte-identical output on re-run', () => {
    const a = JSON.stringify(merge(null, [s1, s2]))
    const b = JSON.stringify(merge(null, [s1, s2]))
    expect(a).toBe(b)
  })

  it('continuing from prior logbook equals full rebuild', () => {
    const first = merge(null, [s1]).logbook
    const json = JSON.parse(JSON.stringify(first))
    expect(merge(json, [s2]).logbook).toEqual(merge(null, [s1, s2]).logbook)
  })

  it('does not mutate prior logbook', () => {
    const first = merge(null, [s1]).logbook
    const before = JSON.stringify(first)
    merge(first, [s2])
    expect(JSON.stringify(first)).toBe(before)
  })

  it('ignores row order within a snapshot', () => {
    const shuffled = { ...s2, rows: [...s2.rows].reverse() }
    expect(merge(null, [s1, shuffled]).logbook).toEqual(merge(null, [s1, s2]).logbook)
  })

  it('appends snapshot names once', () => {
    expect(merge(merge(null, [s1]).logbook, [s1]).logbook.snapshots).toEqual(['ticks.csv'])
  })

  it('resurrects tick that returns', () => {
    const partial = subset(s1, (r) => !r.URL.includes('109909536'), 'partial.csv')
    const { logbook, diffs } = merge(null, [s1, partial, { ...s1, name: 'full.csv' }])
    const [solo] = find(logbook.ticks, '109909536')
    expect(solo.deleted).toBe(false)
    expect(solo.deleted_at).toBeNull()
    expect(solo.edits.map((e) => [e.field, e.to, e.at])).toEqual([
      ['deleted', true, 'partial.csv'],
      ['deleted', false, 'full.csv'],
    ])
    expect(diffs[2].resurrected).toBe(1)
  })

  it('marks missing ticks deleted after partial export and warns', () => {
    const partial = subset(s1, (_, i) => i < 5, 'partial.csv')
    const { logbook, diffs, warnings } = merge(null, [s1, partial])
    expect(logbook.ticks).toHaveLength(23)
    expect(logbook.ticks.filter((t) => t.deleted)).toHaveLength(18)
    expect(diffs[1].deleted).toBe(18)
    expect(warnings).toHaveLength(1)
  })

  it('does not warn on small deletion', () => {
    const big: Snapshot = { name: 'big.csv', rows: [...s1.rows, ...s2.rows.slice(0, 8)] }
    const minus: Snapshot = { name: 'minus.csv', rows: big.rows.slice(1) }
    const { diffs, warnings } = merge(null, [big, minus])
    expect(diffs[1].deleted).toBe(1)
    expect(warnings).toEqual([])
  })

  it('separates repeat laps by occurrence, dropping one lap deletes last occurrence', () => {
    const oneLap = subset(s1, (r, i) => !(r.URL.includes('200953736') && i === 10), 'one.csv')
    const { logbook } = merge(null, [s1, oneLap])
    const malibu = find(logbook.ticks, '200953736')
    expect(malibu.map((t) => [t.id.endsWith('|0'), t.deleted])).toEqual([
      [true, false],
      [false, true],
    ])
  })
})

describe('orderSnapshots', () => {
  const snap = (name: string, lastModified?: number, rows = s1.rows): Snapshot => ({ name, rows, lastModified })
  const names = (r: { ordered: Snapshot[] }) => r.ordered.map((s) => s.name)

  it('orders by last number in filename', () => {
    const r = orderSnapshots([snap('ticks 6.csv'), snap('ticks (3).csv'), snap('ticks.csv')])
    expect(r.strategy).toBe('filename number')
    expect(names(r)).toEqual(['ticks.csv', 'ticks (3).csv', 'ticks 6.csv'])
  })

  it('falls back to lastModified when filename numbers collide', () => {
    const r = orderSnapshots([snap('b.csv', 200), snap('a.csv', 100)])
    expect(r.strategy).toBe('last modified')
    expect(names(r)).toEqual(['a.csv', 'b.csv'])
  })

  it('falls back to latest tick date and row count', () => {
    const r = orderSnapshots([snap('x.csv', undefined, s2.rows), snap('y.csv', undefined, s1.rows)])
    expect(r.strategy).toBe('latest tick date')
    expect(names(r)).toEqual(['y.csv', 'x.csv'])
    const sameDate = orderSnapshots([snap('p.csv', 5, s1.rows), snap('q.csv', 5, s1.rows.slice(0, 3))])
    expect(names(sameDate)).toEqual(['q.csv', 'p.csv'])
  })

  it('falls back to name sort when everything ties', () => {
    const r = orderSnapshots([snap('b.csv', 1), snap('a.csv', 1)])
    expect(r.strategy).toBe('file name')
    expect(names(r)).toEqual(['a.csv', 'b.csv'])
  })

  it('merge result does not depend on input order once ordered', () => {
    const forward = merge(null, orderSnapshots([s1, s2]).ordered)
    const backward = merge(null, orderSnapshots([s2, s1]).ordered)
    expect(backward).toEqual(forward)
  })
})
