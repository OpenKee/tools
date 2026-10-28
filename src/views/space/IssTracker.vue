<script setup>
import { ref, computed, watch, onMounted, onActivated, onDeactivated, onBeforeUnmount } from 'vue'
import { CalendarClock, MapPin, Orbit, Users } from '@lucide/vue'
import { i18nState, useT } from '../../i18n.js'
import { themeState } from '../../theme.js'
import { locale, locateMe, issPasses } from '../../ok.js'
import { getIssPosition, getPeopleInSpace } from '../../lib/space-data.js'
import { detectRegion } from '../../lib/regions.js'
import { MAP_ATTRIBUTION, mapTileUrl } from '../../lib/map-tiles.js'
import {
  UiBadge,
  UiButton,
  UiCard,
  UiEmptyState,
  UiErrorState,
  UiField,
  UiInput,
  UiLoading,
} from '../../components/ui/index.js'
import L from 'leaflet'
import copy from '../../copy/iss-tracker.js'
import 'leaflet/dist/leaflet.css'

const t = useT(copy)

const TRAIL_MAX = 360

const mapEl = ref(null)
const lastPos = ref(null)
const lastUpdateTs = ref(null)
const astrosData = ref(null)
const astrosState = ref('loading')
const passLat = ref('')
const passLon = ref('')
const passState = ref('idle')
const passItems = ref([])
const passError = ref('')

let map = null
let tileLayer = null
let issMarker = null
let footprint = null
let trailLayer = null
let trail = []
let prevPos = null
let positionTimer = null

const latText = computed(() => (lastPos.value ? lastPos.value.lat.toFixed(3) + '°' : '--'))

const lonText = computed(() => (lastPos.value ? lastPos.value.lon.toFixed(3) + '°' : '--'))

const badgeText = computed(() => {
  if (!lastPos.value) return '--'
  return formatCoord(lastPos.value.lat, 'lat') + ', ' + formatCoord(lastPos.value.lon, 'lon')
})

const regionText = computed(() => {
  if (!lastPos.value) return '--'
  const r = detectRegion(lastPos.value.lat, lastPos.value.lon)
  return i18nState.lang === 'zh' ? r.zh : r.en
})

const speedText = computed(() => {
  const s = lastPos.value && lastPos.value.speed
  if (s != null && s > 0) return Math.round(s).toLocaleString(locale()) + ' km/h'
  return '~27,600 km/h'
})

const altText = computed(() => {
  const a = lastPos.value && lastPos.value.alt
  return (a ? '~' + Math.round(a) : '~408') + ' km'
})

