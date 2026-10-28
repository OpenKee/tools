import { i18nState } from './i18n.js'

export function shortText(value, max = 240) {
  const text = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

export async function fetchJSON(url, opts = {}) {
  const { timeout = 12000, ...rest } = opts
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

export const githubLangColors = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Lua: '#000080',
  Zig: '#ec915c',
  Elixir: '#6e4a7e',
  Scala: '#c22d40',
  R: '#198CE7',
  'Jupyter Notebook': '#DA5B0B',
}

export function lsGet(key) {
  try {
    return localStorage.getItem(key)
  } catch (e) {
    return null
  }
}

export function lsSet(key, val) {
  try {
    localStorage.setItem(key, val)
  } catch (e) {}
}

export function lsRemove(key) {
  try {
    localStorage.removeItem(key)
  } catch (e) {}
}

export function locale() {
  return i18nState.lang === 'zh' ? 'zh-CN' : 'en-US'
}

const apiCache = new Map()
const CACHE_TTL = 5 * 60 * 1000

function cachedJSON(key, url) {
  const hit = apiCache.get(key)
  if (hit && Date.now() - hit.t < CACHE_TTL) return hit.p
  apiCache.delete(key)
  const p = fetchJSON(url).catch((e) => {
    apiCache.delete(key)
    throw e
  })
  apiCache.set(key, { p, t: Date.now() })
  return p
}

export function geoSearch(query, { count = 5, lang } = {}) {
  const language = lang || (i18nState.lang === 'zh' ? 'zh' : 'en')
  const url =
    'https://geocoding-api.open-meteo.com/v1/search?name=' +
    encodeURIComponent(query) +
    '&count=' +
    count +
    '&language=' +
    language +
    '&format=json'
  return cachedJSON('geo:' + language + ':' + count + ':' + query, url).then((d) => (d && d.results) || [])
}

export async function geocode(name, { count = 5, lang } = {}) {
  const results = await geoSearch(name, { count, lang })
  return results.map(function (r) {
    return {
      name: r.name,
      lat: r.latitude,
      lon: r.longitude,
      country: r.country,
      countryCode: r.country_code,
      admin1: r.admin1,
      timezone: r.timezone,
    }
  })
}

export async function ipLocate() {
  const d = await fetchJSON('https://api.ipquery.io/?format=json', { timeout: 8000 })
  const loc = d && d.location
  if (!loc || loc.latitude == null || loc.longitude == null) throw new Error('ip locate unavailable')
  return {
    lat: loc.latitude,
    lon: loc.longitude,
    city: loc.city || '',
    region: loc.state || '',
    country: loc.country || '',
    countryCode: loc.country_code || '',
    timezone: loc.timezone || '',
  }
}

export async function locateMe({ timeout = 10000 } = {}) {
  const browserPos = await new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout, enableHighAccuracy: false },
    )
  })
  if (browserPos) return { ...browserPos, precision: 'gps' }
  const ip = await ipLocate()
  return { ...ip, precision: 'ip' }
}

const ISS_TLE_URL = 'https://tle.ivanstanojevic.me/api/tle/25544'

export async function issPasses({ lat, lon, days = 5, limit = 5, minElev = 10, withinHours = 24, stepSec = 30 } = {}) {
  const tle = await fetchJSON(ISS_TLE_URL, { timeout: 12000 })
  if (!tle || !tle.line1 || !tle.line2) throw new Error('bad tle')
  const satellite = await import('./lib/satellite.js')
  const satrec = satellite.twoline2satrec(tle.line1, tle.line2)
  const observerGd = { longitude: (lon * Math.PI) / 180, latitude: (lat * Math.PI) / 180, height: 0.1 }
  const within = withinHours != null ? Date.now() + withinHours * 3600000 : Infinity
  const passes = []
  let current = null
  const end = Date.now() + days * 86400000
  for (let t = Date.now(); t <= end && t <= within; t += stepSec * 1000) {
    const date = new Date(t)
    const pv = satellite.propagate(satrec, date)
    if (!pv.position) continue
    const ecf = satellite.eciToEcf(pv.position, satellite.gstime(date))
    const look = satellite.ecfToLookAngles(observerGd, ecf)
    const elev = (look.elevation * 180) / Math.PI
    const az = (look.azimuth * 180) / Math.PI
    if (elev >= minElev) {
      if (!current) current = { risetime: Math.round(t / 1000), maxElev: elev, az: az }
      else if (elev > current.maxElev) {
        current.maxElev = elev
        current.az = az
      }
    } else if (current) {
      current.duration = Math.round((t - current.risetime * 1000) / 1000)
      passes.push(current)
      current = null
      if (passes.length >= limit) break
    }
  }
  return passes
}

