import type { ReactNode } from 'react'
import { SEND_GROUPS } from '../lib/stats.ts'

// Recharts cannot read CSS custom properties, palette lives here instead
const PALETTE = {
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'],
  sequential: ['#cde2fb', '#9db7d7', '#6d8cb3', '#3d618f', '#0d366b'],
  grid: '#eceeef',
  muted: '#818a91',
  text: '#151515',
}

export function usePalette() {
  return PALETTE
}

export const SEND_COLORS: Record<string, string> = Object.fromEntries(
  SEND_GROUPS.map((g, i) => [g, PALETTE.series[i]]),
)

export const AXIS_PROPS = {
  tick: { fill: PALETTE.muted, fontSize: 12 },
  axisLine: { stroke: PALETTE.grid },
  tickLine: false,
} as const

export const GRID_PROPS = { stroke: PALETTE.grid, vertical: false } as const

const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

export function number(n: number): string {
  return formatter.format(n)
}

export function Card({ title, subtitle, legend, children }: { title: string; subtitle?: string; legend?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <h3>{title}</h3>
      {subtitle && <p className="card-subtitle text-muted">{subtitle}</p>}
      {legend}
      <div className="card-body">{children}</div>
    </section>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="legend">
      {items.map((i) => (
        <li key={i.label}>
          <span className="legend-swatch" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

export function SendLegend() {
  return <Legend items={SEND_GROUPS.map((g) => ({ label: g, color: SEND_COLORS[g] }))} />
}

interface TooltipEntry {
  name?: string | number
  value?: unknown
  color?: string
  dataKey?: unknown
}

export function TooltipBox({
  active,
  payload,
  label,
  format = (v) => number(Number(v)),
}: {
  active?: boolean
  payload?: readonly TooltipEntry[]
  label?: ReactNode
  format?: (value: unknown, name: string) => string
}) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((p) => p.value !== 0 && p.value !== null && p.value !== undefined)
  return (
    <div className="tooltip-box">
      <div className="tooltip-label">{label}</div>
      {rows.map((p) => (
        <div key={String(p.name)} className="tooltip-row">
          <span className="legend-swatch" style={{ background: p.color }} />
          <span>{p.name}</span>
          <strong>{format(p.value, String(p.name))}</strong>
        </div>
      ))}
    </div>
  )
}

export function Empty() {
  return <p className="text-muted empty">No ticks match these filters.</p>
}
