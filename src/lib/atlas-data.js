export function wbCode(cca3) {
  return cca3 === 'UNK' ? 'XKX' : cca3
}

export function bestByIso(rows) {
  const map = {}
  for (const row of rows) {
    if (row.value == null || !row.countryiso3code) continue
    const year = Number(row.date)
    const prev = map[row.countryiso3code]
    if (!prev || year > prev.year) {
      map[row.countryiso3code] = { value: row.value, year }
    }
  }
  return map
}

export function applyPopulationFallback(countries, facts = {}) {
  for (const country of countries) {
    if (!country.stats) country.stats = {}
    if (country.stats.population) continue
    const estimate = facts[country.cca3]?.populationEst
    if (estimate) {
      country.stats.population = { value: estimate, year: null, estimated: true }
    }
  }
  return countries
}

export function normalizeAtlasQuery(query = {}, regions = [], sorts = []) {
  const out = {}
  if (typeof query.sort === 'string' && sorts.includes(query.sort) && query.sort !== 'pop') {
    out.sort = query.sort
  }
  if (typeof query.region === 'string' && regions.includes(query.region) && query.region) {
    out.region = query.region
  }
  if (query.sovereign === '1' || query.sovereign === 'true') {
    out.sovereign = '1'
  }
  if (typeof query.country === 'string' && /^[A-Za-z]{3}$/.test(query.country)) {
    out.country = query.country.toUpperCase()
  }
  return out
}

export function buildAtlasQuery({ sort, region, sovereign, country } = {}) {
  const out = {}
  if (sort && sort !== 'pop') out.sort = sort
  if (region) out.region = region
  if (sovereign) out.sovereign = '1'
  if (country) out.country = country
  return out
}