const lastUpdateText = computed(() => {
  if (!lastUpdateTs.value) return '--:--:--'
  return new Date(lastUpdateTs.value).toLocaleTimeString(locale(), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
})

const astrosCountText = computed(() => (astrosData.value ? astrosData.value.number : '--'))

const astrosList = computed(() => (astrosData.value && astrosData.value.people) || [])

const latPh = computed(() => t.value('latPh'))
const lonPh = computed(() => t.value('lonPh'))

function formatCoord(v, type) {
  const dir = type === 'lat' ? (v >= 0 ? 'N' : 'S') : v >= 0 ? 'E' : 'W'
  return Math.abs(v).toFixed(2) + '° ' + dir
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371
  const toRad = function (d) {
    return (d * Math.PI) / 180
  }
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * R * Math.asin(Math.sqrt(a))
}

function applyBaseMap() {
  if (!map) return
  const url = mapTileUrl(themeState.theme)
  if (tileLayer && tileLayer._url === url) return
  if (tileLayer) map.removeLayer(tileLayer)
  tileLayer = L.tileLayer(url, {
    attribution: MAP_ATTRIBUTION,
    maxZoom: 19,
  }).addTo(map)
  tileLayer.bringToBack()
}

function initMap() {
  map = L.map(mapEl.value, {
    zoomControl: true,
    worldCopyJump: true,
    minZoom: 2,
    maxZoom: 8,
    attributionControl: true,
  }).setView([20, 0], 2)

  applyBaseMap()

  trailLayer = L.layerGroup().addTo(map)

  const icon = L.divIcon({
    className: 'iss-marker',
    html: '<div class="iss-icon"><span class="iss-ring"></span><span class="iss-core"></span></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
  issMarker = L.marker([0, 0], { icon: icon, zIndexOffset: 1000 }).addTo(map)

  footprint = L.circle([0, 0], {
    radius: 1500000,
    color: '#38bdf8',
    weight: 1,
    opacity: 0.4,
    fillColor: '#38bdf8',
    fillOpacity: 0.06,
  }).addTo(map)

  requestAnimationFrame(function () {
    if (map) map.invalidateSize()
  })
}

async function fetchISSPosition() {
  try {
    const data = await getIssPosition({ timeout: 20000 })
    handleNewPosition(data.lat, data.lon, data.ts, data.speed, data.alt)
  } catch (err) {
    console.warn('ISS position fetch failed:', err)
  }
}

function handleNewPosition(lat, lon, ts, apiSpeed, apiAlt) {
  if (!map || !issMarker || !footprint) return

  const newPos = { lat: lat, lon: lon, t: ts }

  let speed = apiSpeed || null
  if (speed == null && prevPos) {
    const dist = haversine(prevPos.lat, prevPos.lon, lat, lon)
    const dt = (ts - prevPos.t) / 3600000
    if (dt > 0) speed = dist / dt
  }
  prevPos = newPos
  trail.push(newPos)
  if (trail.length > TRAIL_MAX) trail.shift()

  issMarker.setLatLng([lat, lon])
  footprint.setLatLng([lat, lon])

  if (trail.length === 1) {
    map.setView([lat, lon], 4)
  }

  redrawTrail()

  lastPos.value = { lat, lon, t: ts, speed, alt: apiAlt }
  lastUpdateTs.value = ts
}

function redrawTrail() {
  trailLayer.clearLayers()
  if (trail.length < 2) return

  const segments = [[]]
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i]
    const seg = segments[segments.length - 1]
    if (seg.length > 0) {
      const prev = seg[seg.length - 1]
      if (Math.abs(p.lon - prev[1]) > 180) {
        segments.push([])
      }
    }
    segments[segments.length - 1].push([p.lat, p.lon])
  }

  segments.forEach(function (seg) {
    if (seg.length >= 2) {
      L.polyline(seg, {
        color: '#38bdf8',
        weight: 2,
        opacity: 0.5,
        dashArray: '4 4',
      }).addTo(trailLayer)
    }
  })
}

async function fetchAstronauts() {
  astrosState.value = 'loading'
  try {
    astrosData.value = await getPeopleInSpace({ timeout: 20000 })
    astrosState.value = 'loaded'
  } catch (err) {
    console.warn('Astronauts fetch failed:', err)
    astrosState.value = 'error'
  }
}

async function fetchPass(lat, lon) {
  passState.value = 'updating'
  passItems.value = []

  try {
    const passes = await issPasses({ lat, lon, limit: 3, withinHours: null, days: 5 })
    if (!passes.length) {
      passState.value = 'empty'
      return
    }
    passItems.value = passes.map(function (p) {
      return { risetime: p.risetime, duration: p.duration }
    })
    passState.value = 'loaded'
  } catch (err) {
    console.warn('Pass fetch failed:', err)
    passError.value = 'fetchError'
    passState.value = 'error'
  }
}

function formatPassTime(risetime) {
  return new Date(risetime * 1000).toLocaleString(locale(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function onPassBtn() {
  const lat = parseFloat(passLat.value)
  const lon = parseFloat(passLon.value)
  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    passError.value = 'enterCoords'
    passState.value = 'error'
    return
  }
  fetchPass(lat, lon)
}

function onUseLocBtn() {
  locateMe()
    .then((loc) => {
      passLat.value = loc.lat.toFixed(2)
      passLon.value = loc.lon.toFixed(2)
      fetchPass(loc.lat, loc.lon)
    })
    .catch(() => {
      passError.value = 'locError'
      passState.value = 'error'
    })
}

function startPolling() {
  if (positionTimer) return
  positionTimer = setInterval(() => {
    if (!document.hidden) fetchISSPosition()
  }, 5000)
}

function stopPolling() {
  if (positionTimer) {
    clearInterval(positionTimer)
    positionTimer = null
  }
}

let wasDeactivated = false

watch(
  () => themeState.theme,
  () => applyBaseMap(),
)

onMounted(() => {
  initMap()
  fetchISSPosition()
  fetchAstronauts()
  startPolling()
})

onActivated(() => {
  if (!wasDeactivated) return
  wasDeactivated = false
  if (map) map.invalidateSize()
  fetchISSPosition()
  startPolling()
})

onDeactivated(() => {
  wasDeactivated = true
  stopPolling()
})

onBeforeUnmount(() => {
  stopPolling()
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<template>
  <div class="iss-app">
    <div class="iss-toolbar">
      <UiBadge variant="up" dot class="live-pill">
        <span>{{ t('live') }}</span>
        <span class="live-time">{{ lastUpdateText }}</span>
      </UiBadge>
      <span class="toolbar-hint">{{ t('refreshHint') }}</span>
    </div>

    <section class="dashboard">
      <div class="map-wrap">
        <div ref="mapEl" class="map" role="application" aria-label="ISS real-time position map"></div>
        <div class="map-badge" aria-hidden="true">
          <span class="badge-label">{{ t('coords') }}</span>
          <span class="badge-value">{{ badgeText }}</span>
        </div>
      </div>

      <aside class="info-panel" aria-label="ISS information panels">
        <UiCard density="compact" :label="t('coords')" :icon="MapPin" accent="#38bdf8" :interactive="false">
          <div class="card-rows">
            <div class="row">
              <span>{{ t('latitude') }}</span
              ><strong>{{ latText }}</strong>
            </div>
            <div class="row">
              <span>{{ t('longitude') }}</span
              ><strong>{{ lonText }}</strong>
            </div>
            <div class="row">
              <span>{{ t('region') }}</span
              ><strong>{{ regionText }}</strong>
            </div>
          </div>
        </UiCard>

        <UiCard density="compact" :label="t('orbit')" :icon="Orbit" accent="#38bdf8" :interactive="false">
          <div class="card-rows">
            <div class="row">
              <span>{{ t('speed') }}</span
              ><strong>{{ speedText }}</strong>
            </div>
            <div class="row">
              <span>{{ t('altitude') }}</span
              ><strong>{{ altText }}</strong>
            </div>
            <div class="row">
              <span>{{ t('orbitPeriod') }}</span
              ><strong>~92 min</strong>
            </div>
          </div>
        </UiCard>

        <UiCard
          density="compact"
          :label="astrosData ? astrosCountText + ' ' + t('inSpace') : t('crewInSpace')"
          :icon="Users"
          accent="#a78bfa"
          :interactive="false"
        >
          <div class="astros-list">
            <UiLoading v-if="astrosState === 'loading'" compact :label="t('loadingAstros')" />
            <UiErrorState
              v-else-if="astrosState === 'error'"
              :message="t('fetchError')"
              :retry-label="t('retry')"
              @retry="fetchAstronauts"
            />
            <template v-else>
              <div v-for="(p, i) in astrosList" :key="i" class="astro-item">
                <span>{{ p.name }}</span>
                <span class="craft" :title="p.agency">{{ p.agencyAbbrev || p.agency || '—' }}</span>
              </div>
            </template>
          </div>
        </UiCard>

        <UiCard density="compact" :label="t('nextPass')" :icon="CalendarClock" accent="#38bdf8" :interactive="false">
          <div class="pass-form">
            <UiField :label="t('latitude')">
              <UiInput
                v-model="passLat"
                type="number"
                step="0.01"
                min="-90"
                max="90"
                monospace
                :placeholder="latPh"
                :aria-label="t('latitude')"
              />
            </UiField>
            <UiField :label="t('longitude')">
              <UiInput
                v-model="passLon"
                type="number"
                step="0.01"
                min="-180"
                max="180"
                monospace
                :placeholder="lonPh"
                :aria-label="t('longitude')"
              />
            </UiField>
          </div>
          <div class="pass-actions">
            <UiButton variant="secondary" block :aria-label="t('useLocAria')" @click="onUseLocBtn">
              {{ t('useLoc') }}
            </UiButton>
            <UiButton variant="primary" block @click="onPassBtn">{{ t('check') }}</UiButton>
          </div>
          <div class="pass-result" aria-live="polite">
            <UiLoading v-if="passState === 'updating'" compact :label="t('updating')" />
            <UiEmptyState v-else-if="passState === 'empty'" :description="t('noPass')" compact />
            <UiErrorState v-else-if="passState === 'error'" :message="t(passError)" retry-label="" />
            <template v-else-if="passState === 'loaded'">
              <div v-for="(p, i) in passItems" :key="i" class="pass-item">
                <span class="pass-time">{{ formatPassTime(p.risetime) }}</span>
                <span class="pass-dur">{{ p.duration }}s</span>
              </div>
            </template>
          </div>
        </UiCard>
      </aside>
    </section>
  </div>
</template>

<style scoped>
.iss-app {
  --bg: var(--ok-bg);
  --panel: var(--ok-panel);
  --line: var(--ok-line);
  --text: var(--ok-text);
  --muted: var(--ok-muted);
  --accent: var(--ok-accent);
  --accent-soft: var(--ok-accent-soft);

  color: var(--ok-text);
  font-family: var(--ok-font);
  -webkit-font-smoothing: antialiased;
}

.iss-app .dashboard {
  margin-top: 0;
}

.iss-app a {
  color: var(--accent);
  text-decoration: none;
}
.iss-app h1,
.iss-app h2,
.iss-app h3,
.iss-app p,
.iss-app strong,
.iss-app span,
.iss-app small {
  margin: 0;
}

.iss-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 0.9rem;
  margin-bottom: 0.8rem;
}

.toolbar-hint {
  color: var(--muted);
  font-size: 0.72rem;
}

.live-pill {
  font-family: var(--ok-mono);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
}

.live-pill :deep(.ui-badge-dot) {
  width: 8px;
  height: 8px;
  animation: live-pulse 1.6s ease-in-out infinite;
}

@keyframes live-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.8);
  }
}

.live-time {
  color: var(--muted);
  font-weight: 500;
}

.dashboard {
  margin-top: 1.2rem;
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 1rem;
  align-items: start;
}

.map-wrap {
  position: relative;
  border: 1px solid var(--line);
  border-radius: var(--ok-radius-lg);
  overflow: hidden;
  background: var(--panel);
  height: 560px;
  box-shadow: var(--ok-shadow-card);
}

.map {
  width: 100%;
  height: 100%;
  background: var(--ok-map-bg);
}

.map-badge {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 500;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.5rem 0.75rem;
  background: var(--ok-map-badge-bg);
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-sm);
  pointer-events: none;
}

