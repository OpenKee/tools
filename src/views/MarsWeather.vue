<script setup>
/* ============================================================
   Mars Weather — 火星天气（Vue 3 SFC）
   数据来源：MAAS2 API（NASA Curiosity / InSight 公开数据聚合）
   API 不可用时降级到内置模拟数据，保证页面功能完整。
   ============================================================ */

import { ref, computed, watch, onMounted } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- i18n 文案字典（中英双语） ---------- */
const copy = {
  en: {
    eyebrow: 'Mars · Curiosity / InSight data',
    title: 'Mars Weather',
    lead: 'Surface weather records from Mars: temperature, pressure, wind and season. Latest Sol fetched live via MAAS2, with a 7-Sol trend built from the most recent observation.',
    celsius: '°C',
    fahrenheit: '°F',
    dataSource: 'Data source',
    season: 'Season',
    latestSol: 'Latest Sol',
    updated: 'Updated',
    martianSeason: 'Martian season',
    trendTitle: '7-Sol temperature trend',
    maxTemp: 'High',
    minTemp: 'Low',
    solDaysTitle: 'Recent Sol weather',
    solHint: 'Sol = a Mars day (~24h 37m)',
    loading: 'Loading Mars weather data…',
    sourceTitle: 'Data source',
    sourceText: 'The latest Sol data comes from the MAAS2 API, which aggregates NASA Curiosity and InSight rover weather observations. Because MAAS2 only exposes the most recent Sol, the surrounding 6 Sols are generated from the latest reading to show the 7-Sol trend. When the API is unavailable, the page falls back to built-in simulated data so all features keep working.',
    // Sol 卡片
    sol: 'Sol',
    high: 'High',
    low: 'Low',
    pressure: 'Pressure',
    wind: 'Wind',
    windDir: 'Wind dir',
    seasonLabel: 'Season',
    // 季节描述
    seasonWinter: 'Winter on Mars brings cold, dusty skies and reduced sunlight at the landing site.',
    seasonSpring: 'Spring sees rising temperatures and occasional dust storms begin to form.',
    seasonSummer: 'Summer is the warmest season, though still well below freezing by Earth standards.',
    seasonAutumn: 'Autumn brings falling temperatures as the hemisphere tilts away from the Sun.',
    seasonNorth: 'Northern hemisphere',
    seasonSouth: 'Southern hemisphere',
    // 对比
    compareTitle: 'Mars vs Earth',
    distanceSun: 'Distance from Sun',
    dayLength: 'Day length',
    yearLength: 'Year length',
    atmosphere: 'Atmosphere',
    avgTemp: 'Avg surface temp',
    gravity: 'Gravity',
    moons: 'Moons',
    mars: 'Mars',
    earth: 'Earth',
    // 状态
    simulated: 'Simulated data',
    liveData: 'MAAS2 live',
    fetchError: 'Failed to fetch live data, showing simulated data.',
    noData: 'No weather data available.',
  },
  zh: {
    eyebrow: '火星 · 好奇号 / 洞察号数据',
    title: '火星天气',
    lead: '火星地表天气记录：温度、气压、风与季节。最新 Sol 通过 MAAS2 实时获取，7 Sol 趋势基于最近一次观测生成。',
    celsius: '°C',
    fahrenheit: '°F',
    dataSource: '数据来源',
    season: '当前季节',
    latestSol: '最新 Sol',
    updated: '更新时间',
    martianSeason: '火星季节',
    trendTitle: '7 Sol 温度趋势',
    maxTemp: '最高温',
    minTemp: '最低温',
    solDaysTitle: '近期 Sol 天气',
    solHint: 'Sol = 火星日（约 24 小时 37 分）',
    loading: '正在加载火星天气数据…',
    sourceTitle: '数据来源说明',
    sourceText: '最新的 Sol 数据来自 MAAS2 API，它聚合了 NASA 好奇号与洞察号的火星气象观测数据。由于 MAAS2 只提供最新的一个 Sol，周围的 6 个 Sol 会基于最近一次的读数生成，以展示 7 Sol 趋势；当 API 不可用时，页面将展示内置模拟数据以保证功能完整。',
    // Sol 卡片
    sol: 'Sol',
    high: '最高',
    low: '最低',
    pressure: '气压',
    wind: '风速',
    windDir: '风向',
    seasonLabel: '季节',
    // 季节描述
    seasonWinter: '火星冬季：着陆点天空寒冷多尘，日照减弱。',
    seasonSpring: '火星春季：气温回升，偶有沙尘暴开始形成。',
    seasonSummer: '火星夏季：一年中最温暖的季节，但按地球标准仍远低于冰点。',
    seasonAutumn: '火星秋季：随半球转向背离太阳，气温逐渐下降。',
    seasonNorth: '北半球',
    seasonSouth: '南半球',
    // 对比
    compareTitle: '火星 vs 地球',
    distanceSun: '距太阳距离',
    dayLength: '一天长度',
    yearLength: '一年长度',
    atmosphere: '大气成分',
    avgTemp: '平均地表温度',
    gravity: '重力',
    moons: '卫星',
    mars: '火星',
    earth: '地球',
    // 状态
    simulated: '模拟数据',
    liveData: 'MAAS2 实时',
    fetchError: '实时数据获取失败，已切换为模拟数据。',
    noData: '暂无天气数据。',
  }
}

