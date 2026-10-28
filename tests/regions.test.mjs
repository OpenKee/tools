import test from 'node:test'
import assert from 'node:assert/strict'
import { detectRegion } from '../src/lib/regions.js'

test('detectRegion prefers continents over oceans', () => {
  assert.deepEqual(detectRegion(39.9, 116.4), { en: 'Asia', zh: '亚洲' })
  assert.deepEqual(detectRegion(48.8, 2.3), { en: 'Europe', zh: '欧洲' })
  assert.deepEqual(detectRegion(-33.9, 151.2), { en: 'Australia', zh: '澳大利亚' })
})

test('detectRegion handles poles', () => {
  assert.deepEqual(detectRegion(80, 0), { en: 'Arctic region', zh: '北极地区' })
  assert.deepEqual(detectRegion(-80, 0), { en: 'Antarctic region', zh: '南极地区' })
})

test('detectRegion falls back to oceans, then open ocean', () => {
  assert.deepEqual(detectRegion(0, -150), { en: 'Pacific Ocean', zh: '太平洋' })
  assert.deepEqual(detectRegion(0, -30), { en: 'Atlantic Ocean', zh: '大西洋' })
  assert.deepEqual(detectRegion(-50, 0), { en: 'Open ocean', zh: '开阔海域' })
})
