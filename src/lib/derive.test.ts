import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deriveTicks, gradeLabel, parsePartners, scaleOf } from './derive.ts';
import type { Logbook } from './types.ts';

const logbook: Logbook = JSON.parse(readFileSync('public/logbook.json', 'utf8'));
const ticks = deriveTicks(logbook);

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

  it('covers the notes in the real logbook, missing only the solos', () => {
    const withPartners = ticks.filter((t) => t.partners.length > 0);
    expect(withPartners).toHaveLength(773);

    // What's left is 23 ascents genuinely climbed alone, plus one gym session.
    const alone = ticks.filter((t) => t.partners.length === 0);
    expect(alone).toHaveLength(24);
    expect(
      alone.filter((t) => /solo/i.test(t.notes) || t.style === 'Solo' || !/\bw\//i.test(t.notes)),
    ).toHaveLength(23);

    const counts = new Map<string, number>();
    for (const tick of ticks) {
      for (const partner of tick.partners) counts.set(partner, (counts.get(partner) ?? 0) + 1);
    }
    expect(counts.get('Emilia')).toBeGreaterThan(400);
    expect([...counts.keys()].every((name) => /^\p{Lu}/u.test(name))).toBe(true);
  });
});

describe('grades', () => {
  it('separates the V scale by rating code, not by route type', () => {
    // A boulder-tagged route with a YDS grade belongs on the roped axis.
    const yds = ticks.find((t) => t.rating === '5.9 V0');
    expect(yds?.scale).toBe('yds');
    expect(yds?.gradeLabel).toBe('5.9');
    expect(yds?.disciplines).toContain('Boulder');

    const v = ticks.find((t) => t.rating === 'V2');
    expect(v?.scale).toBe('v');
    expect(v?.gradeLabel).toBe('V2');
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
  });
});

describe('deriveTicks', () => {
  it('numbers repeat ascents of a route in date order', () => {
    const byRoute = ticks.filter((t) => t.routeId === '105862735');
    expect(byRoute.length).toBeGreaterThan(1);
    expect(byRoute.map((t) => t.ascentNumber)).toEqual(byRoute.map((_, i) => i + 1));
    expect(byRoute[0].date <= byRoute[1].date).toBe(true);
  });

  it('reads style, location and discipline out of every row', () => {
    expect(ticks).toHaveLength(797);
    expect(ticks.every((t) => t.state !== 'Unknown')).toBe(true);
    expect(ticks.filter((t) => t.sendStatus === 'Onsight')).toHaveLength(191);
    expect(ticks.filter((t) => t.isLead)).toHaveLength(357);
    expect(ticks.filter((t) => t.disciplines.includes('Trad')).length).toBeGreaterThan(190);

    const multipitch = ticks.find((t) => t.pitches > 1);
    expect(multipitch?.pitches).toBeGreaterThan(1);
  });
});
