import type { Tick } from '../lib/derive.ts';
import { EMPTY_FILTERS, isFiltered, SOLO, type Filters } from '../lib/filters.ts';

interface Props {
  all: Tick[];
  filters: Filters;
  onChange: (filters: Filters) => void;
  matched: number;
  deletedCount: number;
}

const DISCIPLINES = ['Sport', 'Trad', 'TR', 'Boulder', 'Aid', 'Alpine'];

export function FilterBar({ all, filters, onChange, matched, deletedCount }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  // Grade bounds come from the data, ordered by rating code.
  const grades = [...new Map(all.filter((t) => t.scale !== 'ungraded').map((t) => [t.ratingCode, t.gradeLabel]))]
    .sort(([a], [b]) => a - b)
    .map(([code, label]) => ({ code, label }));

  const partners = [...new Set(all.flatMap((t) => t.partners))].sort();

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <div className="filters">
      <label>
        From
        <input
          type="date"
          value={filters.from}
          onChange={(e) => set({ from: e.target.value })}
        />
      </label>
      <label>
        to
        <input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
      </label>

      <label>
        Grade
        <select
          value={filters.minCode}
          onChange={(e) => set({ minCode: Number(e.target.value) })}
        >
          <option value={EMPTY_FILTERS.minCode}>any</option>
          {grades.map((g) => (
            <option key={g.code} value={g.code}>
              {g.label}
            </option>
          ))}
        </select>
        –
        <select
          value={filters.maxCode}
          onChange={(e) => set({ maxCode: Number(e.target.value) })}
        >
          <option value={EMPTY_FILTERS.maxCode}>any</option>
          {grades.map((g) => (
            <option key={g.code} value={g.code}>
              {g.label}
            </option>
          ))}
        </select>
      </label>

      {DISCIPLINES.map((discipline) => (
        <button
          key={discipline}
          className="chip"
          aria-pressed={filters.disciplines.includes(discipline)}
          onClick={() => set({ disciplines: toggle(filters.disciplines, discipline) })}
        >
          {discipline}
        </button>
      ))}

      <label>
        With
        <select value={filters.partner} onChange={(e) => set({ partner: e.target.value })}>
          <option value="">anyone</option>
          <option value={SOLO}>solo — nobody in the notes</option>
          {partners.map((partner) => (
            <option key={partner} value={partner}>
              {partner}
            </option>
          ))}
        </select>
      </label>

      <input
        type="search"
        placeholder="Search routes and notes"
        value={filters.q}
        onChange={(e) => set({ q: e.target.value })}
      />

      {deletedCount > 0 && (
        <button
          className="chip"
          aria-pressed={filters.includeDeleted}
          onClick={() => set({ includeDeleted: !filters.includeDeleted })}
          title="Ticks that have disappeared from Mountain Project's exports but are kept in your logbook"
        >
          Show {deletedCount} deleted
        </button>
      )}

      <span className="spacer" />

      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        {matched === all.length ? `${matched} ticks` : `${matched} of ${all.length}`}
      </span>
      {isFiltered(filters) && (
        <button className="btn ghost" onClick={() => onChange(EMPTY_FILTERS)}>
          Clear
        </button>
      )}
    </div>
  );
}
