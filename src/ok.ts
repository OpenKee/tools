import { i18nState, type Lang } from './i18n.js'

/* ============================================================
   共享工具函数，替代旧版 window.OK 的工具方法。
   ============================================================ */

/** HTML 转义，防止 XSS（Vue 模板默认转义，仅在 v-html 场景需要手动调用）。 */
export function escapeHtml(str: unknown): string {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface FetchJSONOptions {
  /** 超时毫秒，默认 12000 */
  timeout?: number
  /** 失败重试次数（5xx / 网络错误），默认 2 */
  retries?: number
  /** 重试基础延迟毫秒（指数退避），默认 800 */
  retryDelay?: number
  headers?: HeadersInit
  method?: string
  body?: BodyInit
  signal?: AbortSignal
}

/** 简易 fetch 封装：超时（AbortController）+ 指数退避重试。
    - 超时 / 4xx 直接失败，不重试
    - 5xx / 网络错误最多重试 retries 次，延迟按 retryDelay * 2^attempt 递增
    - 外部 signal 与内部超时合并，任一方触发即中止 */
export async function fetchJSON<T = unknown>(url: string, opts: FetchJSONOptions = {}): Promise<T> {
  const { timeout = 12000, retries = 2, retryDelay = 800, signal: outer, ...fetchOpts } = opts
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    const onOuterAbort = () => controller.abort()
    outer?.addEventListener('abort', onOuterAbort, { once: true })
    try {
      const res = await fetch(url, { ...fetchOpts, signal: controller.signal })
      if (res.ok) return (await res.json()) as T
      throw new Error('HTTP ' + res.status)
    } catch (err) {
      if (outer?.aborted) throw err
      const isTimeout = err instanceof DOMException && err.name === 'AbortError'
      const isClientError = err instanceof Error && /^HTTP [4]/.test(err.message)
      if (isTimeout || isClientError || attempt >= retries) throw err
      // 指数退避后重试
      await new Promise((resolve) => setTimeout(resolve, retryDelay * 2 ** attempt))
    } finally {
      clearTimeout(timer)
      outer?.removeEventListener('abort', onOuterAbort)
    }
  }
  throw new Error('fetchJSON: unexpected')
}

/** GitHub 语言颜色映射（repo-scope / trending-atlas 共用）。 */
export const githubLangColors: Record<string, string> = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
  Go: '#00ADD8', Rust: '#dea584', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600',
  Ruby: '#701516', PHP: '#4F5D95', Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB',
  Shell: '#89e051', HTML: '#e34c26', CSS: '#563d7c', Vue: '#41b883', Lua: '#000080',
  Zig: '#ec915c', Elixir: '#6e4a7e', Scala: '#c22d40', R: '#198CE7',
  'Jupyter Notebook': '#DA5B0B',
}

/* ---------- localStorage 安全读写（隐私模式兼容） ---------- */

export function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch (e) {
    return null
  }
}

export function lsSet(key: string, val: string): void {
  try {
    localStorage.setItem(key, val)
  } catch (e) {}
}

export function lsRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (e) {}
}

/** 当前语言对应的 BCP 47 locale（用于 Intl 格式化）。 */
export function locale(): string {
  return i18nState.lang === 'zh' ? 'zh-CN' : 'en-US'
}

/* ---------- 地理编码（Open-Meteo Geocoding） ----------
   多个视图原本各自实现，此处抽出公共函数供融合应用复用。 */

export interface GeoResult {
  name: string
  lat: number
  lon: number
  country?: string
  countryCode?: string
  admin1?: string
  timezone?: string
}

interface GeocodingResponse {
  results?: Array<{
    name?: string
    latitude?: number
    longitude?: number
    country?: string
    country_code?: string
    admin1?: string
    timezone?: string
  }>
}

/** 返回标准化结果数组，空数组表示无匹配。 */
export async function geocode(
  name: string,
  { count = 5, lang }: { count?: number; lang?: Lang } = {},
): Promise<GeoResult[]> {
  const language = lang || (i18nState.lang === 'zh' ? 'zh' : 'en')
  const url =
    'https://geocoding-api.open-meteo.com/v1/search?count=' + count +
    '&language=' + language + '&format=json&name=' + encodeURIComponent(name)
  const data = await fetchJSON<GeocodingResponse>(url, { timeout: 10000 })
  if (!data || !Array.isArray(data.results)) return []
  return data.results.map((r) => ({
    name: String(r.name ?? ''),
    lat: r.latitude ?? 0,
    lon: r.longitude ?? 0,
    country: r.country,
    countryCode: r.country_code,
    admin1: r.admin1,
    timezone: r.timezone,
  }))
}

/** Haversine 距离（公里），用于地震/位置半径计算。 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * R * Math.asin(Math.sqrt(a))
}
