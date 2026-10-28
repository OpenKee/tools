<script setup>
import { ref, computed, watch, onMounted, onActivated, onBeforeUnmount } from 'vue'
import { i18nState, useT } from '../../i18n.js'
import { themeState } from '../../theme.js'
import { fetchJSON, usgsQuakes } from '../../ok.js'
import { escapeHtml } from '../../lib/format.js'
import { MAP_ATTRIBUTION, mapTileUrl } from '../../lib/map-tiles.js'
import { UiBadge, UiChip, UiErrorState, UiField, UiLoading, UiSegmented, UiStat } from '../../components/ui/index.js'
import L from 'leaflet'
import copy from '../../copy/earthquake.js'
import 'leaflet/dist/leaflet.css'

const t = useT(copy)

const PLATES_URL = 'https://cdn.jsdelivr.net/gh/fraxen/tectonicplates@master/GeoJSON/PB2002_boundaries.json'

const ALERT_COLORS = { green: '#4ade80', yellow: '#facc15', orange: '#fb923c', red: '#ef4444' }

const timeFilters = [
  { key: 'day', tKey: 'day' },
  { key: 'week', tKey: 'week' },
  { key: 'month', tKey: 'month' },
]
const magFilters = [
  { mag: 0, tKey: 'all' },
  { mag: 2.5, label: 'M2.5+' },
  { mag: 4.5, label: 'M4.5+' },
  { mag: 5.5, label: 'M5.5+' },
]

const timeOptions = computed(() => timeFilters.map((f) => ({ value: f.key, label: t.value(f.tKey) })))
const magOptions = computed(() => magFilters.map((f) => ({ value: String(f.mag), label: f.label || t.value(f.tKey) })))

const period = ref('day')
const minMag = ref(0)
const data = ref([])
const loading = ref(false)
const hasError = ref(false)
const updateTime = ref('')
const showPlates = ref(false)

const mapEl = ref(null)
let map = null
let tileLayer = null
let layerGroup = null
let platesLayer = null
let platesData = null

function magClass(m) {
  if (m == null) return 'g'
  if (m < 3) return 'g'
  if (m < 5) return 'y'
  if (m < 6) return 'o'
  return 'r'
}

function magColor(m) {
  if (m == null) return '#4ade80'
  if (m < 3) return '#4ade80'
  if (m < 5) return '#facc15'
  if (m < 6) return '#fb923c'
  return '#ef4444'
}

function timeAgo(ts) {
  const d = Math.max(0, Math.round((Date.now() - ts) / 60000))
  if (d < 60) return d + t.value('mago')
  if (d < 1440) return Math.round(d / 60) + t.value('hago')
  return Math.round(d / 1440) + t.value('dago')
}

function eqRadius(m) {
  const z = map.getZoom()
  const base = Math.sqrt(Math.pow(10, 1.02 * m - 4) / Math.PI) * 1000
  const scale = Math.pow(2, 10 - z) * 0.15
  return Math.max(3000, base * scale)
}

function alertColor(a) {
  return ALERT_COLORS[a] || ''
}

const listItems = computed(() => data.value.slice(0, 100))

const stats = computed(() => {
  const cd = data.value
  let mx = -Infinity,
    dp = 0,
    sg = 0,
    vd = 0
  cd.forEach((e) => {
    const m = e.properties.mag
    const d = e.geometry.coordinates[2]
    if (m != null && m > mx) mx = m
    if (m >= 5) sg++
    if (d != null) {
      dp += d
      vd++
    }
  })
  const av = vd ? Math.round(dp / vd) : 0
  return {
    total: cd.length,
    maxMag: mx > -Infinity ? mx.toFixed(1) : '-',
    avgDepth: av,
    m5: sg,
  }
})

async function loadData() {
  loading.value = true
  hasError.value = false
  const e = new Date(),
    s = new Date()
  if (period.value === 'day') s.setDate(s.getDate() - 1)
  else if (period.value === 'week') s.setDate(s.getDate() - 7)
  else s.setMonth(s.getMonth() - 1)
  try {
    const features = await usgsQuakes({
      starttime: s.toISOString(),
      endtime: e.toISOString(),
      minMag: minMag.value,
      limit: 20000,
    })
    data.value = features || []
    updateTime.value = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit' })
  } catch (err) {
    data.value = []
    hasError.value = true
  } finally {
    loading.value = false
  }
}

