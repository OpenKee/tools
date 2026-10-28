<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { Activity, ChartColumn, Globe2, Layers, Lightbulb, RefreshCw } from '@lucide/vue'
import { useT } from '../../i18n.js'
import { themeState } from '../../theme.js'
import { locale, lsGet } from '../../ok.js'
import { getKpIndex, getKpForecast, getAuroraOval } from '../../lib/space-data.js'
import { KP_BANDS, kpBand, kpVisibleLat } from '../../lib/kp.js'
import { chartTheme, Bar } from '../../lib/charts.js'
import copy from '../../copy/aurora-forecast.js'
import kpScale from '../../copy/kp-scale.js'
import { UiBadge, UiCard, UiEmptyState, UiIconButton, UiLoading, UiTooltip } from '../../components/ui/index.js'

const props = defineProps({
  latitude: { type: Number, default: null },
})

const t = useT(copy)
const kpText = useT(kpScale)

const latOptions = [70, 65, 60, 55, 50, 45, 40, 35, 30, -45, -55, -65]

const userLat = ref(55)
const loading = ref(true)
const kpParsed = ref(null)
const aurora = ref(null)
const usedFallback = ref(false)

const northCanvas = ref(null)
const southCanvas = ref(null)

function parseTime(s) {
  let str = String(s).replace(' ', 'T')
  if (!/[zZ]|[+-]\d\d:?\d\d$/.test(str)) str += 'Z'
  return new Date(str)
}

