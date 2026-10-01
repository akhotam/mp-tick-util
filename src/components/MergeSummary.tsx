import type { OrderStrategy } from '../lib/merge.ts'
import type { SnapshotDiff } from '../lib/types.ts'

export interface MergeInfo {
  priorName: string | null
  diffs: SnapshotDiff[]
  warnings: string[]
  strategy: OrderStrategy
  totalTicks: number
  deletedTicks: number
}

function MergeSummary({ info, onDismiss }: { info: MergeInfo; onDismiss: () => void }) {
  const added = info.diffs.reduce((s, d) => s + d.added, 0)
  const edited = info.diffs.reduce((s, d) => s + d.edited, 0)
  const deleted = info.diffs.reduce((s, d) => s + d.deleted, 0)
  const resurrected = info.diffs.reduce((s, d) => s + d.resurrected, 0)
  return (
    <section className="panel merge-summary" aria-label="Merge summary">
      <button className="dismiss" type="button" onClick={onDismiss} aria-label="Dismiss merge summary">
        ×
      </button>
      <h3>
        {info.diffs.length > 0
          ? `Merged ${info.diffs.length} export${info.diffs.length === 1 ? '' : 's'}`
          : 'Loaded logbook'}
        {info.priorName && ` into ${info.priorName}`}
      </h3>
      <p>
        {added} added, {edited} edited, {deleted} deleted, {resurrected} restored. Logbook now holds{' '}
        {info.totalTicks} ticks, {info.deletedTicks} of them deleted on Mountain Project and kept here.
      </p>
      {info.diffs.length > 0 && (
        <>
          <p className="text-muted">Applied in order, by {info.strategy}:</p>
          <table className="data compact">
            <thead>
              <tr>
                <th>Export</th>
                <th className="num">Rows</th>
                <th className="num">Added</th>
                <th className="num">Edited</th>
                <th className="num">Deleted</th>
                <th className="num">Restored</th>
              </tr>
            </thead>
            <tbody>
              {info.diffs.map((d, i) => (
                <tr key={`${i}-${d.name}`}>
                  <td>{d.name}</td>
                  <td className="num">{d.total}</td>
                  <td className="num">{d.added}</td>
                  <td className="num">{d.edited}</td>
                  <td className="num">{d.deleted}</td>
                  <td className="num">{d.resurrected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {info.warnings.map((w) => (
        <p key={w} className="alert" role="alert">
          {w}
        </p>
      ))}
      <p className="text-muted">Download logbook.json to keep these changes.</p>
    </section>
  )
}

export default MergeSummary
