import { useEffect, useState, type ReactNode } from 'react';

/**
 * Recharts writes colours as SVG presentation attributes, which don't resolve
 * `var(--…)`, so the palette is read in JS. Both modes are validated steps of
 * the same hues — the dark column is not an automatic flip of the light one.
 */
const LIGHT = {
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'],
  sequential: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#0d366b'],
  surface: '#fcfcfb',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  muted: '#898781',
};

const DARK = {
  series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'],
  sequential: ['#0d366b', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#b7d3f6'],
  surface: '#1a1a19',
  grid: '#2c2c2a',
  axis: '#383835',
  muted: '#898781',
};

export function usePalette() {
  const [dark, setDark] = useState(
    () => globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  );

  useEffect(() => {
    const query = globalThis.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setDark(e.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  return dark ? DARK : LIGHT;
}

export const AXIS_PROPS = (muted: string) => ({
  tick: { fill: muted, fontSize: 11 },
  tickLine: false,
  axisLine: false,
});

export function Card({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <h3>{title}</h3>
      {caption && <p className="caption">{caption}</p>}
      {children}
    </section>
  );
}

/** Identity is never colour alone: every multi-series chart carries this. */
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="legend">
      {items.map(({ label, color }) => (
        <span key={label}>
          <i style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export function TooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="tooltip">
      <div className="t-title">{title}</div>
      {rows.map((row) => (
        <div className="t-row" key={row.label}>
          <span>
            {row.color && (
              <i
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: row.color,
                  marginRight: 6,
                }}
              />
            )}
            {row.label}
          </span>
          <b>{row.value}</b>
        </div>
      ))}
    </div>
  );
}

export const number = (value: number) => value.toLocaleString('en-US');
