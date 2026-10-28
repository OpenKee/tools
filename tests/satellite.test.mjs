import test from 'node:test'
import assert from 'node:assert/strict'
import { twoline2satrec, propagate, gstime, eciToEcf, ecfToLookAngles } from '../src/lib/satellite.js'

test('satellite.js wrapper exposes the SGP4 functions used by ISS passes', () => {
  for (const fn of [twoline2satrec, propagate, gstime, eciToEcf, ecfToLookAngles]) {
    assert.equal(typeof fn, 'function')
  }
})