const t = useT(copy)

/* ---------- API 地址 ---------- */
// MAAS2 本身未设置 CORS，通过 corsproxy.io（免费公开代理）在浏览器端访问。
const MAAS2_URL = 'https://corsproxy.io/?url=https%3A%2F%2Fapi.maas2.apollorion.com%2F'

/* ---------- 季节中英映射 ---------- */
const SEASON_MAP = {
  winter:  { en: 'Winter',  zh: '冬季' },
  spring:  { en: 'Spring',  zh: '春季' },
  summer:  { en: 'Summer',  zh: '夏季' },
  autumn:  { en: 'Autumn',  zh: '秋季' },
  fall:    { en: 'Autumn',  zh: '秋季' },
}

// 季节描述 key（按英文季节名归一）
function seasonDescKey(season) {
  const s = String(season || '').toLowerCase()
  if (s.indexOf('winter') > -1) return 'seasonWinter'
  if (s.indexOf('spring') > -1) return 'seasonSpring'
  if (s.indexOf('summer') > -1) return 'seasonSummer'
  return 'seasonAutumn'
}

// 季节名映射（取不到时回退到原文）
function seasonMap(raw) {
  const k = String(raw || '').toLowerCase()
  return SEASON_MAP[k] || { en: raw || '', zh: raw || '' }
}

/* ---------- 内置模拟数据（API 不可用时降级） ---------- */
// 数值参考 InSight 着陆点（埃律西昂平原）的真实量级
function buildMockData() {
  const season = 'winter'
  const base = Date.now()
  const days = []
  // 7 个 Sol，温度围绕真实火星范围波动
  const seeds = [
    { mx: -24.2, mn: -88.1, pre: 712, hws: 6.4, dir: 'NE', deg: 45 },
    { mx: -21.8, mn: -85.7, pre: 708, hws: 7.8, dir: 'E',  deg: 90 },
    { mx: -26.5, mn: -90.3, pre: 715, hws: 5.2, dir: 'NE', deg: 50 },
    { mx: -23.1, mn: -87.4, pre: 720, hws: 8.9, dir: 'SE', deg: 135 },
    { mx: -19.7, mn: -83.9, pre: 725, hws: 6.1, dir: 'E',  deg: 95 },
    { mx: -22.4, mn: -86.2, pre: 711, hws: 7.0, dir: 'NE', deg: 40 },
    { mx: -25.0, mn: -89.0, pre: 718, hws: 9.3, dir: 'SE', deg: 140 },
  ]
  for (let i = 0; i < 7; i++) {
    const s = seeds[i]
    days.push({
      sol: 1340 + i,
      date: new Date(base - (6 - i) * 86400000),
      at: { av: +((s.mx + s.mn) / 2).toFixed(1), mx: s.mx, mn: s.mn },
      pre: { av: s.pre },
      hws: { av: s.hws },
      wd: { compass_point: s.dir, compass_degrees: s.deg },
      season: season,
      simulated: true,
    })
  }
  return days
}

/* ---------- 解析 MAAS2 API 返回 ---------- */
// MAAS2 返回单个最新 Sol 对象。我们把它作为最新一天，再基于它生成前 6 天。
function parseApiResponse(data) {
  if (!data || data.sol == null) return null
  const latest = maas2ToDay(data, false)
  if (!latest) return null
  const days = [latest]
  // 生成前 6 天：温度、气压、风速在真实值附近小幅波动
  for (let i = 1; i < 7; i++) {
    const factor = i / 6 // 0..1，越往前偏离越大
    const jitter = (max, min) => (Math.random() * (max - min) + min) * factor
    const mx = latest.at.mx + jitter(4, -4)
    const mn = latest.at.mn + jitter(4, -4)
    const pre = latest.pre && latest.pre.av != null
      ? latest.pre.av + jitter(12, -12)
      : null
    const hws = latest.hws && latest.hws.av != null
      ? latest.hws.av + jitter(2, -2)
      : null
    days.unshift({
      sol: latest.sol - i,
      date: new Date(latest.date.getTime() - i * 88700000), // 约一个火星日
      at: { av: +((mx + mn) / 2).toFixed(1), mx: +mx.toFixed(1), mn: +mn.toFixed(1) },
      pre: pre != null ? { av: +pre.toFixed(1) } : null,
      hws: hws != null ? { av: Math.max(0, +hws.toFixed(1)) } : null,
      wd: latest.wd,
      season: latest.season,
      simulated: true, // 历史 Sol 为基于真实数据生成的填充数据
    })
  }
  return days
}

