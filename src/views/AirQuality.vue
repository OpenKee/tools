<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, lsGet, lsSet, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ============================================================
   Air Quality Monitor — 空气质量监测（Vue 3 SFC）
   数据源：Open-Meteo
     · Air Quality API：当前污染物 + US AQI + 24h 逐小时预报
     · Geocoding API：城市名搜索
   accent 颜色随当前 AQI 等级动态变化。
   ============================================================ */

/* ---------- 文案字典（中英双语） ---------- */
const copy = {
  en: {
    title: 'Air Quality',
    eyebrow: 'Open-Meteo · Atmospheric Monitoring',
    lead: 'Real-time US AQI, pollutant concentrations and 24-hour trends for any city. Data by Open-Meteo.',
    searchPlaceholder: 'Search a city…',
    favorite: 'Favorite',
    loading: 'Loading…',
    refresh: 'Refresh',
    usAqi: 'US Air Quality Index',
    healthAdvice: 'Health Advice',
    pollutants: 'Pollutants',
    trend24h: '24-Hour AQI Trend',
    location: 'Location',
    dominant: 'Dominant pollutant',
    updated: 'Last updated',
    dataSource: 'Data: Open-Meteo Air Quality API',
    builtBy: 'Built by',
    noResults: 'No matching cities',
    searchError: 'City search failed. Please try again.',
    loadError: 'Failed to load air quality data. Please try again.',
    now: 'Now',
    aqiUnit: 'AQI',
    levelGood: 'Good',
    levelModerate: 'Moderate',
    levelUsg: 'Unhealthy for Sensitive Groups',
    levelUnhealthy: 'Unhealthy',
    levelVeryUnhealthy: 'Very Unhealthy',
    levelHazardous: 'Hazardous',
    pm25: 'PM2.5 Fine Particulate',
    pm10: 'PM10 Coarse Particulate',
    o3: 'Ozone',
    no2: 'Nitrogen Dioxide',
    so2: 'Sulphur Dioxide',
    co: 'Carbon Monoxide',
    adviceGood: 'Air quality is ideal. Enjoy outdoor activities and exercise freely.',
    adviceModerate: 'Air quality is acceptable. Unusually sensitive people should consider reducing prolonged heavy outdoor exertion.',
    adviceUsg: 'Sensitive groups (children, elderly, those with heart or lung disease) should reduce prolonged outdoor exertion. Watch for symptoms like coughing.',
    adviceUnhealthy: 'Everyone may begin to be affected. Limit prolonged outdoor exertion and consider wearing a mask in traffic.',
    adviceVeryUnhealthy: 'Health alert: avoid prolonged outdoor exertion. Wear a mask outdoors and keep windows closed.',
    adviceHazardous: 'Health warning: everyone should avoid all outdoor activity. Stay indoors and use an air purifier if available.'
  },
  zh: {
    title: '空气质量',
    eyebrow: 'Open-Meteo · 大气监测',
    lead: '任意城市的实时美国 AQI、污染物浓度与 24 小时趋势。数据由 Open-Meteo 提供。',
    searchPlaceholder: '搜索城市…',
    favorite: '收藏',
    loading: '加载中…',
    refresh: '刷新',
    usAqi: '美国空气质量指数',
    healthAdvice: '健康建议',
    pollutants: '污染物',
    trend24h: '24 小时 AQI 趋势',
    location: '位置',
    dominant: '主要污染物',
    updated: '更新时间',
    dataSource: '数据：Open-Meteo 空气质量 API',
    builtBy: '由',
    noResults: '未找到匹配的城市',
    searchError: '城市搜索失败，请重试。',
    loadError: '空气质量数据加载失败，请重试。',
    now: '现在',
    aqiUnit: 'AQI',
    levelGood: '良好',
    levelModerate: '中等',
    levelUsg: '敏感人群不健康',
    levelUnhealthy: '不健康',
    levelVeryUnhealthy: '非常不健康',
    levelHazardous: '危险',
    pm25: 'PM2.5 细颗粒物',
    pm10: 'PM10 可吸入颗粒物',
    o3: '臭氧',
    no2: '二氧化氮',
    so2: '二氧化硫',
    co: '一氧化碳',
    adviceGood: '空气质量理想，适合户外活动与运动。',
    adviceModerate: '空气质量尚可。异常敏感人群应考虑减少长时间高强度户外运动。',
    adviceUsg: '敏感人群（儿童、老人、心肺疾病患者）应减少长时间户外运动，注意咳嗽等症状。',
    adviceUnhealthy: '所有人都可能受到影响。应限制长时间户外运动，交通中建议佩戴口罩。',
    adviceVeryUnhealthy: '健康警报：避免长时间户外运动。外出佩戴口罩并关闭门窗。',
    adviceHazardous: '健康警告：所有人应避免一切户外活动，请留在室内，有条件请使用空气净化器。'
  }
}
const t = useT(copy)

