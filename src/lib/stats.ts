import type { Scale, Tick } from './types.ts'

export const SEND_GROUPS = ['Onsight', 'Flash', 'Redpoint', 'Fell/Hung', 'Toprope', 'Other'] as const
export type SendGroup = (typeof SEND_GROUPS)[number]

export function sendGroup(status: string): SendGroup {
  switch (status) {
    case 'Onsight':
    case 'Flash':
    case 'Redpoint':
    case 'Fell/Hung':
      return status
    case 'Pinkpoint':
      return 'Redpoint'
    case 'TR':
    case 'Follow':
      return 'Toprope'
    default:
      return 'Other'
  }
}

type GroupCounts = Record<SendGroup, number>

function emptyGroups(): GroupCounts {
  return { Onsight: 0, Flash: 0, Redpoint: 0, 'Fell/Hung': 0, Toprope: 0, Other: 0 }
}

export interface Hardest {
  label: string
  code: number
  route: string
  date: string
}

export interface Summary {
  ticks: number
  routes: number
  pitches: number
  feet: number
  days: number
  crags: number
  first: string
  last: string
  hardestOnsight: Hardest | null
  hardestSend: Hardest | null
}

const SEND_STYLES = new Set(['Redpoint', 'Pinkpoint', 'Flash'])

const isYdsLead = (t: Tick) => t.isLead && t.scale === 'yds'

function hardest(ticks: Tick[]): Hardest | null {
  let best: Tick | null = null
  for (const t of ticks) if (!best || t.ratingCode > best.ratingCode) best = t
  return best && { label: best.gradeLabel, code: best.ratingCode, route: best.route, date: best.date }
}

export function summarise(ticks: Tick[]): Summary {
  const dates = ticks.map((t) => t.date).sort()
  return {
    ticks: ticks.length,
    routes: new Set(ticks.map((t) => t.routeId)).size,
    pitches: ticks.reduce((s, t) => s + t.pitches, 0),
    feet: ticks.reduce((s, t) => s + (t.length ?? 0), 0),
    days: new Set(dates).size,
    crags: new Set(ticks.map((t) => t.location)).size,
    first: dates[0] ?? '',
    last: dates[dates.length - 1] ?? '',
    hardestOnsight: hardest(ticks.filter((t) => isYdsLead(t) && t.sendStatus === 'Onsight')),
    hardestSend: hardest(ticks.filter((t) => isYdsLead(t) && SEND_STYLES.has(t.sendStatus))),
  }
}