function fmtTime(d) {
  if (!d || isNaN(d.getTime())) return '—'
  const loc = locale()
  return d.toLocaleString(loc, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtUTC(d) {
  function p(n) {
    return n < 10 ? '0' + n : '' + n
  }
  return (
    d.getUTCFullYear() +
    '-' +
    p(d.getUTCMonth() + 1) +
    '-' +
    p(d.getUTCDate()) +
    ' ' +
    p(d.getUTCHours()) +
    ':' +
    p(d.getUTCMinutes()) +
    ':' +
    p(d.getUTCSeconds())
  )
}

function auroraColor(intensity) {
  if (intensity > 75) return '#f472b6'
  if (intensity > 50) return '#a855f7'
  if (intensity > 25) return '#22d3ee'
  return '#4ade80'
}

function mockKp() {
  const rows = []
  const now = new Date()

  for (let h = -30; h <= 0; h += 3) {
    const tm = new Date(now.getTime() + h * 3600000)
    const kp = 2 + 2 * Math.sin(h / 8) + (h > -6 ? 1.5 : 0)
    rows.push({ time_tag: fmtUTC(tm), Kp: Math.max(0, kp).toFixed(2), a_running: 10, station_count: 8 })
  }

  for (let h = 3; h <= 72; h += 3) {
    const tf = new Date(now.getTime() + h * 3600000)
    const kp2 = 3 + 3 * Math.sin(h / 10) + (h > 24 && h < 42 ? 2.5 : 0)
    rows.push({ time_tag: fmtUTC(tf), Kp: Math.min(9, Math.max(0, kp2)).toFixed(2), a_running: 10, station_count: 0 })
  }
  return rows
}

function mockAurora() {
  const coords = []
  const now = Date.now()

  for (let lat = 55; lat <= 80; lat++) {
    for (let lon = -180; lon < 180; lon += 3) {
      const dlat = lat - 68
      const nightMod = 0.5 + 0.5 * Math.cos((lon * Math.PI) / 180)
      const intensity = Math.exp(-(dlat * dlat) / 18) * 80 * (0.4 + 0.6 * nightMod)
      if (intensity > 3) coords.push([lon, lat, Math.round(intensity)])
    }
  }

  for (let slat = -80; slat <= -55; slat++) {
    for (let slon = -180; slon < 180; slon += 3) {
      const sdlat = slat - -68
      const snight = 0.5 + 0.5 * Math.cos((slon * Math.PI) / 180)
      const sint = Math.exp(-(sdlat * sdlat) / 18) * 80 * (0.4 + 0.6 * snight)
      if (sint > 3) coords.push([slon, slat, Math.round(sint)])
    }
  }
  return {
    'Observation Time': new Date(now - 3600000).toISOString(),
    'Forecast Time': new Date(now).toISOString(),
    'Data Format': '[Longitude, Latitude, Aurora]',
    coordinates: coords,
  }
}

function normalizeKpRow(r) {
  if (!r) return null
  if (Array.isArray(r)) {
    return {
      time: parseTime(r[0]),
      kp: parseFloat(r[1]),
      station: parseInt(r[3], 10) || 0,
    }
  }
  const time = r.time_tag || r.TimeTag || r.time
  const kp = r.Kp || r.kp || r.KP
  const station = r.station_count || r.StationCount || r.station || 0
  return {
    time: parseTime(time),
    kp: parseFloat(kp),
    station: parseInt(station, 10) || 0,
  }
}

function parseKp(rows, forecastRows) {
  const now = Date.now()
  const data = (Array.isArray(rows) ? rows : []).map(normalizeKpRow).filter((d) => {
    return d && !isNaN(d.kp) && d.time && !isNaN(d.time.getTime())
  })

  const measured = data.filter((d) => d.station > 0)
  let current = measured.length ? measured[measured.length - 1] : null
  if (!current) {
    current = data.filter((d) => d.time.getTime() <= now).pop() || data[0] || null
  }

  const forecast = (Array.isArray(forecastRows) ? forecastRows : [])
    .map(normalizeKpRow)
    .filter((d) => {
      return d && !isNaN(d.kp) && d.time && !isNaN(d.time.getTime())
    })
    .filter((d) => d.time.getTime() > now)
    .slice(0, 24)
  return { current, forecast }
}

const currentEntry = computed(() => (kpParsed.value && kpParsed.value.current ? kpParsed.value.current : null))
const currentKp = computed(() => (currentEntry.value ? currentEntry.value.kp : 0))
const currentBand = computed(() => kpBand(currentKp.value))
const kpDisplay = computed(() => (currentEntry.value ? currentEntry.value.kp.toFixed(1) : '—'))
const kpValueColor = computed(() => (currentEntry.value ? currentBand.value.color : 'var(--accent)'))
const kpLevelText = computed(() => (currentEntry.value ? kpText.value(currentBand.value.key) : '—'))
const kpLevelColor = computed(() => (currentEntry.value ? currentBand.value.color : 'var(--accent)'))
const kpVisibleLatDisplay = computed(() =>
  currentEntry.value ? kpVisibleLat(currentKp.value) + '° ' + t.value('hemiBoth') : '—',
)
const kpUpdatedDisplay = computed(() => (currentEntry.value ? fmtTime(currentEntry.value.time) : '—'))

const forecastEntries = computed(() => (kpParsed.value && kpParsed.value.forecast ? kpParsed.value.forecast : []))

const forecastLabels = computed(() => {
  let lastDay = ''
  return forecastEntries.value.map((entry) => {
    const day = entry.time.toDateString()
    if (day !== lastDay) {
      lastDay = day
      return entry.time.toLocaleDateString(locale(), { month: 'short', day: 'numeric' })
    }
    return ''
  })
})

const forecastData = computed(() => ({
  labels: forecastLabels.value,
  datasets: [
    {
      data: forecastEntries.value.map((entry) => entry.kp),
      backgroundColor: forecastEntries.value.map((entry) => kpBand(entry.kp).color),
      borderRadius: 3,
      barPercentage: 0.7,
      categoryPercentage: 0.82,
    },
  ],
}))

const forecastOptions = computed(() => {
  const theme = chartTheme(themeState.theme)
  const entries = forecastEntries.value
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        titleColor: theme.text,
        bodyColor: theme.text,
        displayColors: false,
        callbacks: {
          title: (items) => {
            const entry = entries[items[0].dataIndex]
            return entry ? fmtTime(entry.time) : ''
          },
          label: (item) => {
            const entry = entries[item.dataIndex]
            return entry ? 'Kp ' + entry.kp.toFixed(1) + ' · ' + kpText.value(kpBand(entry.kp).key) : ''
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: theme.line },
        ticks: {
          color: theme.muted,
          font: { size: 10 },
          maxRotation: 0,
          autoSkip: false,
          callback: (value, index) => forecastLabels.value[index] || '',
        },
      },
      y: {
        min: 0,
        max: 9,
        grid: { color: theme.line, drawTicks: false, borderDash: [2, 4] },
        border: { display: false },
        ticks: { color: theme.muted, font: { size: 10 }, stepSize: 3 },
      },
    },
  }
})

const adviceData = computed(() => {
  const kp = currentKp.value
  const visLat = kpVisibleLat(kp)
  const diff = Math.abs(userLat.value) - visLat
  let key
  if (diff >= 0 && kp >= 6) {
    key = 'adviceStrong'
  } else if (diff >= 0) {
    key = 'advicePossible'
  } else if (diff >= -5) {
    key = 'adviceEdge'
  } else {
    key = 'adviceUnlikely'
  }
  const hemi = userLat.value >= 0 ? t.value('hemiN') : t.value('hemiS')
  const sub =
    t.value('yourLat') +
    ': ' +
    Math.abs(userLat.value).toFixed(1) +
    '°' +
    hemi +
    '  ·  ' +
    t.value('visibleLat') +
    ': ' +
    visLat +
    '° ' +
    t.value('hemiBoth')
  return { text: t.value(key), sub }
})