/* ---------- 常量 ---------- */
const AQ_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const CURRENT_FIELDS = 'pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi,us_aqi_pm2_5,us_aqi_pm10,us_aqi_ozone,us_aqi_nitrogen_dioxide,us_aqi_sulphur_dioxide,us_aqi_carbon_monoxide'
const HOURLY_FIELDS = 'pm10,pm2_5,us_aqi'
const FAV_KEY = 'openkee-airquality-favs'
const DEFAULT_CITY = { name: 'Beijing', lat: 39.9, lng: 116.4, country: 'China', admin1: 'Beijing' }

// AQI 等级颜色（US AQI 标准）
const LEVEL_COLORS = {
  good: '#22c55e',
  moderate: '#eab308',
  usg: '#f97316',
  unhealthy: '#ef4444',
  veryUnhealthy: '#a855f7',
  hazardous: '#991b1b'
}

// 等级软背景色（用于 --aqi-soft）
const LEVEL_SOFT = {
  good: 'rgba(34,197,94,0.14)',
  moderate: 'rgba(234,179,8,0.16)',
  usg: 'rgba(249,115,22,0.16)',
  unhealthy: 'rgba(239,68,68,0.16)',
  veryUnhealthy: 'rgba(168,85,247,0.18)',
  hazardous: 'rgba(153,27,27,0.22)'
}

// 等级建议图标
const ADVICE_ICONS = {
  good: '😊', moderate: '🙂', usg: '⚠️',
  unhealthy: '😷', veryUnhealthy: '🚨', hazardous: '☣️'
}

// 污染物配置：API 字段 → 展示信息
const POLLUTANTS = [
  { key: 'pm2_5', sub: 'us_aqi_pm2_5', chem: 'PM2.5', labelKey: 'pm25' },
  { key: 'pm10', sub: 'us_aqi_pm10', chem: 'PM10', labelKey: 'pm10' },
  { key: 'ozone', sub: 'us_aqi_ozone', chem: 'O₃', labelKey: 'o3' },
  { key: 'nitrogen_dioxide', sub: 'us_aqi_nitrogen_dioxide', chem: 'NO₂', labelKey: 'no2' },
  { key: 'sulphur_dioxide', sub: 'us_aqi_sulphur_dioxide', chem: 'SO₂', labelKey: 'so2' },
  { key: 'carbon_monoxide', sub: 'us_aqi_carbon_monoxide', chem: 'CO', labelKey: 'co' }
]

// 等级刻度条分段（按 AQI 范围宽度加权）
const SCALE_SEGMENTS = [
  { key: 'good', lo: 0, lo2: 50, weight: 50 },
  { key: 'moderate', lo: 51, lo2: 100, weight: 50 },
  { key: 'usg', lo: 101, lo2: 150, weight: 50 },
  { key: 'unhealthy', lo: 151, lo2: 200, weight: 50 },
  { key: 'veryUnhealthy', lo: 201, lo2: 300, weight: 100 },
  { key: 'hazardous', lo: 301, lo2: 500, weight: 200 }
]

/* ---------- 响应式状态 ---------- */
const city = ref(null)              // 当前城市
const data = ref(null)              // 当前空气质量数据
const errorMsg = ref('')            // 错误文案 key
const loading = ref(false)
const searchQuery = ref('')         // 搜索输入
const searchResults = ref([])       // 搜索结果
const searchActive = ref(-1)        // 键盘导航当前高亮项
const searchErrored = ref(false)    // 搜索是否失败
const showDropdown = ref(false)     // 是否展示搜索下拉
const favorites = ref([])           // 收藏城市列表
const searchWrapRef = ref(null)     // 搜索框容器引用
let searchTimer = null

/* ---------- 工具函数 ---------- */
// US AQI 值 -> 等级 key
function aqiLevel(aqi) {
  if (aqi == null || isNaN(aqi)) return 'good'
  if (aqi <= 50) return 'good'
  if (aqi <= 100) return 'moderate'
  if (aqi <= 150) return 'usg'
  if (aqi <= 200) return 'unhealthy'
  if (aqi <= 300) return 'veryUnhealthy'
  return 'hazardous'
}

// 等级 key -> i18n 文案 key
function levelLabelKey(l) {
  return {
    good: 'levelGood', moderate: 'levelModerate', usg: 'levelUsg',
    unhealthy: 'levelUnhealthy', veryUnhealthy: 'levelVeryUnhealthy',
    hazardous: 'levelHazardous'
  }[l]
}

// 等级 key -> 健康建议 i18n key
function adviceKey(l) {
  return {
    good: 'adviceGood', moderate: 'adviceModerate', usg: 'adviceUsg',
    unhealthy: 'adviceUnhealthy', veryUnhealthy: 'adviceVeryUnhealthy',
    hazardous: 'adviceHazardous'
  }[l]
}

// 数值格式化（μg/m³）
function fmtVal(v) {
  if (v == null || isNaN(v)) return '—'
  if (v < 10) return v.toFixed(2)
  if (v < 100) return v.toFixed(1)
  return Math.round(v).toString()
}

