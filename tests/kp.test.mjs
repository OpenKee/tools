import test from 'node:test'
import assert from 'node:assert/strict'
import { KP_BANDS, kpBand, kpVisibleLat } from '../src/lib/kp.js'

test('kpBand follows the shared 0–3 / 4–5 / 6–7 / 8–9 scale', () => {
  assert.equal(kpBand(0).key, 'low')
  assert.equal(kpBand(3.9).key, 'low')
  assert.equal(kpBand(4).key, 'med')
  assert.equal(kpBand(5.9).key, 'med')
  assert.equal(kpBand(6).key, 'high')
  assert.equal(kpBand(7.9).key, 'high')
  assert.equal(kpBand(8).key, 'storm')
  assert.equal(kpBand(9).key, 'storm')
})

test('kpBand handles missing values', () => {
  assert.equal(kpBand(null), null)
  assert.equal(kpBand(undefined), null)
  assert.equal(kpBand('not-a-number'), null)
})

test('kpVisibleLat uses the same 66 - 2 × Kp approximation everywhere', () => {
  assert.equal(kpVisibleLat(0), 66)
  assert.equal(kpVisibleLat(2.3), 61)
  assert.equal(kpVisibleLat(9), 48)
  assert.equal(kpVisibleLat(null), null)
})

test('every Kp band has a distinct color', () => {
  assert.equal(KP_BANDS.length, 4)
  assert.equal(new Set(KP_BANDS.map((band) => band.color)).size, 4)
})
