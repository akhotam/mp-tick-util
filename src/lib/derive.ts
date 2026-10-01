import { normalizeAreaPath } from './areas.ts'
import { routeId } from './parse.ts'
import type { Scale, Tick, TickRecord } from './types.ts'

export const SEND_STATUSES = [
  'Onsight',
  'Flash',
  'Redpoint',
  'Pinkpoint',
  'Fell/Hung',
  'Send',
  'Attempt',
  'TR',
  'Follow',
  'Solo',
  'Lead',
  'Unknown',
] as const

const CLEAN = new Set(['Onsight', 'Flash', 'Redpoint', 'Pinkpoint', 'Send', 'Solo'])

export function scaleOf(code: number): Scale {
  if (code >= 20000) return 'v'
  if (code <= 0) return 'ungraded'
  return 'yds'
}

// Safety, aid and boulder suffixes would split one YDS grade into many labels
const STOP_TOKEN = /^(?:PG13|R|X)$|^[VAC]\d|^V-easy/

export function gradeLabel(rating: string, scale: Scale): string {
  const tokens = rating.trim().split(/\s+/).filter(Boolean)
  if (scale === 'v') return tokens.find((t) => /^V(?:\d|-easy)/.test(t)) ?? rating.trim()
  if (scale === 'ungraded') return 'Ungraded'
  const kept: string[] = []
  for (const t of tokens) {
    if (STOP_TOKEN.test(t)) break
    kept.push(t)
  }
  return kept.join(' ') || rating.trim()
}

export function sendStatus(style: string, leadStyle: string): string {
  if (style === 'Lead') return leadStyle || 'Lead'
  return style || 'Unknown'
}

const NAME_WORD = String.raw`\p{Lu}[\p{L}\p{M}'’-]*`
const NAME_RUN = new RegExp(String.raw`^${NAME_WORD}(?:\s+${NAME_WORD}){0,2}`, 'u')

// Partners follow w/ by MP convention, w/o means without
export function parsePartners(notes: string): string[] {
  const found: string[] = []
  for (const m of notes.matchAll(/\bw\/(?!o\b)([^.!?\n]*)/gi)) {
    for (const part of m[1].split(/&|,|:|\band\b/)) {
      const run = NAME_RUN.exec(part.trim())?.[0]
      if (!run) continue
      const name = run.replace(/['’]s$/, '')
      // All-caps runs name gyms and clubs, not people
      if (name.length > 30 || !/\p{Ll}/u.test(name)) continue
      if (!found.includes(name)) found.push(name)
    }
  }
  return found
}

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }

// MP exports HTML entities inside some text fields
export function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] !== '#') return ENTITIES[body.toLowerCase()] ?? whole
    const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
    return Number.isFinite(code) ? String.fromCodePoint(code) : whole
  })
}

function num(s: string): number | null {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

export function deriveTicks(records: TickRecord[]): Tick[] {
  const sorted = [...records].sort((a, b) => cmp(a.raw.Date, b.raw.Date) || cmp(a.id, b.id))
  const ascents = new Map<string, number>()
  const labels = new Map<number, string>()

  const ticks = sorted.map((rec): Tick => {
    const r = rec.raw
    const id = routeId(r.URL)
    const ratingCode = num(r['Rating Code']) ?? 0
    const scale = scaleOf(ratingCode)
    const areaPath = normalizeAreaPath(
      decodeEntities(r.Location)
        .split('>')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    let ascentNumber = 0
    if (!rec.deleted) {
      ascentNumber = (ascents.get(id) ?? 0) + 1
      ascents.set(id, ascentNumber)
    }
    const status = sendStatus(r.Style, r['Lead Style'])
    const notes = decodeEntities(r.Notes)
    const pitches = num(r.Pitches)
    const length = num(r.Length)
    const avgStars = num(r['Avg Stars'])
    const label = gradeLabel(r.Rating, scale)
    labels.set(ratingCode, label)
    return {
      id: rec.id,
      date: r.Date,
      month: r.Date.slice(0, 7),
      year: Number(r.Date.slice(0, 4)),
      route: decodeEntities(r.Route),
      routeId: id,
      url: r.URL,
      rating: r.Rating,
      gradeLabel: label,
      ratingCode,
      scale,
      pitches: pitches && pitches > 0 ? pitches : 1,
      length: length && length > 0 ? length : null,
      avgStars: avgStars !== null && avgStars >= 0 ? avgStars : null,
      areaPath,
      location: areaPath.join(' > '),
      state: areaPath[0] ?? '',
      crag: areaPath[areaPath.length - 1] ?? '',
      disciplines: r['Route Type']
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      style: r.Style,
      leadStyle: r['Lead Style'],
      sendStatus: status,
      isLead: r.Style === 'Lead',
      isClean: CLEAN.has(status),
      notes,
      partners: parsePartners(notes),
      ascentNumber,
      deleted: rec.deleted,
    }
  })

  // One rating code maps to one label, most recent spelling wins
  for (const t of ticks) t.gradeLabel = labels.get(t.ratingCode) ?? t.gradeLabel
  return ticks
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
