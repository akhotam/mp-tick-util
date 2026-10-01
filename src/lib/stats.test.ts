import { describe, expect, it } from 'vitest'
import { deriveTicks } from './derive.ts'
import { DEFAULT_FILTERS, SOLO, applyFilters, fromParams, toParams, type Filters } from './filters.ts'
import { fixtureSnapshot } from './fixtures.ts'
import { merge } from './merge.ts'
import {
  HERE,
  byArea,
  byDay,
  byGrade,
  byMonth,
  byPartner,
  disciplineMix,
  mostRepeated,
  newVsRepeat,
  onsightRate,
  progression,
  sendGroup,
  summarise,
} from './stats.ts'
import type { Tick } from './types.ts'

const all = deriveTicks(merge(null, [fixtureSnapshot('ticks.csv'), fixtureSnapshot('ticks 2.csv')]).logbook.ticks)
const live = applyFilters(all, DEFAULT_FILTERS)
const withFilters = (f: Partial<Filters>) => applyFilters(all, { ...DEFAULT_FILTERS, ...f })

function tick(over: Partial<Tick>): Tick {
  return { ...live[0], ...over }
}

describe('filters', () => {
  it('hides deleted ticks unless asked', () => {
    expect(live).toHaveLength(30)
    expect(withFilters({ includeDeleted: true })).toHaveLength(32)
  })

  it('filters by partner and solo sentinel', () => {
    const joe = withFilters({ partner: 'Joe' })
    expect(joe.length).toBeGreaterThan(0)
    expect(joe.every((t) => t.partners.includes('Joe'))).toBe(true)
    const solo = withFilters({ partner: SOLO })
    expect(solo.length).toBeGreaterThan(0)
    expect(solo.every((t) => t.partners.length === 0)).toBe(true)
    expect(joe.length + solo.length).toBeLessThanOrEqual(live.length)
  })

  it('filters by area prefix on whole segments', () => {
    expect(withFilters({ area: 'California' }).every((t) => t.state === 'California')).toBe(true)
    expect(withFilters({ area: 'Californ' })).toEqual([])
    expect(withFilters({ area: 'California > Lake Tahoe' })).toHaveLength(2)
  })

  it('filters by text, date, grade, discipline and send status', () => {
    expect(withFilters({ q: 'UNDERCLING' })).toHaveLength(1)
    expect(withFilters({ from: '2026-10-01' })).toHaveLength(8)
    expect(withFilters({ to: '2026-06-14' })).toHaveLength(2)
    expect(withFilters({ minCode: 20000 }).every((t) => t.scale === 'v')).toBe(true)
    expect(withFilters({ maxCode: 1500 }).every((t) => t.ratingCode <= 1500)).toBe(true)
    expect(withFilters({ disciplines: ['Boulder'] }).every((t) => t.disciplines.includes('Boulder'))).toBe(true)
    expect(withFilters({ sendStatus: ['Onsight'] })).toHaveLength(4)
  })

  it('round-trips through URL params, omitting defaults', () => {
    expect(toParams(DEFAULT_FILTERS, 'overview').toString()).toBe('')
    const f: Filters = {
      from: '2026-01-01',
      to: '2026-12-31',
      minCode: 1500,
      maxCode: 3200,
      disciplines: ['Sport', 'Trad'],
      sendStatus: ['Fell/Hung', 'Onsight'],
      area: 'California > Lake Tahoe',
      partner: SOLO,
      q: 'crux & more',
      includeDeleted: true,
    }
    const params = toParams(f, 'partners')
    expect(params.get('with')).toBe('(solo)')
    expect(params.get('deleted')).toBe('1')
    expect(fromParams(new URLSearchParams(params.toString()))).toEqual({ filters: f, tab: 'partners' })
    expect(fromParams(new URLSearchParams('tab=bogus&min=abc'))).toEqual({ filters: DEFAULT_FILTERS, tab: 'overview' })
  })
})

describe('stats', () => {
  it('groups send statuses', () => {
    expect(['Onsight', 'Pinkpoint', 'TR', 'Follow', 'Solo', 'Fell/Hung'].map(sendGroup)).toEqual([
      'Onsight',
      'Redpoint',
      'Toprope',
      'Toprope',
      'Other',
      'Fell/Hung',
    ])
  })

  it('summarises fixtures', () => {
    const s = summarise(live)
    expect(s).toMatchObject({ ticks: 30, routes: 20, pitches: 39, feet: 1394, days: 18, crags: 8, first: '2026-06-07', last: '2026-10-01' })
    expect(s.hardestOnsight?.label).toBe('5.8+')
    expect(s.hardestSend?.label).toBe('5.10a')
  })

  it('fills empty months and years', () => {
    const rows = byMonth([tick({ month: '2025-11' }), tick({ month: '2026-02' })])
    expect(rows.map((r) => r.month)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(rows.map((r) => r.total)).toEqual([1, 0, 0, 1])
    expect(disciplineMix([tick({ year: 2023 }), tick({ year: 2025 })]).map((r) => r.year)).toEqual(['2023', '2024', '2025'])
    expect(newVsRepeat([tick({ year: 2023 }), tick({ year: 2025 })]).map((r) => r.year)).toEqual(['2023', '2024', '2025'])
  })

  it('stacks grade counts by send group', () => {
    const v = byGrade(live, 'v')
    expect(v.map((r) => r.label)).toEqual(['V-easy', 'V3', 'V5'])
    const total = byMonth(live).reduce((s, r) => s + r.total, 0)
    expect(total).toBe(30)
  })

  it('tracks progression per quarter', () => {
    const rows = progression(live)
    expect(rows.map((r) => r.quarter)).toEqual(['2026 Q2', '2026 Q3', '2026 Q4'])
    expect(rows[1]).toEqual({ quarter: '2026 Q3', onsight: 2200, send: 2600 })
  })

  it('drills down area levels', () => {
    const top = byArea(live, '')
    expect(top[0]).toMatchObject({ name: '* In Progress', ticks: 21, hasChildren: true })
    const tahoe = byArea(live, 'California > Lake Tahoe > South Shore > The Pie Shop > 3. Monty Python Castles > Castle Arrruuuuuuuugggh')
    expect(tahoe).toEqual([expect.objectContaining({ name: HERE, ticks: 2, hasChildren: false })])
  })

  it('counts partners, repeats, new vs repeat', () => {
    expect(byPartner(live)[0]).toMatchObject({ name: 'Bill', ticks: 5, days: 5 })
    expect(mostRepeated(live)[0].count).toBeGreaterThan(1)
    expect(mostRepeated(live).every((r) => r.count > 1)).toBe(true)
    const nr = newVsRepeat(live)
    expect(nr[0].New + nr[0].Repeat).toBe(30)
    expect(nr[0].New).toBe(new Set(live.map((t) => t.routeId)).size)
  })

  it('computes onsight rate only for grades with three leads', () => {
    const many = [1, 2, 3].map((i) => tick({ isLead: true, scale: 'yds', ratingCode: 2000, sendStatus: i === 1 ? 'Onsight' : 'Redpoint' }))
    expect(onsightRate(many)).toEqual([expect.objectContaining({ code: 2000, leads: 3, onsights: 1 })])
    expect(onsightRate(many.slice(1))).toEqual([])
  })

  it('counts ticks per day', () => {
    const days = byDay(live)
    expect(days.find((d) => d.date === '2026-10-01')?.count).toBe(8)
    expect(days.reduce((s, d) => s + d.count, 0)).toBe(30)
  })
})
