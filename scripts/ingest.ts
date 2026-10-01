import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { serializeLogbook } from '../src/lib/load.ts'
import { merge, orderSnapshots } from '../src/lib/merge.ts'
import { parseCsv } from '../src/lib/parse.ts'
import type { Snapshot, TickRecord } from '../src/lib/types.ts'

const root = join(import.meta.dirname, '..')
const dataDir = join(root, 'data')
const outFile = join(root, 'public', 'logbook.json')

const files = readdirSync(dataDir).filter((f) => f.toLowerCase().endsWith('.csv'))
if (files.length === 0) {
  console.error(`No CSV exports in ${dataDir}`)
  process.exit(1)
}

const snapshots: Snapshot[] = files.map((name) => {
  const path = join(dataDir, name)
  return { name, rows: parseCsv(readFileSync(path, 'utf8')), lastModified: statSync(path).mtimeMs }
})
const { ordered, strategy } = orderSnapshots(snapshots)
const { logbook, diffs, warnings } = merge(null, ordered)

console.log(`Export order (by ${strategy}): ${ordered.map((s) => s.name).join(' → ')}\n`)
console.table(
  diffs.map((d) => ({
    export: d.name,
    rows: d.total,
    added: d.added,
    edited: d.edited,
    deleted: d.deleted,
    back: d.resurrected,
  })),
)

const newest = ordered[ordered.length - 1].name
const describe = (t: TickRecord) => `${t.raw.Date}  ${t.raw.Route}  (${[t.raw.Style, t.raw['Lead Style']].filter(Boolean).join(' ')})`
const added = logbook.ticks.filter((t) => t.first_seen === newest && ordered.length > 1)
const vanished = logbook.ticks.filter((t) => t.deleted_at === newest)
const edited = logbook.ticks.filter((t) => t.edits.some((e) => e.at === newest && e.field !== 'deleted'))

function section(title: string, lines: string[]): void {
  if (lines.length === 0) return
  console.log(`\n${title}:`)
  for (const l of lines) console.log(`  ${l}`)
}

section(`Added in ${newest}`, added.map(describe))
section(`Vanished in ${newest}`, vanished.map(describe))
section(
  `Edits in ${newest}`,
  edited.flatMap((t) =>
    t.edits
      .filter((e) => e.at === newest && e.field !== 'deleted')
      .map((e) => `${t.raw.Route}: ${e.field} ${JSON.stringify(e.from)} → ${JSON.stringify(e.to)}`),
  ),
)
if (added.length > 0 && vanished.length > 0) {
  console.log(`\nNote: ${newest} both adds and deletes ticks, likely a date or style edited on Mountain Project.`)
}
section('Warnings', warnings)

writeFileSync(outFile, serializeLogbook(logbook))
const deleted = logbook.ticks.filter((t) => t.deleted).length
console.log(`\nWrote ${outFile} (${logbook.ticks.length} ticks, ${deleted} deleted)`)
