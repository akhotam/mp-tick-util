import type { Scale, SendStatus, Tick } from './derive.ts';

/**
 * The six buckets the pyramid stacks, hardest-earned first. They map onto
 * categorical slots 1–6 in this order, which is the order the palette was
 * validated in — changing it changes which colours sit next to each other.
 */
export const SEND_GROUPS = ['Onsight', 'Flash', 'Redpoint', 'Fell/Hung', 'Toprope', 'Other'] as const;
export type SendGroup = (typeof SEND_GROUPS)[number];

const GROUP_OF: Partial<Record<SendStatus, SendGroup>> = {
  Onsight: 'Onsight',
  Flash: 'Flash',
  Redpoint: 'Redpoint',
  Pinkpoint: 'Redpoint',
  'Fell/Hung': 'Fell/Hung',
  TR: 'Toprope',
  Follow: 'Toprope',
};

export function sendGroup(status: SendStatus): SendGroup {
  return GROUP_OF[status] ?? 'Other';
}

export interface Summary {
  ticks: number;
  routes: number;
  pitches: number;
  feet: number;
  days: number;
  crags: number;
  firstDate: string;
  lastDate: string;
  hardestOnsight: string;
  hardestRedpoint: string;
}

export function summarise(ticks: Tick[]): Summary {
  const hardest = (statuses: SendStatus[]) => {
    const best = ticks
      .filter((t) => t.scale === 'yds' && statuses.includes(t.sendStatus))
      .reduce<Tick | null>((max, t) => (!max || t.ratingCode > max.ratingCode ? t : max), null);
    return best?.gradeLabel ?? '—';
  };

  const dates = ticks.map((t) => t.date).sort();
  return {
    ticks: ticks.length,
    routes: new Set(ticks.map((t) => t.routeId)).size,
    pitches: ticks.reduce((sum, t) => sum + t.pitches, 0),
    feet: ticks.reduce((sum, t) => sum + (t.length ?? 0), 0),
    days: new Set(dates).size,
    crags: new Set(ticks.map((t) => t.location)).size,
    firstDate: dates[0] ?? '',
    lastDate: dates.at(-1) ?? '',
    hardestOnsight: hardest(['Onsight']),
    hardestRedpoint: hardest(['Redpoint', 'Pinkpoint', 'Flash']),
  };
}

export interface MonthPoint {
  month: string;
  label: string;
  ticks: number;
  pitches: number;
}

