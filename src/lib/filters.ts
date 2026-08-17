import type { SendStatus, Tick } from './derive.ts';

export interface Filters {
  from: string;
  to: string;
  /** Rating-code bounds — the sortable integer, not the grade string. */
  minCode: number;
  maxCode: number;
  disciplines: string[];
  sendStatus: SendStatus[];
  /** ' > '-joined prefix of the location hierarchy. */
  area: string;
  /** A partner's name, or `SOLO` for ticks with nobody named in the notes. */
  partner: string;
  q: string;
  /** Ticks Mountain Project has since dropped are hidden unless asked for. */
  includeDeleted: boolean;
}

/**
 * Sentinel for the partner filter's "solo" option: ticks where `parsePartners`
 * found nobody. The parens keep it out of reach of a real value — a parsed
 * name always starts with a capital letter — so no partner can ever shadow it.
 *
 * Worth remembering when reading the number: this is "no partner written in
 * the notes", which is not quite "climbed alone". Ticks where the notes simply
 * didn't mention anyone land here too. Mountain Project's own `Solo` style is
 * a separate thing, filtered through `sendStatus`.
 */
export const SOLO = '(solo)';

export const EMPTY_FILTERS: Filters = {
  from: '',
  to: '',
  minCode: 0,
  maxCode: Number.MAX_SAFE_INTEGER,
  disciplines: [],
  sendStatus: [],
  area: '',
  partner: '',
  q: '',
  includeDeleted: false,
};

export function applyFilters(ticks: Tick[], filters: Filters): Tick[] {
  const needle = filters.q.trim().toLowerCase();

  return ticks.filter((tick) => {
    if (!filters.includeDeleted && tick.deleted) return false;
    if (filters.from && tick.date < filters.from) return false;
    if (filters.to && tick.date > filters.to) return false;
    if (tick.ratingCode < filters.minCode || tick.ratingCode > filters.maxCode) return false;
    if (filters.disciplines.length > 0 && !filters.disciplines.some((d) => tick.disciplines.includes(d))) {
      return false;
    }
    if (filters.sendStatus.length > 0 && !filters.sendStatus.includes(tick.sendStatus)) return false;
    if (filters.area && !tick.location.startsWith(filters.area)) return false;
    if (filters.partner === SOLO) {
      if (tick.partners.length > 0) return false;
    } else if (filters.partner && !tick.partners.includes(filters.partner)) return false;
    if (needle) {
      const haystack = `${tick.route} ${tick.notes} ${tick.location}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

export function isFiltered(filters: Filters): boolean {
  return toParams(filters).size > 0;
}

/** Only non-default values are serialised, so a clean view has a clean URL. */
export function toParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.minCode !== EMPTY_FILTERS.minCode) params.set('min', String(filters.minCode));
  if (filters.maxCode !== EMPTY_FILTERS.maxCode) params.set('max', String(filters.maxCode));
  if (filters.disciplines.length > 0) params.set('type', filters.disciplines.join(','));
  if (filters.sendStatus.length > 0) params.set('send', filters.sendStatus.join(','));
  if (filters.area) params.set('area', filters.area);
  if (filters.partner) params.set('with', filters.partner);
  if (filters.q) params.set('q', filters.q);
  if (filters.includeDeleted) params.set('deleted', '1');
  return params;
}

export function fromParams(params: URLSearchParams): Filters {
  const list = (key: string) => params.get(key)?.split(',').filter(Boolean) ?? [];
  return {
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    minCode: Number(params.get('min') ?? EMPTY_FILTERS.minCode),
    maxCode: Number(params.get('max') ?? EMPTY_FILTERS.maxCode),
    disciplines: list('type'),
    sendStatus: list('send') as SendStatus[],
    area: params.get('area') ?? '',
    partner: params.get('with') ?? '',
    q: params.get('q') ?? '',
    includeDeleted: params.get('deleted') === '1',
  };
}
