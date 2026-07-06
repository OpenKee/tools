<script setup>
/* ============================================================
   Aurora Forecast — 极光预报（Vue 3 SFC）
   数据源：NOAA SWPC
     · KP 指数历史与预报：products/noaa-planetary-k-index.json
     · 极光可见性网格：json/ovation_aurora_latest.json
   接口失败时降级到内嵌示例数据，保证页面始终可用。
   ============================================================ */

import { ref, computed, watch, onMounted } from 'vue'
import { useT } from '../i18n.js'
import { fetchJSON, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- 文案字典（中英双语） ---------- */
const copy = {
  en: {
    title: 'Aurora Forecast',
    eyebrow: 'NOAA SWPC · Space Weather',
    lead: 'Real-time planetary Kp index, 3-day forecast and aurora oval visibility from NOAA SWPC.',
    refresh: 'Refresh',
    latitude: 'Latitude',
    currentKp: 'Current Kp Index',
    visibleLat: 'Visible latitude',
    lastUpdated: 'Last updated',
    forecast3day: '3-Day Kp Forecast',
    auroraMap: 'Aurora Visibility',
    northHemi: 'Northern Hemisphere',
    southHemi: 'Southern Hemisphere',
    observation: 'Observation Advice',
    legend: 'Kp Index Legend',
    levelLow: 'Low',
    levelMed: 'Medium',
    levelHigh: 'High',
    levelStorm: 'Storm',
    loading: 'Loading…',
    fallbackNote: 'Live API unavailable — showing sample data',
    dataSource: 'Data: NOAA SWPC',
    builtBy: 'Built by',
    auroraNote: 'Brighter colors = higher aurora probability. Dashed ring marks your latitude.',
    adviceStrong: 'Strong aurora activity — you have a high chance of seeing the lights tonight. Find a dark sky with a clear view toward the pole.',
    advicePossible: 'Aurora may be visible from your latitude tonight. Seek a dark location away from city lights.',
    adviceEdge: 'You are near the edge of visibility. A low horizon toward the pole could reveal a faint glow.',
    adviceUnlikely: 'Aurora is unlikely at your latitude tonight. Activity would need to strengthen to reach you.',
    legendRange: 'Kp {a}–{b}',
    legendVis: 'Visible from ~{lat}°',
    yourLat: 'Your latitude',
    hemiN: 'N',
    hemiS: 'S'
  },
  zh: {
    title: '极光预报',
    eyebrow: 'NOAA SWPC · 空间天气',
    lead: '来自 NOAA 空间天气预报中心的实时行星 Kp 指数、未来 3 天预报与极光椭圆可见范围。',
    refresh: '刷新',
    latitude: '纬度',
    currentKp: '当前 Kp 指数',
    visibleLat: '可见纬度',
    lastUpdated: '更新时间',
    forecast3day: '未来 3 天 Kp 预报',
    auroraMap: '极光可见范围',
    northHemi: '北半球',
    southHemi: '南半球',
    observation: '观测建议',
    legend: 'Kp 指数等级图例',
    levelLow: '低',
    levelMed: '中',
    levelHigh: '高',
    levelStorm: '风暴',
    loading: '加载中…',
    fallbackNote: '实时接口不可用——正在显示示例数据',
    dataSource: '数据：NOAA SWPC',
    builtBy: '由',
    auroraNote: '颜色越亮代表极光概率越高。虚线圆环为您所选纬度。',
    adviceStrong: '极光活动强烈——今晚您很有机会看到极光。请寻找黑暗、视野朝向极点方向的开阔地。',
    advicePossible: '今晚您所在纬度有可能看到极光。请远离城市灯光，寻找黑暗地点。',
    adviceEdge: '您处于可见边缘附近。朝向极点方向的低矮地平线可能看到微弱光晕。',
    adviceUnlikely: '今晚您所在纬度不太可能看到极光，需要活动进一步增强才能抵达。',
    legendRange: 'Kp {a}–{b}',
    legendVis: '约 {lat}° 起可见',
    yourLat: '您的纬度',
    hemiN: '北',
    hemiS: '南'
  }
}

const t = useT(copy)

/* ---------- 常量 ---------- */
const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'
const KP_FORECAST_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json'
const AURORA_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json'
const LEVEL_COLORS = { low: '#4ade80', med: '#22d3ee', high: '#a855f7', storm: '#f43f5e' }
const LEGEND = [
  { key: 'low', a: 0, b: 3 },
  { key: 'med', a: 4, b: 5 },
  { key: 'high', a: 6, b: 7 },
  { key: 'storm', a: 8, b: 9 }
]

// 纬度下拉选项
const latOptions = [70, 65, 60, 55, 50, 45, 40, 35, 30, -45, -55, -65]

/* ---------- 预报条形图布局常量 ---------- */
const FC_W = 720, FC_H = 240
const FC_PAD_L = 30, FC_PAD_R = 12, FC_PAD_T = 14, FC_PAD_B = 30
const FC_PLOT_W = FC_W - FC_PAD_L - FC_PAD_R
const FC_PLOT_H = FC_H - FC_PAD_T - FC_PAD_B
const FC_GRID = [0, 3, 5, 7, 9]

/* ---------- 响应式状态 ---------- */
const userLat = ref(55)             // 用户所选纬度
const loading = ref(true)           // 加载中
const kpParsed = ref(null)          // 解析后的 KP 数据 { current, forecast }
const aurora = ref(null)            // 极光可见性数据
const usedFallback = ref(false)     // 是否使用了降级数据

/* ---------- Canvas 引用 ---------- */
const northCanvas = ref(null)
const southCanvas = ref(null)

/* ---------- 工具函数 ---------- */

// KP 值 -> 等级
function kpLevel(kp) {
  if (kp < 4) return 'low'
  if (kp < 6) return 'med'
  if (kp < 8) return 'high'
  return 'storm'
}

// 等级 -> i18n key
function levelKey(l) {
  return { low: 'levelLow', med: 'levelMed', high: 'levelHigh', storm: 'levelStorm' }[l]
}

// 极光赤道侧可见纬度（地理纬度近似：66 - 2*Kp）
function visibleLatitude(kp) { return Math.round(66 - 2 * kp) }

// 解析 NOAA 时间字符串（视为 UTC）
function parseTime(s) {
  let str = String(s).replace(' ', 'T')
  if (!/[zZ]|[+-]\d\d:?\d\d$/.test(str)) str += 'Z'
  return new Date(str)
}

// 本地化时间格式化
function fmtTime(d) {
  if (!d || isNaN(d.getTime())) return '—'
  const loc = locale()
  return d.toLocaleString(loc, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// 格式化为 UTC 字符串（用于 mock 数据，匹配 NOAA 格式）
function fmtUTC(d) {
  function p(n) { return n < 10 ? '0' + n : '' + n }
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
    ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds())
}

// 极光强度 -> 颜色
function auroraColor(intensity) {
  if (intensity > 75) return '#f472b6'
  if (intensity > 50) return '#a855f7'
  if (intensity > 25) return '#22d3ee'
  return '#4ade80'
}

// y 坐标：Kp 0 在底部，Kp 9 在顶部
function fcY(kp) { return FC_PAD_T + FC_PLOT_H - (kp / 9) * FC_PLOT_H }

/* ---------- 示例数据（API 失败时降级用） ---------- */

// 生成 mock KP 数据（结构与 NOAA 新格式一致：对象数组）
function mockKp() {
  const rows = []
  const now = new Date()
  // 过去 30 小时（实测）
  for (let h = -30; h <= 0; h += 3) {
    const tm = new Date(now.getTime() + h * 3600000)
    const kp = 2 + 2 * Math.sin(h / 8) + (h > -6 ? 1.5 : 0)
    rows.push({ time_tag: fmtUTC(tm), Kp: Math.max(0, kp).toFixed(2), a_running: 10, station_count: 8 })
  }
  // 未来 72 小时（预报），含一次风暴峰值
  for (let h = 3; h <= 72; h += 3) {
    const tf = new Date(now.getTime() + h * 3600000)
    const kp2 = 3 + 3 * Math.sin(h / 10) + (h > 24 && h < 42 ? 2.5 : 0)
    rows.push({ time_tag: fmtUTC(tf), Kp: Math.min(9, Math.max(0, kp2)).toFixed(2), a_running: 10, station_count: 0 })
  }
  return rows
}

// 生成 mock 极光可见性数据（合成极光椭圆）
function mockAurora() {
  const coords = []
  const now = Date.now()
  // 北半球椭圆（中心纬度 ~68°）
  for (let lat = 55; lat <= 80; lat++) {
    for (let lon = -180; lon < 180; lon += 3) {
      const dlat = lat - 68
      const nightMod = 0.5 + 0.5 * Math.cos(lon * Math.PI / 180)
      const intensity = Math.exp(-(dlat * dlat) / 18) * 80 * (0.4 + 0.6 * nightMod)
      if (intensity > 3) coords.push([lon, lat, Math.round(intensity)])
    }
  }
  // 南半球椭圆（中心纬度 ~-68°）
  for (let slat = -80; slat <= -55; slat++) {
    for (let slon = -180; slon < 180; slon += 3) {
      const sdlat = slat - (-68)
      const snight = 0.5 + 0.5 * Math.cos(slon * Math.PI / 180)
      const sint = Math.exp(-(sdlat * sdlat) / 18) * 80 * (0.4 + 0.6 * snight)
      if (sint > 3) coords.push([slon, slat, Math.round(sint)])
    }
  }
  return {
    'Observation Time': new Date(now - 3600000).toISOString(),
    'Forecast Time': new Date(now).toISOString(),
    'Data Format': '[Longitude, Latitude, Aurora]',
    coordinates: coords
  }
}

/* ---------- 解析 KP 数据 ---------- */

// NOAA 当前提供两种格式：对象数组 [{time_tag,Kp,a_running,station_count}]（新）
// 或嵌套数组 [['time_tag', 'Kp', ...], [...]]（旧）。此处兼容两者。
function normalizeKpRow(r) {
  if (!r) return null
  if (Array.isArray(r)) {
    return {
      time: parseTime(r[0]),
      kp: parseFloat(r[1]),
      station: parseInt(r[3], 10) || 0
    }
  }
  const time = r.time_tag || r.TimeTag || r.time
  const kp = r.Kp || r.kp || r.KP
  const station = r.station_count || r.StationCount || r.station || 0
  return {
    time: parseTime(time),
    kp: parseFloat(kp),
    station: parseInt(station, 10) || 0
  }
}

function parseKp(rows, forecastRows) {
  if (!rows || !rows.length) return { current: null, forecast: [] }

  const now = Date.now()
  const data = rows.map(normalizeKpRow).filter((d) => {
    return d && !isNaN(d.kp) && d.time && !isNaN(d.time.getTime())
  })

  const measured = data.filter((d) => d.station > 0)
  let current = measured.length ? measured[measured.length - 1] : null
  if (!current) {
    current = data.filter((d) => d.time.getTime() <= now).pop() || data[0] || null
  }

  // 预报优先使用专用 forecast 接口；若不可用，用历史数据兜底
  let forecast = []
  if (forecastRows && forecastRows.length) {
    forecast = forecastRows.map(normalizeKpRow).filter((d) => {
      return d && !isNaN(d.kp) && d.time && !isNaN(d.time.getTime())
    }).filter((d) => d.time.getTime() > now).slice(0, 24)
  }
  if (!forecast.length) {
    forecast = data.filter((d) => d.time.getTime() > now).slice(0, 24)
  }
  if (!forecast.length) forecast = data.slice(-24)
  return { current, forecast }
}

/* ---------- 派生：当前 KP 卡片 ---------- */
const currentEntry = computed(() => (kpParsed.value && kpParsed.value.current) ? kpParsed.value.current : null)
const currentKp = computed(() => currentEntry.value ? currentEntry.value.kp : 0)
const currentLevel = computed(() => kpLevel(currentKp.value))
const kpDisplay = computed(() => currentEntry.value ? currentEntry.value.kp.toFixed(1) : '—')
const kpValueColor = computed(() => currentEntry.value ? LEVEL_COLORS[currentLevel.value] : 'var(--accent)')
const kpLevelText = computed(() => currentEntry.value ? t.value(levelKey(currentLevel.value)) : '—')
const kpLevelColor = computed(() => currentEntry.value ? LEVEL_COLORS[currentLevel.value] : 'var(--accent)')
const kpVisibleLatDisplay = computed(() => currentEntry.value ? visibleLatitude(currentKp.value) + '°' : '—')
const kpUpdatedDisplay = computed(() => currentEntry.value ? fmtTime(currentEntry.value.time) : '—')

/* ---------- 派生：预报条形图数据 ---------- */
const forecastEntries = computed(() => (kpParsed.value && kpParsed.value.forecast) ? kpParsed.value.forecast : [])

const forecastBars = computed(() => {
  const entries = forecastEntries.value
  const n = entries.length
  if (!n) return []
  const slot = FC_PLOT_W / n
  const barW = slot * 0.62
  return entries.map((e, i) => {
    const kp = e.kp
    const x = FC_PAD_L + i * slot + (slot - barW) / 2
    const top = fcY(kp)
    const h = (FC_PAD_T + FC_PLOT_H) - top
    return {
      x, y: top, w: barW, h: Math.max(1, h),
      color: LEVEL_COLORS[kpLevel(kp)],
      kp, timeLabel: fmtTime(e.time)
    }
  })
})

const forecastXLabels = computed(() => {
  const entries = forecastEntries.value
  const n = entries.length
  if (!n) return []
  const slot = FC_PLOT_W / n
  const loc = locale()
  const labels = []
  let lastDay = null
  entries.forEach((e, i) => {
    const dayKey = e.time.toDateString()
    if (dayKey !== lastDay) {
      lastDay = dayKey
      const x = FC_PAD_L + i * slot + slot / 2
      const label = e.time.toLocaleDateString(loc, { month: 'short', day: 'numeric' })
      labels.push({ x, label })
    }
  })
  return labels
})

/* ---------- 派生：观测建议 ---------- */
const adviceData = computed(() => {
  const kp = currentKp.value
  const visLat = visibleLatitude(kp)
  const diff = Math.abs(userLat.value) - visLat
  let icon, key
  if (diff >= 0 && kp >= 6) { icon = '✅'; key = 'adviceStrong' }
  else if (diff >= 0) { icon = '✅'; key = 'advicePossible' }
  else if (diff >= -5) { icon = '⚠️'; key = 'adviceEdge' }
  else { icon = '❌'; key = 'adviceUnlikely' }
  const hemi = userLat.value >= 0 ? t.value('hemiN') : t.value('hemiS')
  const sub = t.value('yourLat') + ': ' + Math.abs(userLat.value) + '°' + hemi +
    '  ·  ' + t.value('visibleLat') + ': ' + visLat + '°'
  return { icon, text: t.value(key), sub }
})

/* ---------- 派生：KP 等级图例 ---------- */
const legendItems = computed(() => {
  return LEGEND.map((it) => {
    const color = LEVEL_COLORS[it.key]
    const visFrom = visibleLatitude(it.b)
    const visTo = visibleLatitude(it.a)
    const range = t.value('legendRange').replace('{a}', it.a).replace('{b}', it.b)
    const vis = t.value('legendVis').replace('{lat}', visFrom + '–' + visTo)
    return {
      key: it.key,
      color,
      name: t.value(levelKey(it.key)),
      range,
      vis
    }
  })
})

/* ---------- 派生：状态提示 ---------- */
const statusData = computed(() => {
  if (usedFallback.value) {
    return { text: t.value('fallbackNote'), warn: true }
  }
  const cur = kpParsed.value && kpParsed.value.current
  return { text: cur ? (t.value('lastUpdated') + ': ' + fmtTime(cur.time)) : '', warn: false }
})

/* ---------- 渲染：极光可见范围（Canvas 极投影） ---------- */
function drawHemisphere(canvas, coords, hemisphere) {
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  const size = 300
  // 内部分辨率按 dpr 放大，保证清晰
  if (canvas.width !== size * dpr) {
    canvas.width = size * dpr
    canvas.height = size * dpr
  }
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, size, size)

  const cx = size / 2, cy = size / 2
  const R = size / 2 - 10

  // 背景圆（极区底色）
  ctx.fillStyle = '#0a0e27'
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.fill()

  // 纬度环 60° / 70° / 80°
  ctx.strokeStyle = 'rgba(139,149,201,0.28)'
  ctx.lineWidth = 1
  ctx.fillStyle = 'rgba(139,149,201,0.6)'
  ctx.font = '9px "JetBrains Mono", monospace'
  ;[80, 70, 60].forEach((lat) => {
    const r = (90 - lat) / 90 * R
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.stroke()
    ctx.fillText(lat + '°', cx + r + 2, cy - 2)
  })

  // 经线 每 45°
  for (let m = 0; m < 360; m += 45) {
    const a = m * Math.PI / 180
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + R * Math.sin(a), cy - R * Math.cos(a))
    ctx.stroke()
  }

  // 极光强度色块
  const step = Math.max(1, Math.floor(coords.length / 15000))
  for (let i = 0; i < coords.length; i += step) {
    const c = coords[i]
    const lon = c[0], lat = c[1], intensity = c[2] || 0
    if (intensity <= 2) continue
    const inNorth = lat >= 0
    if (hemisphere === 'north' && !inNorth) continue
    if (hemisphere === 'south' && inNorth) continue
    const absLat = Math.abs(lat)
    if (absLat < 50) continue
    const r = (90 - absLat) / 90 * R
    const ang = lon * Math.PI / 180
    const x = cx + r * Math.sin(ang)
    const y = cy - r * Math.cos(ang)
    ctx.fillStyle = auroraColor(intensity)
    ctx.globalAlpha = Math.min(1, intensity / 100 * 0.85 + 0.15)
    ctx.fillRect(x - 1.3, y - 1.3, 2.8, 2.8)
  }
  ctx.globalAlpha = 1

  // 用户所选纬度环（虚线），颜色随当前 KP 等级
  const curKp = (kpParsed.value && kpParsed.value.current) ? kpParsed.value.current.kp : 0
  const ringColor = LEVEL_COLORS[kpLevel(curKp)]
  const uLat = userLat.value
  if ((hemisphere === 'north' && uLat > 0) || (hemisphere === 'south' && uLat < 0)) {
    const ur = (90 - Math.abs(uLat)) / 90 * R
    ctx.strokeStyle = ringColor
    ctx.setLineDash([4, 4])
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(cx, cy, ur, 0, 2 * Math.PI); ctx.stroke()
    ctx.setLineDash([])
  }

  // 极点中心标记
  ctx.fillStyle = 'rgba(232,236,255,0.55)'
  ctx.beginPath(); ctx.arc(cx, cy, 2, 0, 2 * Math.PI); ctx.fill()
}

