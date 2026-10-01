import { routeId } from './parse.ts'
import {
  TRACKED_FIELDS,
  type Logbook,
  type MergeResult,
  type RawTick,
  type Snapshot,
  type SnapshotDiff,
  type TickRecord,
} from './types.ts'

const DELETE_WARN_RATIO = 0.05

export function tickKey(raw: RawTick): string {
  return [raw.Date, routeId(raw.URL), raw.Style, raw['Lead Style'], raw.Pitches].join('|')
}

// Every snapshot counts as MP's complete list, absence means deleted upstream
export function merge(prior: Logbook | null, snapshots: Snapshot[]): MergeResult {
  const records = new Map<string, TickRecord>()
  for (const t of prior?.ticks ?? []) records.set(t.id, structuredClone(t))
  const names = [...(prior?.snapshots ?? [])]
  const diffs: SnapshotDiff[] = []
  const warnings: string[] = []

  for (const snap of snapshots) {
    const at = snap.name
    const diff: SnapshotDiff = { name: at, total: snap.rows.length, added: 0, edited: 0, deleted: 0, resurrected: 0 }
    const occurrences = new Map<string, number>()
    const seen = new Set<string>()

    for (const raw of snap.rows) {
      const key = tickKey(raw)
      const n = occurrences.get(key) ?? 0
      occurrences.set(key, n + 1)
      // Occurrence suffix keeps repeat laps of one route on one day distinct
      const id = `${key}|${n}`
      seen.add(id)

      const rec = records.get(id)
      if (!rec) {
        records.set(id, { id, raw: { ...raw }, first_seen: at, last_seen: at, deleted: false, deleted_at: null, edits: [] })
        diff.added++
        continue
      }
      if (rec.deleted) {
        rec.edits.push({ field: 'deleted', from: true, to: false, at })
        rec.deleted = false
        rec.deleted_at = null
        diff.resurrected++
      }
      let edited = false
      for (const field of TRACKED_FIELDS) {
        if (rec.raw[field] === raw[field]) continue
        rec.edits.push({ field, from: rec.raw[field], to: raw[field], at })
        edited = true
      }
      if (edited) diff.edited++
      rec.raw = { ...raw }
      rec.last_seen = at
    }

    for (const rec of records.values()) {
      if (rec.deleted || seen.has(rec.id)) continue
      rec.edits.push({ field: 'deleted', from: false, to: true, at })
      rec.deleted = true
      rec.deleted_at = at
      diff.deleted++
    }

    if (diff.deleted > 0 && diff.deleted > records.size * DELETE_WARN_RATIO) {
      const pct = Math.round((diff.deleted / records.size) * 100)
      warnings.push(
        `${at}: ${diff.deleted} ticks vanished (${pct}% of logbook). Check that exports are complete and in order.`,
      )
    }
    if (!names.includes(at)) names.push(at)
    diffs.push(diff)
  }

  const ticks = [...records.values()].sort((a, b) => cmp(a.raw.Date, b.raw.Date) || cmp(a.id, b.id))
  return { logbook: { version: 1, snapshots: names, ticks }, diffs, warnings }
}

export type OrderStrategy = 'filename number' | 'last modified' | 'latest tick date' | 'file name'

// Each strategy maps snapshots to sort keys, first one with distinct valid keys wins
const STRATEGIES: [OrderStrategy, (s: Snapshot) => number | string][] = [
  ['filename number', (s) => filenameNumber(s.name)],
  ['last modified', (s) => s.lastModified ?? NaN],
  ['latest tick date', (s) => `${maxDate(s)}|${String(s.rows.length).padStart(6, '0')}`],
]

export function orderSnapshots(snapshots: Snapshot[]): { ordered: Snapshot[]; strategy: OrderStrategy } {
  for (const [strategy, keyOf] of STRATEGIES) {
    const keys = snapshots.map(keyOf)
    if (keys.some((k) => typeof k === 'number' && Number.isNaN(k))) continue
    if (new Set(keys).size !== keys.length) continue
    const order = snapshots.map((s, i) => ({ s, k: keys[i] })).sort((a, b) => cmp(a.k, b.k))
    return { ordered: order.map((o) => o.s), strategy }
  }
  return { ordered: [...snapshots].sort((a, b) => cmp(a.name, b.name)), strategy: 'file name' }
}

// MP names the first export ticks.csv, browsers number repeats, ticks 6.csv or ticks (3).csv
function filenameNumber(name: string): number {
  const digits = name.replace(/\.[^.]*$/, '').match(/\d+/g)
  return digits ? Number(digits[digits.length - 1]) : 1
}

function maxDate(s: Snapshot): string {
  return s.rows.reduce((max, r) => (r.Date > max ? r.Date : max), '')
}

function cmp<T extends string | number>(a: T, b: T): number {
  return a < b ? -1 : a > b ? 1 : 0
}
