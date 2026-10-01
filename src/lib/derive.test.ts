import { describe, expect, it } from 'vitest'
import { normalizeAreaPath } from './areas.ts'
import { decodeEntities, deriveTicks, gradeLabel, parsePartners, scaleOf, sendStatus } from './derive.ts'
import { fixtureSnapshot } from './fixtures.ts'
import { asLogbook, readFiles, serializeLogbook } from './load.ts'
import { merge } from './merge.ts'

const ticks = deriveTicks(merge(null, [fixtureSnapshot('ticks.csv'), fixtureSnapshot('ticks 2.csv')]).logbook.ticks)
const byRoute = (id: string) => ticks.filter((t) => t.routeId === id)

describe('scaleOf', () => {
  it('derives scale from rating code', () => {
    expect(scaleOf(20000)).toBe('v')
    expect(scaleOf(20500)).toBe('v')
    expect(scaleOf(0)).toBe('ungraded')
    expect(scaleOf(-1)).toBe('ungraded')
    expect(scaleOf(800)).toBe('yds')
    expect(scaleOf(2600)).toBe('yds')
  })
})

describe('gradeLabel', () => {
  it('stops at safety, aid and boulder tokens', () => {
    expect(gradeLabel('5.10a V1- R', 'yds')).toBe('5.10a')
    expect(gradeLabel('3rd V0 PG13', 'yds')).toBe('3rd')
    expect(gradeLabel('5.12- C1', 'yds')).toBe('5.12-')
    expect(gradeLabel('5.9 PG13', 'yds')).toBe('5.9')
    expect(gradeLabel('5.5 X', 'yds')).toBe('5.5')
    expect(gradeLabel('5.10a/b', 'yds')).toBe('5.10a/b')
  })

  it('takes V token on V scale', () => {
    expect(gradeLabel('V5', 'v')).toBe('V5')
    expect(gradeLabel('V-easy', 'v')).toBe('V-easy')
    expect(gradeLabel('V3 PG13', 'v')).toBe('V3')
  })

  it('labels ungraded ratings', () => {
    expect(gradeLabel('C1+', 'ungraded')).toBe('Ungraded')
  })

  it('assigns one label per rating code', () => {
    const labels = new Map<number, Set<string>>()
    for (const t of ticks) labels.set(t.ratingCode, (labels.get(t.ratingCode) ?? new Set()).add(t.gradeLabel))
    for (const set of labels.values()) expect(set.size).toBe(1)
  })
})

describe('sendStatus', () => {
  it('maps style and lead style', () => {
    expect(sendStatus('Lead', 'Onsight')).toBe('Onsight')
    expect(sendStatus('Lead', '')).toBe('Lead')
    expect(sendStatus('', '')).toBe('Unknown')
    expect(sendStatus('TR', 'Fell/Hung')).toBe('TR')
    expect(sendStatus('Follow', '')).toBe('Follow')
  })
})

describe('parsePartners', () => {
  it('splits lists on & , : and', () => {
    expect(parsePartners('w/ Ana, Bill, & Tom. Linked 1+2')).toEqual(['Ana', 'Bill', 'Tom'])
    expect(parsePartners('Fell / Hung. w/ Joe & Tom. Figured')).toEqual(['Joe', 'Tom'])
    expect(parsePartners('onsight w/ climbing class: Alex, Tommy-Lee, Chris')).toEqual(['Alex', 'Tommy-Lee', 'Chris'])
    expect(parsePartners('w/ Joe and Bob')).toEqual(['Joe', 'Bob'])
  })

  it('strips possessive and trailing words', () => {
    expect(parsePartners("Fell/Hung. w/ Tom's rope. Forgot")).toEqual(['Tom'])
    expect(parsePartners('w/ Dana from climbing meetup group.')).toEqual(['Dana'])
    expect(parsePartners('w/ Mary Jo Smith Jones')).toEqual(['Mary Jo Smith'])
  })

  it('ignores w/o, acronyms, lowercase and overlong names', () => {
    expect(parsePartners('Soloed w/o a rope')).toEqual([])
    expect(parsePartners('attempt w/ REI')).toEqual([])
    expect(parsePartners('w/ friends')).toEqual([])
    expect(parsePartners('w/ Abcdefghijklmnopqrstuvwxyzabcdef')).toEqual([])
    expect(parsePartners('with Bob')).toEqual([])
  })

  it('handles unicode names and dedupes', () => {
    expect(parsePartners('w/ Zoë & Łukasz. Later w/ Zoë')).toEqual(['Zoë', 'Łukasz'])
  })
})

