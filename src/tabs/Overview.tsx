import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Tick } from '../lib/derive.ts';
import { byDay, byMonth, disciplineMix, summarise } from '../lib/stats.ts';
import { AXIS_PROPS, Card, Legend, TooltipBox, number, usePalette } from '../components/charts.tsx';

const DISCIPLINES = ['Sport', 'Trad', 'Boulder', 'Other'] as const;

export function Overview({ ticks }: { ticks: Tick[] }) {
  const palette = usePalette();
  const summary = summarise(ticks);
  const months = byMonth(ticks);
  const mix = disciplineMix(ticks);

  const kpis = [
    { label: 'Ticks', value: number(summary.ticks), foot: `${summary.routes} distinct routes` },
    { label: 'Days out', value: number(summary.days), foot: `${(summary.ticks / (summary.days || 1)).toFixed(1)} ticks a day` },
    { label: 'Pitches', value: number(summary.pitches) },
    { label: 'Feet climbed', value: number(summary.feet), foot: 'where lengths are known' },
    { label: 'Crags', value: number(summary.crags) },
    { label: 'Hardest onsight', value: summary.hardestOnsight },
    { label: 'Hardest send', value: summary.hardestRedpoint, foot: 'redpoint, pinkpoint or flash' },
    {
      label: 'Span',
      value: summary.firstDate.slice(0, 4),
      foot: `through ${summary.lastDate.slice(0, 4)}`,
    },
  ];

  return (
    <>
      <div className="kpis">
        {kpis.map((kpi) => (
          <div className="kpi" key={kpi.label}>
            <div className="label">{kpi.label}</div>
            <div className="value">{kpi.value}</div>
            {kpi.foot && <div className="foot">{kpi.foot}</div>}
          </div>
        ))}
      </div>

      <div className="grid">
        <Card title="Ticks a month" caption="Every month in range, so a quiet spell reads as one.">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={months} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={palette.grid} />
              <XAxis
                dataKey="label"
                {...AXIS_PROPS(palette.muted)}
                interval="preserveStartEnd"
                minTickGap={44}
              />
              <YAxis {...AXIS_PROPS(palette.muted)} width={44} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: palette.grid, opacity: 0.4 }}
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <TooltipBox
                      title={(payload[0].payload as { label: string }).label}
                      rows={[
                        { label: 'Ticks', value: number(payload[0].payload.ticks) },
                        { label: 'Pitches', value: number(payload[0].payload.pitches) },
                      ]}
                    />
                  ) : null
                }
              />
              <Bar dataKey="ticks" fill={palette.series[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card
          title="Days on rock"
          caption={`${summary.days} climbing days. Darker squares are busier days.`}
        >
          <CalendarHeatmap ticks={ticks} palette={palette} />
        </Card>

        <Card title="What you climbed, by year" caption="Ticks counted under a route's leading type.">
          <Legend
            items={DISCIPLINES.map((d, i) => ({ label: d, color: palette.series[i] }))}
          />
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={mix} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
                      rows={[...payload]
                        .reverse()
                        .filter((p) => Number(p.value) > 0)
                        .map((p) => ({
                          label: String(p.name),
                          value: number(Number(p.value)),
                          color: p.color,
                        }))}
                    />
                  ) : null
                }
              />
              {DISCIPLINES.map((discipline, i) => (
                <Area
                  key={discipline}
                  type="linear"
                  dataKey={discipline}
                  stackId="mix"
                  stroke={palette.surface}
                  strokeWidth={1}
                  fill={palette.series[i]}
                  fillOpacity={1}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </>
  );
}

function CalendarHeatmap({ ticks, palette }: { ticks: Tick[]; palette: ReturnType<typeof usePalette> }) {
  const days = byDay(ticks);
  if (days.size === 0) return <div className="empty">Nothing in range.</div>;

  // Only years you actually climbed in — a decade of blank grids says nothing.
  const years = [...new Set([...days.keys()].map((d) => Number(d.slice(0, 4))))].sort();
  const busiest = Math.max(...days.values());

  const shade = (count: number) => {
    if (count === 0) return undefined;
    const step = Math.ceil((count / busiest) * (palette.sequential.length - 1));
    return palette.sequential[Math.max(1, step)];
  };

  return (
    <div className="calendar">
      {years.map((year) => {
        const weeks: { date: string; count: number }[][] = [];
        const cursor = new Date(Date.UTC(year, 0, 1));
        let week: { date: string; count: number }[] = Array.from(
          { length: cursor.getUTCDay() },
          () => ({ date: '', count: -1 }),
        );

        while (cursor.getUTCFullYear() === year) {
          const date = cursor.toISOString().slice(0, 10);
          week.push({ date, count: days.get(date) ?? 0 });
          if (week.length === 7) {
            weeks.push(week);
            week = [];
          }
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        if (week.length > 0) weeks.push(week);

        return (
          <div className="calendar-year" key={year}>
            <div className="y">{year}</div>
            <div className="weeks">
              {weeks.map((w, i) => (
                <div className="week" key={i}>
                  {w.map((day, j) =>
                    day.count < 0 ? (
                      <div key={j} style={{ width: 9, height: 9 }} />
                    ) : (
                      <div
                        key={day.date}
                        className="day"
                        style={{ background: shade(day.count) }}
                        title={
                          day.count > 0
                            ? `${day.date}: ${day.count} tick${day.count === 1 ? '' : 's'}`
                            : day.date
                        }
                      />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