export async function githubAPI(url, { token, timeout = 15000 } = {}) {
  const headers = { Accept: 'application/vnd.github+json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(timeout) })
  const reset = parseInt(r.headers.get('x-ratelimit-reset') || '0', 10)
  if (r.status === 404) throw new Error('not_found')
  if (r.status === 202) return null
  if (r.status === 403 || r.status === 429) {
    const body = await r.json().catch(() => ({}))
    const msg = (body && body.message) || ''
    if (/rate limit/i.test(msg)) {
      const err = new Error('rate_limit')
      err.resetAt = reset ? new Date(reset * 1000) : null
      throw err
    }
    throw new Error('forbidden')
  }
  if (!r.ok) {
    let msg = `${r.status}`
    try {
      const b = await r.json()
      msg = b.message || msg
    } catch (e) {}
    throw new Error(msg)
  }
  return r.json()
}

const githubCache = new Map()
const GITHUB_CACHE_TTL = 5 * 60 * 1000

export function githubCachedAPI(url, { token, timeout = 15000, ttl = GITHUB_CACHE_TTL } = {}) {
  const key = `${url}\n${token || ''}`
  const hit = githubCache.get(key)
  if (hit && Date.now() - hit.t < ttl) return hit.p
  const p = githubAPI(url, { token, timeout }).catch((e) => {
    githubCache.delete(key)
    throw e
  })
  githubCache.set(key, { p, t: Date.now() })
  return p
}

export async function usgsQuakes({
  lat,
  lon,
  radiusKm = 500,
  minMag,
  limit = 20,
  days = 30,
  hours,
  starttime,
  endtime,
} = {}) {
  const now = new Date()
  const start = starttime
    ? new Date(starttime)
    : new Date(now.getTime() - (hours != null ? hours * 3600000 : days * 24 * 3600000))
  const end = endtime ? new Date(endtime) : now
  let url =
    'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
    '&starttime=' +
    start.toISOString() +
    '&endtime=' +
    end.toISOString()
  if (lat != null && lon != null) {
    url += '&latitude=' + lat + '&longitude=' + lon + '&maxradiuskm=' + radiusKm
  }
  if (minMag != null) url += '&minmagnitude=' + minMag
  url += '&limit=' + limit + '&orderby=time'
  const d = await fetchJSON(url)
  return d.features || []
}

const CRYPTO_SRC_KEY = 'crypto-src'
const CRYPTO_SRC_TTL = 24 * 60 * 60 * 1000

export async function cryptoMarkets({ perPage = 15, sparkline = false, priceChange = '24h,7d' } = {}) {
  let preferred = null
  try {
    const saved = JSON.parse(lsGet(CRYPTO_SRC_KEY) || 'null')
    if (saved && saved.src === 'gate' && Date.now() - saved.at < CRYPTO_SRC_TTL) preferred = 'gate'
  } catch (e) {}

  if (preferred !== 'gate') {
    try {
      const coins = await fetchJSON(
        'https://api.coingecko.com/api/v3/coins/markets' +
          `?vs_currency=usd&order=market_cap_desc&per_page=${perPage}` +
          `&page=1&sparkline=${sparkline}&price_change_percentage=${priceChange}`,
        { timeout: 12000 },
      )
      if (Array.isArray(coins) && coins.length) {
        lsSet(CRYPTO_SRC_KEY, JSON.stringify({ src: 'coingecko', at: Date.now() }))
        return coins
      }
      throw new Error('empty coingecko response')
    } catch (e) {
      lsSet(CRYPTO_SRC_KEY, JSON.stringify({ src: 'gate', at: Date.now() }))
    }
  }

  const tickers = await fetchJSON('https://api.gateio.ws/api/v4/spot/tickers', { timeout: 10000 })
  return (Array.isArray(tickers) ? tickers : [])
    .filter((tk) => /_USDT$/.test(tk.currency_pair) && !/[0-9][LS]_/.test(tk.currency_pair))
    .map((tk) => {
      const base = tk.currency_pair.split('_')[0]
      return {
        id: base.toLowerCase(),
        symbol: base,
        name: base,
        image: null,
        current_price: parseFloat(tk.last),
        market_cap: null,
        market_cap_rank: null,
        total_volume: parseFloat(tk.quote_volume != null ? tk.quote_volume : tk.volume_quote),
        price_change_percentage_24h: parseFloat(tk.change_percentage),
        price_change_percentage_7d_in_currency: null,
        sparkline_in_7d: null,
      }
    })
    .sort((a, b) => (b.total_volume || 0) - (a.total_volume || 0))
    .slice(0, perPage)
}