/** Empty months are filled in, so a gap in the climbing reads as a gap. */
export function byMonth(ticks: Tick[]): MonthPoint[] {
  if (ticks.length === 0) return [];
  const counts = new Map<string, MonthPoint>();
  for (const tick of ticks) {
    const point = counts.get(tick.month) ?? { month: tick.month, label: monthLabel(tick.month), ticks: 0, pitches: 0 };
    point.ticks += 1;
    point.pitches += tick.pitches;
    counts.set(tick.month, point);
  }

  const months = [...counts.keys()].sort();
  const filled: MonthPoint[] = [];
  const cursor = new Date(`${months[0]}-01T00:00:00Z`);
  const end = new Date(`${months.at(-1)}-01T00:00:00Z`);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 7);
    filled.push(counts.get(key) ?? { month: key, label: monthLabel(key), ticks: 0, pitches: 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return filled;
}

function monthLabel(month: string): string {
  const [year, m] = month.split('-');
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1]} ${year}`;
}

export type GradeRow = { code: number; label: string; total: number } & Record<SendGroup, number>;

export function byGrade(ticks: Tick[], scale: Scale): GradeRow[] {
  const rows = new Map<number, GradeRow>();
  for (const tick of ticks) {
    if (tick.scale !== scale) continue;
    let row = rows.get(tick.ratingCode);
    if (!row) {
      row = { code: tick.ratingCode, label: tick.gradeLabel, total: 0 } as GradeRow;
      for (const group of SEND_GROUPS) row[group] = 0;
      rows.set(tick.ratingCode, row);
    }
    row[sendGroup(tick.sendStatus)] += 1;
    row.total += 1;
  }
  return [...rows.values()].sort((a, b) => a.code - b.code);
}

export interface ProgressionPoint {
  quarter: string;
  onsight: number | null;
  onsightLabel: string;
  redpoint: number | null;
  redpointLabel: string;
}

/** Hardest clean lead per quarter — the shape of getting better. */
export function progression(ticks: Tick[]): ProgressionPoint[] {
  const quarters = new Map<string, { onsight: Tick | null; redpoint: Tick | null }>();
  for (const tick of ticks) {
    if (tick.scale !== 'yds' || !tick.isLead) continue;
    const quarter = `${tick.year} Q${Math.floor(Number(tick.date.slice(5, 7)) / 3.01) + 1}`;
    const entry = quarters.get(quarter) ?? { onsight: null, redpoint: null };
    if (tick.sendStatus === 'Onsight' && (!entry.onsight || tick.ratingCode > entry.onsight.ratingCode)) {
      entry.onsight = tick;
    }
    if (
      ['Redpoint', 'Pinkpoint', 'Flash'].includes(tick.sendStatus) &&
      (!entry.redpoint || tick.ratingCode > entry.redpoint.ratingCode)
    ) {
      entry.redpoint = tick;
    }
    quarters.set(quarter, entry);
  }

  return [...quarters.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([quarter, { onsight, redpoint }]) => ({
      quarter,
      onsight: onsight?.ratingCode ?? null,
      onsightLabel: onsight?.gradeLabel ?? '',
      redpoint: redpoint?.ratingCode ?? null,
      redpointLabel: redpoint?.gradeLabel ?? '',
    }));
}

export interface AreaRow {
  name: string;
  path: string;
  ticks: number;
  pitches: number;
  feet: number;
  routes: number;
  firstVisit: string;
  lastVisit: string;
}

/** One level of the location hierarchy at a time, below `prefix`. */
export function byArea(ticks: Tick[], prefix: string): AreaRow[] {
  const depth = prefix ? prefix.split(' > ').length : 0;
  const rows = new Map<string, AreaRow & { routeIds: Set<string> }>();

  for (const tick of ticks) {
    if (prefix && !tick.location.startsWith(prefix)) continue;
    const name = tick.areaPath[depth];
    if (!name) continue;
    const path = tick.areaPath.slice(0, depth + 1).join(' > ');
    const row =
      rows.get(path) ??
      {
        name,
        path,
        ticks: 0,
        pitches: 0,
        feet: 0,
        routes: 0,
        firstVisit: tick.date,
        lastVisit: tick.date,
        routeIds: new Set<string>(),
      };
    row.ticks += 1;
    row.pitches += tick.pitches;
    row.feet += tick.length ?? 0;
    row.routeIds.add(tick.routeId);
    if (tick.date < row.firstVisit) row.firstVisit = tick.date;
    if (tick.date > row.lastVisit) row.lastVisit = tick.date;
    rows.set(path, row);
  }

  return [...rows.values()]
    .map(({ routeIds, ...row }) => ({ ...row, routes: routeIds.size }))
    .sort((a, b) => b.ticks - a.ticks);
}

export interface PartnerRow {
  name: string;
  ticks: number;
  days: number;
  hardest: string;
  firstDate: string;
  lastDate: string;
}

export function byPartner(ticks: Tick[]): PartnerRow[] {
  const rows = new Map<string, { ticks: Tick[]; days: Set<string> }>();
  for (const tick of ticks) {
    for (const partner of tick.partners) {
      const row = rows.get(partner) ?? { ticks: [], days: new Set<string>() };
      row.ticks.push(tick);
      row.days.add(tick.date);
      rows.set(partner, row);
    }
  }

  return [...rows.entries()]
    .map(([name, { ticks: theirs, days }]) => {
      const dates = theirs.map((t) => t.date).sort();
      const hardest = theirs
        .filter((t) => t.scale === 'yds')
        .reduce<Tick | null>((max, t) => (!max || t.ratingCode > max.ratingCode ? t : max), null);
      return {
        name,
        ticks: theirs.length,
        days: days.size,
        hardest: hardest?.gradeLabel ?? '—',
        firstDate: dates[0],
        lastDate: dates.at(-1)!,
      };
    })
    .sort((a, b) => b.ticks - a.ticks);
}

export interface RepeatRow {
  route: string;
  url: string;
  grade: string;
  location: string;
  ascents: number;
  lastDate: string;
}

export function mostRepeated(ticks: Tick[]): RepeatRow[] {
  const rows = new Map<string, RepeatRow>();
  for (const tick of ticks) {
    const row = rows.get(tick.routeId) ?? {
      route: tick.route,
      url: tick.url,
      grade: tick.gradeLabel,
      location: tick.location,
      ascents: 0,
      lastDate: tick.date,
    };
    row.ascents += 1;
    if (tick.date > row.lastDate) row.lastDate = tick.date;
    rows.set(tick.routeId, row);
  }
  return [...rows.values()].filter((r) => r.ascents > 1).sort((a, b) => b.ascents - a.ascents);
}

/** Share of each year's ticks that were routes climbed for the first time. */
export function newVsRepeat(ticks: Tick[]): { year: number; first: number; repeat: number }[] {
  const years = new Map<number, { year: number; first: number; repeat: number }>();
  for (const tick of ticks) {
    const row = years.get(tick.year) ?? { year: tick.year, first: 0, repeat: 0 };
    if (tick.ascentNumber === 1) row.first += 1;
    else row.repeat += 1;
    years.set(tick.year, row);
  }
  return fillYears(years, (year) => ({ year, first: 0, repeat: 0 }));
}

/**
 * Years with no climbing still get a row. Without them the axis skips straight
 * from 2018 to 2020 and a two-year gap reads as a steady climb.
 */
function fillYears<T extends { year: number }>(rows: Map<number, T>, empty: (year: number) => T): T[] {
  const years = [...rows.keys()].sort((a, b) => a - b);
  if (years.length === 0) return [];
  const filled: T[] = [];
  for (let year = years[0]; year <= years.at(-1)!; year += 1) {
    filled.push(rows.get(year) ?? empty(year));
  }
  return filled;
}

/** Share of leads at each grade that went first try, with no prior knowledge. */
export function onsightRate(ticks: Tick[]): { label: string; code: number; rate: number; leads: number }[] {
  const rows = new Map<number, { label: string; code: number; onsights: number; leads: number }>();
  for (const tick of ticks) {
    if (!tick.isLead || tick.scale !== 'yds') continue;
    const row = rows.get(tick.ratingCode) ?? {
      label: tick.gradeLabel,
      code: tick.ratingCode,
      onsights: 0,
      leads: 0,
    };
    row.leads += 1;
    if (tick.sendStatus === 'Onsight') row.onsights += 1;
    rows.set(tick.ratingCode, row);
  }
  return [...rows.values()]
    .filter((r) => r.leads >= 3)
    .sort((a, b) => a.code - b.code)
    .map(({ onsights, leads, ...rest }) => ({ ...rest, leads, rate: onsights / leads }));
}

export function byDay(ticks: Tick[]): Map<string, number> {
  const days = new Map<string, number>();
  for (const tick of ticks) days.set(tick.date, (days.get(tick.date) ?? 0) + 1);
  return days;
}

export function disciplineMix(ticks: Tick[]): { year: number; Sport: number; Trad: number; Boulder: number; Other: number }[] {
  const years = new Map<number, { year: number; Sport: number; Trad: number; Boulder: number; Other: number }>();
  for (const tick of ticks) {
    const row = years.get(tick.year) ?? { year: tick.year, Sport: 0, Trad: 0, Boulder: 0, Other: 0 };
    // A route can carry several types; count it under the leading one so the
    // stack still sums to the tick count.
    if (tick.disciplines.includes('Sport')) row.Sport += 1;
    else if (tick.disciplines.includes('Trad')) row.Trad += 1;
    else if (tick.disciplines.includes('Boulder')) row.Boulder += 1;
    else row.Other += 1;
    years.set(tick.year, row);
  }
  return fillYears(years, (year) => ({ year, Sport: 0, Trad: 0, Boulder: 0, Other: 0 }));
}