.badge-label {
  font-family: var(--ok-mono);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}

.badge-value {
  font-family: var(--ok-mono);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent);
}

.info-panel {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.card-rows {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.8rem;
  gap: 0.5rem;
}

.row span {
  color: var(--muted);
}
.row strong {
  font-family: var(--ok-mono);
  font-weight: 600;
  color: var(--text);
  text-align: right;
}

.astros-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.astro-item {
  font-size: 0.78rem;
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  line-height: 1.4;
}
.astro-item .craft {
  font-family: var(--ok-mono);
  font-size: 0.66rem;
  color: var(--muted);
  text-align: right;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.pass-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.pass-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.pass-result {
  margin-top: 0.6rem;
  font-size: 0.78rem;
}

.pass-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.35rem 0;
  border-bottom: 1px dashed var(--line);
  gap: 0.5rem;
}
.pass-item:last-child {
  border-bottom: none;
}
.pass-item .pass-time {
  font-family: var(--ok-mono);
  color: var(--accent);
  font-weight: 500;
}
.pass-item .pass-dur {
  color: var(--muted);
  font-size: 0.72rem;
}

.iss-app :deep(.leaflet-container) {
  background: var(--ok-map-bg);
  font-family: var(--ok-font);

  z-index: 0;
}
.iss-app :deep(.leaflet-control-zoom a) {
  background: var(--ok-map-control-bg) !important;
  color: var(--ok-map-control-text) !important;
  border-color: var(--ok-map-control-border) !important;
}
.iss-app :deep(.leaflet-control-zoom a:hover) {
  background: var(--ok-accent-soft) !important;
  color: var(--ok-accent) !important;
}
.iss-app :deep(.leaflet-control-attribution) {
  background: var(--ok-map-attribution-bg) !important;
  color: var(--ok-map-attribution-text) !important;
  font-size: 0.6rem !important;
}
.iss-app :deep(.leaflet-control-attribution a) {
  color: var(--ok-accent) !important;
}
.iss-app :deep(.leaflet-bar) {
  border: none !important;
}

.iss-app :deep(.iss-marker) {
  background: transparent;
  border: none;
}
.iss-app :deep(.iss-icon) {
  position: relative;
  width: 18px;
  height: 18px;
}
.iss-app :deep(.iss-core) {
  position: absolute;
  inset: 4px;
  background: var(--accent);
  border-radius: 50%;
  box-shadow: 0 0 12px 2px var(--accent);
}
.iss-app :deep(.iss-ring) {
  position: absolute;
  inset: 0;
  border: 2px solid var(--accent);
  border-radius: 50%;
  animation: iss-ping 2s ease-out infinite;
}
@keyframes iss-ping {
  0% {
    transform: scale(0.6);
    opacity: 0.9;
  }
  100% {
    transform: scale(2.6);
    opacity: 0;
  }
}

@media (max-width: 880px) {
  .dashboard {
    grid-template-columns: 1fr;
  }
  .map-wrap {
    height: 420px;
  }
}

@media (max-width: 480px) {
  .map-wrap {
    height: 320px;
  }
}
</style>