describe('deriveTicks', () => {
  it('counts ascents per route chronologically, skipping deleted', () => {
    expect(byRoute('121453674').map((t) => [t.date, t.ascentNumber])).toEqual([
      ['2026-07-05', 1],
      ['2026-07-12', 2],
    ])
    expect(byRoute('127378380').map((t) => [t.date, t.deleted, t.ascentNumber])).toEqual([
      ['2026-06-27', false, 1],
      ['2026-06-28', true, 0],
      ['2026-10-01', false, 2],
    ])
  })

  it('fills derived fields', () => {
    const [riel] = byRoute('117376550')
    expect(riel).toMatchObject({
      month: '2026-08',
      year: 2026,
      pitches: 4,
      length: 500,
      avgStars: 2.1,
      state: 'Alberta',
      crag: 'Falls Area Rock',
      location: 'Alberta > Banff National Park > Cascade Mountain > Falls Area Rock',
      sendStatus: 'Onsight',
      isLead: true,
      isClean: true,
      partners: ['Ana', 'Bill', 'Tom'],
    })
    const [right] = byRoute('116604247')
    expect(right.disciplines).toEqual(['Trad', 'TR', 'Boulder'])
    expect(right.sendStatus).toBe('Unknown')
    const [c1] = byRoute('201168358')
    expect(c1.avgStars).toBeNull()
    const [aid] = byRoute('127378380')
    expect(aid.scale).toBe('ungraded')
  })

  it('decodes HTML entities in notes', () => {
    expect(decodeEntities('can&#39;t &#34;x&#34; &amp; &bogus;')).toBe('can\'t "x" & &bogus;')
    expect(byRoute('121964621')[0].notes).toContain("can't jam")
  })
})

describe('normalizeAreaPath', () => {
  it('passes US paths through', () => {
    expect(normalizeAreaPath(['California', 'Yosemite'])).toEqual(['California', 'Yosemite'])
  })

  it('starts at listed subdivision', () => {
    expect(normalizeAreaPath(['International', 'North America', 'Canada', 'Alberta', 'Banff'])).toEqual(['Alberta', 'Banff'])
    expect(normalizeAreaPath(['International', 'Europe', 'UK', 'Wales', 'Gogarth'])).toEqual(['Wales', 'Gogarth'])
    expect(normalizeAreaPath(['International', 'North America', 'Mexico', 'Nuevo Leon', 'Potrero Chico'])).toEqual([
      'Nuevo Leon',
      'Potrero Chico',
    ])
  })

  it('starts at country otherwise', () => {
    expect(normalizeAreaPath(['International', 'Asia', 'Thailand', 'Krabi', 'Tonsai'])).toEqual(['Thailand', 'Krabi', 'Tonsai'])
    expect(normalizeAreaPath(['International', 'Europe', 'Spain', 'Not A Region'])).toEqual(['Spain', 'Not A Region'])
    expect(normalizeAreaPath(['International', 'Europe', 'Spain'])).toEqual(['Spain'])
  })

  it('keeps continent when only continent exists', () => {
    expect(normalizeAreaPath(['International', 'Antarctica'])).toEqual(['Antarctica'])
  })
})

describe('load', () => {
  const file = (name: string, body: string) => new File([body], name, { lastModified: 42 })

  it('splits CSVs and one prior logbook', async () => {
    const prior = merge(null, [fixtureSnapshot('ticks.csv')]).logbook
    const csv = 'Date,Route,Rating,Notes,URL,Pitches,Location,Avg Stars,Your Stars,Style,Lead Style,Route Type,Your Rating,Length,Rating Code\n'
    const r = await readFiles([file('logbook.json', serializeLogbook(prior)), file('ticks 3.csv', csv)])
    expect(r.prior).toEqual(prior)
    expect(r.snapshots).toEqual([{ name: 'ticks 3.csv', rows: [], lastModified: 42 }])
  })

  it('rejects unsupported or ambiguous selections', async () => {
    await expect(readFiles([file('a.txt', '')])).rejects.toThrow(/Choose/)
    await expect(readFiles([file('a.json', '{}'), file('b.json', '{}')])).rejects.toThrow(/at most one/)
    await expect(readFiles([file('bad.csv', 'x,y\n1,2')])).rejects.toThrow(/^bad\.csv: Missing columns/)
  })

  it('validates logbook shape', () => {
    expect(() => asLogbook({ version: 2, ticks: [] })).toThrow()
    expect(() => asLogbook({ version: 1 })).toThrow()
    expect(asLogbook({ version: 1, ticks: [] })).toEqual({ version: 1, snapshots: [], ticks: [] })
  })

  it('serializes with two-space indent and trailing newline', () => {
    expect(serializeLogbook({ version: 1, snapshots: [], ticks: [] })).toBe(
      '{\n  "version": 1,\n  "snapshots": [],\n  "ticks": []\n}\n',
    )
  })
})
