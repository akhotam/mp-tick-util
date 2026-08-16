import { useState } from 'react';
import type { Tick } from '../lib/derive.ts';
import { Card, number } from '../components/charts.tsx';

type Column = {
  key: string;
  label: string;
  num?: boolean;
  value: (tick: Tick) => string | number;
  render?: (tick: Tick) => React.ReactNode;
};

const COLUMNS: Column[] = [
  { key: 'date', label: 'Date', value: (t) => t.date },
  {
    key: 'route',
    label: 'Route',
    value: (t) => t.route,
    render: (t) => (
      <a href={t.url} target="_blank" rel="noreferrer">
        {t.route}
      </a>
    ),
  },
  { key: 'grade', label: 'Grade', value: (t) => t.ratingCode, render: (t) => t.rating },
  { key: 'style', label: 'Style', value: (t) => t.sendStatus },
  { key: 'type', label: 'Type', value: (t) => t.disciplines.join(', ') },
  { key: 'pitches', label: 'Pitches', num: true, value: (t) => t.pitches },
  {
    key: 'location',
    label: 'Where',
    value: (t) => t.location,
    render: (t) => t.areaPath.slice(-2).join(' › '),
  },
  { key: 'partners', label: 'With', value: (t) => t.partners.join(', ') },
  {
    key: 'notes',
    label: 'Notes',
    value: (t) => t.notes,
    render: (t) => <span title={t.notes}>{t.notes}</span>,
  },
];

const PAGE = 200;

export function Ticks({ ticks }: { ticks: Tick[] }) {
  const [sort, setSort] = useState({ key: 'date', desc: true });
  const [limit, setLimit] = useState(PAGE);

  const column = COLUMNS.find((c) => c.key === sort.key)!;
  const sorted = [...ticks].sort((a, b) => {
    const left = column.value(a);
    const right = column.value(b);
    const order = typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right));
    return sort.desc ? -order : order;
  });

  return (
    <div className="grid">
      <Card
        title={`${number(ticks.length)} ticks`}
        caption="Every row behind the charts. Click a heading to sort; route names link back to Mountain Project."
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`sortable${col.num ? ' num' : ''}`}
                    onClick={() =>
                      setSort((s) => ({ key: col.key, desc: s.key === col.key ? !s.desc : true }))
                    }
                    aria-sort={sort.key === col.key ? (sort.desc ? 'descending' : 'ascending') : 'none'}
                  >
                    {col.label}
                    {sort.key === col.key && (sort.desc ? ' ↓' : ' ↑')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, limit).map((tick) => (
                <tr key={tick.id} className={tick.deleted ? 'deleted' : undefined}>
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={col.num ? 'num' : col.key === 'notes' ? 'wide' : undefined}
                    >
                      {col.render ? col.render(tick) : col.value(tick)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {ticks.length === 0 && <div className="empty">Nothing matches these filters.</div>}
        {limit < sorted.length && (
          <button className="btn" style={{ marginTop: 12 }} onClick={() => setLimit((l) => l + PAGE)}>
            Show {Math.min(PAGE, sorted.length - limit)} more
          </button>
        )}
      </Card>
    </div>
  );
}
