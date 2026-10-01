import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AXIS_PROPS, Card, Empty, GRID_PROPS, Legend, TooltipBox, number, usePalette } from '../components/charts.tsx'
import { SOLO } from '../lib/filters.ts'
import { byPartner, mostRepeated, newVsRepeat, type PartnerRow } from '../lib/stats.ts'
import type { Tick } from '../lib/types.ts'

const TOP = 15

function Partners({ ticks, onPartner }: { ticks: Tick[]; onPartner: (partner: string) => void }) {
  const palette = usePalette()
  if (ticks.length === 0) return <Empty />
  const partners = byPartner(ticks)
  const top = partners.slice(0, TOP)
  const solo = ticks.filter((t) => t.partners.length === 0).length
  const nvr = newVsRepeat(ticks)
  const repeats = mostRepeated(ticks)
  const [newColor, repeatColor] = palette.series

  return (
    <div className="cards">
      <Card
        title="Ticks with each partner"
        subtitle={`Names after "w/" in notes, click a bar to filter. ${solo} ticks name no partner.`}
      >
        {top.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(120, top.length * 30 + 40)}>
            <BarChart data={top} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={palette.grid} horizontal={false} />
              <XAxis type="number" allowDecimals={false} {...AXIS_PROPS} />
              <YAxis type="category" dataKey="name" width={110} interval={0} {...AXIS_PROPS} />
              <Tooltip cursor={{ fill: palette.grid }} content={(p) => <TooltipBox {...p} />} />
              <Bar
                dataKey="ticks"
                name="Ticks"
                fill={palette.series[0]}
                radius={[0, 4, 4, 0]}
                maxBarSize={24}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(d) => onPartner((d.payload as PartnerRow).name)}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-muted empty">
            No partners found. Write <code>w/ Name</code> in tick notes to track them.{' '}
            <button type="button" className="link-button" onClick={() => onPartner(SOLO)}>
              Show ticks without partners
            </button>
          </p>
        )}
      </Card>

      <Card
        title="New routes vs repeats"
        subtitle="First ascent of a route across your whole logbook, by year"
        legend={
          <Legend
            items={[
              { label: 'New', color: newColor },
              { label: 'Repeat', color: repeatColor },
            ]}
          />
        }
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={nvr} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="year" {...AXIS_PROPS} />
            <YAxis allowDecimals={false} {...AXIS_PROPS} />
            <Tooltip cursor={{ fill: palette.grid }} content={(p) => <TooltipBox {...p} />} />
            <Bar dataKey="New" stackId="a" fill={newColor} stroke="#fff" strokeWidth={1} maxBarSize={48} isAnimationActive={false} />
            <Bar dataKey="Repeat" stackId="a" fill={repeatColor} stroke="#fff" strokeWidth={1} maxBarSize={48} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Most repeated routes" subtitle="Routes ticked more than once">
        {repeats.length > 0 ? (
          <table className="data">
            <thead>
              <tr>
                <th>Route</th>
                <th>Grade</th>
                <th className="num">Ticks</th>
                <th>Last</th>
              </tr>
            </thead>
            <tbody>
              {repeats.slice(0, 20).map((r) => (
                <tr key={r.routeId}>
                  <td>
                    <a href={r.url} target="_blank" rel="noreferrer">
                      {r.route}
                    </a>
                    <div className="text-muted small">{r.location}</div>
                  </td>
                  <td>{r.gradeLabel}</td>
                  <td className="num">{r.count}</td>
                  <td className="nowrap">{r.last}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted empty">No route ticked twice yet.</p>
        )}
      </Card>

      <Card title="Partner table" subtitle="Every partner in these ticks">
        {partners.length > 0 ? (
          <table className="data">
            <thead>
              <tr>
                <th>Partner</th>
                <th className="num">Ticks</th>
                <th className="num">Days</th>
                <th className="num">Routes</th>
                <th>First</th>
                <th>Last</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.name}>
                  <td>
                    <button type="button" className="link-button" onClick={() => onPartner(p.name)}>
                      {p.name}
                    </button>
                  </td>
                  <td className="num">{number(p.ticks)}</td>
                  <td className="num">{number(p.days)}</td>
                  <td className="num">{number(p.routes)}</td>
                  <td className="nowrap">{p.first}</td>
                  <td className="nowrap">{p.last}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty />
        )}
      </Card>
    </div>
  )
}

export default Partners
