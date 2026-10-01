import Papa from 'papaparse'
import { COLUMNS, type RawTick } from './types.ts'

// Notes contain quoted newlines, line splitting would corrupt them
export function parseCsv(text: string): RawTick[] {
  const result = Papa.parse<Record<string, string | undefined>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  const fields = result.meta.fields ?? []
  const missing = COLUMNS.filter((c) => !fields.includes(c))
  if (missing.length > 0) throw new Error(`Missing columns: ${missing.join(', ')}`)
  return result.data.map((row) => {
    const raw = {} as RawTick
    for (const c of COLUMNS) raw[c] = row[c] ?? ''
    return raw
  })
}

export function routeId(url: string): string {
  return /\/route\/(\d+)/.exec(url)?.[1] ?? url
}
