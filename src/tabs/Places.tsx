import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Tick } from '../lib/derive.ts';
import { byArea } from '../lib/stats.ts';
import { AXIS_PROPS, Card, TooltipBox, number, usePalette } from '../components/charts.tsx';

interface Props {
  ticks: Tick[];
  /** The drilldown position, shared with the filter bar so the two agree. */
  area: string;
  onArea: (area: string) => void;
}

export function Places({ ticks, area, onArea }: Props) {
  const palette = usePalette();
  const rows = byArea(ticks, area);
  const crumbs = area ? area.split(' > ') : [];

  return (
    <div className="grid">
      <Card
        title="Where you climb"
        caption="Mountain Project's area hierarchy, one level at a time — foreign crags start at their state or country rather than under 'International'. Click a bar to go deeper."
      >
        <div className="breadcrumb">
          <button onClick={() => onArea('')}>All areas</button>
          {crumbs.map((crumb, i) => (
            <span key={crumb}>
              {' › '}
              <button onClick={() => onArea(crumbs.slice(0, i + 1).join(' > '))}>{crumb}</button>
            </span>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            Nothing below here — {crumbs.at(-1) ?? 'this area'} is as deep as the data goes.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, Math.min(rows.length, 18) * 30)}>
            <BarChart
              data={rows.slice(0, 18)}
              layout="vertical"
              margin={{ top: 4, right: 12, bottom: 0, left: 4 }}
            >
              <CartesianGrid horizontal={false} stroke={palette.grid} />
              <XAxis type="number" {...AXIS_PROPS(palette.muted)} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={150} {...AXIS_PROPS(palette.muted)} />
              <Tooltip
                cursor={{ fill: palette.grid, opacity: 0.4 }}
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <TooltipBox
                      title={payload[0].payload.name}
                      rows={[
                        { label: 'Ticks', value: number(payload[0].payload.ticks) },
                        { label: 'Routes', value: number(payload[0].payload.routes) },
                        { label: 'Pitches', value: number(payload[0].payload.pitches) },
                        { label: 'First visit', value: payload[0].payload.firstVisit },
                      ]}
                    />
                  ) : null
                }
              />
              <Bar
                dataKey="ticks"
                fill={palette.series[0]}
                radius={[0, 4, 4, 0]}
                maxBarSize={20}
                cursor="pointer"
                onClick={(bar: { path?: string }) => bar.path && onArea(bar.path)}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Every area at this level" caption="Sorted by ticks. Feet counted where lengths are known.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Area</th>
                <th className="num">Ticks</th>
                <th className="num">Routes</th>
                <th className="num">Pitches</th>
                <th className="num">Feet</th>
                <th>First visit</th>
                <th>Last visit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.path}>
                  <td>
                    <button
                      className="btn ghost"
                      style={{ border: 0, padding: 0 }}
                      onClick={() => onArea(row.path)}
                    >
                      {row.name}
                    </button>
                  </td>
                  <td className="num">{number(row.ticks)}</td>
                  <td className="num">{number(row.routes)}</td>
                  <td className="num">{number(row.pitches)}</td>
                  <td className="num">{number(row.feet)}</td>
                  <td>{row.firstVisit}</td>
                  <td>{row.lastVisit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