// 将 MAAS2 单个 Sol 对象转成统一 day 结构
function maas2ToDay(d, simulated) {
  const sol = parseInt(d.sol, 10)
  if (isNaN(sol)) return null
  const mx = num(d.max_temp)
  const mn = num(d.min_temp)
  const pre = num(d.pressure)
  const hws = d.wind_speed !== '--' && d.wind_speed != null ? num(d.wind_speed) : null
  const date = d.terrestrial_date ? new Date(d.terrestrial_date) : new Date()
  return {
    sol: sol,
    date: date,
    at: {
      av: mx != null && mn != null ? +((mx + mn) / 2).toFixed(1) : (mx != null ? mx : (mn != null ? mn : null)),
      mx: mx,
      mn: mn,
    },
    pre: pre != null ? { av: pre } : null,
    hws: hws != null ? { av: hws } : null,
    wd: parseWindDirection(d.wind_direction),
    season: d.season || 'unknown',
    simulated: simulated,
  }
}

function parseWindDirection(raw) {
  if (!raw) return null
  const str = String(raw).trim().toUpperCase()
  const DIRS = { N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
                 S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5 }
  const deg = DIRS[str]
  if (deg == null) return null
  return { compass_point: str, compass_degrees: deg }
}

// 安全取数
function num(v) {
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

/* ---------- 温度单位换算 ---------- */
function toF(c) { return c * 9 / 5 + 32 }

// 按当前单位格式化温度（保留 1 位小数）
function fmtTemp(c) {
  if (c == null) return '—'
  const v = unit.value === 'F' ? toF(c) : c
  return v.toFixed(1) + '°' + unit.value
}

/* ---------- 运行时状态 ---------- */
const unit = ref('C')            // 温度单位：'C' | 'F'
const weatherData = ref(null)    // 解析后的天气数据数组（按时间正序）
const isSimulated = ref(false)   // 是否使用模拟数据
const loading = ref(true)        // 加载中标记（初始即为加载态，避免首屏闪烁）
const updatedText = ref('—')     // 状态条更新时间

/* ---------- 派生：最新一天 ---------- */
const latestDay = computed(() => {
  if (!weatherData.value || !weatherData.value.length) return null
  return weatherData.value[weatherData.value.length - 1]
})

/* ---------- 派生：状态条 / 季节卡片文案 ---------- */
const seasonText = computed(() => {
  const d = latestDay.value
  if (!d) return '—'
  const m = seasonMap(d.season)
  return i18nState.lang === 'zh' ? m.zh : m.en
})

const seasonDescKeyValue = computed(() => {
  const d = latestDay.value
  if (!d) return ''
  return seasonDescKey(d.season)
})

const solValText = computed(() => {
  const d = latestDay.value
  return d ? d.sol : '—'
})

/* ---------- 派生：Sol 天气卡片数据 ---------- */
const solCards = computed(() => {
  if (!weatherData.value || !weatherData.value.length) return []
  const arr = weatherData.value
  return arr.map((d, idx) => {
    const isLatest = idx === arr.length - 1
    const dateStr = d.date.toLocaleDateString(locale(), { month: 'short', day: 'numeric' })
    const preStr = d.pre && d.pre.av != null ? Math.round(d.pre.av) + ' Pa' : '—'
    const windStr = d.hws && d.hws.av != null ? d.hws.av.toFixed(1) + ' m/s' : '—'
    const dirStr = d.wd && d.wd.compass_point ? d.wd.compass_point : '—'
    const dirDeg = d.wd && d.wd.compass_degrees != null ? d.wd.compass_degrees : 0
    const m = seasonMap(d.season)
    const cardSeasonText = i18nState.lang === 'zh' ? m.zh : m.en
    return { d, isLatest, dateStr, preStr, windStr, dirStr, dirDeg, cardSeasonText }
  })
})

/* ---------- 派生：温度趋势 SVG 图表几何 ---------- */
const chartGeom = computed(() => {
  const wd = weatherData.value
  if (!wd || wd.length < 2) return null

  // 画布参数
  const W = 720, H = 280
  const padL = 44, padR = 16, padT = 18, padB = 34
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  // 收集最高/最低温（按当前单位）
  const maxVals = wd.map((d) => unit.value === 'F' ? toF(d.at.mx) : d.at.mx)
  const minVals = wd.map((d) => unit.value === 'F' ? toF(d.at.mn) : d.at.mn)

  // 计算坐标范围（留出余量）
  const allVals = maxVals.concat(minVals).filter((v) => v != null)
  if (!allVals.length) return null
  let lo = Math.min.apply(null, allVals)
  let hi = Math.max.apply(null, allVals)
  const span = hi - lo || 1
  lo = lo - span * 0.15
  hi = hi + span * 0.15
  const range = hi - lo

  const n = wd.length
  const x = (i) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v) => padT + innerH - ((v - lo) / range) * innerH

  // 构造折线路径
  function pathFor(vals) {
    let p = ''
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] == null) continue
      p += (p ? ' L' : 'M') + x(i).toFixed(1) + ' ' + y(vals[i]).toFixed(1)
    }
    return p
  }

  // 最高温下方填充区域
  const areaPath = pathFor(maxVals) +
    ' L' + x(n - 1).toFixed(1) + ' ' + (padT + innerH) +
    ' L' + x(0).toFixed(1) + ' ' + (padT + innerH) + ' Z'

  // Y 轴网格线 + 刻度（4 等分）
  const grid = []
  const ticks = 4
  for (let i = 0; i <= ticks; i++) {
    const v = lo + (range * i / ticks)
    grid.push({ yy: y(v), v })
  }

  // X 轴 Sol 标签
  const xLabels = wd.map((d, i) => ({ x: x(i), sol: d.sol }))

  // 数据点 + 数值标签
  const dots = []
  for (let i = 0; i < n; i++) {
    if (maxVals[i] != null) {
      dots.push({ cx: x(i), cy: y(maxVals[i]), type: 'max', label: Math.round(maxVals[i]) + '°', labelY: y(maxVals[i]) - 8 })
    }
    if (minVals[i] != null) {
      dots.push({ cx: x(i), cy: y(minVals[i]), type: 'min', label: Math.round(minVals[i]) + '°', labelY: y(minVals[i]) + 14 })
    }
  }

  return {
    W, H, padL, padR,
    grid, xLabels,
    areaPath,
    maxPath: pathFor(maxVals),
    minPath: pathFor(minVals),
    dots,
    unit: unit.value,
  }
})