// 时间格式化（API 因 timezone=auto 返回本地时间字符串）
function fmtTime(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString(locale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// 小时格式化（用于趋势图 x 轴）
function fmtHour(s) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
}

// 找出分指数最高的污染物
function dominantPollutant(cur) {
  let best = null
  POLLUTANTS.forEach((p) => {
    const sub = cur[p.sub]
    if (sub != null && !isNaN(sub) && (!best || sub > best.sub)) {
      best = { chem: p.chem, sub: sub, labelKey: p.labelKey }
    }
  })
  return best
}

// 转义 SVG 属性值（v-html 内容不受 Vue 自动转义保护）
function escapeAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/* ---------- 收藏管理 ---------- */
function loadFavs() {
  const raw = lsGet(FAV_KEY)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch (e) { return [] }
}
function saveFavs() {
  lsSet(FAV_KEY, JSON.stringify(favorites.value))
}
// 判断城市是否已收藏（按经纬度匹配，保留 2 位小数）
function isFav(c) {
  if (!c) return false
  return favorites.value.some((f) => Math.abs(f.lat - c.lat) < 0.01 && Math.abs(f.lng - c.lng) < 0.01)
}
const isCurrentFav = computed(() => isFav(city.value))
function toggleFav() {
  const c = city.value
  if (!c) return
  if (isFav(c)) {
    favorites.value = favorites.value.filter((f) => !(Math.abs(f.lat - c.lat) < 0.01 && Math.abs(f.lng - c.lng) < 0.01))
  } else {
    favorites.value.push({ name: c.name, lat: c.lat, lng: c.lng, country: c.country || '', admin1: c.admin1 || '' })
  }
  saveFavs()
}
function removeFav(idx) {
  if (idx >= 0 && idx < favorites.value.length) {
    favorites.value.splice(idx, 1)
    saveFavs()
  }
}
function selectFav(f) {
  selectCity({ name: f.name, lat: f.lat, lng: f.lng, country: f.country, admin1: f.admin1 })
}

/* ---------- 城市搜索 ---------- */
// 搜索结果项的副标题：行政区/国家 或 经纬度
function resultMeta(r) {
  const meta = [r.admin1, r.country].filter(Boolean).join(', ')
  if (meta) return meta
  return Number(r.latitude).toFixed(2) + ', ' + Number(r.longitude).toFixed(2)
}

// 防抖搜索
async function runSearch(query) {
  const url = GEO_URL + '?name=' + encodeURIComponent(query) + '&count=5&language=' + (i18nState.lang === 'zh' ? 'zh' : 'en') + '&format=json'
  try {
    const res = await fetchJSON(url)
    searchResults.value = (res && res.results) ? res.results : []
    searchErrored.value = false
  } catch (e) {
    searchResults.value = []
    searchErrored.value = true
  } finally {
    searchActive.value = -1
    showDropdown.value = true
  }
}

function hideResults() {
  showDropdown.value = false
  searchResults.value = []
  searchErrored.value = false
  searchActive.value = -1
}

// 选中搜索结果：构造城市对象并加载
function pickResult(r) {
  const c = {
    name: r.name,
    lat: Number(r.latitude),
    lng: Number(r.longitude),
    country: r.country || '',
    admin1: r.admin1 || ''
  }
  searchQuery.value = ''
  hideResults()
  selectCity(c)
}

// 搜索框键盘导航：上下选择、回车确认、Esc 关闭
function onSearchKeydown(e) {
  if (e.key === 'Escape') {
    hideResults()
    return
  }
  const n = searchResults.value.length
  if (!n) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    searchActive.value = (searchActive.value + 1) % n
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    searchActive.value = (searchActive.value - 1 + n) % n
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (searchActive.value >= 0) pickResult(searchResults.value[searchActive.value])
  }
}

// 点击页面外部关闭搜索下拉
function onDocClick(e) {
  if (searchWrapRef.value && !searchWrapRef.value.contains(e.target)) {
    hideResults()
  }
}

/* ---------- 选择城市并加载数据 ---------- */
function selectCity(c) {
  city.value = c
  loadAirQuality(c)
}

async function loadAirQuality(c) {
  loading.value = true
  errorMsg.value = ''
  const url = AQ_URL + '?latitude=' + c.lat + '&longitude=' + c.lng +
    '&current=' + CURRENT_FIELDS +
    '&hourly=' + HOURLY_FIELDS +
    '&timezone=auto&forecast_days=1'
  try {
    data.value = await fetchJSON(url)
  } catch (e) {
    data.value = null
    errorMsg.value = 'loadError'
  } finally {
    loading.value = false
  }
}

// 刷新当前城市
function refresh() {
  if (city.value) loadAirQuality(city.value)
}

/* ---------- 派生：动态主题色变量 ---------- */
const themeVars = computed(() => {
  const cur = data.value && data.value.current ? data.value.current : null
  const level = aqiLevel(cur ? cur.us_aqi : null)
  return {
    '--aqi': LEVEL_COLORS[level],
    '--aqi-soft': LEVEL_SOFT[level],
    '--ok-accent': LEVEL_COLORS[level],
    '--ok-accent-soft': LEVEL_SOFT[level],
    '--ok-footer-link': LEVEL_COLORS[level]
  }
})

