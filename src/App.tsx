import { useEffect, useMemo, useRef, useState } from 'react';
import { FilterBar } from './components/FilterBar.tsx';
import { Landing } from './components/Landing.tsx';
import { MergeSummary } from './components/MergeSummary.tsx';
import { deriveTicks } from './lib/derive.ts';
import { applyFilters, fromParams, toParams, type Filters } from './lib/filters.ts';
import { asLogbook, downloadLogbook, loadDropped } from './lib/load.ts';
import type { MergeResult } from './lib/types.ts';
import { Grades } from './tabs/Grades.tsx';
import { Overview } from './tabs/Overview.tsx';
import { Partners } from './tabs/Partners.tsx';
import { Places } from './tabs/Places.tsx';
import { Ticks } from './tabs/Ticks.tsx';

const TABS = ['Overview', 'Grades', 'Places', 'Partners', 'Ticks'] as const;
type Tab = (typeof TABS)[number];

export function App() {
  const [result, setResult] = useState<MergeResult | null>(null);
  const [showSummary, setShowSummary] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('Overview');
  const [filters, setFilters] = useState<Filters>(() => fromParams(new URLSearchParams(location.search)));
  const addMore = useRef<HTMLInputElement>(null);

  // Filters and tab live in the URL, so any view can be bookmarked or shared.
  useEffect(() => {
    const params = toParams(filters);
    if (tab !== 'Overview') params.set('tab', tab);
    const query = params.toString();
    history.replaceState(null, '', query ? `?${query}` : location.pathname);
  }, [filters, tab]);

  useEffect(() => {
    const wanted = new URLSearchParams(location.search).get('tab');
    if (wanted && (TABS as readonly string[]).includes(wanted)) setTab(wanted as Tab);
  }, []);

  const logbook = result?.logbook ?? null;
  const all = useMemo(() => (logbook ? deriveTicks(logbook) : []), [logbook]);
  const ticks = useMemo(() => applyFilters(all, filters), [all, filters]);
  const deletedCount = useMemo(() => all.filter((t) => t.deleted).length, [all]);

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await loadDropped(files, logbook));
      setShowSummary(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleDemo() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}logbook.json`);
      const demo = asLogbook(await response.json(), 'The demo logbook');
      setResult({ logbook: demo, diffs: [], warnings: [] });
      setShowSummary(false);
    } catch {
      setError('Could not load the demo logbook.');
    } finally {
      setBusy(false);
    }
  }

  if (!logbook) {
    return (
      <div className="app">
        <Landing onFiles={handleFiles} onDemo={handleDemo} busy={busy} error={error} />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <h1>Your logbook</h1>
          <div className="sub">
            {logbook.snapshots.length > 0
              ? `${logbook.ticks.length} ticks merged from ${logbook.snapshots.length} export${logbook.snapshots.length === 1 ? '' : 's'}`
              : `${logbook.ticks.length} ticks`}
          </div>
        </div>
        <div className="masthead-actions">
          <button className="btn" onClick={() => addMore.current?.click()}>
            Add an export
          </button>
          <button className="btn primary" onClick={() => downloadLogbook(logbook)}>
            Download logbook.json
          </button>
          <input
            ref={addMore}
            type="file"
            accept=".csv,.json"
            multiple
            hidden
            onChange={(e) => handleFiles([...(e.target.files ?? [])])}
          />
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      {showSummary && result && result.diffs.length > 0 && (
        <MergeSummary
          logbook={logbook}
          diffs={result.diffs}
          warnings={result.warnings}
          onDismiss={() => setShowSummary(false)}
        />
      )}

      <nav className="tabs" role="tablist">
        {TABS.map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </nav>

      <FilterBar
        all={all}
        filters={filters}
        onChange={setFilters}
        matched={ticks.length}
        deletedCount={deletedCount}
      />

      {ticks.length === 0 ? (
        <div className="empty">Nothing matches these filters.</div>
      ) : tab === 'Overview' ? (
        <Overview ticks={ticks} />
      ) : tab === 'Grades' ? (
        <Grades ticks={ticks} />
      ) : tab === 'Places' ? (
        <Places
          ticks={ticks}
          area={filters.area}
          onArea={(area) => setFilters({ ...filters, area })}
        />
      ) : tab === 'Partners' ? (
        <Partners
          ticks={ticks}
          partner={filters.partner}
          onPartner={(partner) => setFilters({ ...filters, partner })}
        />
      ) : (
        <Ticks ticks={ticks} />
      )}

      <p className="privacy" style={{ textAlign: 'center' }}>
        Nothing here is uploaded or stored. Download <code>logbook.json</code> to keep this merge —
        drop it back next time with a fresh export to carry on.
      </p>
    </div>
  );
}
