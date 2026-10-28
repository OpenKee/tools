import { fetchJSON, lsGet, lsSet } from '../ok.js'

const CACHE_KEY = 'openkee-usd-rates-v1'
const CACHE_TTL = 10 * 60 * 1000
const RATES_URL = 'https://open.er-api.com/v6/latest/USD'

let memory = null

function readStored() {
  const raw = lsGet(CACHE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || !Number.isFinite(parsed.at) || !parsed.data?.rates) return null
    return parsed
  } catch (e) {
    return null
  }
}

function writeStored(entry) {
  lsSet(CACHE_KEY, JSON.stringify(entry))
}

function isFresh(entry, now = Date.now()) {
  const age = now - entry?.at
  return Number.isFinite(entry?.at) && age >= 0 && age < CACHE_TTL
}

export async function getUsdRates({ force = false } = {}) {
  const now = Date.now()
  if (!force && isFresh(memory, now)) return memory.data

  const stored = readStored()
  if (!force && isFresh(stored, now)) {
    memory = stored
    return stored.data
  }

  try {
    const data = await fetchJSON(RATES_URL)
    if (!data || data.result !== 'success' || !data.rates) {
      throw new Error('rates unavailable')
    }
    memory = { at: Date.now(), data }
    writeStored(memory)
    return data
  } catch (e) {
    if (isFresh(memory)) return memory.data
    if (isFresh(stored)) return stored.data
    throw e
  }
}
