import { fetchJSON, lsGet, lsSet } from '../ok.js'
import { parseMslSoles } from './mars.js'

const ISS_URL = 'https://api.wheretheiss.at/v1/satellites/25544'
const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'
const KP_FORECAST_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json'
const AURORA_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json'
const LAUNCH_URL = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=30&ordering=net'

const MARS_MSL_URL = 'https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json'
const PEOPLE_URL = 'https://ll.thespacedevs.com/2.2.0/astronaut/?in_space=true&limit=30'

const MINUTE = 60 * 1000
const TTL = {
  kp: 10 * MINUTE,
  kpForecast: 10 * MINUTE,
  aurora: 10 * MINUTE,

  launches: 30 * MINUTE,

  mars: 3 * 60 * MINUTE,
  people: 30 * MINUTE,
}

const STORAGE_PREFIX = 'openkee-space-v1-'
const memory = new Map()

function readStored(key, ttl) {
  const raw = lsGet(STORAGE_PREFIX + key)
  if (!raw) return null
  try {
    const entry = JSON.parse(raw)
    if (!entry || typeof entry.t !== 'number') return null
    if (Date.now() - entry.t > ttl) return null
    return entry
  } catch (e) {
    return null
  }
}

function writeStored(key, entry) {
  lsSet(STORAGE_PREFIX + key, JSON.stringify(entry))
}

async function cachedJSON(key, url, ttl, { timeout = 15000, persist = true, force = false } = {}) {
  if (!force) {
    const hit = memory.get(key)
    if (hit && Date.now() - hit.t < ttl) return hit.data

    if (persist) {
      const stored = readStored(key, ttl)
      if (stored) {
        memory.set(key, stored)
        return stored.data
      }
    }
  }

  const data = await fetchJSON(url, { timeout })
  const entry = { t: Date.now(), data }
  memory.set(key, entry)
  if (persist) writeStored(key, entry)
  return data
}

export async function getIssPosition({ timeout = 15000 } = {}) {
  const d = await fetchJSON(ISS_URL, { timeout })
  if (!d || d.latitude == null || d.longitude == null) {
    throw new Error('bad iss response')
  }
  return {
    lat: parseFloat(d.latitude),
    lon: parseFloat(d.longitude),
    ts: d.timestamp ? d.timestamp * 1000 : Date.now(),
    speed: d.velocity != null ? parseFloat(d.velocity) : null,
    alt: d.altitude != null ? parseFloat(d.altitude) : null,
  }
}

export function getKpIndex(opts) {
  return cachedJSON('kp', KP_URL, TTL.kp, opts)
}

export function getKpForecast(opts) {
  return cachedJSON('kp-forecast', KP_FORECAST_URL, TTL.kpForecast, opts)
}

export function getAuroraOval(opts) {
  return cachedJSON('aurora', AURORA_URL, TTL.aurora, { ...opts, persist: false })
}

export async function getUpcomingLaunches({ limit = 10, timeout = 15000, force = false } = {}) {
  const d = await cachedJSON('launches', LAUNCH_URL, TTL.launches, { timeout, force })
  const results = Array.isArray(d && d.results) ? d.results : []
  return results.slice(0, limit)
}

export async function getMarsWeather({ days = 7, force = false, timeout = 20000 } = {}) {
  const KEY = 'mars-msl'

  const CACHE_DAYS = 7

  if (!force) {
    const hit = memory.get(KEY)
    if (hit && Date.now() - hit.t < TTL.mars && Array.isArray(hit.data) && hit.data.length) {
      return { days: hit.data.slice(-days), fetchedAt: hit.t }
    }
    const stored = readStored(KEY, TTL.mars)
    if (stored && Array.isArray(stored.data) && stored.data.length) {
      memory.set(KEY, stored)
      return { days: stored.data.slice(-days), fetchedAt: stored.t }
    }
  }

  const raw = await fetchJSON(MARS_MSL_URL, { timeout })
  const parsed = parseMslSoles(raw, CACHE_DAYS)
  if (!parsed.length) throw new Error('bad msl weather response')

  const entry = { t: Date.now(), data: parsed }
  memory.set(KEY, entry)
  writeStored(KEY, entry)
  return { days: parsed.slice(-days), fetchedAt: entry.t }
}

export async function getPeopleInSpace({ timeout = 15000, force = false } = {}) {
  const d = await cachedJSON('people-v2', PEOPLE_URL, TTL.people, { timeout, force })
  if (!d || !Array.isArray(d.results)) throw new Error('bad people response')
  const people = d.results
    .filter((a) => !(a && a.type && a.type.name === 'Non-Human'))
    .map((a) => ({
      name: a.name,
      agency: (a.agency && a.agency.name) || '',
      agencyAbbrev: (a.agency && a.agency.abbrev) || '',
    }))
  return {
    number: people.length,
    people: people,
  }
}
