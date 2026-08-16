import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Tick } from '../lib/derive.ts';
import { byPartner, mostRepeated, newVsRepeat } from '../lib/stats.ts';
import { AXIS_PROPS, Card, Legend, TooltipBox, number, usePalette } from '../components/charts.tsx';

interface Props {
  ticks: Tick[];
  partner: string;
  onPartner: (partner: string) => void;
}

export function Partners({ ticks, partner, onPartner }: Props) {
  const palette = usePalette();
  const partners = byPartner(ticks);
  const repeats = mostRepeated(ticks);
  const churn = newVsRepeat(ticks);
  const unparsed = ticks.filter((t) => t.partners.length === 0).length;

  return (
    <div className="grid">
      <Card
        title="Who you climb with"
        caption={`Read out of your notes, where partners are written "w/ Name". ${unparsed} of ${ticks.length} ticks name nobody — solos, mostly.`}
      >
        {partners.length === 0 ? (
          <div className="empty">No partners found in these notes.</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, Math.min(partners.length, 14) * 30)}>
            <BarChart
              data={partners.slice(0, 14)}
              layout="vertical"
              margin={{ top: 4, right: 12, bottom: 0, left: 4 }}
            >
              <CartesianGrid horizontal={false} stroke={palette.grid} />
              <XAxis type="number" {...AXIS_PROPS(palette.muted)} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={110} {...AXIS_PROPS(palette.muted)} />
              <Tooltip
                cursor={{ fill: palette.grid, opacity: 0.4 }}
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <TooltipBox
                      title={payload[0].payload.name}
                      rows={[
                        { label: 'Ticks together', value: number(payload[0].payload.ticks) },
                        { label: 'Days out', value: number(payload[0].payload.days) },
                        { label: 'Hardest', value: payload[0].payload.hardest },
                      ]}
                    />
                  ) : null
                }
              />
              <Bar
                dataKey="ticks"
                radius={[0, 4, 4, 0]}
                maxBarSize={20}
                cursor="pointer"
                onClick={(bar: { name?: string }) =>
                  bar.name && onPartner(bar.name === partner ? '' : bar.name)
                }
                // Emphasis: the selected partner keeps the accent, the rest recede.
                fill={palette.series[0]}
                shape={(props: any) => (
                  <rect
                    {...props}
                    rx={4}
                    fill={!partner || props.payload.name === partner ? palette.series[0] : palette.grid}
                  />
                )}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="New routes versus repeats" caption="How much of each year was ground you'd already covered.">
        <Legend
          items={[
            { label: 'First time on the route', color: palette.series[0] },
            { label: 'Repeat ascent', color: palette.series[1] },
          ]}
        />
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={churn} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={palette.grid} />
            <XAxis
              dataKey="year"
              type="number"
              domain={['dataMin', 'dataMax']}
              allowDecimals={false}
              {...AXIS_PROPS(palette.muted)}
            />
            <YAxis {...AXIS_PROPS(palette.muted)} width={44} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: palette.axis }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={String(label)}
                    rows={payload.map((p) => ({
                      label: p.dataKey === 'first' ? 'First time' : 'Repeat',
                      value: number(Number(p.value)),
                      color: p.color,
                    }))}
                  />
                ) : null
              }
            />
            <Area
              type="linear"
              dataKey="first"
              stackId="churn"
              stroke={palette.surface}
              strokeWidth={1}
              fill={palette.series[0]}
              fillOpacity={1}
            />
            <Area
              type="linear"
              dataKey="repeat"
              stackId="churn"
              stroke={palette.surface}
              strokeWidth={1}
              fill={palette.series[1]}
              fillOpacity={1}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Routes you keep going back to" caption="Ticked more than once.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="num">Ascents</th>
                <th>Route</th>
                <th>Grade</th>
                <th>Where</th>
                <th>Last time</th>
              </tr>
            </thead>
            <tbody>
              {repeats.slice(0, 40).map((row) => (
                <tr key={row.url}>
                  <td className="num">{row.ascents}</td>
                  <td>
                    <a href={row.url} target="_blank" rel="noreferrer">
                      {row.route}
                    </a>
                  </td>
                  <td>{row.grade}</td>
                  <td className="wide">{row.location.split(' > ').slice(-2).join(' › ')}</td>
                  <td>{row.lastDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {repeats.length === 0 && <div className="empty">No repeats in range.</div>}
        </div>
      </Card>

      <Card title="Every partner" caption="Click a name in the chart above to filter the whole page to those days.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Partner</th>
                <th className="num">Ticks</th>
                <th className="num">Days</th>
                <th>Hardest together</th>
                <th>First</th>
                <th>Most recent</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((row) => (
                <tr key={row.name}>
                  <td>
                    <button
                      className="btn ghost"
                      style={{ border: 0, padding: 0 }}
                      onClick={() => onPartner(row.name === partner ? '' : row.name)}
                    >
                      {row.name}
                    </button>
                  </td>
                  <td className="num">{number(row.ticks)}</td>
                  <td className="num">{number(row.days)}</td>
                  <td>{row.hardest}</td>
                  <td>{row.firstDate}</td>
                  <td>{row.lastDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
