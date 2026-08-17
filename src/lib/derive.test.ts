import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deriveTicks, gradeLabel, parsePartners, scaleOf } from './derive.ts';
import type { Logbook, RawTick, TickRecord } from './types.ts';

/** The committed logbook — the merge of the two exports in `data/`. */
const logbook: Logbook = JSON.parse(readFileSync('public/logbook.json', 'utf8'));
const ticks = deriveTicks(logbook);

/** A one-off record for cases the committed fixture doesn't happen to contain. */
function record(raw: Partial<RawTick>): TickRecord {
  return {
    id: 'test',
    raw: {
      Date: '2026-05-01',
      Route: 'Test',
      Rating: '5.9',
      Notes: '',
      URL: 'https://www.mountainproject.com/route/999999999/test',
      Pitches: '1',
      Location: 'Colorado > Fake Canyon > Dummy Crag',
      'Avg Stars': '2.0',
      'Your Stars': '-1',
      Style: 'Lead',
      'Lead Style': 'Onsight',
      'Route Type': 'Sport',
      'Your Rating': '',
      Length: '60',
      'Rating Code': '2400',
      ...raw,
    },
    first_seen: 'test.csv',
    last_seen: 'test.csv',
    deleted: false,
    deleted_at: null,
    edits: [],
  };
}

const asLogbook = (records: TickRecord[]): Logbook => ({ version: 1, snapshots: [], ticks: records });