const legendItems = computed(() => {
  return KP_BANDS.map((band) => {
    const range = t.value('legendRange').replace('{a}', band.a).replace('{b}', band.b)
    const vis = t.value('legendVis').replace('{lat}', kpVisibleLat(band.b) + '–' + kpVisibleLat(band.a))
    return {
      key: band.key,
      color: band.color,
      name: kpText.value(band.key),
      range,
      vis,
    }
  })
})

function drawHemisphere(canvas, coords, hemisphere) {
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  const size = 300

  if (canvas.width !== size * dpr) {
    canvas.width = size * dpr
    canvas.height = size * dpr
  }
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, size, size)

  const dark = themeState.theme === 'dark'
  const cx = size / 2,
    cy = size / 2
  const R = size / 2 - 10

  ctx.fillStyle = dark ? '#0a0a0a' : '#e9edf3'
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, 2 * Math.PI)
  ctx.fill()

  ctx.strokeStyle = dark ? 'rgba(139,149,201,0.28)' : 'rgba(37,50,71,0.18)'
  ctx.lineWidth = 1
  ctx.fillStyle = dark ? 'rgba(139,149,201,0.6)' : 'rgba(37,50,71,0.62)'
  ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace'
  ;[80, 70, 60].forEach((lat) => {
    const r = ((90 - lat) / 90) * R
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, 2 * Math.PI)
    ctx.stroke()
    ctx.fillText(lat + '°', cx + r + 2, cy - 2)
  })

  for (let m = 0; m < 360; m += 45) {
    const a = (m * Math.PI) / 180
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + R * Math.sin(a), cy - R * Math.cos(a))
    ctx.stroke()
  }

  const step = Math.max(1, Math.floor(coords.length / 15000))
  for (let i = 0; i < coords.length; i += step) {
    const c = coords[i]
    const lon = c[0],
      lat = c[1],
      intensity = c[2] || 0
    if (intensity <= 2) continue
    const inNorth = lat >= 0
    if (hemisphere === 'north' && !inNorth) continue
    if (hemisphere === 'south' && inNorth) continue
    const absLat = Math.abs(lat)
    if (absLat < 50) continue
    const r = ((90 - absLat) / 90) * R
    const ang = (lon * Math.PI) / 180
    const x = cx + r * Math.sin(ang)
    const y = cy - r * Math.cos(ang)
    ctx.fillStyle = auroraColor(intensity)
    ctx.globalAlpha = Math.min(1, (intensity / 100) * 0.85 + 0.15)
    ctx.fillRect(x - 1.3, y - 1.3, 2.8, 2.8)
  }
  ctx.globalAlpha = 1

  const curKp = kpParsed.value && kpParsed.value.current ? kpParsed.value.current.kp : 0
  const ringColor = kpBand(curKp).color
  const uLat = userLat.value
  if ((hemisphere === 'north' && uLat > 0) || (hemisphere === 'south' && uLat < 0)) {
    const ur = ((90 - Math.abs(uLat)) / 90) * R
    ctx.strokeStyle = ringColor
    ctx.setLineDash([4, 4])
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, ur, 0, 2 * Math.PI)
    ctx.stroke()
    ctx.setLineDash([])
  }

  ctx.fillStyle = dark ? 'rgba(232,236,255,0.55)' : 'rgba(20,40,70,0.55)'
  ctx.beginPath()
  ctx.arc(cx, cy, 2, 0, 2 * Math.PI)
  ctx.fill()
}

function renderAurora() {
  const coords = aurora.value ? aurora.value.coordinates || aurora.value['Coordinates'] || [] : []
  drawHemisphere(northCanvas.value, coords, 'north')
  drawHemisphere(southCanvas.value, coords, 'south')
}

async function load(force = false) {
  loading.value = true
  let kpFallback = false
  let auroraFallback = false

  const kpP = getKpIndex({ force }).catch(() => {
    kpFallback = true
    return mockKp()
  })
  const fcP = getKpForecast({ force }).catch(() => null)
  const auP = getAuroraOval({ force }).catch(() => {
    auroraFallback = true
    return mockAurora()
  })

  try {
    const [kpRes, fcRes, auRes] = await Promise.all([kpP, fcP, auP])
    kpParsed.value = parseKp(kpRes, fcRes)
    aurora.value = auRes

    usedFallback.value = kpFallback || auroraFallback
  } catch (e) {
    kpParsed.value = parseKp(mockKp())
    aurora.value = mockAurora()
    usedFallback.value = true
  } finally {
    loading.value = false
  }
}

watch([kpParsed, aurora, userLat], () => {
  renderAurora()
})

