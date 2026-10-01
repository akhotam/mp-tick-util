import type { Tick } from './types.ts'

// Partner sentinel selecting ticks with no parsed partners
export const SOLO = '(solo)'

export const TABS = ['overview', 'grades', 'places', 'partners', 'ticks'] as const
export type Tab = (typeof TABS)[number]

export interface Filters {
  from: string
  to: string
  minCode: number | null
  maxCode: number | null
  disciplines: string[]
  sendStatus: string[]
  area: string
  partner: string
  q: string
  includeDeleted: boolean
}

export const DEFAULT_FILTERS: Filters = {
  from: '',
  to: '',
  minCode: null,
  maxCode: null,
  disciplines: [],
  sendStatus: [],
  area: '',
  partner: '',
  q: '',
  includeDeleted: false,
}

export function applyFilters(ticks: Tick[], f: Filters): Tick[] {
  const q = f.q.trim().toLowerCase()
  return ticks.filter((t) => {
    if (t.deleted && !f.includeDeleted) return false
    if (f.from && t.date < f.from) return false
    if (f.to && t.date > f.to) return false
    if (f.minCode !== null && t.ratingCode < f.minCode) return false
    if (f.maxCode !== null && t.ratingCode > f.maxCode) return false
    if (f.disciplines.length > 0 && !f.disciplines.some((d) => t.disciplines.includes(d))) return false
    if (f.sendStatus.length > 0 && !f.sendStatus.includes(t.sendStatus)) return false
    if (f.area && t.location !== f.area && !t.location.startsWith(f.area + ' > ')) return false
    if (f.partner === SOLO && t.partners.length > 0) return false
    if (f.partner && f.partner !== SOLO && !t.partners.includes(f.partner)) return false
    if (q && !`${t.route}\n${t.notes}\n${t.location}`.toLowerCase().includes(q)) return false
    return true
  })
}

export function isFiltered(f: Filters): boolean {
  return toParams(f, 'overview').toString() !== ''
}

// Non-default values only, keeps shared URLs short
export function toParams(f: Filters, tab: Tab): URLSearchParams {
  const p = new URLSearchParams()
  if (tab !== 'overview') p.set('tab', tab)
  if (f.from) p.set('from', f.from)
  if (f.to) p.set('to', f.to)
  if (f.minCode !== null) p.set('min', String(f.minCode))
  if (f.maxCode !== null) p.set('max', String(f.maxCode))
  if (f.disciplines.length > 0) p.set('type', f.disciplines.join(','))
  if (f.sendStatus.length > 0) p.set('send', f.sendStatus.join(','))
  if (f.area) p.set('area', f.area)
  if (f.partner) p.set('with', f.partner)
  if (f.q) p.set('q', f.q)
  if (f.includeDeleted) p.set('deleted', '1')
  return p
}

export function fromParams(p: URLSearchParams): { filters: Filters; tab: Tab } {
  const list = (k: string) => (p.get(k) ?? '').split(',').filter(Boolean)
  const code = (k: string) => {
    const n = Number(p.get(k) ?? NaN)
    return p.has(k) && Number.isFinite(n) ? n : null
  }
  const tab = p.get('tab')
  return {
    tab: TABS.find((t) => t === tab) ?? 'overview',
    filters: {
      from: p.get('from') ?? '',
      to: p.get('to') ?? '',
      minCode: code('min'),
      maxCode: code('max'),
      disciplines: list('type'),
      sendStatus: list('send'),
      area: p.get('area') ?? '',
      partner: p.get('with') ?? '',
      q: p.get('q') ?? '',
      includeDeleted: p.get('deleted') === '1',
    },
  }
}
