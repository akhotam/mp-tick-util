import type { Logbook, SnapshotDiff } from '../lib/types.ts';

interface Props {
  logbook: Logbook;
  diffs: SnapshotDiff[];
  warnings: string[];
  onDismiss: () => void;
}

export function MergeSummary({ logbook, diffs, warnings, onDismiss }: Props) {
  const latest = diffs.at(-1);
  const deleted = logbook.ticks.filter((t) => t.deleted).length;

  const parts = [`${logbook.ticks.length} ticks`, `${logbook.snapshots.length} exports`];
  if (latest) {
    if (latest.added > 0) parts.push(`${latest.added} added`);
    if (latest.edited > 0) parts.push(`${latest.edited} edited`);
    if (latest.deleted > 0) parts.push(`${latest.deleted} gone from Mountain Project`);
    if (latest.resurrected > 0) parts.push(`${latest.resurrected} back again`);
  }

  return (
    <div className="summary-panel">
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
        <strong>{parts.join(' · ')}</strong>
        <button className="btn ghost" onClick={onDismiss} aria-label="Dismiss summary">
          ✕
        </button>
      </div>

      <div className="order">
        Merged oldest to newest: {logbook.snapshots.join(' → ')}
        {deleted > 0 && (
          <>
            {' '}
            · {deleted} tick{deleted === 1 ? '' : 's'} no longer in Mountain Project's export, kept
            here and hidden until you ask for them.
          </>
        )}
      </div>

      {warnings.map((warning) => (
        <div className="warning" key={warning}>
          {warning}
        </div>
      ))}
    </div>
  );
}