/* ---------- 派生：主 AQI 卡片 ---------- */
const current = computed(() => data.value && data.value.current ? data.value.current : null)
const currentAqi = computed(() => current.value ? current.value.us_aqi : null)
const currentLevel = computed(() => aqiLevel(currentAqi.value))
const aqiValueText = computed(() => {
  const aqi = currentAqi.value
  return (aqi == null || isNaN(aqi)) ? '—' : Math.round(aqi).toString()
})
const aqiTagText = computed(() => t.value(levelLabelKey(currentLevel.value)))
const locationText = computed(() => {
  if (!city.value) return '—'
  const parts = [city.value.name]
  if (city.value.admin1 && city.value.admin1 !== city.value.name) parts.push(city.value.admin1)
  if (city.value.country) parts.push(city.value.country)
  return parts.join(', ')
})
const dominantText = computed(() => {
  const cur = current.value
  if (!cur) return '—'
  const dom = dominantPollutant(cur)
  return dom ? dom.chem : '—'
})
const updatedText = computed(() => current.value ? fmtTime(current.value.time) : '—')

// AQI 等级刻度条当前位置标记（百分比）
const aqiMarkerPct = computed(() => {
  const aqi = currentAqi.value
  if (aqi == null || isNaN(aqi)) return null
  return Math.max(0, Math.min(100, (aqi / 500) * 100)).toFixed(2)
})

/* ---------- 派生：污染物网格 ---------- */
const pollutantCells = computed(() => {
  const cur = current.value
  return POLLUTANTS.map((p) => {
    const val = cur ? cur[p.key] : null
    const sub = cur ? cur[p.sub] : null
    const level = aqiLevel(sub)
    const color = LEVEL_COLORS[level]
    const subTxt = (sub == null || isNaN(sub)) ? '—' : Math.round(sub).toString()
    return {
      chem: p.chem,
      labelKey: p.labelKey,
      val: fmtVal(val),
      subTxt,
      levelLabel: t.value(levelLabelKey(level)),
      color
    }
  })
})

/* ---------- 派生：健康建议 ---------- */
const adviceInfo = computed(() => {
  const aqi = currentAqi.value
  const level = aqiLevel(aqi)
  const cur = current.value
  const subParts = []
  if (aqi != null && !isNaN(aqi)) subParts.push('US AQI ' + Math.round(aqi))
  const dom = cur ? dominantPollutant(cur) : null
  if (dom) subParts.push(dom.chem + ' ' + Math.round(dom.sub))
  return {
    icon: ADVICE_ICONS[level],
    text: t.value(adviceKey(level)),
    sub: subParts.join('  ·  ')
  }
})