describe('parsePartners', () => {
  it('finds names anywhere in the note, not just at the start', () => {
    expect(parsePartners('w/ Emilia. Pretty fun')).toEqual(['Emilia']);
    expect(parsePartners('Flash. w/ Joseph')).toEqual(['Joseph']);
    expect(parsePartners('Fell / Hung. w/ Joseph. Figured out the beta')).toEqual(['Joseph']);
  });

  it('splits multiple partners', () => {
    expect(parsePartners('w/ Emilia & Jessica. Tricky crux')).toEqual(['Emilia', 'Jessica']);
    expect(parsePartners('w/ Emilia, Joseph and Ian')).toEqual(['Emilia', 'Joseph', 'Ian']);
  });

  it('stops the name where the prose resumes', () => {
    expect(parsePartners('Flash w/ Jessica from Coalition Crag meetup. Pumpy')).toEqual(['Jessica']);
    expect(parsePartners('Flash w/ John F Kim from Coalition Crag meetup')).toEqual(['John F Kim']);
  });

  it('does not turn gear or lowercase words into people', () => {
    expect(parsePartners('Sent it w/ a #2 cam and a lot of luck')).toEqual([]);
    expect(parsePartners('Soloed w/o a rope')).toEqual([]);
    expect(parsePartners('Great day out')).toEqual([]);
  });

  it('reads a gym or club as a place, not a person', () => {
    expect(parsePartners('onsight w/ YMCA')).toEqual([]);
    expect(parsePartners('redpoint w/ Kristen, Alison, UCD climbing club')).toEqual([
      'Kristen',
      'Alison',
    ]);
    expect(parsePartners('Repeat. w/ SPI class: Karsten, Emil, Kelsey')).toEqual([
      'Karsten',
      'Emil',
      'Kelsey',
    ]);
    expect(parsePartners("w/ Ian's rope")).toEqual(['Ian']);
  });

  it('covers the notes in the logbook, missing only the solo', () => {
    const withPartners = ticks.filter((t) => t.partners.length > 0);
    expect(withPartners).toHaveLength(19);

    // What's left is the one ascent climbed alone, whose note names nobody.
    const alone = ticks.filter((t) => t.partners.length === 0);
    expect(alone.map((t) => t.route)).toEqual(['Solo Test']);
    expect(
      alone.filter((t) => /solo/i.test(t.notes) || t.style === 'Solo' || !/\bw\//i.test(t.notes)),
    ).toHaveLength(1);

    const counts = new Map<string, number>();
    for (const tick of ticks) {
      for (const partner of tick.partners) counts.set(partner, (counts.get(partner) ?? 0) + 1);
    }
    expect([...counts].sort()).toEqual([
      ['Priya', 6],
      ['Theo', 6],
      ['Zara', 7],
    ]);
    expect([...counts.keys()].every((name) => /^\p{Lu}/u.test(name))).toBe(true);
  });
});

describe('grades', () => {
  it('separates the V scale by rating code, not by route type', () => {
    // A boulder-tagged route with a YDS grade belongs on the roped axis. No such
    // row is in the fixture, so this one is built by hand.
    const [yds] = deriveTicks(
      asLogbook([record({ Rating: '5.9 V0', 'Route Type': 'Boulder', 'Rating Code': '2400' })]),
    );
    expect(yds.scale).toBe('yds');
    expect(yds.gradeLabel).toBe('5.9');
    expect(yds.disciplines).toContain('Boulder');

    const v = ticks.find((t) => t.rating === 'V2');
    expect(v?.scale).toBe('v');
    expect(v?.gradeLabel).toBe('V2');
    expect(v?.ratingCode).toBeGreaterThanOrEqual(20000);
  });

  it('strips safety and aid suffixes so one code gets one label', () => {
    expect(gradeLabel('5.8 PG13', 2100)).toBe('5.8');
    expect(gradeLabel('5.8 C2', 2100)).toBe('5.8');
    expect(gradeLabel('5.10a V1- R', 3100)).toBe('5.10a');
    expect(gradeLabel('5.6 V-easy R', 1600)).toBe('5.6');
    expect(gradeLabel('5.10b/c', 3300)).toBe('5.10b/c');
    expect(gradeLabel('3rd V0 PG13', 800)).toBe('3rd');
    expect(scaleOf(0)).toBe('ungraded');
  });

  it('gives every rating code exactly one label across the whole logbook', () => {
    const labels = new Map<number, Set<string>>();
    for (const tick of ticks) {
      if (tick.scale === 'ungraded') continue;
      const set = labels.get(tick.ratingCode) ?? new Set();
      set.add(tick.gradeLabel);
      labels.set(tick.ratingCode, set);
    }
    const ambiguous = [...labels].filter(([, set]) => set.size > 1);
    expect(ambiguous).toEqual([]);
    expect(labels.size).toBeGreaterThan(1);
  });
});

describe('deriveTicks', () => {
  it('numbers repeat ascents of a route in date order', () => {
    // Sample Slab, ticked twice on 2026-01-12.
    const byRoute = ticks.filter((t) => t.routeId === '900000103');
    expect(byRoute.length).toBeGreaterThan(1);
    expect(byRoute.map((t) => t.ascentNumber)).toEqual(byRoute.map((_, i) => i + 1));
    expect(byRoute[0].date <= byRoute[1].date).toBe(true);
  });

  it('reads style, location and discipline out of every row', () => {
    expect(ticks).toHaveLength(20);
    expect(ticks.every((t) => t.state !== 'Unknown')).toBe(true);
    expect(ticks.every((t) => t.state === 'Colorado')).toBe(true);
    expect(ticks.filter((t) => t.sendStatus === 'Onsight')).toHaveLength(6);
    expect(ticks.filter((t) => t.isLead)).toHaveLength(10);
    expect(ticks.filter((t) => t.disciplines.includes('Trad'))).toHaveLength(12);

    // "Trad, TR" is two disciplines on one tick, not one string.
    const both = ticks.find((t) => t.route === 'Multi Value Type');
    expect(both?.disciplines).toEqual(['Trad', 'TR']);

    const multipitch = ticks.find((t) => t.pitches > 1);
    expect(multipitch?.route).toBe('Two Pitch Test');
    expect(multipitch?.pitches).toBe(2);
  });

  it('carries the deleted flag through to the derived tick', () => {
    expect(ticks.filter((t) => t.deleted).map((t) => t.route)).toEqual([
      'Fake Buttress',
      'Ghost Crack',
    ]);
  });

  it('leaves length null when the export has none', () => {
    expect(ticks.find((t) => t.route === 'Empty Length Route')?.length).toBe(null);
    expect(ticks.find((t) => t.route === 'Fake Buttress')?.length).toBe(60);
  });
});