function renderAurora() {
  const coords = aurora.value ? (aurora.value.coordinates || aurora.value['Coordinates'] || []) : []
  drawHemisphere(northCanvas.value, coords, 'north')
  drawHemisphere(southCanvas.value, coords, 'south')
}

/* ---------- 数据加载（带降级） ---------- */
async function load() {
  loading.value = true
  let kpFallback = false
  let auroraFallback = false

  const kpP = fetchJSON(KP_URL).catch(() => { kpFallback = true; return mockKp() })
  const fcP = fetchJSON(KP_FORECAST_URL).catch(() => null)
  const auP = fetchJSON(AURORA_URL).catch(() => { auroraFallback = true; return mockAurora() })

  try {
    const [kpRes, fcRes, auRes] = await Promise.all([kpP, fcP, auP])
    kpParsed.value = parseKp(kpRes, fcRes)
    aurora.value = auRes
    // 只有核心数据（当前 KP / 极光图）降级才提示；预报接口失败会静默使用历史/模拟数据
    usedFallback.value = kpFallback || auroraFallback
  } catch (e) {
    // 最终兜底
    kpParsed.value = parseKp(mockKp())
    aurora.value = mockAurora()
    usedFallback.value = true
  } finally {
    loading.value = false
  }
}

/* ---------- watch：数据/纬度变化时重绘 Canvas ---------- */
watch([kpParsed, aurora, userLat], () => {
  renderAurora()
})

