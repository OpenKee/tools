import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseMslSoles,
  seasonFromLs,
  oppositeSeason,
  MARS_SEASONS,
  approxSolarLongitude,
  mslSolFromDate,
  mslDateForSol,
  buildMockSols,
} from '../src/lib/mars.js'

test('seasonFromLs maps solar longitude to northern-hemisphere seasons', () => {
  assert.equal(seasonFromLs(0).key, 'spring')
  assert.equal(seasonFromLs(89.9).key, 'spring')
  assert.equal(seasonFromLs(90).key, 'summer')
  assert.equal(seasonFromLs(180).key, 'autumn')
  assert.equal(seasonFromLs(269.9).key, 'autumn')
  assert.equal(seasonFromLs(270).key, 'winter')
  assert.equal(seasonFromLs(359.9).key, 'winter')

  assert.equal(seasonFromLs(360).key, 'spring')
  assert.equal(seasonFromLs(-10).key, 'winter')
  assert.equal(seasonFromLs(450).key, 'summer')
})

test('oppositeSeason flips hemispheres', () => {
  const byKey = Object.fromEntries(MARS_SEASONS.map((s) => [s.key, s]))
  assert.equal(oppositeSeason(byKey.spring).key, 'autumn')
  assert.equal(oppositeSeason(byKey.winter).key, 'summer')
  assert.equal(oppositeSeason(byKey.summer).key, 'winter')
  assert.equal(oppositeSeason(byKey.autumn).key, 'spring')
})

test('parseMslSoles drops empty rows, dedupes and sorts by Sol', () => {
  const raw = {
    soles: {
      0: {
        sol: '9',
        terrestrial_date: '2026-08-19',
        ls: '337',
        min_temp: '-72',
        max_temp: '-6',
        pressure: '778',
        min_gts_temp: '-86',
        max_gts_temp: '2',
        local_uv_irradiance_index: 'Moderate',
        atmo_opacity: 'Sunny',
        sunrise: '06:44',
        sunset: '18:50',
        wind_speed: '--',
        wind_direction: '--',
      },
      1: { sol: '8', min_temp: '--', max_temp: '--' },
      2: {
        sol: '10',
        terrestrial_date: '2026-08-20',
        ls: '338',
        min_temp: '-70',
        max_temp: '-8',
        pressure: '--',
        min_gts_temp: '--',
        max_gts_temp: '--',
        local_uv_irradiance_index: '--',
        atmo_opacity: 'Cloudy',
        sunrise: '06:45',
        sunset: '18:50',
      },
      3: {
        sol: '10',
        terrestrial_date: '2026-08-20',
        ls: '338',
        min_temp: '-70',
        max_temp: '-7',
        pressure: '779',
      },
    },
  }

  const days = parseMslSoles(raw, 7)
  assert.equal(days.length, 2)
  assert.deepEqual(
    days.map((d) => d.sol),
    [9, 10],
  )

  assert.equal(days[1].maxTemp, -7)
  assert.equal(days[0].minTemp, -72)
  assert.equal(days[0].groundMax, 2)
  assert.equal(days[0].sunrise, '06:44')
  assert.equal(days[0].simulated, false)

  assert.equal(days[1].uv, null)
  assert.equal(days[1].pressure, 779)

  assert.equal(parseMslSoles(raw, 1).length, 1)
  assert.equal(parseMslSoles(raw, 1)[0].sol, 10)
  assert.deepEqual(parseMslSoles(null, 7), [])
  assert.deepEqual(parseMslSoles({}, 7), [])
})

test('parseMslSoles accepts array-shaped soles', () => {
  const raw = {
    soles: [
      { sol: '2', min_temp: '-60', max_temp: '-10' },
      { sol: '1', min_temp: '-70', max_temp: '-20' },
    ],
  }
  const days = parseMslSoles(raw, 7)
  assert.deepEqual(
    days.map((d) => d.sol),
    [1, 2],
  )
})

test('MSL sol <-> date conversion round-trips', () => {
  const date = new Date(Date.UTC(2026, 7, 25, 12))
  const sol = mslSolFromDate(date)
  const back = mslDateForSol(sol)
  assert.equal(back.toISOString().slice(0, 10), '2026-08-25')
  assert.ok(sol > 4900)
})

test('approxSolarLongitude is close to observed Ls values', () => {
  const springEquinox = approxSolarLongitude(new Date(Date.UTC(1955, 3, 11)))
  assert.ok(springEquinox < 1 || springEquinox > 359)
  const aug2026 = approxSolarLongitude(new Date(Date.UTC(2026, 7, 25)))
  assert.ok(Math.abs(aug2026 - 341) < 2, `expected ~341, got ${aug2026}`)
})

test('buildMockSols produces a sane, clearly marked fallback', () => {
  const now = new Date(Date.UTC(2026, 9, 27))
  const days = buildMockSols(now, 7)
  assert.equal(days.length, 7)
  assert.equal(days[0].sol, mslSolFromDate(now) - 6)
  assert.equal(days[6].sol, mslSolFromDate(now))

  for (let i = 0; i < days.length; i++) {
    const d = days[i]
    assert.equal(d.simulated, true)
    assert.match(d.date, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(d.ls >= 0 && d.ls < 360)
    assert.ok(Number.isFinite(d.minTemp) && Number.isFinite(d.maxTemp))
    assert.ok(d.maxTemp > d.minTemp)
    assert.ok(d.groundMax > d.maxTemp)
    assert.ok(d.groundMin < d.minTemp)
    assert.ok(d.pressure > 500 && d.pressure < 1000)
    assert.match(d.sunrise, /^\d{2}:\d{2}$/)
    assert.match(d.sunset, /^\d{2}:\d{2}$/)
    if (i > 0) assert.ok(d.sol > days[i - 1].sol)
  }
})