/* ---------- 派生：24h 趋势 SVG（字符串，通过 v-html 注入） ---------- */
const trendSVG = computed(() => {
  const hourly = data.value && data.value.hourly ? data.value.hourly : null
  const times = hourly ? hourly.time : null
  const aqis = hourly ? hourly.us_aqi : null
  const label = escapeAttr(t.value('trend24h'))
  if (!times || !aqis || !times.length) {
    return '<svg class="trend-svg" viewBox="0 0 720 240" role="img" aria-label="' + label + '"><text x="360" y="120" text-anchor="middle" class="axis-label">—</text></svg>'
  }
  const n = times.length
  // 过滤有效点，保留索引
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = aqis[i]
    if (a != null && !isNaN(a)) pts.push({ i: i, a: a, t: times[i] })
  }

  const W = 720, H = 240
  const padL = 38, padR = 16, padT = 16, padB = 30
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  // y 轴最大值：向上取整到 50 的倍数，至少 50
  let maxAqi = 50
  pts.forEach((p) => { if (p.a > maxAqi) maxAqi = p.a })
  let maxScale = Math.ceil(maxAqi / 50) * 50
  if (maxScale > 500) maxScale = 500

  function x(i) { return padL + (plotW * i / (n - 1)) }
  function y(a) { return padT + plotH - (Math.min(a, maxScale) / maxScale) * plotH }

  const curColor = LEVEL_COLORS[aqiLevel(currentAqi.value)]
  const parts = ['<svg class="trend-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + label + '">']

  // 渐变定义（面积填充用）
  parts.push('<defs><linearGradient id="aqiFill" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="' + curColor + '" stop-opacity="0.35"/>' +
    '<stop offset="100%" stop-color="' + curColor + '" stop-opacity="0"/>' +
    '</linearGradient></defs>')

  // 横向网格线（AQI 等级边界）
  ;[50, 100, 150, 200, 300].forEach((lvl) => {
    if (lvl > maxScale) return
    const yy = y(lvl)
    parts.push('<line x1="' + padL + '" y1="' + yy.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + yy.toFixed(1) + '" class="' + (lvl === 0 ? 'grid-base' : 'grid-line') + '"/>')
    parts.push('<text x="' + (padL - 6) + '" y="' + (yy + 3).toFixed(1) + '" text-anchor="end" class="axis-label">' + lvl + '</text>')
  })
  // 基线
  const baseY = padT + plotH
  parts.push('<line x1="' + padL + '" y1="' + baseY + '" x2="' + (W - padR) + '" y2="' + baseY + '" class="grid-base"/>')

  // 趋势折线 + 面积
  if (pts.length >= 2) {
    const linePath = pts.map((p, idx) => (idx === 0 ? 'M' : 'L') + x(p.i).toFixed(1) + ' ' + y(p.a).toFixed(1)).join(' ')
    const areaPath = linePath +
      ' L' + x(pts[pts.length - 1].i).toFixed(1) + ' ' + baseY.toFixed(1) +
      ' L' + x(pts[0].i).toFixed(1) + ' ' + baseY.toFixed(1) + ' Z'
    parts.push('<path d="' + areaPath + '" fill="url(#aqiFill)"/>')
    parts.push('<path d="' + linePath + '" fill="none" stroke="' + curColor + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>')
    // 数据点（每 3 小时一个，便于查看）
    pts.forEach((p) => {
      if (p.i % 3 !== 0 && p.i !== n - 1) return
      const cx = x(p.i), cy = y(p.a)
      parts.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="2.2" fill="' + LEVEL_COLORS[aqiLevel(p.a)] + '"><title>AQI ' + Math.round(p.a) + ' · ' + escapeAttr(fmtHour(p.t)) + '</title></circle>')
    })
  } else if (pts.length === 1) {
    const p0 = pts[0]
    parts.push('<circle cx="' + x(p0.i).toFixed(1) + '" cy="' + y(p0.a).toFixed(1) + '" r="3" fill="' + LEVEL_COLORS[aqiLevel(p0.a)] + '"/>')
  }

  // “现在”标记：找最接近当前时间的小时点
  let nowIdx = -1
  if (data.value && data.value.current && data.value.current.time) {
    const nowT = new Date(data.value.current.time).getTime()
    let bestDiff = Infinity
    times.forEach((tm, i) => {
      const diff = Math.abs(new Date(tm).getTime() - nowT)
      if (diff < bestDiff) { bestDiff = diff; nowIdx = i }
    })
  }
  if (nowIdx >= 0) {
    const nx = x(nowIdx)
    parts.push('<line x1="' + nx.toFixed(1) + '" y1="' + padT + '" x2="' + nx.toFixed(1) + '" y2="' + baseY + '" class="now-line"/>')
    const curAqi = aqis[nowIdx]
    if (curAqi != null && !isNaN(curAqi)) {
      parts.push('<circle cx="' + nx.toFixed(1) + '" cy="' + y(curAqi).toFixed(1) + '" r="4" class="now-dot"/>')
    }
    parts.push('<text x="' + nx.toFixed(1) + '" y="' + (padT - 4) + '" text-anchor="middle" class="now-label">' + escapeAttr(t.value('now')) + '</text>')
  }

  // x 轴时间标签（每 4 小时一个）
  for (let xi = 0; xi < n; xi += 4) {
    const lx = x(xi)
    parts.push('<text x="' + lx.toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle" class="axis-x">' + escapeAttr(fmtHour(times[xi])) + '</text>')
  }

  parts.push('</svg>')
  return parts.join('')
})

/* ---------- 监听：搜索输入防抖 350ms ---------- */
watch(searchQuery, (q) => {
  if (searchTimer) clearTimeout(searchTimer)
  const trimmed = q.trim()
  if (trimmed.length < 2) {
    hideResults()
    return
  }
  searchTimer = setTimeout(() => { runSearch(trimmed) }, 350)
})

/* ---------- 生命周期 ---------- */
onMounted(() => {
  // 初始化收藏
  favorites.value = loadFavs()
  // 监听全局点击，用于关闭搜索下拉
  document.addEventListener('click', onDocClick)
  // 首次加载：默认北京
  selectCity(DEFAULT_CITY)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <div class="aq-app" :style="themeVars">
    <!-- 顶部栏：标题 + 语言切换（语言切换由 AppHeader 内部处理） -->
    <AppHeader :title="t('title')" />

    <main class="shell">
      <!-- 页头：说明 + 城市搜索 + 收藏 -->
      <section class="masthead">
        <p class="eyebrow">{{ t('eyebrow') }}</p>
        <p class="lead">{{ t('lead') }}</p>

        <div class="search-row">
          <div ref="searchWrapRef" class="search-box">
            <span class="search-icon" aria-hidden="true">⌕</span>
            <input
              v-model="searchQuery"
              class="search-input"
              type="text"
              autocomplete="off"
              :placeholder="t('searchPlaceholder')"
              @keydown="onSearchKeydown"
            />
            <!-- 搜索结果下拉 -->
            <ul v-if="showDropdown" class="search-results" role="listbox">
              <li v-if="searchErrored" class="res-empty">{{ t('searchError') }}</li>
              <li v-else-if="!searchResults.length" class="res-empty">{{ t('noResults') }}</li>
              <li
                v-for="(r, i) in searchResults"
                :key="i"
                role="option"
                :class="{ active: i === searchActive }"
                @click="pickResult(r)"
              >
                <span class="res-name">{{ r.name }}</span>
                <span class="res-meta">{{ resultMeta(r) }}</span>
              </li>
            </ul>
          </div>
          <button
            class="fav-btn"
            :class="{ on: isCurrentFav }"
            type="button"
            :title="t('favorite')"
            :aria-pressed="isCurrentFav ? 'true' : 'false'"
            @click="toggleFav"
          >
            <span class="fav-star">{{ isCurrentFav ? '★' : '☆' }}</span><span>{{ t('favorite') }}</span>
          </button>
        </div>

        <!-- 收藏城市芯片 -->
        <div v-if="favorites.length" class="fav-row">
          <span v-for="(f, i) in favorites" :key="i" class="fav-chip">
            <span class="chip-name" @click="selectFav(f)">{{ f.name }}<template v-if="f.country && f.country !== f.name">, {{ f.country }}</template></span>
            <button class="chip-del" type="button" :aria-label="t('favorite')" @click.stop="removeFav(i)">×</button>
          </span>
        </div>
      </section>

      <!-- 加载状态 -->
      <div v-if="loading" class="ok-loading">
        <span class="ok-spinner"></span>
        <span>{{ t('loading') }}</span>
      </div>

      <!-- 错误提示 -->
      <div v-if="errorMsg" class="ok-error">{{ t(errorMsg) }}</div>

      <!-- 主体布局 -->
      <div v-if="data && !loading && !errorMsg" class="layout">
        <!-- 主 AQI 大卡片 -->
        <section class="card aqi-card">
          <div class="aqi-head">
            <span class="card-label">{{ t('usAqi') }}</span>
            <button class="ok-btn-ghost refresh-btn" type="button" @click="refresh">{{ t('refresh') }}</button>
          </div>
          <div class="aqi-main">
            <div class="aqi-value">{{ aqiValueText }}</div>
            <div class="aqi-tag">{{ aqiTagText }}</div>
          </div>
          <div class="aqi-meta">
            <div class="meta-row">
              <span class="meta-label">{{ t('location') }}</span>
              <span class="meta-value">{{ locationText }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">{{ t('dominant') }}</span>
              <span class="meta-value">{{ dominantText }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">{{ t('updated') }}</span>
              <span class="meta-value">{{ updatedText }}</span>
            </div>
          </div>
          <!-- AQI 等级刻度条 -->
          <div class="aqi-scale">
            <div class="scale-bar">
              <span
                v-for="seg in SCALE_SEGMENTS"
                :key="seg.key"
                :class="'seg-' + seg.key"
                :style="{ flex: seg.weight }"
                :title="t(levelLabelKey(seg.key)) + ' (' + seg.lo + '–' + seg.lo2 + ')'"
              ></span>
            </div>
            <div v-if="aqiMarkerPct" class="aqi-marker" :style="{ left: aqiMarkerPct + '%' }"></div>
          </div>
        </section>

        <!-- 健康建议卡片 -->
        <section class="card advice-card">
          <div class="card-label">{{ t('healthAdvice') }}</div>
          <div class="advice-icon">{{ adviceInfo.icon }}</div>
          <p class="advice-text">{{ adviceInfo.text }}</p>
          <p v-if="adviceInfo.sub" class="advice-sub">{{ adviceInfo.sub }}</p>
        </section>

        <!-- 污染物详情网格 -->
        <section class="card pollutants-card">
          <div class="card-label">{{ t('pollutants') }}</div>
          <div class="pollutant-grid">
            <div
              v-for="cell in pollutantCells"
              :key="cell.chem"
              class="pollutant-cell"
              :style="{ '--cell-color': cell.color }"
              :title="t(cell.labelKey)"
            >
              <div class="p-name">{{ cell.chem }}</div>
              <div class="p-value">{{ cell.val }}<span class="p-unit">μg/m³</span></div>
              <div class="p-sub">
                <span class="dot"></span>
                <span class="lvl">{{ cell.levelLabel }}</span>
                <span class="aqi-num">{{ cell.subTxt }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- 24 小时 AQI 趋势图 -->
        <section class="card trend-card">
          <div class="card-label">{{ t('trend24h') }}</div>
          <div class="trend-chart" v-html="trendSVG"></div>
        </section>
      </div>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Air Quality Monitor — 空气质量监测样式
   深色主题，accent 根据当前 AQI 等级动态变色。
   原版 :root 变量映射到组件根类 .aq-app 上。
   ============================================================ */

.aq-app {
  /* app 自有变量 */
  --bg: #0b0f1a;
  --surface: #131a2b;
  --surface-2: #1a2238;
  --text: #eaf0ff;
  --text-muted: #8b95b8;
  --border: #283150;

  /* AQI 动态强调色：默认绿（Good），由 JS 按等级覆盖 */
  --aqi: #22c55e;
  --aqi-soft: rgba(34, 197, 94, 0.14);
  color-scheme: dark;

  /* 映射到共享设计 token */
  --ok-bg: var(--bg);
  --ok-panel: var(--surface);
  --ok-text: var(--text);
  --ok-muted: var(--text-muted);
  --ok-line: var(--border);
  --ok-accent: var(--aqi);
  --ok-accent-soft: var(--aqi-soft);
  --ok-radius: 14px;
  --ok-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  --ok-topbar-h: 3.4rem;
  --ok-topbar-line: var(--border);
  --ok-footer-line: var(--border);
  --ok-footer-text: var(--text-muted);
  --ok-footer-link: var(--aqi);

  /* 字体（按要求使用 Outfit + IBM Plex Mono） */
  --ok-font: "Outfit", system-ui, -apple-system, sans-serif;
  --ok-mono: "IBM Plex Mono", "SFMono-Regular", Menlo, monospace;

  /* 原版 body 背景：深色径向渐变 */
  margin: 0;
  font-family: var(--ok-font);
  color: var(--text);
  background:
    radial-gradient(1100px 560px at 84% -10%, var(--aqi-soft), transparent 60%),
    radial-gradient(820px 480px at 6% -4%, rgba(96, 165, 250, 0.1), transparent 55%),
    var(--bg);
  background-attachment: fixed;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  transition: background 0.6s ease;
}

h1, h2, h3, p, strong, span, small { margin: 0; }

/* ---------- 顶部栏（覆盖 AppHeader 内的 .ok-topbar 以贴合原版深色顶栏） ---------- */
.aq-app :deep(.ok-topbar) {
  height: var(--ok-topbar-h);
  padding: 0 1.2rem;
  font-size: 0.85rem;
  justify-content: space-between;
  background: rgba(11, 15, 26, 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 30;
}

.aq-app :deep(.topbar-title) {
  font-size: 1.02rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
  opacity: 1;
}

/* ---------- 主容器 ---------- */
.shell {
  width: min(1040px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

/* ---------- 页头 ---------- */
.masthead {
  padding: 1.3rem 0 1rem;
  border-bottom: 1px solid var(--border);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--aqi);
}

.lead {
  margin-top: 0.5rem;
  color: var(--text-muted);
  font-size: 0.92rem;
  line-height: 1.6;
  max-width: 62ch;
}

/* ---------- 搜索栏 ---------- */
.search-row {
  display: flex;
  gap: 0.6rem;
  align-items: stretch;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1 1 280px;
  min-width: 220px;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  font-size: 1.05rem;
  pointer-events: none;
}

.search-input {
  font: inherit;
  width: 100%;
  height: 2.6rem;
  padding: 0 0.9rem 0 2.3rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.9rem;
  border-radius: 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.search-input::placeholder { color: var(--text-muted); }
.search-input:focus-visible {
  outline: none;
  border-color: var(--aqi);
  box-shadow: 0 0 0 3px var(--aqi-soft);
}

/* 搜索结果下拉 */
.search-results {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  list-style: none;
  margin: 0;
  padding: 0.3rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--ok-shadow);
  z-index: 40;
  max-height: 320px;
  overflow-y: auto;
}

.search-results li {
  padding: 0.55rem 0.7rem;
  border-radius: 7px;
  cursor: pointer;
  font-size: 0.86rem;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.6rem;
  transition: background 0.12s;
}

.search-results li:hover,
.search-results li.active {
  background: var(--aqi-soft);
}

.search-results .res-name { color: var(--text); font-weight: 500; }
.search-results .res-meta { color: var(--text-muted); font-family: var(--ok-mono); font-size: 0.74rem; }
.search-results .res-empty { color: var(--text-muted); cursor: default; }
.search-results .res-empty:hover { background: transparent; }

/* ---------- 收藏按钮 ---------- */
.fav-btn {
  font: inherit;
  height: 2.6rem;
  padding: 0 0.95rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 600;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.fav-btn:hover { border-color: var(--aqi); color: var(--aqi); }
.fav-star { font-size: 1rem; line-height: 1; }
.fav-btn.on { color: var(--aqi); border-color: var(--aqi); background: var(--aqi-soft); }

/* ---------- 收藏城市芯片 ---------- */
.fav-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.9rem;
}

.fav-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.4rem 0.4rem 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 0.8rem;
  color: var(--text);
  transition: border-color 0.15s, background 0.15s;
}

.fav-chip:hover { border-color: var(--aqi); background: var(--aqi-soft); }
.fav-chip .chip-name { cursor: pointer; }
.fav-chip .chip-del {
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.95rem;
  line-height: 1;
  padding: 0 0.25rem;
  border-radius: 999px;
}
.fav-chip .chip-del:hover { color: #f87171; }

/* ---------- 布局网格 ---------- */
.layout {
  display: grid;
  grid-template-columns: 1.35fr 0.65fr;
  gap: 1rem;
  margin-top: 1rem;
}

.pollutants-card,
.trend-card { grid-column: 1 / -1; }

/* ---------- 卡片通用 ---------- */
.card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0)),
    var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--ok-radius);
  padding: 1.3rem;
  box-shadow: var(--ok-shadow);
}

.card-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  font-weight: 600;
}

/* ---------- 主 AQI 卡片 ---------- */
.aqi-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.refresh-btn { height: 2rem; padding: 0 0.7rem; font-size: 0.76rem; }

.aqi-main {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  margin: 0.9rem 0 1.1rem;
  flex-wrap: wrap;
}

.aqi-value {
  font-family: var(--ok-mono);
  font-size: clamp(4.5rem, 14vw, 7.5rem);
  font-weight: 600;
  line-height: 0.9;
  letter-spacing: -0.04em;
  color: var(--aqi);
  text-shadow: 0 0 36px var(--aqi-soft);
  transition: color 0.4s ease, text-shadow 0.4s ease;
}

.aqi-tag {
  font-size: 1rem;
  font-weight: 700;
  padding: 0.32rem 0.9rem;
  border-radius: 999px;
  border: 1px solid currentColor;
  color: var(--aqi);
  background: var(--aqi-soft);
}

.aqi-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
}

.meta-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.meta-value {
  font-family: var(--ok-mono);
  font-weight: 500;
  font-size: 0.9rem;
  text-align: right;
}

/* AQI 等级刻度条 */
.aqi-scale {
  position: relative;
  display: flex;
  height: 8px;
  margin-top: 1.1rem;
  border-radius: 999px;
  overflow: visible;
}
.aqi-scale .scale-bar {
  display: flex;
  height: 8px;
  width: 100%;
  border-radius: 999px;
  overflow: hidden;
}
.aqi-scale .scale-bar span { flex: 1; }
.aqi-scale .seg-good { background: #22c55e; }
.aqi-scale .seg-moderate { background: #eab308; }
.aqi-scale .seg-usg { background: #f97316; }
.aqi-scale .seg-unhealthy { background: #ef4444; }
.aqi-scale .seg-veryUnhealthy { background: #a855f7; }
.aqi-scale .seg-hazardous { background: #991b1b; }

/* AQI 当前位置指示器（绝对定位，相对 .aqi-scale） */
.aqi-marker {
  position: absolute;
  top: -3px;
  left: 0;
  width: 3px;
  height: 14px;
  background: var(--text);
  border-radius: 2px;
  transform: translateX(-50%);
  box-shadow: 0 0 0 2px var(--bg);
  pointer-events: none;
}

/* ---------- 健康建议卡片 ---------- */
.advice-card {
  display: flex;
  flex-direction: column;
}

.advice-icon {
  font-size: 2.2rem;
  line-height: 1;
  margin: 0.9rem 0 0.7rem;
}

.advice-text {
  font-size: 0.95rem;
  line-height: 1.55;
  color: var(--text);
  flex: 1;
}

.advice-sub {
  margin-top: 0.8rem;
  padding-top: 0.8rem;
  border-top: 1px solid var(--border);
  font-family: var(--ok-mono);
  font-size: 0.74rem;
  color: var(--text-muted);
}

/* ---------- 污染物网格 ---------- */
.pollutant-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.8rem;
  margin-top: 1rem;
}

.pollutant-cell {
  position: relative;
  padding: 0.9rem 0.95rem 0.95rem 1.05rem;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.02);
  overflow: hidden;
}

.pollutant-cell::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--cell-color, var(--text-muted));
}

.p-name {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

.p-value {
  font-family: var(--ok-mono);
  font-size: 1.55rem;
  font-weight: 600;
  line-height: 1.1;
  margin-top: 0.35rem;
  color: var(--text);
}

.p-unit {
  font-family: var(--ok-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
  margin-left: 0.2rem;
}

.p-sub {
  margin-top: 0.55rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
}

.p-sub .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--cell-color, var(--text-muted));
  box-shadow: 0 0 8px var(--cell-color);
}

.p-sub .lvl {
  color: var(--cell-color, var(--text-muted));
  font-weight: 600;
}

.p-sub .aqi-num {
  margin-left: auto;
  font-family: var(--ok-mono);
  color: var(--text-muted);
}

/* ---------- 24h 趋势图 ---------- */
.trend-chart { width: 100%; margin-top: 0.6rem; }

.trend-chart :deep(.trend-svg) {
  width: 100%;
  height: auto;
  display: block;
}

.trend-chart :deep(.grid-line) { stroke: rgba(139, 149, 184, 0.16); stroke-width: 1; stroke-dasharray: 2 4; }
.trend-chart :deep(.grid-base) { stroke: rgba(139, 149, 184, 0.4); stroke-width: 1; }
.trend-chart :deep(.axis-label) { fill: var(--text-muted); font-size: 10px; font-family: var(--ok-mono); }
.trend-chart :deep(.axis-x) { fill: var(--text-muted); font-size: 10px; }
.trend-chart :deep(.now-line) { stroke: var(--text); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.5; }
.trend-chart :deep(.now-dot) { fill: var(--aqi); stroke: var(--bg); stroke-width: 2; }
.trend-chart :deep(.now-label) { fill: var(--text); font-size: 9px; font-family: var(--ok-mono); }

/* ---------- 加载与错误（沿用 shared，微调） ---------- */
.ok-loading { padding: 2rem 0.5rem; }
.ok-error { margin-top: 1rem; }

/* ---------- 响应式 ---------- */
@media (max-width: 760px) {
  .layout { grid-template-columns: 1fr; }
  .aqi-value { font-size: clamp(3.6rem, 18vw, 5.5rem); }
  .pollutant-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
}

@media (prefers-reduced-motion: reduce) {
  .aqi-app, .aqi-value { transition: none; }
}
</style>