function renderMapMarkers() {
  if (!map || !layerGroup) return
  layerGroup.clearLayers()
  const cd = data.value
  cd.forEach((eq) => {
    const p = eq.properties,
      c = eq.geometry.coordinates
    const m = p.mag || 0
    const d = c[2] != null ? Math.round(c[2]) : '?'
    const col = magColor(m)
    const r = eqRadius(m)
    const place = escapeHtml(p.place || t.value('unknown'))

    const ah = p.alert
      ? '<br><strong>' +
        t.value('popImpact') +
        ':</strong> <span style="text-transform:uppercase;font-weight:bold;color:' +
        ALERT_COLORS[p.alert] +
        '">' +
        escapeHtml(p.alert) +
        '</span>'
      : ''
    const fh = p.felt
      ? '<br><strong>' + t.value('felt') + ':</strong> ' + escapeHtml(p.felt) + ' ' + t.value('people')
      : ''
    const th = p.tsunami ? '<br><strong style="color:#3b82f6">' + t.value('tsunami') + '</strong>' : ''
    const pop =
      '<div class="popup-title" style="color:' +
      col +
      '">M ' +
      escapeHtml(m.toFixed(1)) +
      '</div>' +
      '<div class="popup-sub"><strong>' +
      t.value('location') +
      ':</strong> ' +
      place +
      '<br><strong>' +
      t.value('depth') +
      ':</strong> ' +
      escapeHtml(String(d)) +
      ' km' +
      '<br><strong>' +
      t.value('radius') +
      ':</strong> ' +
      (r / 1000).toFixed(0) +
      ' km' +
      '<br><strong>' +
      t.value('time') +
      ':</strong> ' +
      escapeHtml(new Date(p.time).toLocaleString()) +
      ah +
      fh +
      th +
      '</div>'

    ;[-360, 0, 360].forEach((off) => {
      const k = L.circle([c[1], c[0] + off], {
        radius: r,
        fillColor: col,
        color: col,
        weight: 1,
        opacity: 0.5,
        fillOpacity: 0.2,
      })
      k.bindPopup(pop)
      k.addTo(layerGroup)
    })
  })
}

async function togglePlates() {
  showPlates.value = !showPlates.value
  if (showPlates.value) {
    if (!platesData) {
      try {
        platesData = await fetchJSON(PLATES_URL)
        platesLayer = L.layerGroup()
        L.geoJSON(platesData, { style: { color: '#ef4444', weight: 1.5, opacity: 0.7 } }).eachLayer((l) =>
          platesLayer.addLayer(l),
        )
      } catch (e) {
        console.warn('Plate boundaries load failed:', e)
      }
    }
    if (platesLayer && !map.hasLayer(platesLayer)) platesLayer.addTo(map)
  } else {
    if (platesLayer && map.hasLayer(platesLayer)) map.removeLayer(platesLayer)
  }
}

function onItemClick(eq) {
  if (!map) return
  const c = eq.geometry.coordinates
  const m = eq.properties.mag || 0
  map.flyTo([c[1], c[0]], m >= 6 ? 5 : m >= 4 ? 6 : 8, { duration: 1.5 })
}

function setPeriod(p) {
  period.value = p
  loadData()
}
function setMinMag(m) {
  minMag.value = m
  loadData()
}

watch(data, () => renderMapMarkers())

watch(
  () => i18nState.lang,
  () => renderMapMarkers(),
)

function applyBaseMap() {
  if (!map) return
  const url = mapTileUrl(themeState.theme)
  if (tileLayer && tileLayer._url === url) return
  if (tileLayer) map.removeLayer(tileLayer)
  tileLayer = L.tileLayer(url, {
    maxZoom: 18,
    attribution: MAP_ATTRIBUTION,
  }).addTo(map)
  tileLayer.bringToBack()
}

watch(
  () => themeState.theme,
  () => applyBaseMap(),
)

onMounted(() => {
  map = L.map(mapEl.value, {
    zoomControl: false,
    worldCopyJump: true,
    preferCanvas: true,
    minZoom: 2,
    maxZoom: 15,
  }).setView([20, 0], 2)
  L.control.zoom({ position: 'topleft' }).addTo(map)

  applyBaseMap()

  layerGroup = L.layerGroup().addTo(map)

  loadData()
})

