import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AXIS_PROPS, Card, Empty, GRID_PROPS, Legend, SEND_COLORS, SendLegend, TooltipBox, number, usePalette } from '../components/charts.tsx'
import { DISCIPLINES, SEND_GROUPS, byDay, byMonth, disciplineMix, summarise, type Hardest } from '../lib/stats.ts'
import type { Tick } from '../lib/types.ts'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthLabel(month: string): string {
  return `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`
}

function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {detail && <div className="kpi-detail text-muted">{detail}</div>}
    </div>
  )
}

function hardestKpi(label: string, h: Hardest | null) {
  return <Kpi label={label} value={h?.label ?? '—'} detail={h ? `${h.route}, ${h.date}` : 'No YDS leads'} />
}

function Overview({ ticks }: { ticks: Tick[] }) {
  const palette = usePalette()
  if (ticks.length === 0) return <Empty />
  const s = summarise(ticks)
  const months = byMonth(ticks)
  const mix = disciplineMix(ticks)
  const mixColors = Object.fromEntries(DISCIPLINES.map((d, i) => [d, palette.series[i]]))

  return (
    <>
      <div className="kpis">
        <Kpi label="Ticks" value={number(s.ticks)} detail={`${s.first} to ${s.last}`} />
        <Kpi label="Routes" value={number(s.routes)} />
        <Kpi label="Days out" value={number(s.days)} />
        <Kpi label="Pitches" value={number(s.pitches)} />
        <Kpi label="Feet climbed" value={number(s.feet)} detail="Ticks with a length" />
        <Kpi label="Crags" value={number(s.crags)} />
        {hardestKpi('Hardest onsight', s.hardestOnsight)}
        {hardestKpi('Hardest redpoint', s.hardestSend)}
      </div>

      <div className="cards">
        <Card title="Ticks a month" subtitle="Stacked by send style" legend={<SendLegend />}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={months} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="month" tickFormatter={monthLabel} {...AXIS_PROPS} minTickGap={16} />
              <YAxis allowDecimals={false} {...AXIS_PROPS} />
              <Tooltip cursor={{ fill: palette.grid }} content={(p) => <TooltipBox {...p} label={monthLabel(String(p.label))} />} />
              {SEND_GROUPS.map((g) => (
                <Bar key={g} dataKey={g} stackId="a" fill={SEND_COLORS[g]} stroke="#fff" strokeWidth={1} maxBarSize={24} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card
          title="Discipline mix by year"
          subtitle="Each tick counted once, Sport over Trad over Boulder"
          legend={<Legend items={DISCIPLINES.map((d) => ({ label: d, color: mixColors[d] }))} />}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={mix} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="year" {...AXIS_PROPS} />
              <YAxis allowDecimals={false} {...AXIS_PROPS} />
              <Tooltip cursor={{ fill: palette.grid }} content={(p) => <TooltipBox {...p} />} />
              {DISCIPLINES.map((d) => (
                <Bar key={d} dataKey={d} stackId="a" fill={mixColors[d]} stroke="#fff" strokeWidth={1} maxBarSize={48} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Days on rock" subtitle="Ticks a day, one row a year">
        <Heatmap ticks={ticks} />
      </Card>
    </>
  )
}

const CELL = 12
const GAP = 2
const STEP = CELL + GAP
const DAY_MS = 86_400_000

function bucket(count: number): number {
  if (count >= 5) return 4
  if (count >= 3) return 3
  return count
}

function Heatmap({ ticks }: { ticks: Tick[] }) {
  const palette = usePalette()
  const counts = new Map(byDay(ticks).map((d) => [d.date, d.count]))
  const years = [...new Set(ticks.map((t) => t.year))].sort((a, b) => b - a)
  const levels = ['No ticks', '1', '2', '3–4', '5+']
  const colors = [palette.grid, ...palette.sequential.slice(1)]

  return (
    <div className="heatmap">
      {years.map((year) => {
        const start = Date.UTC(year, 0, 1)
        const offset = new Date(start).getUTCDay()
        const days = (Date.UTC(year + 1, 0, 1) - start) / DAY_MS
        const weeks = Math.ceil((days + offset) / 7)
        return (
          <div key={year} className="heatmap-year">
            <div className="heatmap-label">{year}</div>
            <div className="heatmap-scroll">
              <svg width={weeks * STEP} height={7 * STEP + 14} role="img" aria-label={`Ticks per day in ${year}`}>
                {MONTHS.map((m, i) => {
                  const day = (Date.UTC(year, i, 1) - start) / DAY_MS
                  return (
                    <text key={m} x={Math.floor((day + offset) / 7) * STEP} y={10} className="heatmap-month">
                      {m}
                    </text>
                  )
                })}
                {Array.from({ length: days }, (_, d) => {
                  const date = new Date(start + d * DAY_MS).toISOString().slice(0, 10)
                  const count = counts.get(date) ?? 0
                  const slot = d + offset
                  return (
                    <rect
                      key={date}
                      x={Math.floor(slot / 7) * STEP}
                      y={14 + (slot % 7) * STEP}
                      width={CELL}
                      height={CELL}
                      rx={2}
                      fill={colors[bucket(count)]}
                    >
                      <title>{`${date}: ${count} tick${count === 1 ? '' : 's'}`}</title>
                    </rect>
                  )
                })}
              </svg>
            </div>
          </div>
        )
      })}
      <Legend items={levels.map((label, i) => ({ label, color: colors[i] }))} />
    </div>
  )
}

export default Overview