const LAT_KEY = 'aurora-lat'

watch(
  () => props.latitude,
  (v) => {
    if (Number.isFinite(v)) userLat.value = v
  },
)

watch(
  () => themeState.theme,
  () => {
    if (aurora.value) renderAurora()
  },
)

onMounted(() => {
  load()

  if (Number.isFinite(props.latitude)) userLat.value = props.latitude
  else {
    const saved = Number(lsGet(LAT_KEY))
    if (saved && latOptions.includes(saved)) userLat.value = saved
  }
})
</script>

<template>
  <div class="aurora-app">
    <UiBadge v-if="usedFallback" variant="warn" class="fallback-banner">{{ t('fallbackNote') }}</UiBadge>

    <UiLoading v-show="loading" :label="t('loading')" />

    <div v-show="!loading && kpParsed" class="layout">
      <UiCard class="kp-card" :label="t('currentKp')" :icon="Activity" accent="#22c55e" :interactive="false">
        <template #actions>
          <UiTooltip :label="t('refresh')">
            <UiIconButton :label="t('refresh')" variant="secondary" size="sm" @click="load(true)">
              <RefreshCw :size="14" aria-hidden="true" />
            </UiIconButton>
          </UiTooltip>
        </template>
        <div class="kp-main">
          <div class="kp-value" :style="{ color: kpValueColor }">{{ kpDisplay }}</div>
          <UiBadge class="kp-level" :style="{ color: kpLevelColor, borderColor: kpLevelColor }">{{
            kpLevelText
          }}</UiBadge>
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
      </UiCard>

      <UiCard class="advice-card" :label="t('observation')" :icon="Lightbulb" accent="#38bdf8" :interactive="false">
        <p class="advice-text">{{ adviceData.text }}</p>
        <p class="advice-sub">{{ adviceData.sub }}</p>
      </UiCard>

      <UiCard
        class="forecast-card"
        :label="t('forecast3day')"
        :icon="ChartColumn"
        accent="#22c55e"
        :interactive="false"
      >
        <div class="forecast-chart">
          <Bar
            v-if="forecastEntries.length"
            :data="forecastData"
            :options="forecastOptions"
            class="chart-canvas"
            role="img"
            :aria-label="t('forecast3day')"
          />
          <UiEmptyState v-else compact class="chart-empty" :description="t('forecastUnavailable')" />
        </div>
      </UiCard>

      <UiCard class="aurora-card" :label="t('auroraMap')" :icon="Globe2" accent="#22c55e" :interactive="false">
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
      </UiCard>

      <UiCard class="legend-card" :label="t('legend')" :icon="Layers" accent="#94a3b8" :interactive="false">
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
      </UiCard>
    </div>
  </div>
</template>

<style scoped>
.aurora-app {
  --ok-content-width: 1040px;
  --ok-content-gutter: 1.5rem;

  --bg: var(--ok-bg);
  --surface: var(--ok-panel);
  --surface-2: var(--ok-panel);
  --text: var(--ok-text);
  --text-muted: var(--ok-muted);
  --border: var(--ok-line);
  --accent: var(--ok-accent);
  --accent-2: var(--ok-accent);
  --accent-3: var(--ok-accent);
  --storm: #f43f5e;
  --ok-accent-contrast: var(--ok-bg);

  min-height: 0;
  color: var(--text);
  font-family: var(--ok-font);
  background: transparent;
  -webkit-font-smoothing: antialiased;
}

.aurora-app .layout {
  margin-top: 0.8rem;
}

h1,
h2,
h3,
p,
strong,
span,
small {
  margin: 0;
}

.fallback-banner {
  display: flex;
  width: 100%;
  margin-bottom: 0.8rem;
  padding: 0.45rem 0.7rem;
  border-radius: var(--ok-radius-sm);
  font-size: 0.75rem;
  white-space: normal;
}

.layout {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 1rem;
  margin-top: 1rem;
}

.forecast-card,
.aurora-card,
.legend-card {
  grid-column: 1 / -1;
}

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
}

.kp-level {
  background: transparent;
  font-size: 0.82rem;
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

.advice-card {
  display: flex;
  flex-direction: column;
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

.forecast-chart {
  position: relative;
  width: 100%;
  height: 260px;
}

.chart-canvas {
  width: 100% !important;
  height: 100% !important;
  display: block;
}

.chart-empty {
  height: 100%;
  justify-content: center;
}

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
  background: var(--ok-bg);
}

.legend-swatch {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  margin-top: 2px;
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

@media (max-width: 760px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .aurora-grid {
    grid-template-columns: 1fr;
  }
  .kp-value {
    font-size: 3.4rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .kp-value {
    animation: none;
  }
}
</style>