/* ---------- 生命周期 ---------- */
onMounted(() => {
  load()
})
</script>

<template>
  <div class="aurora-app">
    <!-- 顶部栏：标题 + 语言切换 -->
    <AppHeader :title="t('title')" :show-lang-toggle="true" />

    <main class="shell">
      <!-- 页头说明 + 控件 -->
      <section class="masthead">
        <p class="eyebrow">{{ t('eyebrow') }}</p>
        <p class="lead">{{ t('lead') }}</p>
        <div class="controls">
          <label class="control-label">
            <span>{{ t('latitude') }}</span>
            <select v-model.number="userLat" class="select">
              <option v-for="opt in latOptions" :key="opt" :value="opt">{{ opt }}°</option>
            </select>
          </label>
          <button class="ok-btn-ghost" type="button" @click="load">{{ t('refresh') }}</button>
          <span class="status-note" :class="{ warn: statusData.warn }">{{ statusData.text }}</span>
        </div>
      </section>

      <!-- 加载状态 -->
      <div v-show="loading" class="ok-loading">
        <span class="ok-spinner"></span>
        <span>{{ t('loading') }}</span>
      </div>

      <!-- 主体布局 -->
      <div v-show="!loading && kpParsed" class="layout">
        <!-- 当前 KP 指数大卡片 -->
        <section class="card kp-card">
          <div class="card-label">{{ t('currentKp') }}</div>
          <div class="kp-main">
            <div class="kp-value" :style="{ color: kpValueColor }">{{ kpDisplay }}</div>
            <div class="kp-level" :style="{ color: kpLevelColor, borderColor: kpLevelColor }">{{ kpLevelText }}</div>
          </div>
          <div class="kp-meta">
            <div class="meta-row">
              <span class="meta-label">{{ t('visibleLat') }}</span>
              <span class="meta-value">{{ kpVisibleLatDisplay }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">{{ t('lastUpdated') }}</span>
              <span class="meta-value">{{ kpUpdatedDisplay }}</span>
            </div>
          </div>
        </section>

        <!-- 观测建议卡片 -->
        <section class="card advice-card">
          <div class="card-label">{{ t('observation') }}</div>
          <div class="advice-icon">{{ adviceData.icon }}</div>
          <p class="advice-text">{{ adviceData.text }}</p>
          <p class="advice-sub">{{ adviceData.sub }}</p>
        </section>

        <!-- 未来 3 天 KP 预报条形图 -->
        <section class="card forecast-card">
          <div class="card-label">{{ t('forecast3day') }}</div>
          <div class="forecast-chart">
            <svg
              v-if="forecastBars.length"
              class="forecast-svg"
              :viewBox="`0 0 ${FC_W} ${FC_H}`"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              :aria-label="t('forecast3day')"
            >
              <!-- 网格线 + y 轴标签 -->
              <template v-for="kp in FC_GRID" :key="kp">
                <line
                  :x1="FC_PAD_L" :y1="fcY(kp)" :x2="FC_W - FC_PAD_R" :y2="fcY(kp)"
                  :class="kp === 0 ? 'grid-base' : 'grid-line'"
                  :stroke-dasharray="kp === 0 ? null : '2 4'"
                />
                <text :x="FC_PAD_L - 6" :y="fcY(kp) + 3" text-anchor="end" class="axis-label">{{ kp }}</text>
              </template>
              <!-- 柱子 -->
              <rect
                v-for="(b, i) in forecastBars"
                :key="'b' + i"
                class="bar"
                :x="b.x.toFixed(1)"
                :y="b.y.toFixed(1)"
                :width="b.w.toFixed(1)"
                :height="b.h.toFixed(1)"
                rx="2"
                :fill="b.color"
                opacity="0.88"
              >
                <title>Kp {{ b.kp.toFixed(1) }} · {{ b.timeLabel }}</title>
              </rect>
              <!-- x 轴日期标签 -->
              <text
                v-for="(lbl, i) in forecastXLabels"
                :key="'x' + i"
                :x="lbl.x.toFixed(1)"
                :y="FC_H - 10"
                text-anchor="middle"
                class="x-label"
              >{{ lbl.label }}</text>
            </svg>
            <svg
              v-else
              class="forecast-svg"
              :viewBox="`0 0 ${FC_W} ${FC_H}`"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              :aria-label="t('forecast3day')"
            >
              <text :x="FC_W / 2" :y="FC_H / 2" text-anchor="middle" class="axis-label">—</text>
            </svg>
          </div>
        </section>

        <!-- 极光可见范围可视化 -->
        <section class="card aurora-card">
          <div class="card-label">{{ t('auroraMap') }}</div>
          <div class="aurora-grid">
            <div class="aurora-panel">
              <div class="aurora-title">{{ t('northHemi') }}</div>
              <canvas ref="northCanvas" class="aurora-canvas" width="300" height="300"></canvas>
            </div>
            <div class="aurora-panel">
              <div class="aurora-title">{{ t('southHemi') }}</div>
              <canvas ref="southCanvas" class="aurora-canvas" width="300" height="300"></canvas>
            </div>
          </div>
          <p class="aurora-note">{{ t('auroraNote') }}</p>
        </section>

        <!-- KP 指数等级图例 -->
        <section class="card legend-card">
          <div class="card-label">{{ t('legend') }}</div>
          <div class="legend-grid">
            <div v-for="item in legendItems" :key="item.key" class="legend-item">
              <span class="legend-swatch" :style="{ background: item.color, color: item.color }"></span>
              <div class="legend-info">
                <div class="legend-name">{{ item.name }}</div>
                <div class="legend-range">{{ item.range }}</div>
                <div class="legend-vis">{{ item.vis }}</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>

    <!-- 数据来源说明 + 页脚 -->
    <p class="data-source">{{ t('dataSource') }}</p>
    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Aurora Forecast — 深蓝/紫色北极光主题，color-scheme: dark
   原 :root 变量迁移到组件根类 .aurora-app，
   --ok-* 令牌在此覆盖，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.aurora-app {
  /* app 自有变量 */
  --bg: #0a0e27;
  --surface: #131a3a;
  --surface-2: #1a2347;
  --text: #e8ecff;
  --text-muted: #8b95c9;
  --border: #2a3358;
  --accent: #4ade80;
  --accent-2: #22d3ee;
  --accent-3: #a855f7;
  --storm: #f43f5e;
  color-scheme: dark;

  /* 映射到共享设计 token */
  --ok-bg: var(--bg);
  --ok-surface: var(--surface);
  --ok-text: var(--text);
  --ok-text-muted: var(--text-muted);
  --ok-border: var(--border);
  --ok-accent: var(--accent);
  --ok-accent-contrast: #0a0e27;
  --ok-radius: 14px;
  --ok-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
  --ok-topbar-h: 3.4rem;

  /* 共享组件（topbar/footer）在深色主题下的适配 */
  --ok-line: var(--border);
  --ok-panel: var(--surface);
  --ok-muted: var(--text-muted);
  --ok-accent-soft: rgba(74, 222, 128, 0.12);
  --ok-topbar-line: var(--border);
  --ok-footer-line: var(--border);
  --ok-footer-text: var(--text-muted);
  --ok-footer-link: var(--accent);

  /* 字体 */
  --ok-font: "Sora", system-ui, -apple-system, sans-serif;
  --ok-mono: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;

  /* 原 body 样式迁移到根元素 */
  font-family: var(--ok-font);
  color: var(--text);
  background:
    radial-gradient(1200px 600px at 82% -12%, rgba(74, 222, 128, 0.12), transparent 60%),
    radial-gradient(900px 520px at 8% -5%, rgba(168, 85, 247, 0.12), transparent 55%),
    radial-gradient(700px 500px at 50% 110%, rgba(34, 211, 238, 0.08), transparent 60%),
    var(--bg);
  background-attachment: fixed;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, p, strong, span, small { margin: 0; }

/* ---------- 顶部栏（覆盖 AppHeader 的 .ok-topbar） ---------- */
.aurora-app :deep(.ok-topbar) {
  height: var(--ok-topbar-h);
  padding: 0 1.2rem;
  font-size: 0.85rem;
  justify-content: space-between;
  background: rgba(10, 14, 39, 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 20;
}

.aurora-app :deep(.topbar-title) {
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
  padding: 1.3rem 0 0.9rem;
  border-bottom: 1px solid var(--border);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent);
}

.lead {
  margin-top: 0.5rem;
  color: var(--text-muted);
  font-size: 0.92rem;
  line-height: 1.6;
  max-width: 62ch;
}

.controls {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 0.95rem;
}

.control-label {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.select {
  font: inherit;
  height: 2.2rem;
  padding: 0 0.6rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.82rem;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.select:hover { border-color: var(--accent); color: var(--accent); }
.select:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

.status-note {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-left: auto;
}

.status-note.warn { color: #fbbf24; }

/* ---------- 布局网格 ---------- */
.layout {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 1rem;
  margin-top: 1rem;
}

.forecast-card,
.aurora-card,
.legend-card { grid-column: 1 / -1; }

/* ---------- 卡片 ---------- */
.card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0)),
    var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--ok-radius);
  padding: 1.25rem;
  box-shadow: var(--ok-shadow);
}

.card-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  font-weight: 600;
  margin-bottom: 0.9rem;
}

