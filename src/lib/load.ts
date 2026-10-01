import { parseCsv } from './parse.ts'
import type { Logbook, Snapshot } from './types.ts'

export interface LoadedFiles {
  snapshots: Snapshot[]
  prior: Logbook | null
}

export async function readFiles(files: File[]): Promise<LoadedFiles> {
  const csvs = files.filter((f) => /\.csv$/i.test(f.name))
  const jsons = files.filter((f) => /\.json$/i.test(f.name))
  if (csvs.length === 0 && jsons.length === 0) throw new Error('Choose tick .csv exports or a logbook.json.')
  if (jsons.length > 1) throw new Error('Choose at most one logbook.json.')

  const prior = jsons.length > 0 ? await readLogbook(jsons[0]) : null
  const snapshots = await Promise.all(
    csvs.map(async (f) => {
      try {
        return { name: f.name, rows: parseCsv(await f.text()), lastModified: f.lastModified }
      } catch (e) {
        throw new Error(`${f.name}: ${errorMessage(e)}`, { cause: e })
      }
    }),
  )
  return { snapshots, prior }
}

async function readLogbook(file: File): Promise<Logbook> {
  try {
    return asLogbook(JSON.parse(await file.text()))
  } catch (e) {
    throw new Error(`${file.name}: ${errorMessage(e)}`, { cause: e })
  }
}

export function asLogbook(value: unknown): Logbook {
  const v = value as Partial<Logbook> | null
  if (!v || typeof v !== 'object' || v.version !== 1 || !Array.isArray(v.ticks)) {
    throw new Error('Not a version 1 logbook.json')
  }
  return { version: 1, snapshots: Array.isArray(v.snapshots) ? v.snapshots : [], ticks: v.ticks }
}

export function serializeLogbook(logbook: Logbook): string {
  return JSON.stringify(logbook, null, 2) + '\n'
}

export function downloadLogbook(logbook: Logbook): void {
  const url = URL.createObjectURL(new Blob([serializeLogbook(logbook)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'logbook.json'
  a.click()
  URL.revokeObjectURL(url)
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
