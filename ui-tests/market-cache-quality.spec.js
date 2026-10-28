import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { fetchJSON } = vi.hoisted(() => ({ fetchJSON: vi.fn() }))
vi.mock('../src/ok.js', () => ({
  fetchJSON,
  lsGet: (key) => localStorage.getItem(key),
  lsSet: (key, value) => localStorage.setItem(key, value),
}))

const KEY = 'openkee-usd-rates-v1'
const TTL = 10 * 60 * 1000
const NOW = Date.UTC(2026, 9, 10, 12)
const data = { result: 'success', rates: { USD: 1, CNY: 7 }, time_last_update_utc: 'Sat, 10 Oct 2026 12:00:00 GMT' }
let getUsdRates

beforeEach(async () => {
  localStorage.clear()
  fetchJSON.mockReset()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  vi.resetModules()
  ;({ getUsdRates } = await import('../src/lib/markets.js'))
})
afterEach(() => vi.useRealTimers())

describe('USD rate cache freshness', () => {
  test('preserves the API return shape and the stored timestamp on fresh hits', async () => {
    const entry = { at: NOW - TTL + 1, data }
    localStorage.setItem(KEY, JSON.stringify(entry))
    expect(await getUsdRates()).toEqual(data)
    expect(await getUsdRates()).toEqual(data)
    expect(fetchJSON).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual(entry)
  })

  test.each([NOW - TTL, NOW - TTL - 1, NOW + 1, 'invalid', String(NOW), null])(
    'does not silently return an expired or invalid stored cache (%s) after failure',
    async (at) => {
      localStorage.setItem(KEY, JSON.stringify({ at, data }))
      fetchJSON.mockRejectedValue(new Error('offline'))
      await expect(getUsdRates()).rejects.toThrow('offline')
      expect(fetchJSON).toHaveBeenCalledTimes(1)
    },
  )

  test('does not return expired in-memory data after failure', async () => {
    fetchJSON.mockResolvedValueOnce(data)
    await getUsdRates()
    vi.setSystemTime(NOW + TTL)
    fetchJSON.mockRejectedValue(new Error('offline'))
    await expect(getUsdRates()).rejects.toThrow('offline')
  })

  test('rechecks freshness when a failed request crosses the TTL boundary', async () => {
    localStorage.setItem(KEY, JSON.stringify({ at: NOW - TTL + 1, data }))
    await getUsdRates()
    fetchJSON.mockImplementation(async () => {
      vi.setSystemTime(NOW + 1)
      throw new Error('timeout')
    })
    await expect(getUsdRates({ force: true })).rejects.toThrow('timeout')
  })

  test('force bypasses fresh cache; a still-fresh fallback retains the existing return shape', async () => {
    localStorage.setItem(KEY, JSON.stringify({ at: NOW - 1000, data }))
    fetchJSON.mockRejectedValueOnce(new Error('offline'))
    expect(await getUsdRates({ force: true })).toEqual(data)
    expect(fetchJSON).toHaveBeenCalledTimes(1)
  })

  test('timestamps successful data at response time, not request start', async () => {
    fetchJSON.mockImplementation(async () => {
      vi.setSystemTime(NOW + 5000)
      return data
    })
    expect(await getUsdRates()).toEqual(data)
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ at: NOW + 5000, data })
  })
})
