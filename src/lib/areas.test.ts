import { describe, expect, it } from 'vitest';
import { isSubdivision, normalizeAreaPath } from './areas.ts';

const split = (location: string) => location.split(' > ');

describe('normalizeAreaPath', () => {
  it('leaves domestic paths alone', () => {
    const path = split('Colorado > Boulder Canyon > The Dome');
    expect(normalizeAreaPath(path)).toEqual(path);
  });

  it('promotes the province when Mountain Project models one', () => {
    expect(
      normalizeAreaPath(
        split('International > North America > Canada > Alberta > Banff National Park > Cascade Mountain'),
      ),
    ).toEqual(['Alberta', 'Banff National Park', 'Cascade Mountain']);
  });

  it('promotes the country when it has no subdivisions in the tree', () => {
    expect(normalizeAreaPath(split('International > Asia > Thailand > Krabi > Tonsai'))).toEqual([
      'Thailand',
      'Krabi',
      'Tonsai',
    ]);
  });

  it('keeps the country when its child is a region rather than a province', () => {
    expect(normalizeAreaPath(split('International > Europe > Germany > Frankenjura'))).toEqual([
      'Germany',
      'Frankenjura',
    ]);
  });

  it('matches subdivision names through accents and casing', () => {
    expect(normalizeAreaPath(split('International > North America > Mexico > Nuevo León > El Potrero Chico')))
      .toEqual(['Nuevo León', 'El Potrero Chico']);
    expect(isSubdivision('Spain', 'Andalucía')).toBe(true);
    expect(isSubdivision('UK', 'Scotland')).toBe(true);
  });

  it('falls back to the continent when that is all the path has', () => {
    expect(normalizeAreaPath(split('International > Antarctica'))).toEqual(['Antarctica']);
  });

  it('never drops a country down to nothing', () => {
    expect(normalizeAreaPath(split('International > North America > Canada'))).toEqual(['Canada']);
  });
});
