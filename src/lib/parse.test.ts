import { describe, expect, it } from 'vitest'
import { readFixture } from './fixtures.ts'
import { parseCsv, routeId } from './parse.ts'
import { COLUMNS, IDENTITY_FIELDS, TRACKED_FIELDS, UNTRACKED_FIELDS } from './types.ts'

describe('parseCsv', () => {
  it('parses both fixtures', () => {
    expect(parseCsv(readFixture('ticks.csv'))).toHaveLength(23)
    expect(parseCsv(readFixture('ticks 2.csv'))).toHaveLength(30)
  })

  it('keeps quoted newlines inside notes', () => {
    const rows = parseCsv(readFixture('ticks.csv'))
    const tick = rows.find((r) => r.Notes.startsWith('Fell / Hung'))
    expect(tick?.Notes).toMatch(/^Fell \/ Hung\. w\/ Joe & Tom\. Figured out the beta, clipping\r?\nfrom the jug$/)
    expect(tick?.URL).toBe('https://www.mountainproject.com/route/112166313/510a-sport')
  })

  it('keeps every value verbatim as a string', () => {
    const [first] = parseCsv(readFixture('ticks.csv'))
    expect(Object.keys(first)).toEqual([...COLUMNS])
    expect(first['Avg Stars']).toBe('2.8')
    expect(first['Lead Style']).toBe('')
  })

  it('names missing columns', () => {
    expect(() => parseCsv('Date,Route\n2026-01-01,Foo\n')).toThrow(/Missing columns: Rating, Notes, URL/)
  })

  it('tolerates byte order mark and trailing blank lines', () => {
    const text = '﻿' + readFixture('ticks.csv') + '\n\n\n'
    expect(parseCsv(text)).toHaveLength(23)
  })
})

describe('field policy', () => {
  it('puts every column in exactly one policy list, URL in identity too', () => {
    for (const c of COLUMNS) {
      const lists = [TRACKED_FIELDS, UNTRACKED_FIELDS].filter((l) => l.includes(c))
      if (c === 'URL' || !IDENTITY_FIELDS.includes(c)) expect(lists, c).toHaveLength(1)
      else expect(lists, c).toHaveLength(0)
    }
  })
})

describe('routeId', () => {
  it('extracts numeric ID, else returns URL', () => {
    expect(routeId('https://www.mountainproject.com/route/112833955/patio-cracks-left')).toBe('112833955')
    expect(routeId('https://example.com/x')).toBe('https://example.com/x')
  })
})