/* ---------- 派生：火星 vs 地球对比 ---------- */
const COMPARE = [
  { key: 'distanceSun', mars: '2.279 亿 km', earth: '1.496 亿 km' },
  { key: 'dayLength',   mars: '24h 37m',     earth: '24h 00m' },
  { key: 'yearLength',  mars: '687 地球日',   earth: '365.25 天' },
  { key: 'atmosphere',  mars: '95% CO₂',     earth: '78% N₂ · 21% O₂' },
  { key: 'avgTemp',     mars: '−63 °C',      earth: '15 °C' },
  { key: 'gravity',     mars: '3.71 m/s²',   earth: '9.81 m/s²' },
  { key: 'moons',       mars: '2 (火卫一/二)', earth: '1 (月球)' },
]

// 英文版对比数据
const COMPARE_EN = [
  { key: 'distanceSun', mars: '227.9M km', earth: '149.6M km' },
  { key: 'dayLength',   mars: '24h 37m',   earth: '24h 00m' },
  { key: 'yearLength',  mars: '687 Earth days', earth: '365.25 days' },
  { key: 'atmosphere',  mars: '95% CO₂',   earth: '78% N₂ · 21% O₂' },
  { key: 'avgTemp',     mars: '−63 °C',    earth: '15 °C' },
  { key: 'gravity',     mars: '3.71 m/s²', earth: '9.81 m/s²' },
  { key: 'moons',       mars: '2 (Phobos, Deimos)', earth: '1 (Moon)' },
]

const compareData = computed(() => i18nState.lang === 'zh' ? COMPARE : COMPARE_EN)

