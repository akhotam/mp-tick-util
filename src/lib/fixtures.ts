import { readFileSync } from 'node:fs'
import { parseCsv } from './parse.ts'
import type { Snapshot } from './types.ts'

export function readFixture(name: string): string {
  return readFileSync(new URL(`../../data/${name}`, import.meta.url), 'utf8')
}

export function fixtureSnapshot(name: string, lastModified?: number): Snapshot {
  return { name, rows: parseCsv(readFixture(name)), lastModified }
}