onActivated(() => {
  if (map) map.invalidateSize()
})

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<template>
  <div class="earthquake-app">
    <div class="app-body">
      <div ref="mapEl" class="map"></div>

      <aside class="sidebar">
        <div class="filters-container">
          <UiBadge variant="up" dot class="update-pill">{{ updateTime || t('updating') }}</UiBadge>

          <UiField class="filter-block" :label="t('params')">
            <UiSegmented :model-value="period" :options="timeOptions" @update:model-value="setPeriod" />
          </UiField>

          <UiSegmented
            :model-value="String(minMag)"
            :options="magOptions"
            class="filter-block"
            @update:model-value="(v) => setMinMag(parseFloat(v))"
          />

          <div class="filter-group overlay-group">
            <UiChip toggle :active="showPlates" @click="togglePlates">{{ t('plates') }}</UiChip>
          </div>

          <div class="stats">
            <UiStat card compact :label="t('total')" :value="stats.total" />
            <UiStat card compact :label="t('maxMag')" :value="stats.maxMag" />
            <UiStat card compact :label="t('avgDepth')" :value="stats.avgDepth + ' km'" />
            <UiStat card compact :label="t('m5')" :value="stats.m5" />
          </div>

          <div class="list-wrapper">
            <div class="loader-overlay" :class="{ active: loading }">
              <UiLoading compact :label="t('updating')" />
            </div>
            <div class="list">
              <UiErrorState v-if="hasError" class="error-box" :message="t('error')" retry-label="" />

              <button v-for="(eq, i) in listItems" :key="eq.id || i" type="button" class="it" @click="onItemClick(eq)">
                <div class="mg" :class="magClass(eq.properties.mag)">
                  {{ eq.properties.mag ? eq.properties.mag.toFixed(1) : '?' }}
                </div>
                <div class="inf">
                  <div class="pl">{{ eq.properties.place || t('unknown') }}</div>
                  <div class="mt">
                    <span>{{ t('depth') }}: {{ Math.round(eq.geometry.coordinates[2]) }} km</span>
                    <UiBadge
                      v-if="eq.properties.alert"
                      size="sm"
                      class="alert-badge"
                      :style="{ borderColor: alertColor(eq.properties.alert), color: alertColor(eq.properties.alert) }"
                      >{{ eq.properties.alert.toUpperCase() }}</UiBadge
                    >
                    <UiBadge v-if="eq.properties.tsunami" variant="down" size="sm">{{ t('tsunami') }}</UiBadge>
                  </div>
                </div>
                <div class="ag">{{ timeAgo(eq.properties.time) }}</div>
              </button>
            </div>
          </div>

          <footer class="sidebar-foot">
            <span>USGS Data API</span>
            <span>{{ stats.total }} {{ t('events') }}</span>
          </footer>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.earthquake-app {
  --bg: var(--ok-bg);
  --sf: var(--ok-panel);
  --sf-hover: var(--ok-bg);
  --bd: var(--ok-line);
  --tx: var(--ok-text);
  --mt: var(--ok-muted);
  --gn: var(--ok-up);
  --yl: #ca8a04;
  --or: #ea580c;
  --rd: var(--ok-down);
  --bl: var(--ok-accent);

  font-family: var(--ok-font);
  color: var(--tx);
  background: var(--bg);
  line-height: 1.5;

  height: auto;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--bd);
  border-radius: var(--ok-radius-lg);
  box-shadow: var(--ok-shadow-card);
  display: flex;
  flex-direction: column;
}

.earthquake-app .app-body {
  flex: none;
  height: 68vh;
  min-height: 480px;
}

.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.map {
  flex: 1;
  background: var(--ok-map-bg);
  z-index: 1;
}

.sidebar {
  width: 380px;
  background: var(--bg);
  border-left: 1px solid var(--bd);
  display: flex;
  flex-direction: column;
  z-index: 5;
}

.filters-container {
  padding: 1rem;
  background: var(--sf);
  border-bottom: 1px solid var(--bd);
  flex-shrink: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.update-pill {
  margin-bottom: 0.75rem;
  font-family: var(--ok-mono);
  font-size: 0.72rem;
}

.update-pill :deep(.ui-badge-dot) {
  width: 8px;
  height: 8px;
  box-shadow: 0 0 10px var(--gn);
  animation: blink 2s infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
    box-shadow: none;
  }
}