/* ---------- 刷新更新时间 ---------- */
function refreshUpdated() {
  updatedText.value = new Date().toLocaleString(locale(), {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

/* ---------- 获取天气数据（实时优先，失败降级模拟） ---------- */
function useMockData() {
  weatherData.value = buildMockData()
  isSimulated.value = true
  loading.value = false
  refreshUpdated()
}

async function fetchWeather() {
  loading.value = true
  try {
    const data = await fetchJSON(MAAS2_URL, { timeout: 15000 })
    const parsed = parseApiResponse(data)
    if (!parsed) {
      // API 返回但无有效数据，降级
      console.warn('MAAS2 API returned no usable data, falling back to mock.')
      useMockData()
      return
    }
    weatherData.value = parsed
    isSimulated.value = false
    loading.value = false
    refreshUpdated()
  } catch (err) {
    console.warn('MAAS2 API fetch failed:', err)
    useMockData()
  }
}

/* ---------- 温度单位切换 ---------- */
function setUnit(u) {
  if (u === unit.value) return
  unit.value = u
}

/* ---------- watch：语言切换时刷新更新时间 ---------- */
watch(() => i18nState.lang, () => {
  if (weatherData.value) refreshUpdated()
})

/* ---------- 生命周期 ---------- */
onMounted(() => {
  fetchWeather()
})
</script>

<template>
  <div class="mars-weather-app">
    <!-- 顶部栏：返回链接 + 语言切换（语言切换由 AppHeader 内部处理） -->
    <AppHeader :show-lang-toggle="true" />

    <main class="shell">
      <!-- 页头：标题 + 简介 + 温度单位切换 -->
      <header class="masthead">
        <div class="masthead-left">
          <p class="eyebrow">{{ t('eyebrow') }}</p>
          <h1>{{ t('title') }}</h1>
          <p class="lead">{{ t('lead') }}</p>
        </div>
        <div class="header-right">
          <div class="unit-toggle" role="group" aria-label="Temperature unit">
            <button
              class="unit-btn"
              :class="{ on: unit === 'C' }"
              type="button"
              :aria-pressed="unit === 'C'"
              @click="setUnit('C')"
            >{{ t('celsius') }}</button>
            <button
              class="unit-btn"
              :class="{ on: unit === 'F' }"
              type="button"
              :aria-pressed="unit === 'F'"
              @click="setUnit('F')"
            >{{ t('fahrenheit') }}</button>
          </div>
        </div>
      </header>

      <!-- 状态条：数据来源 / 季节 / 最新 Sol / 更新时间 -->
      <section class="status-bar" aria-live="polite">
        <div class="status-item">
          <span class="status-label">{{ t('dataSource') }}</span>
          <span class="status-value" :class="{ sim: isSimulated }">
            {{ isSimulated ? t('simulated') : t('liveData') }}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">{{ t('season') }}</span>
          <span class="status-value">{{ seasonText }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">{{ t('latestSol') }}</span>
          <span class="status-value">{{ solValText }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">{{ t('updated') }}</span>
          <span class="status-value">{{ updatedText }}</span>
        </div>
      </section>

      <!-- 当前季节信息卡片 -->
      <section class="season-card" aria-label="Mars season">
        <div class="season-planet" aria-hidden="true">
          <div class="planet-body"></div>
          <div class="planet-glow"></div>
        </div>
        <div class="season-info">
          <span class="season-eyebrow">{{ t('martianSeason') }}</span>
          <h2 class="season-name">{{ seasonText }}</h2>
          <p class="season-desc">{{ seasonDescKeyValue ? t(seasonDescKeyValue) : '—' }}</p>
        </div>
      </section>

      <!-- 温度趋势图 -->
      <section class="chart-card" aria-label="Temperature trend chart">
        <div class="card-head">
          <h3 class="card-title">{{ t('trendTitle') }}</h3>
          <div class="chart-legend">
            <span class="legend-item">
              <span class="legend-dot max"></span>
              <span>{{ t('maxTemp') }}</span>
            </span>
            <span class="legend-item">
              <span class="legend-dot min"></span>
              <span>{{ t('minTemp') }}</span>
            </span>
          </div>
        </div>
        <div class="chart-wrap">
          <svg
            class="trend-chart"
            viewBox="0 0 720 280"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            :aria-label="t('trendTitle')"
          >
            <template v-if="chartGeom">
              <!-- Y 轴网格线 -->
              <line
                v-for="(g, i) in chartGeom.grid"
                :key="'gl' + i"
                class="grid-line"
                :x1="chartGeom.padL"
                :y1="g.yy"
                :x2="chartGeom.W - chartGeom.padR"
                :y2="g.yy"
              />
              <!-- Y 轴刻度文字 -->
              <text
                v-for="(g, i) in chartGeom.grid"
                :key="'gt' + i"
                class="axis-label"
                :x="chartGeom.padL - 6"
                :y="g.yy + 3"
                text-anchor="end"
              >{{ Math.round(g.v) }}°{{ chartGeom.unit }}</text>
              <!-- X 轴 Sol 标签 -->
              <text
                v-for="(xl, i) in chartGeom.xLabels"
                :key="'xl' + i"
                class="axis-label"
                :x="xl.x"
                :y="chartGeom.H - 12"
                text-anchor="middle"
              >{{ xl.sol }}</text>
              <!-- 最高温填充区域 + 折线 -->
              <path class="area-max" :d="chartGeom.areaPath" />
              <path class="line-max" :d="chartGeom.maxPath" />
              <path class="line-min" :d="chartGeom.minPath" />
              <!-- 数据点 -->
              <circle
                v-for="(dot, i) in chartGeom.dots"
                :key="'dc' + i"
                :class="'dot-' + dot.type"
                :cx="dot.cx"
                :cy="dot.cy"
                r="3.5"
              />
              <!-- 数据点数值标签 -->
              <text
                v-for="(dot, i) in chartGeom.dots"
                :key="'dt' + i"
                class="dot-label"
                :x="dot.cx"
                :y="dot.labelY"
                text-anchor="middle"
              >{{ dot.label }}</text>
            </template>
            <text
              v-else
              x="360"
              y="140"
              text-anchor="middle"
              class="axis-label"
            >{{ t('noData') }}</text>
          </svg>
        </div>
      </section>

      <!-- 7 天天气卡片网格 -->
      <section class="section-head">
        <h3 class="section-title">{{ t('solDaysTitle') }}</h3>
        <span class="section-hint">{{ t('solHint') }}</span>
      </section>
      <div class="sol-grid" aria-live="polite">
        <!-- 加载中 -->
        <div v-if="loading" class="loading-note">
          <span class="ok-spinner" aria-hidden="true"></span>
          <span>{{ t('loading') }}</span>
        </div>
        <!-- 暂无数据 -->
        <div v-else-if="!solCards.length" class="error-msg">{{ t('noData') }}</div>
        <!-- Sol 卡片 -->
        <article
          v-for="(card, idx) in solCards"
          :key="card.d.sol"
          class="sol-card"
          :class="{ latest: card.isLatest }"
          :aria-label="'Sol ' + card.d.sol + ' weather'"
        >
          <div class="sol-card-head">
            <span class="sol-num">{{ t('sol') }} {{ card.d.sol }}</span>
            <span class="sol-date">{{ card.dateStr }}</span>
          </div>
          <div class="sol-temp">
            <span class="temp-max">{{ fmtTemp(card.d.at.mx) }}</span>
            <span class="temp-min">{{ fmtTemp(card.d.at.mn) }}</span>
          </div>
          <div class="sol-metrics">
            <div class="metric">
              <span class="metric-label">{{ t('pressure') }}</span>
              <span class="metric-value">{{ card.preStr }}</span>
            </div>
            <div class="wind-row">
              <span class="metric-label">{{ t('wind') }}</span>
              <span class="wind-compass">
                <svg
                  class="wind-arrow"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  :style="{ transform: 'rotate(' + card.dirDeg + 'deg)' }"
                >
                  <path d="M12 3 L18 14 L12 11 L6 14 Z" fill="currentColor" />
                </svg>
                <span>{{ card.windStr }}</span>
              </span>
            </div>
            <div class="metric">
              <span class="metric-label">{{ t('windDir') }}</span>
              <span class="metric-value">{{ card.dirStr }} · {{ card.cardSeasonText }}</span>
            </div>
          </div>
        </article>
      </div>

      <!-- 火星 vs 地球对比 -->
      <section class="section-head">
        <h3 class="section-title">{{ t('compareTitle') }}</h3>
      </section>
      <div class="compare-grid">
        <div v-for="row in compareData" :key="row.key" class="compare-card">
          <div class="compare-label">{{ t(row.key) }}</div>
          <div class="compare-row">
            <span class="compare-planet">{{ t('mars') }}</span>
            <span class="compare-value mars">{{ row.mars }}</span>
          </div>
          <div class="compare-row">
            <span class="compare-planet">{{ t('earth') }}</span>
            <span class="compare-value earth">{{ row.earth }}</span>
          </div>
        </div>
      </div>

      <!-- 数据来源说明 -->
      <section class="source-note">
        <h3 class="note-title">{{ t('sourceTitle') }}</h3>
        <p class="note-text">{{ t('sourceText') }}</p>
        <a class="note-link" href="https://api.nasa.gov/" target="_blank" rel="noreferrer">api.nasa.gov →</a>
      </section>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Mars Weather — 火星橙红主题
   原 :root 变量迁移到组件根类 .mars-weather-app 上，
   --ok-* 令牌在此覆盖，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.mars-weather-app {
  --bg: #1a0f0a;
  --panel: #2a1810;
  --line: rgba(255,140,80,0.12);
  --text: #f0e0d0;
  --muted: #a08070;
  --accent: #ff6b35;
  --accent-soft: rgba(255,107,53,0.1);
  --blue: #4a90d9;
  --frost: #a0d8ef;

  /* 共享组件主题映射 */
  --ok-bg: var(--bg);
  --ok-panel: var(--panel);
  --ok-line: var(--line);
  --ok-text: var(--text);
  --ok-muted: var(--muted);
  --ok-accent: var(--accent);
  --ok-accent-soft: var(--accent-soft);
  --ok-footer-line: var(--line);
  --ok-footer-text: var(--muted);
  --ok-footer-link: var(--accent);
  --ok-topbar-line: var(--line);
  color-scheme: dark;

  /* 原 body 样式迁移到根元素 */
  margin: 0;
  font-family: "Sora", system-ui, sans-serif;
  color: var(--text);
  background: var(--bg);
  /* 火星表面纹理：多层径向渐变模拟尘暴辉光 + 橙红地平线 */
  background-image:
    radial-gradient(circle at 78% 8%, rgba(255,107,53,0.16), transparent 45%),
    radial-gradient(circle at 8% 92%, rgba(180,60,30,0.14), transparent 42%),
    radial-gradient(circle at 50% 120%, rgba(255,140,80,0.12), transparent 55%),
    radial-gradient(1px 1px at 18% 28%, rgba(255,200,150,0.18), transparent),
    radial-gradient(1px 1px at 62% 64%, rgba(255,180,120,0.14), transparent),
    radial-gradient(1px 1px at 84% 36%, rgba(255,210,160,0.12), transparent),
    radial-gradient(1px 1px at 32% 78%, rgba(255,190,130,0.1), transparent);
  background-attachment: fixed;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

.mars-weather-app :deep(*) { box-sizing: border-box; }

.mars-weather-app a { color: var(--accent); text-decoration: none; }
.mars-weather-app h1, .mars-weather-app h2, .mars-weather-app h3,
.mars-weather-app h4, .mars-weather-app p, .mars-weather-app strong,
.mars-weather-app span, .mars-weather-app small { margin: 0; }

/* ---------- 主容器 ---------- */
.shell {
  width: min(1080px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

/* ---------- 页头 ---------- */
.masthead {
  display: flex;
  justify-content: space-between;
  align-items: end;
  padding: 0.3rem 0 1.2rem;
  border-bottom: 1px solid var(--line);
  gap: 1rem;
}

.masthead-left { min-width: 0; }

.eyebrow {
  font-family: "JetBrains Mono", monospace;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--accent);
}

.masthead h1 {
  margin-top: 0.3rem;
  font-family: "Syne", sans-serif;
  font-size: clamp(2.2rem, 6vw, 3.4rem);
  line-height: 0.95;
  letter-spacing: -0.03em;
  font-weight: 800;
}

.lead {
  margin-top: 0.55rem;
  color: var(--muted);
  font-size: 0.9rem;
  max-width: 52ch;
  line-height: 1.6;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-shrink: 0;
}

/* ---------- 温度单位切换 ---------- */
.unit-toggle {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255,255,255,0.02);
}

.unit-btn {
  font: inherit;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.74rem;
  font-weight: 600;
  padding: 0.35rem 0.75rem;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.unit-btn.on {
  background: var(--accent);
  color: #1a0f0a;
}

.unit-btn:not(.on):hover { color: var(--text); }

/* ---------- 状态条 ---------- */
.status-bar {
  margin-top: 1.1rem;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
}

.status-item {
  background: rgba(42,24,16,0.6);
  padding: 0.7rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.status-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}

.status-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text);
}

.status-value.sim {
  color: var(--accent);
}

/* ---------- 季节卡片 ---------- */
.season-card {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 1.3rem;
  padding: 1.2rem 1.4rem;
  background: linear-gradient(135deg, rgba(42,24,16,0.85), rgba(60,28,16,0.6));
  border: 1px solid var(--line);
  border-radius: 14px;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  overflow: hidden;
  position: relative;
}

.season-planet {
  position: relative;
  width: 84px;
  height: 84px;
  flex-shrink: 0;
}

.planet-body {
  position: absolute;
  inset: 8px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 32% 30%, #d9683a, #8a3a1c 60%, #4a1d0e 100%);
  box-shadow:
    inset -8px -8px 18px rgba(0,0,0,0.55),
    inset 4px 4px 10px rgba(255,180,120,0.25);
}

.planet-body::before,
.planet-body::after {
  content: "";
  position: absolute;
  border-radius: 50%;
  background: rgba(0,0,0,0.18);
}
.planet-body::before { width: 22px; height: 14px; top: 18px; left: 12px; transform: rotate(-12deg); }
.planet-body::after { width: 16px; height: 10px; bottom: 16px; right: 14px; transform: rotate(8deg); }

.planet-glow {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,107,53,0.35), transparent 65%);
  filter: blur(4px);
  animation: planet-pulse 4s ease-in-out infinite;
}

@keyframes planet-pulse {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.06); }
}

.season-info { min-width: 0; }

.season-eyebrow {
  font-family: "JetBrains Mono", monospace;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.62rem;
  color: var(--accent);
}

.season-name {
  margin-top: 0.25rem;
  font-family: "Syne", sans-serif;
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
  text-transform: capitalize;
}

.season-desc {
  margin-top: 0.3rem;
  color: var(--muted);
  font-size: 0.82rem;
  line-height: 1.5;
  max-width: 60ch;
}

/* ---------- 通用卡片头部 ---------- */
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 0.9rem;
}

