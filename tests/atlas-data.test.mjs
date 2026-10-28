import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  wbCode,
  bestByIso,
  applyPopulationFallback,
  normalizeAtlasQuery,
  buildAtlasQuery,
} from '../src/lib/atlas-data.js'

const facts = JSON.parse(fs.readFileSync(new URL('../src/data/country-facts.json', import.meta.url), 'utf8'))

test('Kosovo uses the World Bank XKX code', () => {
  assert.equal(wbCode('UNK'), 'XKX')
  assert.equal(wbCode('CHN'), 'CHN')
})

test('bestByIso keeps the latest non-null year per country', () => {
  const map = bestByIso([
    { countryiso3code: 'CHN', date: '2024', value: 10 },
    { countryiso3code: 'CHN', date: '2025', value: 11 },
    { countryiso3code: 'CHN', date: '2026', value: null },
    { countryiso3code: 'USA', date: '2024', value: null },
    { countryiso3code: 'USA', date: '2023', value: 7 },
  ])
  assert.deepEqual(map.CHN, { value: 11, year: 2025 })
  assert.deepEqual(map.USA, { value: 7, year: 2023 })
})

test('population fallback fills missing values but never overwrites World Bank data', () => {
  const countries = [
    { cca3: 'TWN', stats: {} },
    { cca3: 'CHN', stats: { population: { value: 1400000000, year: 2025 } } },
    { cca3: 'ATA', stats: {} },
  ]
  applyPopulationFallback(countries, facts)
  assert.equal(countries[0].stats.population.value, facts.TWN.populationEst)
  assert.equal(countries[0].stats.population.estimated, true)
  assert.equal(countries[1].stats.population.value, 1400000000)
  assert.equal(countries[2].stats.population, undefined)
})

test('static facts keep the known fallback values', () => {
  assert.equal(facts.TWN.populationEst, 23400000)
  assert.equal(facts.VAT.populationEst, 800)
  assert.equal(facts.UNK.populationEst, 1576876)
  assert.equal(facts.ATA.populationEst, undefined)
})

test('query normalization accepts only known state and clean defaults', () => {
  const regions = ['', 'asia', 'europe']
  const sorts = ['pop', 'area', 'density', 'name']
  assert.deepEqual(
    normalizeAtlasQuery(
      { sort: 'area', region: 'asia', sovereign: 'true', country: 'chn', ignored: '1' },
      regions,
      sorts,
    ),
    { sort: 'area', region: 'asia', sovereign: '1', country: 'CHN' },
  )
  assert.deepEqual(normalizeAtlasQuery({ sort: 'pop', region: 'bogus' }, regions, sorts), {})
  assert.deepEqual(buildAtlasQuery({ sort: 'pop', region: '', sovereign: false }), {})
  assert.deepEqual(buildAtlasQuery({ sort: 'name', region: 'asia', sovereign: true, country: 'CHN' }), {
    sort: 'name',
    region: 'asia',
    sovereign: '1',
    country: 'CHN',
  })
})
