import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Tick } from '../lib/derive.ts';
import { SEND_GROUPS, byGrade, onsightRate, progression } from '../lib/stats.ts';
import { AXIS_PROPS, Card, Legend, TooltipBox, number, usePalette } from '../components/charts.tsx';

export function Grades({ ticks }: { ticks: Tick[] }) {
  const palette = usePalette();
  const roped = byGrade(ticks, 'yds');
  const boulders = byGrade(ticks, 'v');
  const curve = progression(ticks);
  const rates = onsightRate(ticks);

  // Rating codes order the axis; the labels come from the data itself rather
  // than a hardcoded grade table.
  const gradeLabels = new Map(ticks.map((t) => [t.ratingCode, t.gradeLabel]));
  const codeLabel = (code: number) => gradeLabels.get(code) ?? String(code);

  const curveCodes = [
    ...new Set(curve.flatMap((p) => [p.onsight, p.redpoint]).filter((c): c is number => c != null)),
  ].sort((a, b) => a - b);
  // At most eight labels, evenly spread through the grades actually reached.
  const curveTicks = curveCodes.filter(
    (_, i) => i % Math.ceil(curveCodes.length / 8) === 0 || i === curveCodes.length - 1,
  );

  const legend = SEND_GROUPS.map((group, i) => ({ label: group, color: palette.series[i] }));

  return (
    <div className="grid">
      <Card
        title="Grade pyramid"
        caption="Every roped tick by grade and how it went. Boulder problems are on their own scale below."
      >
        <Legend items={legend} />
        {roped.length === 0 ? (
          <div className="empty">Nothing in range.</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, roped.length * 26)}>
            <BarChart data={[...roped].reverse()} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid horizontal={false} stroke={palette.grid} />
              <XAxis type="number" {...AXIS_PROPS(palette.muted)} allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={52} {...AXIS_PROPS(palette.muted)} />
              <Tooltip cursor={{ fill: palette.grid, opacity: 0.4 }} content={stackTooltip} />
              {SEND_GROUPS.map((group, i) => (
                <Bar
                  key={group}
                  dataKey={group}
                  stackId="pyramid"
                  fill={palette.series[i]}
                  stroke={palette.surface}
                  strokeWidth={1}
                  radius={i === SEND_GROUPS.length - 1 ? [0, 4, 4, 0] : undefined}
                  maxBarSize={20}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card
        title="Getting better"
        caption="Hardest lead each quarter — onsighted with no prior knowledge, versus worked and sent."
      >
        <Legend
          items={[
            { label: 'Hardest onsight', color: palette.series[0] },
            { label: 'Hardest send', color: palette.series[1] },
          ]}
        />
        {curve.length === 0 ? (
          <div className="empty">No leads in range.</div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={curve} margin={{ top: 4, right: 12, bottom: 0, left: -6 }}>
              <CartesianGrid vertical={false} stroke={palette.grid} />
              <XAxis dataKey="quarter" {...AXIS_PROPS(palette.muted)} minTickGap={40} />
              <YAxis
                {...AXIS_PROPS(palette.muted)}
                width={52}
                domain={['dataMin - 100', 'dataMax + 100']}
                // Rating codes aren't evenly spaced, so let the axis show only
                // codes that exist — an auto tick like 4350 is not a grade.
                ticks={curveTicks}
                tickFormatter={codeLabel}
              />
              <Tooltip
                cursor={{ stroke: palette.axis }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <TooltipBox
                      title={String(label)}
                      rows={payload
                        .filter((p) => p.value != null)
                        .map((p) => ({
                          label: p.dataKey === 'onsight' ? 'Onsight' : 'Send',
                          value: codeLabel(Number(p.value)),
                          color: p.color,
                        }))}
                    />
                  ) : null
                }
              />
              <Line
                type="linear"
                dataKey="onsight"
                stroke={palette.series[0]}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 0, fill: palette.series[0] }}
                connectNulls
              />
              <Line
                type="linear"
                dataKey="redpoint"
                stroke={palette.series[1]}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 0, fill: palette.series[1] }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card
        title="Onsight rate by grade"
        caption="Share of leads climbed first try, clean. Grades with fewer than three leads are left out."
      >
        {rates.length === 0 ? (
          <div className="empty">Not enough leads in range.</div>
        ) : (
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={rates} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={palette.grid} />
              <XAxis dataKey="label" {...AXIS_PROPS(palette.muted)} />
              <YAxis
                {...AXIS_PROPS(palette.muted)}
                width={44}
                domain={[0, 1]}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              />
              <Tooltip
                cursor={{ fill: palette.grid, opacity: 0.4 }}
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <TooltipBox
                      title={`${payload[0].payload.label} leads`}
                      rows={[
                        { label: 'Onsight rate', value: `${Math.round(payload[0].payload.rate * 100)}%` },
                        { label: 'Leads', value: number(payload[0].payload.leads) },
                      ]}
                    />
                  ) : null
                }
              />
              <Bar dataKey="rate" fill={palette.series[0]} radius={[4, 4, 0, 0]} maxBarSize={34} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {boulders.length > 0 && (
        <Card title="Boulder problems" caption="Graded on the V scale, counted separately.">
          <Legend items={legend} />
          <ResponsiveContainer width="100%" height={Math.max(160, boulders.length * 28)}>
            <BarChart data={[...boulders].reverse()} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid horizontal={false} stroke={palette.grid} />
              <XAxis type="number" {...AXIS_PROPS(palette.muted)} allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={52} {...AXIS_PROPS(palette.muted)} />
              <Tooltip cursor={{ fill: palette.grid, opacity: 0.4 }} content={stackTooltip} />
              {SEND_GROUPS.map((group, i) => (
                <Bar
                  key={group}
                  dataKey={group}
                  stackId="v"
                  fill={palette.series[i]}
                  stroke={palette.surface}
                  strokeWidth={1}
                  maxBarSize={20}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

const stackTooltip = ({ active, payload, label }: any) =>
  active && payload?.length ? (
    <TooltipBox
      title={String(label)}
      rows={[...payload]
        .reverse()
        .filter((p: any) => Number(p.value) > 0)
        .map((p: any) => ({ label: String(p.name), value: number(Number(p.value)), color: p.color }))}
    />
  ) : null;