.card-title {
  font-family: "Syne", sans-serif;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.8rem;
  margin: 1.6rem 0 0.9rem;
}

.section-title {
  font-family: "Syne", sans-serif;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
}

.section-hint {
  font-size: 0.72rem;
  color: var(--muted);
}

/* ---------- 温度趋势图 ---------- */
.chart-card {
  margin-top: 1rem;
  padding: 1.1rem 1.2rem 1rem;
  background: rgba(42,24,16,0.55);
  border: 1px solid var(--line);
  border-radius: 14px;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.chart-legend {
  display: flex;
  gap: 0.9rem;
  font-size: 0.72rem;
  color: var(--muted);
}

.legend-item { display: inline-flex; align-items: center; gap: 0.35rem; }

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.legend-dot.max { background: var(--accent); box-shadow: 0 0 6px rgba(255,107,53,0.6); }
.legend-dot.min { background: var(--frost); box-shadow: 0 0 6px rgba(160,216,239,0.5); }

.chart-wrap { width: 100%; }

.trend-chart {
  width: 100%;
  height: auto;
  display: block;
}

/* SVG 图表内部样式 */
.trend-chart .grid-line { stroke: var(--line); stroke-width: 1; }
.trend-chart .axis-label { fill: var(--muted); font-size: 10px; font-family: "JetBrains Mono", monospace; }
.trend-chart .line-max { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.trend-chart .line-min { fill: none; stroke: var(--frost); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.trend-chart .area-max { fill: rgba(255,107,53,0.12); }
.trend-chart .dot-max { fill: var(--accent); }
.trend-chart .dot-min { fill: var(--frost); }
.trend-chart .dot-label { fill: var(--text); font-size: 9px; font-family: "JetBrains Mono", monospace; font-weight: 600; }

/* ---------- Sol 天气卡片网格 ---------- */
.sol-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.8rem;
}

.loading-note {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--muted);
  font-size: 0.85rem;
  padding: 1.5rem 0;
}

.sol-card {
  background: rgba(42,24,16,0.6);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  transition: border-color 0.18s, transform 0.18s;
}

.sol-card:hover {
  border-color: rgba(255,107,53,0.4);
  transform: translateY(-2px);
}

.sol-card.latest {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px rgba(255,107,53,0.25), 0 8px 24px -12px rgba(255,107,53,0.4);
}

.sol-card-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--line);
}

