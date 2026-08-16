import { routeId } from './parse.ts';
import type { Logbook, TickRecord } from './types.ts';

export type Scale = 'yds' | 'v' | 'ungraded';

export type SendStatus =
  | 'Onsight'
  | 'Flash'
  | 'Redpoint'
  | 'Pinkpoint'
  | 'Fell/Hung'
  | 'Send'
  | 'Attempt'
  | 'TR'
  | 'Follow'
  | 'Solo'
  | 'Lead'
  | 'Unknown';

/** Clean ascents, hardest-earned first. Used to order the pyramid's stacks. */
export const SEND_ORDER: SendStatus[] = [
  'Onsight',
  'Flash',
  'Redpoint',
  'Pinkpoint',
  'Send',
  'Lead',
  'Follow',
  'TR',
  'Solo',
  'Fell/Hung',
  'Attempt',
  'Unknown',
];

const CLEAN = new Set<SendStatus>(['Onsight', 'Flash', 'Redpoint', 'Pinkpoint', 'Send', 'Solo']);

export interface Tick {
  id: string;
  date: string;
  /** `YYYY-MM`, for grouping. */
  month: string;
  year: number;
  route: string;
  routeId: string;
  url: string;
  rating: string;
  /** Rating with safety, aid and boulder suffixes stripped: `5.10a`, `V2`. */
  gradeLabel: string;
  ratingCode: number;
  scale: Scale;
  pitches: number;
  /** Route length in feet, where Mountain Project knows it. */
  length: number | null;
  avgStars: number;
  location: string;
  /** `Location` split on ' > ', state first. */
  areaPath: string[];
  state: string;
  crag: string;
  /** `Route Type` split out — a route can be several at once. */
  disciplines: string[];
  style: string;
  leadStyle: string;
  sendStatus: SendStatus;
  isLead: boolean;
  /** Whether the tick records a clean ascent (nothing weighted, no falls). */
  isClean: boolean;
  notes: string;
  partners: string[];
  /** 1 on the first ascent of this route, 2 on the next, and so on. */
  ascentNumber: number;
  deleted: boolean;
}

export function deriveTicks(logbook: Logbook): Tick[] {
  const chronological = [...logbook.ticks].sort(
    (a, b) => a.raw.Date.localeCompare(b.raw.Date) || a.id.localeCompare(b.id),
  );

  const ascents = new Map<string, number>();
  return chronological.map((record) => {
    const id = routeId(record.raw.URL);
    const ascentNumber = (ascents.get(id) ?? 0) + 1;
    ascents.set(id, ascentNumber);
    return deriveTick(record, id, ascentNumber);
  });
}

function deriveTick(record: TickRecord, id: string, ascentNumber: number): Tick {
  const raw = record.raw;
  const ratingCode = Number(raw['Rating Code']) || 0;
  const areaPath = raw.Location.split(' > ').map((part) => part.trim()).filter(Boolean);
  const sendStatus = deriveSendStatus(raw.Style, raw['Lead Style']);

  return {
    id: record.id,
    date: raw.Date,
    month: raw.Date.slice(0, 7),
    year: Number(raw.Date.slice(0, 4)),
    route: raw.Route,
    routeId: id,
    url: raw.URL,
    rating: raw.Rating,
    gradeLabel: gradeLabel(raw.Rating, ratingCode),
    ratingCode,
    scale: scaleOf(ratingCode),
    pitches: Number(raw.Pitches) || 1,
    length: raw.Length.trim() === '' ? null : Number(raw.Length) || null,
    avgStars: Number(raw['Avg Stars']) || 0,
    location: raw.Location,
    areaPath,
    state: areaPath[0] ?? 'Unknown',
    crag: areaPath.at(-1) ?? 'Unknown',
    disciplines: raw['Route Type'].split(',').map((d) => d.trim()).filter(Boolean),
    style: raw.Style,
    leadStyle: raw['Lead Style'],
    sendStatus,
    isLead: raw.Style === 'Lead',
    isClean: CLEAN.has(sendStatus),
    notes: raw.Notes,
    partners: parsePartners(raw.Notes),
    ascentNumber,
    deleted: record.deleted,
  };
}

/**
 * Boulder problems can't be told apart by route type — a `5.9 V0` route is
 * tagged Boulder but graded on the YDS scale, and codes as 2400 alongside
 * other 5.9s. The rating code is what actually separates the scales.
 * Aid-only lines (`A0`, `C1`) have no free grade at all and code as 0.
 */
export function scaleOf(ratingCode: number): Scale {
  if (ratingCode >= 20000) return 'v';
  if (ratingCode <= 0) return 'ungraded';
  return 'yds';
}

/**
 * Strips safety (`PG13`, `R`, `X`), aid (`A0`, `C1`) and boulder suffixes so
 * that `5.8`, `5.8 PG13` and `5.8 C2` — which all share rating code 2100 —
 * land on one axis tick.
 */
export function gradeLabel(rating: string, ratingCode: number): string {
  const tokens = rating.trim().split(/\s+/);
  if (scaleOf(ratingCode) === 'v') return tokens.find((t) => /^V/i.test(t)) ?? rating;

  const kept: string[] = [];
  for (const token of tokens) {
    if (/^(PG13|R|X)$/i.test(token)) break;
    if (/^[VAC][\d-]/i.test(token) || /^V-easy$/i.test(token)) break;
    kept.push(token);
  }
  return kept.join(' ') || rating;
}

function deriveSendStatus(style: string, leadStyle: string): SendStatus {
  if (style === 'Lead') return (leadStyle as SendStatus) || 'Lead';
  if (style === '') return 'Unknown';
  return style as SendStatus;
}

/**
 * Partners come out of the notes, where they're written `w/ Emilia` — but not
 * at the start: Mountain Project prefixes its own style text, so most rows read
 * `Flash. w/ Joseph`. Names separate with `&`, a comma, `and` or a colon
 * (`w/ SPI class: Karsten, Emil`), and end where the prose resumes
 * (`w/ Jessica from Coalition Crag meetup`), so a name is the leading run of
 * capitalised words. That run is what keeps gear notes ("w/ a #2 cam") from
 * becoming phantom climbing partners.
 */
export function parsePartners(notes: string): string[] {
  const found: string[] = [];
  for (const match of notes.matchAll(/\bw\/(?!o\b)\s*([^.!?\n]*)/gi)) {
    for (const candidate of match[1].split(/&|,|:| and /i)) {
      const name = /^\s*(\p{Lu}[\p{L}'’-]*(?:\s+\p{Lu}[\p{L}'’-]*){0,2})/u
        .exec(candidate)?.[1]
        // "w/ Ian's rope" is a thing, not a person.
        .replace(/['’]s$/, '');
      // Acronyms are gyms and clubs (YMCA, SPI, UCD), never how a partner is written.
      if (name && name.length <= 30 && name !== name.toUpperCase()) found.push(name);
    }
  }
  return [...new Set(found)];
}