.filter-block {
  margin-bottom: 0.75rem;
}

.filter-group {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.filter-group:last-child {
  margin-bottom: 0;
}

.filter-group.overlay-group {
  margin-top: 0.5rem;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.4rem;
  margin-bottom: 0.6rem;
  flex-shrink: 0;
}

.stats :deep(.ui-stat-label) {
  font-size: 0.56rem;
  letter-spacing: 0.04em;
}

.stats :deep(.ui-stat-value) {
  font-size: 0.95rem;
  overflow-wrap: anywhere;
}

.list-wrapper {
  position: relative;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.list {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 1rem;
}

.list::-webkit-scrollbar {
  width: 6px;
}

.list::-webkit-scrollbar-track {
  background: transparent;
}

.list::-webkit-scrollbar-thumb {
  background: var(--ok-bg);
  border-radius: 10px;
}

.it {
  display: flex;
  width: 100%;
  background: transparent;
  color: inherit;
  border: 0;
  text-align: left;
  align-items: center;
  gap: 1rem;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--bd);
  cursor: pointer;
  transition: background 0.15s;
}

.it:hover {
  background: var(--sf-hover);
}

.it .mg {
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  font-weight: 800;
  flex-shrink: 0;
}

.it .mg.g {
  background: rgba(74, 222, 128, 0.15);
  color: var(--gn);
}
.it .mg.y {
  background: rgba(250, 204, 21, 0.15);
  color: var(--yl);
}
.it .mg.o {
  background: rgba(251, 146, 60, 0.15);
  color: var(--or);
}
.it .mg.r {
  background: rgba(239, 68, 68, 0.15);
  color: var(--rd);
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
}

.it .inf {
  flex: 1;
  min-width: 0;
}

.it .pl {
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 0.2rem;
}

.it .mt {
  font-size: 0.75rem;
  color: var(--mt);
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.it .ag {
  font-size: 0.75rem;
  color: var(--mt);
  flex-shrink: 0;
  text-align: right;
}

.alert-badge {
  font-size: 0.65rem;
}

.loader-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

.loader-overlay.active {
  opacity: 1;
  pointer-events: all;
}

.error-box {
  margin: 1rem;
}

.sidebar-foot {
  padding: 0.6rem 1rem;
  background: var(--sf);
  border-top: 1px solid var(--bd);
  font-size: 0.7rem;
  color: var(--mt);
  display: flex;
  justify-content: space-between;
  flex-shrink: 0;
}

.earthquake-app :deep(.leaflet-container) {
  background: var(--ok-map-bg);
  font-family: var(--ok-font);
}

.earthquake-app :deep(.leaflet-control-zoom a) {
  background: var(--ok-map-control-bg) !important;
  color: var(--ok-map-control-text) !important;
  border-color: var(--ok-map-control-border) !important;
}

.earthquake-app :deep(.leaflet-control-zoom a:hover) {
  background: var(--ok-accent-soft) !important;
  color: var(--ok-accent) !important;
}

.earthquake-app :deep(.leaflet-control-attribution) {
  background: var(--ok-map-attribution-bg) !important;
  color: var(--ok-map-attribution-text) !important;
}

.earthquake-app :deep(.leaflet-control-attribution a) {
  color: var(--ok-accent) !important;
}

.earthquake-app :deep(.leaflet-popup-content-wrapper) {
  background: var(--sf) !important;
  color: var(--tx) !important;
  border-radius: 8px !important;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5) !important;
}

.earthquake-app :deep(.leaflet-popup-tip) {
  background: var(--sf) !important;
}

.earthquake-app :deep(.leaflet-popup-content) {
  margin: 12px !important;
  font-family: var(--ok-font);
}

.earthquake-app :deep(.popup-title) {
  font-weight: 800;
  font-size: 1.1rem;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.earthquake-app :deep(.popup-sub) {
  font-size: 0.8rem;
  color: var(--mt);
}

@media (max-width: 768px) {
  .app-body {
    flex-direction: column;
  }
  .sidebar {
    width: 100%;
    height: 50vh;
    border-left: none;
    border-top: 1px solid var(--bd);
  }
  .map {
    height: 50vh;
    flex: none;
  }
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .earthquake-app .app-body {
    height: auto;
  }

  .earthquake-app .sidebar {
    height: auto;
    max-height: 60vh;
  }
}
</style>
