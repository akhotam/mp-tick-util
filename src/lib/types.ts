export const COLUMNS = [
  'Date',
  'Route',
  'Rating',
  'Notes',
  'URL',
  'Pitches',
  'Location',
  'Avg Stars',
  'Your Stars',
  'Style',
  'Lead Style',
  'Route Type',
  'Your Rating',
  'Length',
  'Rating Code',
] as const

export type Column = (typeof COLUMNS)[number]

// Every value kept verbatim as exported
export type RawTick = Record<Column, string>

// Change to any of these means delete plus add, URL contributes its route ID only
export const IDENTITY_FIELDS: readonly Column[] = ['Date', 'URL', 'Style', 'Lead Style', 'Pitches']

export const TRACKED_FIELDS: readonly Column[] = [
  'Route',
  'Rating',
  'Notes',
  'URL',
  'Location',
  'Route Type',
  'Your Rating',
  'Length',
  'Rating Code',
]

// Star ratings drift constantly, logging them would bury real edits
export const UNTRACKED_FIELDS: readonly Column[] = ['Avg Stars', 'Your Stars']

export type TickEdit =
  | { field: Column; from: string; to: string; at: string }
  | { field: 'deleted'; from: boolean; to: boolean; at: string }

export interface TickRecord {
  id: string
  raw: RawTick
  first_seen: string
  last_seen: string
  deleted: boolean
  deleted_at: string | null
  edits: TickEdit[]
}

export interface Logbook {
  version: 1
  snapshots: string[]
  ticks: TickRecord[]
}

export interface Snapshot {
  name: string
  rows: RawTick[]
  lastModified?: number
}

export interface SnapshotDiff {
  name: string
  total: number
  added: number
  edited: number
  deleted: number
  resurrected: number
}

export interface MergeResult {
  logbook: Logbook
  diffs: SnapshotDiff[]
  warnings: string[]
}

export type Scale = 'yds' | 'v' | 'ungraded'

export interface Tick {
  id: string
  date: string
  month: string
  year: number
  route: string
  routeId: string
  url: string
  rating: string
  gradeLabel: string
  ratingCode: number
  scale: Scale
  pitches: number
  length: number | null
  avgStars: number | null
  areaPath: string[]
  location: string
  state: string
  crag: string
  disciplines: string[]
  style: string
  leadStyle: string
  sendStatus: string
  isLead: boolean
  isClean: boolean
  notes: string
  partners: string[]
  // Zero for deleted ticks, they no longer count as ascents
  ascentNumber: number
  deleted: boolean
}
