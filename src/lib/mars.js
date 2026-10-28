export const SOL_MS = 88775244

const MSL_EPOCH_MS = Date.UTC(2012, 7, 7)

const LS_EPOCH_MS = Date.UTC(1955, 3, 11)
const MARS_YEAR_DAYS = 686.98

export function mslSolFromDate(date = new Date()) {
  return Math.floor((date.getTime() - MSL_EPOCH_MS) / SOL_MS) + 1
}

export function mslDateForSol(sol) {
  return new Date(MSL_EPOCH_MS + (sol - 1) * SOL_MS)
}

export const MARS_SEASONS = [
  { key: 'spring', en: 'Spring', zh: '春季', desc: 'seasonSpring', end: 90 },
  { key: 'summer', en: 'Summer', zh: '夏季', desc: 'seasonSummer', end: 180 },
  { key: 'autumn', en: 'Autumn', zh: '秋季', desc: 'seasonAutumn', end: 270 },
  { key: 'winter', en: 'Winter', zh: '冬季', desc: 'seasonWinter', end: 360 },
]

export function approxSolarLongitude(date = new Date()) {
  const days = (date.getTime() - LS_EPOCH_MS) / 86400000
  let ls = ((days / MARS_YEAR_DAYS) * 360) % 360
  if (ls < 0) ls += 360
  return ls
}

export function seasonFromLs(ls) {
  const v = ((Number(ls) % 360) + 360) % 360
  return MARS_SEASONS.find((s) => v < s.end) || MARS_SEASONS[3]
}

export function oppositeSeason(season) {
  const idx = MARS_SEASONS.indexOf(season)
  return MARS_SEASONS[(idx + 2) % MARS_SEASONS.length]
}

function finite(v) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

function cleanText(v) {
  const s = String(v == null ? '' : v).trim()
  return s && s !== '--' ? s : null
}

function normalizeSol(row) {
  if (!row) return null
  const sol = parseInt(row.sol, 10)
  if (!Number.isFinite(sol)) return null
  const minTemp = finite(row.min_temp)
  const maxTemp = finite(row.max_temp)

  if (minTemp == null && maxTemp == null) return null

  return {
    sol,
    date: cleanText(row.terrestrial_date),
    ls: finite(row.ls),
    minTemp,
    maxTemp,
    pressure: finite(row.pressure),
    groundMin: finite(row.min_gts_temp),
    groundMax: finite(row.max_gts_temp),
    uv: cleanText(row.local_uv_irradiance_index),
    opacity: cleanText(row.atmo_opacity),
    sunrise: cleanText(row.sunrise),
    sunset: cleanText(row.sunset),
    simulated: false,
  }
}

export function parseMslSoles(raw, limit = 7) {
  const bag = raw && raw.soles
  if (!bag) return []
  const list = Array.isArray(bag) ? bag : Object.values(bag)
  const bySol = new Map()
  for (const row of list) {
    const day = normalizeSol(row)
    if (day) bySol.set(day.sol, day)
  }
  const sorted = Array.from(bySol.values()).sort((a, b) => a.sol - b.sol)
  return sorted.slice(-limit)
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function buildMockSols(now = new Date(), count = 7) {
  const list = []
  const lastSol = mslSolFromDate(now)
  const firstSol = lastSol - count + 1

  for (let sol = firstSol; sol <= lastSol; sol++) {
    const date = mslDateForSol(sol)
    const ls = +approxSolarLongitude(date).toFixed(1)

    const warm = Math.cos(((ls - 90) * Math.PI) / 180)
    const wobble = Math.sin(sol * 0.7) * 2.4
    const maxTemp = Math.round(-21 + warm * 11 + wobble)
    const minTemp = Math.round(-74 + warm * 7 + wobble * 0.6)
    const day = date.getUTCDate()

    list.push({
      sol,
      date: date.toISOString().slice(0, 10),
      ls,
      minTemp,
      maxTemp,
      pressure: Math.round(796 - warm * 28 + Math.sin(sol * 0.9) * 4),
      groundMin: Math.round(minTemp - 13 + wobble),
      groundMax: Math.round(maxTemp + 8 - wobble * 0.5),
      uv: warm > 0.45 ? 'High' : warm > -0.45 ? 'Moderate' : 'Low',
      opacity: sol % 5 === 0 ? 'Cloudy' : 'Sunny',
      sunrise: `06:${pad2((18 + day) % 60)}`,
      sunset: `18:${pad2((26 + day) % 60)}`,
      simulated: true,
    })
  }

  return list
}
