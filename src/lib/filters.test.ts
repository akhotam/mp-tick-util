import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deriveTicks } from './derive.ts';
import { applyFilters, EMPTY_FILTERS, fromParams, isFiltered, SOLO, toParams } from './filters.ts';
import type { Logbook } from './types.ts';

const logbook: Logbook = JSON.parse(readFileSync('public/logbook.json', 'utf8'));
const ticks = deriveTicks(logbook);

describe('partner filter', () => {
  it('keeps only ticks naming the chosen partner', () => {
    const name = ticks.flatMap((t) => t.partners)[0];
    const matched = applyFilters(ticks, { ...EMPTY_FILTERS, partner: name });
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.every((t) => t.partners.includes(name))).toBe(true);
  });

  it('keeps only partnerless ticks when solo is chosen', () => {
    const matched = applyFilters(ticks, { ...EMPTY_FILTERS, partner: SOLO });
    expect(matched.every((t) => t.partners.length === 0)).toBe(true);
    expect(matched).toHaveLength(ticks.filter((t) => !t.deleted && t.partners.length === 0).length);
  });

  it('splits the logbook cleanly between solo and anyone', () => {
    const all = applyFilters(ticks, EMPTY_FILTERS);
    const solo = applyFilters(ticks, { ...EMPTY_FILTERS, partner: SOLO });
    const withSomeone = all.filter((t) => t.partners.length > 0);
    expect(solo.length + withSomeone.length).toBe(all.length);
  });

  it('cannot be shadowed by a parsed partner name', () => {
    expect(ticks.flatMap((t) => t.partners)).not.toContain(SOLO);
  });

  it('round-trips solo through the URL', () => {
    const filters = { ...EMPTY_FILTERS, partner: SOLO };
    expect(isFiltered(filters)).toBe(true);
    expect(fromParams(new URLSearchParams(toParams(filters).toString()))).toEqual(filters);
  });
});