.sol-num {
  font-family: "Syne", sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
}

.sol-date {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.66rem;
  color: var(--muted);
}

.sol-temp {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}

.temp-max {
  font-family: "JetBrains Mono", monospace;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--accent);
  line-height: 1;
}

.temp-min {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--frost);
}

.sol-metrics {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.76rem;
  gap: 0.5rem;
}

.metric-label {
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.metric-value {
  font-family: "JetBrains Mono", monospace;
  font-weight: 500;
  color: var(--text);
  text-align: right;
}

.wind-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.76rem;
}

.wind-compass {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-family: "JetBrains Mono", monospace;
  color: var(--text);
}

.wind-arrow {
  width: 16px;
  height: 16px;
  color: var(--accent);
  transition: transform 0.3s ease;
}

/* ---------- 火星 vs 地球对比 ---------- */
.compare-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.8rem;
}

.compare-card {
  background: rgba(42,24,16,0.55);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 0.9rem 1rem;
}

.compare-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
  margin-bottom: 0.5rem;
}

.compare-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.3rem 0;
}

.compare-row + .compare-row { border-top: 1px dashed var(--line); }

.compare-planet {
  font-size: 0.72rem;
  color: var(--muted);
}

.compare-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text);
  text-align: right;
}

.compare-value.mars { color: var(--accent); }
.compare-value.earth { color: var(--blue); }

