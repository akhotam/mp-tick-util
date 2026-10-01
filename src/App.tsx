import { useEffect, useMemo, useState, type DragEvent } from 'react'
import FilterBar from './components/FilterBar'
import Landing from './components/Landing'
import MergeSummary, { type MergeInfo } from './components/MergeSummary'
import { deriveTicks } from './lib/derive'
import { applyFilters, fromParams, toParams, type Filters, type Tab } from './lib/filters'
import { asLogbook, downloadLogbook, errorMessage, readFiles } from './lib/load'
import { merge, orderSnapshots } from './lib/merge'
import type { Logbook } from './lib/types'
import Grades from './tabs/Grades'
import Overview from './tabs/Overview'
import Partners from './tabs/Partners'
import Places from './tabs/Places'
import Ticks from './tabs/Ticks'

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  grades: 'Grades',
  places: 'Places',
  partners: 'Partners',
  ticks: 'Ticks',
}

const initial = fromParams(new URLSearchParams(window.location.search))

function App() {
  const [logbook, setLogbook] = useState<Logbook | null>(null)
  const [info, setInfo] = useState<MergeInfo | null>(null)
  const [unsaved, setUnsaved] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [filters, setFilters] = useState<Filters>(initial.filters)
  const [tab, setTab] = useState<Tab>(initial.tab)

  const allTicks = useMemo(() => (logbook ? deriveTicks(logbook.ticks) : []), [logbook])
  const ticks = useMemo(() => applyFilters(allTicks, filters), [allTicks, filters])

  useEffect(() => {
    const qs = toParams(filters, tab).toString()
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`)
  }, [filters, tab])

  // Closing the tab discards merges never downloaded
  useEffect(() => {
    if (!unsaved) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved])

  async function handleFiles(files: File[]) {
    if (files.length === 0) return
    setError('')
    try {
      const loaded = await readFiles(files)
      const { ordered, strategy } = orderSnapshots(loaded.snapshots)
      const prior = loaded.prior ?? logbook
      const result = merge(prior, ordered)
      setLogbook(result.logbook)
      setInfo({
        priorName: loaded.prior ? 'logbook.json' : logbook ? 'current logbook' : null,
        diffs: result.diffs,
        warnings: result.warnings,
        strategy,
        totalTicks: result.logbook.ticks.length,
        deletedTicks: result.logbook.ticks.filter((t) => t.deleted).length,
      })
      setUnsaved(ordered.length > 0)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function loadDemo() {
    setError('')
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}logbook.json`)
      if (!res.ok) throw new Error(`Demo logbook failed to load (${res.status})`)
      setLogbook(asLogbook(await res.json()))
      setInfo(null)
      setUnsaved(false)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  function download() {
    if (!logbook) return
    downloadLogbook(logbook)
    setUnsaved(false)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    void handleFiles([...e.dataTransfer.files])
  }

  function onDragOver(e: DragEvent) {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    setDragging(true)
  }

  const setPatch = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch })

  return (
    <>
      <div className="top-nav" />
      <header className="site-header">
        <div className="container">
          <a className="wordmark" href={import.meta.env.BASE_URL}>
            MP Tick Utility
          </a>
        </div>
      </header>
      <main
        className={`main-content${dragging ? ' dragging' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false)
        }}
        onDrop={onDrop}
      >
        <div className="container">
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          {!logbook ? (
            <Landing onFiles={(f) => void handleFiles(f)} onDemo={() => void loadDemo()} />
          ) : (
            <>
              <div className="masthead">
                <div>
                  <h1>Your logbook</h1>
                  <p className="text-muted">
                    {allTicks.filter((t) => !t.deleted).length} ticks from {logbook.snapshots.length} export
                    {logbook.snapshots.length === 1 ? '' : 's'}
                    {unsaved && ', not yet downloaded'}
                  </p>
                </div>
                <div className="masthead-actions">
                  <label className="btn btn-secondary">
                    Add an export
                    <input
                      className="visually-hidden"
                      type="file"
                      multiple
                      accept=".csv,.json"
                      onChange={(e) => {
                        void handleFiles([...(e.target.files ?? [])])
                        e.target.value = ''
                      }}
                    />
                  </label>
                  <button className="btn btn-primary" type="button" onClick={download}>
                    Download logbook.json
                  </button>
                </div>
              </div>

              {info && <MergeSummary info={info} onDismiss={() => setInfo(null)} />}

              <nav className="tabs" role="tablist">
                {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
                  <button key={t} type="button" role="tab" className="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                    {TAB_LABELS[t]}
                  </button>
                ))}
              </nav>

              <FilterBar ticks={allTicks} filters={filters} onChange={setFilters} />

              <p className="text-muted small">
                Showing {ticks.length} of {allTicks.length} ticks
              </p>

              <div role="tabpanel">
                {tab === 'overview' && <Overview ticks={ticks} />}
                {tab === 'grades' && <Grades ticks={ticks} />}
                {tab === 'places' && <Places ticks={ticks} area={filters.area} onArea={(area) => setPatch({ area })} />}
                {tab === 'partners' && <Partners ticks={ticks} onPartner={(partner) => setPatch({ partner })} />}
                {tab === 'ticks' && <Ticks ticks={ticks} />}
              </div>

              <p className="text-muted small privacy">
                Everything stays in your browser. Closing this tab discards it, except the logbook.json you
                download.
              </p>
            </>
          )}
        </div>
      </main>
      <footer className="site-footer">
        <div className="container text-muted">Not affiliated with Mountain Project.</div>
      </footer>
    </>
  )
}

export default App