/* ---------- 当前 KP 卡片 ---------- */
.kp-main {
  display: flex;
  align-items: baseline;
  gap: 0.9rem;
  margin-bottom: 1rem;
}

.kp-value {
  font-family: var(--ok-mono);
  font-size: 4.2rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--accent);
  text-shadow: 0 0 24px rgba(74, 222, 128, 0.35);
  animation: kp-pulse 3.6s ease-in-out infinite;
}

@keyframes kp-pulse {
  0%, 100% { text-shadow: 0 0 18px rgba(74, 222, 128, 0.25); }
  50% { text-shadow: 0 0 32px rgba(74, 222, 128, 0.55); }
}

.kp-level {
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0.22rem 0.7rem;
  border-radius: 999px;
  border: 1px solid currentColor;
  color: var(--accent);
}

.kp-meta {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding-top: 0.9rem;
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
  font-weight: 600;
  font-size: 0.92rem;
}

/* ---------- 观测建议卡片 ---------- */
.advice-card { display: flex; flex-direction: column; }

.advice-icon {
  font-size: 2.2rem;
  line-height: 1;
  margin-bottom: 0.6rem;
}

.advice-text {
  font-size: 0.95rem;
  line-height: 1.55;
  color: var(--text);
  flex: 1;
}

.advice-sub {
  margin-top: 0.7rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--border);
  font-family: var(--ok-mono);
  font-size: 0.74rem;
  color: var(--text-muted);
}

