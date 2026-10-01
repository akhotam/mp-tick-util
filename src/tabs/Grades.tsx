import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AXIS_PROPS, Card, Empty, GRID_PROPS, Legend, SEND_COLORS, SendLegend, TooltipBox, usePalette } from '../components/charts.tsx'
import { MIN_LEADS_FOR_RATE, SEND_GROUPS, byGrade, codeLabels, onsightRate, progression, type GradeRow } from '../lib/stats.ts'
import type { Tick } from '../lib/types.ts'

function Pyramid({ rows }: { rows: GradeRow[] }) {
  const palette = usePalette()
  // Hardest grade on top
  const data = [...rows].reverse()
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 28 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={palette.grid} horizontal={false} />
        <XAxis type="number" allowDecimals={false} {...AXIS_PROPS} />
        <YAxis type="category" dataKey="label" width={64} interval={0} {...AXIS_PROPS} />
        <Tooltip cursor={{ fill: palette.grid }} content={(p) => <TooltipBox {...p} />} />
        {SEND_GROUPS.map((g) => (
          <Bar key={g} dataKey={g} stackId="a" fill={SEND_COLORS[g]} stroke="#fff" strokeWidth={1} maxBarSize={24} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function Grades({ ticks }: { ticks: Tick[] }) {
  const palette = usePalette()
  if (ticks.length === 0) return <Empty />
  const yds = byGrade(ticks, 'yds')
  const boulder = byGrade(ticks, 'v')
  const prog = progression(ticks)
  const rate = onsightRate(ticks)
  const labels = codeLabels(ticks)
  const progCodes = [...new Set(prog.flatMap((r) => [r.onsight, r.send]).filter((c): c is number => c !== null))].sort(
    (a, b) => a - b,
  )
  const label = (code: unknown) => labels.get(Number(code)) ?? String(code)

  return (
    <div className="cards">
      <Card title="Grade pyramid" subtitle="YDS ticks by grade, stacked by send style" legend={<SendLegend />}>
        {yds.length > 0 ? <Pyramid rows={yds} /> : <Empty />}
      </Card>

      <Card
        title="Progression"
        subtitle="Hardest YDS lead each quarter"
        legend={
          <Legend
            items={[
              { label: 'Onsight', color: SEND_COLORS.Onsight },
              { label: 'Redpoint, pinkpoint or flash', color: SEND_COLORS.Redpoint },
            ]}
          />
        }
      >
        {prog.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={prog} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="quarter" {...AXIS_PROPS} />
              <YAxis
                type="number"
                domain={['dataMin', 'dataMax']}
                ticks={progCodes}
                tickFormatter={label}
                width={56}
                {...AXIS_PROPS}
              />
              <Tooltip content={(p) => <TooltipBox {...p} format={label} />} />
              {(['onsight', 'send'] as const).map((key) => (
                <Line
                  key={key}
                  name={key === 'onsight' ? 'Onsight' : 'Redpoint'}
                  dataKey={key}
                  stroke={key === 'onsight' ? SEND_COLORS.Onsight : SEND_COLORS.Redpoint}
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: key === 'onsight' ? SEND_COLORS.Onsight : SEND_COLORS.Redpoint }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Empty />
        )}
      </Card>

      <Card title="Onsight rate" subtitle={`Share of YDS leads onsighted, grades with ${MIN_LEADS_FOR_RATE}+ leads`}>
        {rate.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={rate} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="label" {...AXIS_PROPS} />
              <YAxis domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} {...AXIS_PROPS} />
              <Tooltip
                cursor={{ fill: palette.grid }}
                content={(p) => {
                  const row = p.payload?.[0]?.payload as (typeof rate)[number] | undefined
                  return (
                    <TooltipBox
                      {...p}
                      format={(v) => `${Math.round(Number(v) * 100)}% (${row?.onsights} of ${row?.leads})`}
                    />
                  )
                }}
              />
              <Bar dataKey="rate" name="Onsight rate" fill={SEND_COLORS.Onsight} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-muted empty">Needs at least {MIN_LEADS_FOR_RATE} YDS leads at one grade.</p>
        )}
      </Card>

      <Card title="Boulder pyramid" subtitle="V-scale ticks by grade" legend={<SendLegend />}>
        {boulder.length > 0 ? <Pyramid rows={boulder} /> : <Empty />}
      </Card>
    </div>
  )
}

export default Grades
