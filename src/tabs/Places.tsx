import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AXIS_PROPS, Card, Empty, TooltipBox, number, usePalette } from '../components/charts.tsx'
import { HERE, byArea, type AreaRow } from '../lib/stats.ts'
import type { Tick } from '../lib/types.ts'

const TOP = 15

function Places({ ticks, area, onArea }: { ticks: Tick[]; area: string; onArea: (area: string) => void }) {
  const palette = usePalette()
  if (ticks.length === 0) return <Empty />
  const rows = byArea(ticks, area)
  const top = rows.slice(0, TOP)
  const crumbs = area ? area.split(' > ') : []
  const drill = (row: AreaRow) => {
    if (row.name !== HERE) onArea(row.path)
  }

  return (
    <>
      <nav className="breadcrumb" aria-label="Area">
        <button type="button" className="link-button" onClick={() => onArea('')} disabled={!area}>
          All areas
        </button>
        {crumbs.map((c, i) => (
          <span key={i}>
            {' › '}
            <button
              type="button"
              className="link-button"
              onClick={() => onArea(crumbs.slice(0, i + 1).join(' > '))}
              disabled={i === crumbs.length - 1}
            >
              {c}
            </button>
          </span>
        ))}
      </nav>

      <div className="cards">
        <Card
          title={area ? `Inside ${crumbs[crumbs.length - 1]}` : 'Ticks by area'}
          subtitle={`Top ${Math.min(TOP, rows.length)} of ${rows.length}, click a bar to drill down`}
        >
          <ResponsiveContainer width="100%" height={Math.max(120, top.length * 30 + 40)}>
            <BarChart data={top} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={palette.grid} horizontal={false} />
              <XAxis type="number" allowDecimals={false} {...AXIS_PROPS} />
              <YAxis type="category" dataKey="name" width={160} interval={0} {...AXIS_PROPS} />
              <Tooltip cursor={{ fill: palette.grid }} content={(p) => <TooltipBox {...p} />} />
              <Bar
                dataKey="ticks"
                name="Ticks"
                fill={palette.series[0]}
                radius={[0, 4, 4, 0]}
                maxBarSize={24}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(d) => drill(d.payload as AreaRow)}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Area table" subtitle="Every area at this level">
          <table className="data">
            <thead>
              <tr>
                <th>Area</th>
                <th className="num">Ticks</th>
                <th className="num">Routes</th>
                <th className="num">Days</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td>
                    {r.name === HERE ? (
                      <span className="text-muted">{HERE}</span>
                    ) : (
                      <button type="button" className="link-button" onClick={() => drill(r)}>
                        {r.name}
                      </button>
                    )}
                  </td>
                  <td className="num">{number(r.ticks)}</td>
                  <td className="num">{number(r.routes)}</td>
                  <td className="num">{number(r.days)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  )
}

export default Places
