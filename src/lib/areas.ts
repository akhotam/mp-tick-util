/**
 * Mountain Project files US crags starting at their state (`Colorado > Boulder
 * Canyon > …`) but files everything else under a single `International`
 * root, with a continent above the country: `International > North America >
 * Canada > Alberta > Banff National Park > …`. Left alone that puts every
 * foreign tick into one "International" bucket two levels above the first
 * thing worth comparing, while every US tick starts at a state.
 *
 * `normalizeAreaPath` drops the `International > <Continent>` prefix so both
 * sides start at the same kind of thing: the state or province where Mountain
 * Project models one, the country otherwise. `Alberta > Banff National Park`,
 * `Thailand > Krabi`.
 *
 * Whether the level below a country is an administrative division or just the
 * first crag region is not something the export tells us — the hierarchy is
 * untyped — so it is a lookup. `SUBDIVISIONS` lists, per country, the names
 * Mountain Project uses for that country's top-level divisions. A country
 * that is missing (or a child name that isn't in its list) simply stays at
 * country level, which is the safe direction to be wrong in: one extra click
 * in the drilldown rather than a crag masquerading as a province.
 *
 * To add a country: add its entry below. Names are matched case- and
 * accent-insensitively, so `Nuevo Leon` and `Nuevo León` both hit.
 */

const SUBDIVISIONS: Record<string, string[]> = {
  canada: [
    'Alberta',
    'British Columbia',
    'Manitoba',
    'New Brunswick',
    'Newfoundland and Labrador',
    'Northwest Territories',
    'Nova Scotia',
    'Nunavut',
    'Ontario',
    'Prince Edward Island',
    'Quebec',
    'Saskatchewan',
    'Yukon',
  ],
  australia: [
    'Australian Capital Territory',
    'New South Wales',
    'Northern Territory',
    'Queensland',
    'South Australia',
    'Tasmania',
    'Victoria',
    'Western Australia',
  ],
  mexico: [
    'Aguascalientes',
    'Baja California',
    'Baja California Sur',
    'Campeche',
    'Chiapas',
    'Chihuahua',
    'Coahuila',
    'Colima',
    'Durango',
    'Guanajuato',
    'Guerrero',
    'Hidalgo',
    'Jalisco',
    'Mexico City',
    'Michoacan',
    'Morelos',
    'Nayarit',
    'Nuevo Leon',
    'Oaxaca',
    'Puebla',
    'Queretaro',
    'Quintana Roo',
    'San Luis Potosi',
    'Sinaloa',
    'Sonora',
    'Tabasco',
    'Tamaulipas',
    'Tlaxcala',
    'Veracruz',
    'Yucatan',
    'Zacatecas',
  ],
  brazil: [
    'Acre',
    'Alagoas',
    'Amapa',
    'Amazonas',
    'Bahia',
    'Ceara',
    'Distrito Federal',
    'Espirito Santo',
    'Goias',
    'Maranhao',
    'Mato Grosso',
    'Mato Grosso do Sul',
    'Minas Gerais',
    'Para',
    'Paraiba',
    'Parana',
    'Pernambuco',
    'Piaui',
    'Rio de Janeiro',
    'Rio Grande do Norte',
    'Rio Grande do Sul',
    'Rondonia',
    'Roraima',
    'Santa Catarina',
    'Sao Paulo',
    'Sergipe',
    'Tocantins',
  ],
  spain: [
    'Andalucia',
    'Aragon',
    'Asturias',
    'Canarias',
    'Cantabria',
    'Castilla y Leon',
    'Castilla-La Mancha',
    'Catalunya',
    'Ceuta',
    'Comunidad Valenciana',
    'Extremadura',
    'Galicia',
    'Islas Baleares',
    'La Rioja',
    'Madrid',
    'Melilla',
    'Murcia',
    'Navarra',
    'Pais Vasco',
  ],
  'united kingdom': ['England', 'Northern Ireland', 'Scotland', 'Wales'],
  'south africa': [
    'Eastern Cape',
    'Free State',
    'Gauteng',
    'KwaZulu-Natal',
    'Limpopo',
    'Mpumalanga',
    'North West',
    'Northern Cape',
    'Western Cape',
  ],
};

/** Country names Mountain Project writes differently from the key above. */
const COUNTRY_ALIASES: Record<string, string> = {
  uk: 'united kingdom',
  'great britain': 'united kingdom',
};

function fold(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

const SUBDIVISION_SETS = new Map<string, Set<string>>(
  Object.entries(SUBDIVISIONS).map(([country, names]) => [country, new Set(names.map(fold))]),
);

/** Whether `child` is a state/province Mountain Project files under `country`. */
export function isSubdivision(country: string, child: string): boolean {
  const key = fold(country);
  return SUBDIVISION_SETS.get(COUNTRY_ALIASES[key] ?? key)?.has(fold(child)) ?? false;
}

/**
 * Rewrites an `International`-rooted path to start at its state/province, or
 * at its country where Mountain Project doesn't model one. Domestic paths and
 * anything that doesn't match the expected shape are returned untouched.
 */
export function normalizeAreaPath(path: string[]): string[] {
  if (path[0] !== 'International') return path;

  // `International > <Continent>` and nothing else: the continent is all we have.
  const belowContinent = path.slice(2);
  if (belowContinent.length === 0) return path.slice(1);

  const [country, child] = belowContinent;
  if (child && isSubdivision(country, child)) return belowContinent.slice(1);
  return belowContinent;
}