function monthRange(first: string, last: string): string[] {
  const out: string[] = []
  let [y, m] = first.split('-').map(Number)
  const [ly, lm] = last.split('-').map(Number)
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

function yearRange(ticks: Tick[]): number[] {
  if (ticks.length === 0) return []
  const years = ticks.map((t) => t.year)
  const out: number[] = []
  for (let y = Math.min(...years); y <= Math.max(...years); y++) out.push(y)
  return out
}

export type MonthRow = { month: string; total: number } & GroupCounts

export function byMonth(ticks: Tick[]): MonthRow[] {
  if (ticks.length === 0) return []
  const months = ticks.map((t) => t.month).sort()
  const rows = new Map(
    monthRange(months[0], months[months.length - 1]).map((month): [string, MonthRow] => [
      month,
      { month, total: 0, ...emptyGroups() },
    ]),
  )
  for (const t of ticks) {
    const row = rows.get(t.month)!
    row.total++
    row[sendGroup(t.sendStatus)]++
  }
  return [...rows.values()]
}

export type GradeRow = { label: string; code: number; total: number } & GroupCounts

export function byGrade(ticks: Tick[], scale: Scale): GradeRow[] {
  const rows = new Map<number, GradeRow>()
  for (const t of ticks) {
    if (t.scale !== scale) continue
    let row = rows.get(t.ratingCode)
    if (!row) {
      row = { label: t.gradeLabel, code: t.ratingCode, total: 0, ...emptyGroups() }
      rows.set(t.ratingCode, row)
    }
    row.total++
    row[sendGroup(t.sendStatus)]++
  }
  return [...rows.values()].sort((a, b) => a.code - b.code)
}

export interface ProgressionRow {
  quarter: string
  onsight: number | null
  send: number | null
}

function quarterOf(t: Tick): string {
  return `${t.year} Q${Math.floor((Number(t.month.slice(5)) - 1) / 3) + 1}`
}

export function progression(ticks: Tick[]): ProgressionRow[] {
  const leads = ticks.filter(isYdsLead)
  if (leads.length === 0) return []
  const rows = new Map<string, ProgressionRow>()
  for (const y of yearRange(leads)) {
    for (let q = 1; q <= 4; q++) rows.set(`${y} Q${q}`, { quarter: `${y} Q${q}`, onsight: null, send: null })
  }
  for (const t of leads) {
    const row = rows.get(quarterOf(t))!
    if (t.sendStatus === 'Onsight') row.onsight = Math.max(row.onsight ?? 0, t.ratingCode)
    if (SEND_STYLES.has(t.sendStatus)) row.send = Math.max(row.send ?? 0, t.ratingCode)
  }
  const keys = leads.map(quarterOf).sort()
  const first = keys[0]
  const last = keys[keys.length - 1]
  return [...rows.values()].filter((r) => r.quarter >= first && r.quarter <= last)
}

export function codeLabels(ticks: Tick[]): Map<number, string> {
  return new Map(ticks.map((t) => [t.ratingCode, t.gradeLabel]))
}

export interface AreaRow {
  name: string
  path: string
  ticks: number
  routes: number
  days: number
  hasChildren: boolean
}

export const HERE = '(this area)'

// One hierarchy level below prefix, ticks logged at prefix itself group under HERE
export function byArea(ticks: Tick[], prefix: string): AreaRow[] {
  const depth = prefix ? prefix.split(' > ').length : 0
  const groups = new Map<string, { path: string; ticks: Tick[]; deeper: boolean }>()
  for (const t of ticks) {
    if (prefix && t.location !== prefix && !t.location.startsWith(prefix + ' > ')) continue
    const child = t.areaPath[depth]
    const name = child ?? HERE
    const path = child ? t.areaPath.slice(0, depth + 1).join(' > ') : prefix
    let g = groups.get(name)
    if (!g) {
      g = { path, ticks: [], deeper: false }
      groups.set(name, g)
    }
    g.ticks.push(t)
    if (t.areaPath.length > depth + 1) g.deeper = true
  }
  return [...groups.entries()]
    .map(([name, g]) => ({
      name,
      path: g.path,
      ticks: g.ticks.length,
      routes: new Set(g.ticks.map((t) => t.routeId)).size,
      days: new Set(g.ticks.map((t) => t.date)).size,
      hasChildren: g.deeper,
    }))
    .sort((a, b) => b.ticks - a.ticks || a.name.localeCompare(b.name))
}

export interface PartnerRow {
  name: string
  ticks: number
  days: number
  routes: number
  first: string
  last: string
}

export function byPartner(ticks: Tick[]): PartnerRow[] {
  const groups = new Map<string, Tick[]>()
  for (const t of ticks) for (const p of t.partners) groups.set(p, [...(groups.get(p) ?? []), t])
  return [...groups.entries()]
    .map(([name, ts]) => {
      const dates = ts.map((t) => t.date).sort()
      return {
        name,
        ticks: ts.length,
        days: new Set(dates).size,
        routes: new Set(ts.map((t) => t.routeId)).size,
        first: dates[0],
        last: dates[dates.length - 1],
      }
    })
    .sort((a, b) => b.ticks - a.ticks || a.name.localeCompare(b.name))
}

export interface RepeatRow {
  routeId: string
  route: string
  url: string
  gradeLabel: string
  location: string
  count: number
  last: string
}

export function mostRepeated(ticks: Tick[]): RepeatRow[] {
  const groups = new Map<string, Tick[]>()
  for (const t of ticks) groups.set(t.routeId, [...(groups.get(t.routeId) ?? []), t])
  return [...groups.values()]
    .filter((ts) => ts.length > 1)
    .map((ts) => {
      const latest = ts.reduce((a, b) => (b.date > a.date ? b : a))
      return {
        routeId: latest.routeId,
        route: latest.route,
        url: latest.url,
        gradeLabel: latest.gradeLabel,
        location: latest.location,
        count: ts.length,
        last: latest.date,
      }
    })
    .sort((a, b) => b.count - a.count || a.route.localeCompare(b.route))
}

export interface NewRepeatRow {
  year: string
  New: number
  Repeat: number
}

// Ascent numbers come from full history, filters do not turn repeats into firsts
export function newVsRepeat(ticks: Tick[]): NewRepeatRow[] {
  const rows = new Map(yearRange(ticks).map((y): [number, NewRepeatRow] => [y, { year: String(y), New: 0, Repeat: 0 }]))
  for (const t of ticks) {
    if (t.ascentNumber === 0) continue
    rows.get(t.year)![t.ascentNumber === 1 ? 'New' : 'Repeat']++
  }
  return [...rows.values()]
}

export const DISCIPLINES = ['Sport', 'Trad', 'Boulder', 'Other'] as const
export type Discipline = (typeof DISCIPLINES)[number]

export function primaryDiscipline(t: Tick): Discipline {
  for (const d of ['Sport', 'Trad', 'Boulder'] as const) if (t.disciplines.includes(d)) return d
  return 'Other'
}

export type DisciplineRow = { year: string } & Record<Discipline, number>

export function disciplineMix(ticks: Tick[]): DisciplineRow[] {
  const rows = new Map(
    yearRange(ticks).map((y): [number, DisciplineRow] => [y, { year: String(y), Sport: 0, Trad: 0, Boulder: 0, Other: 0 }]),
  )
  for (const t of ticks) rows.get(t.year)![primaryDiscipline(t)]++
  return [...rows.values()]
}

export interface OnsightRow {
  label: string
  code: number
  leads: number
  onsights: number
  rate: number
}

export const MIN_LEADS_FOR_RATE = 3

export function onsightRate(ticks: Tick[]): OnsightRow[] {
  const rows = new Map<number, OnsightRow>()
  for (const t of ticks) {
    if (!isYdsLead(t)) continue
    let row = rows.get(t.ratingCode)
    if (!row) {
      row = { label: t.gradeLabel, code: t.ratingCode, leads: 0, onsights: 0, rate: 0 }
      rows.set(t.ratingCode, row)
    }
    row.leads++
    if (t.sendStatus === 'Onsight') row.onsights++
  }
  return [...rows.values()]
    .filter((r) => r.leads >= MIN_LEADS_FOR_RATE)
    .map((r) => ({ ...r, rate: r.onsights / r.leads }))
    .sort((a, b) => a.code - b.code)
}

export interface DayCount {
  date: string
  count: number
}

export function byDay(ticks: Tick[]): DayCount[] {
  const counts = new Map<string, number>()
  for (const t of ticks) counts.set(t.date, (counts.get(t.date) ?? 0) + 1)
  return [...counts.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => (a.date < b.date ? -1 : 1))
}