/* ---------- 预报条形图 ---------- */
.forecast-chart { width: 100%; }

.forecast-svg {
  width: 100%;
  height: auto;
  display: block;
}

.forecast-svg .grid-line { stroke: rgba(139, 149, 201, 0.16); stroke-width: 1; }
.forecast-svg .grid-base { stroke: rgba(139, 149, 201, 0.4); stroke-width: 1; }
.forecast-svg .axis-label { fill: var(--text-muted); font-size: 10px; font-family: var(--ok-mono); }
.forecast-svg .x-label { fill: var(--text-muted); font-size: 10px; }
.forecast-svg .bar { transition: opacity 0.15s; }
.forecast-svg .bar:hover { opacity: 1; }

/* ---------- 极光可见范围 ---------- */
.aurora-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.aurora-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.aurora-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.6rem;
}

.aurora-canvas {
  width: 300px;
  max-width: 100%;
  height: auto;
  aspect-ratio: 1 / 1;
  display: block;
}

.aurora-note {
  margin-top: 0.9rem;
  font-size: 0.76rem;
  color: var(--text-muted);
  line-height: 1.5;
}

/* ---------- KP 等级图例 ---------- */
.legend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.8rem;
}

.legend-item {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
}

.legend-swatch {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  margin-top: 2px;
  box-shadow: 0 0 12px currentColor;
}

.legend-name {
  font-weight: 700;
  font-size: 0.92rem;
}

.legend-range {
  font-family: var(--ok-mono);
  font-size: 0.76rem;
  color: var(--text);
  margin-top: 0.15rem;
}

.legend-vis {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 0.1rem;
}

/* ---------- 数据来源说明 ---------- */
.data-source {
  text-align: center;
  font-size: 0.72rem;
  color: var(--text-muted);
  padding: 0 1rem 0.5rem;
}

/* ---------- 加载状态（沿用 shared，微调） ---------- */
.aurora-app :deep(.ok-loading) { padding: 2rem 0.5rem; }

/* ---------- 响应式 ---------- */
@media (max-width: 760px) {
  .layout { grid-template-columns: 1fr; }
  .aurora-grid { grid-template-columns: 1fr; }
  .kp-value { font-size: 3.4rem; }
  .status-note { margin-left: 0; width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .kp-value { animation: none; }
}
</style>
