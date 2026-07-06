import { i18nState } from './i18n.js'

/* ============================================================
   共享工具函数，替代旧版 window.OK 的工具方法。
   ============================================================ */

/** HTML 转义，防止 XSS（Vue 模板默认转义，仅在 v-html 场景需要手动调用）。 */
export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 简易 fetch 封装，带超时（AbortController）。 */
export async function fetchJSON(url, opts = {}) {
  const timeout = opts.timeout || 12000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/** GitHub 语言颜色映射（repo-scope / trending-atlas 共用）。 */
export const githubLangColors = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
  Go: '#00ADD8', Rust: '#dea584', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600',
  Ruby: '#701516', PHP: '#4F5D95', Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB',
  Shell: '#89e051', HTML: '#e34c26', CSS: '#563d7c', Vue: '#41b883', Lua: '#000080',
  Zig: '#ec915c', Elixir: '#6e4a7e', Scala: '#c22d40', R: '#198CE7',
  'Jupyter Notebook': '#DA5B0B',
}

/* ---------- localStorage 安全读写（隐私模式兼容） ---------- */

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

/** 当前语言对应的 BCP 47 locale（用于 Intl 格式化）。 */
export function locale() {
  return i18nState.lang === 'zh' ? 'zh-CN' : 'en-US'
}

/* ---------- 地理编码（Open-Meteo Geocoding） ----------
   多个视图原本各自实现，此处抽出公共函数供融合应用复用。
   返回标准化结果数组，空数组表示无匹配。 */
export async function geocode(name, { count = 5, lang } = {}) {
  const language = lang || (i18nState.lang === 'zh' ? 'zh' : 'en')
  const url =
    'https://geocoding-api.open-meteo.com/v1/search?count=' + count +
    '&language=' + language + '&format=json&name=' + encodeURIComponent(name)
  const data = await fetchJSON(url, { timeout: 10000 })
  if (!data || !Array.isArray(data.results)) return []
  return data.results.map(function (r) {
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

/** Haversine 距离（公里），用于地震/位置半径计算。 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const toRad = function (d) { return (d * Math.PI) / 180 }
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * R * Math.asin(Math.sqrt(a))
}
