import { useState } from 'react'
import { Empty } from '../components/charts.tsx'
import type { Tick } from '../lib/types.ts'

type SortKey = 'date' | 'route' | 'grade' | 'style' | 'location' | 'pitches'

const COLUMNS: { key: SortKey; label: string; value: (t: Tick) => string | number }[] = [
  { key: 'date', label: 'Date', value: (t) => t.date },
  { key: 'route', label: 'Route', value: (t) => t.route.toLowerCase() },
  { key: 'grade', label: 'Grade', value: (t) => t.ratingCode },
  { key: 'style', label: 'Style', value: (t) => t.sendStatus },
  { key: 'pitches', label: 'Pitches', value: (t) => t.pitches },
  { key: 'location', label: 'Location', value: (t) => t.location.toLowerCase() },
]

function Ticks({ ticks }: { ticks: Tick[] }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'date', desc: true })
  if (ticks.length === 0) return <Empty />
  const col = COLUMNS.find((c) => c.key === sort.key)!
  const sorted = [...ticks].sort((a, b) => {
    const x = col.value(a)
    const y = col.value(b)
    const order = x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : 1
    return sort.desc ? -order : order
  })

  return (
    <div className="table-scroll">
      <table className="data ticks-table">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className={c.key === 'pitches' ? 'num' : undefined}
                aria-sort={sort.key === c.key ? (sort.desc ? 'descending' : 'ascending') : undefined}
              >
                <button
                  type="button"
                  className="sort-button"
                  onClick={() => setSort({ key: c.key, desc: sort.key === c.key ? !sort.desc : c.key === 'date' })}
                >
                  {c.label}
                  {sort.key === c.key && (sort.desc ? ' ▼' : ' ▲')}
                </button>
              </th>
            ))}
            <th>Partners</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={t.id} className={t.deleted ? 'deleted' : undefined}>
              <td className="nowrap">{t.date}</td>
              <td>
                <a href={t.url} target="_blank" rel="noreferrer">
                  {t.route}
                </a>
                {t.deleted && <span className="badge">Deleted on MP</span>}
                {t.ascentNumber > 1 && <span className="text-muted small"> #{t.ascentNumber}</span>}
              </td>
              <td className="nowrap">{t.rating}</td>
              <td>{t.sendStatus}</td>
              <td className="num">{t.pitches}</td>
              <td className="small">{t.location}</td>
              <td className="small">{t.partners.join(', ')}</td>
              <td className="small notes">{t.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Ticks
