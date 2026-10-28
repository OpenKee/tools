export const KP_BANDS = [
  { key: 'low', max: 4, color: '#4ade80', a: 0, b: 3 },
  { key: 'med', max: 6, color: '#22d3ee', a: 4, b: 5 },
  { key: 'high', max: 8, color: '#a855f7', a: 6, b: 7 },
  { key: 'storm', max: Infinity, color: '#f43f5e', a: 8, b: 9 },
]

function normalizeKp(kp) {
  if (kp == null || kp === '') return null
  const value = Number(kp)
  return Number.isFinite(value) ? value : null
}

export function kpBand(kp) {
  const value = normalizeKp(kp)
  if (value == null) return null
  return KP_BANDS.find((band) => value < band.max) || KP_BANDS[KP_BANDS.length - 1]
}

export function kpVisibleLat(kp) {
  const value = normalizeKp(kp)
  if (value == null) return null
  return Math.max(0, Math.round(66 - 2 * value))
}
