import { useMemo } from 'react'
import { SEND_STATUSES } from '../lib/derive.ts'
import { DEFAULT_FILTERS, SOLO, isFiltered, type Filters } from '../lib/filters.ts'
import { byPartner, codeLabels } from '../lib/stats.ts'
import type { Tick } from '../lib/types.ts'

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function FilterBar({ ticks, filters, onChange }: { ticks: Tick[]; filters: Filters; onChange: (f: Filters) => void }) {
  const options = useMemo(() => {
    const live = ticks.filter((t) => !t.deleted)
    return {
      grades: [...codeLabels(live)].filter(([code]) => code > 0).sort((a, b) => a[0] - b[0]),
      disciplines: [...new Set(live.flatMap((t) => t.disciplines))].sort(),
      statuses: SEND_STATUSES.filter((s) => live.some((t) => t.sendStatus === s)),
      partners: byPartner(live).map((p) => p.name),
      deleted: ticks.length - live.length,
    }
  }, [ticks])
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  const code = (v: string) => (v === '' ? null : Number(v))

  return (
    <section className="filter-bar" aria-label="Filters">
      <div className="filter-row">
        <label>
          From
          <input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} />
        </label>
        <label>
          To
          <input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
        </label>
        <label>
          Min grade
          <select value={filters.minCode ?? ''} onChange={(e) => set({ minCode: code(e.target.value) })}>
            <option value="">Any</option>
            {options.grades.map(([c, label]) => (
              <option key={c} value={c}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Max grade
          <select value={filters.maxCode ?? ''} onChange={(e) => set({ maxCode: code(e.target.value) })}>
            <option value="">Any</option>
            {options.grades.map(([c, label]) => (
              <option key={c} value={c}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Partner
          <select value={filters.partner} onChange={(e) => set({ partner: e.target.value })}>
            <option value="">Anyone</option>
            <option value={SOLO}>No partner noted</option>
            {filters.partner && filters.partner !== SOLO && !options.partners.includes(filters.partner) && (
              <option value={filters.partner}>{filters.partner}</option>
            )}
            {options.partners.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="grow">
          Search
          <input
            type="search"
            placeholder="Route, notes, location"
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
          />
        </label>
      </div>
      <div className="filter-row">
        <span className="filter-label">Type</span>
        {options.disciplines.map((d) => (
          <button
            key={d}
            type="button"
            className="chip"
            aria-pressed={filters.disciplines.includes(d)}
            onClick={() => set({ disciplines: toggle(filters.disciplines, d) })}
          >
            {d}
          </button>
        ))}
        <span className="filter-label">Style</span>
        {options.statuses.map((s) => (
          <button
            key={s}
            type="button"
            className="chip"
            aria-pressed={filters.sendStatus.includes(s)}
            onClick={() => set({ sendStatus: toggle(filters.sendStatus, s) })}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="filter-row">
        {filters.area && (
          <span className="chip" aria-pressed="true">
            Area: {filters.area}
            <button type="button" className="chip-clear" aria-label="Clear area" onClick={() => set({ area: '' })}>
              ×
            </button>
          </span>
        )}
        {options.deleted > 0 && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={filters.includeDeleted}
              onChange={(e) => set({ includeDeleted: e.target.checked })}
            />
            Include {options.deleted} tick{options.deleted === 1 ? '' : 's'} deleted on Mountain Project
          </label>
        )}
        {isFiltered(filters) && (
          <button type="button" className="link-button" onClick={() => onChange(DEFAULT_FILTERS)}>
            Reset filters
          </button>
        )}
      </div>
    </section>
  )
}

export default FilterBar