/* ---------- 数据来源说明 ---------- */
.source-note {
  margin-top: 1.6rem;
  padding: 1.1rem 1.2rem;
  background: rgba(42,24,16,0.45);
  border: 1px solid var(--line);
  border-left: 3px solid var(--accent);
  border-radius: 10px;
}

.note-title {
  font-family: "Syne", sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.5rem;
}

.note-text {
  color: var(--muted);
  font-size: 0.8rem;
  line-height: 1.65;
}

.note-link {
  display: inline-block;
  margin-top: 0.6rem;
  font-size: 0.78rem;
  font-weight: 600;
}

/* ---------- 错误提示 ---------- */
.error-msg {
  grid-column: 1 / -1;
  color: #f87171;
  font-size: 0.82rem;
  padding: 1rem;
  background: rgba(248,113,113,0.08);
  border: 1px solid rgba(248,113,113,0.25);
  border-radius: 8px;
}

/* ---------- 响应式 ---------- */
@media (max-width: 720px) {
  .masthead { flex-direction: column; align-items: start; }
  .status-bar { grid-template-columns: repeat(2, 1fr); }
  .season-card { flex-direction: column; text-align: center; align-items: center; }
  .season-planet { width: 72px; height: 72px; }
  .chart-legend { flex-wrap: wrap; }
}

@media (max-width: 420px) {
  .header-right { flex-wrap: wrap; }
  .status-bar { grid-template-columns: 1fr; }
}
</style>
