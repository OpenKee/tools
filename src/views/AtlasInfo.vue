<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useT } from '../i18n.js'
import { fetchJSON, locale, lsGet, lsSet, lsRemove } from '../ok.js'
import { wbCode, bestByIso, applyPopulationFallback, normalizeAtlasQuery, buildAtlasQuery } from '../lib/atlas-data.js'
import { getUsdRates } from '../lib/markets.js'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { UiButton, UiPage, UiPageHead } from '../components/ui/index.js'
import { themeState } from '../theme.js'
import { MAP_ATTRIBUTION, mapTileUrl } from '../lib/map-tiles.js'
import countryFacts from '../data/country-facts.json'
import copy from '../copy/atlas-info.js'
import CountryDirectory from '../components/atlas/CountryDirectory.vue'
import ComparePanel from '../components/atlas/ComparePanel.vue'
import CountryDetail from '../components/atlas/CountryDetail.vue'
import {
  REGION_KEYS,
  VALID_SORTS,
  areaValue,
  buildSearchText,
  capitalTextFor,
  countryName,
  densityValue,
  flagImg,
} from '../lib/atlas-display.js'

const route = useRoute()
const router = useRouter()
const t = useT(copy)

const THIS_YEAR = new Date().getFullYear()
const LAST_YEAR = THIS_YEAR - 1
const WB = 'https://api.worldbank.org/v2'
const COUNTRIES_URL = 'https://cdn.jsdelivr.net/npm/world-countries@5.1.0/countries.json'

const CORE_INDICATORS = {
  population: { code: 'SP.POP.TOTL', from: LAST_YEAR - 3, to: LAST_YEAR },
  gdp: { code: 'NY.GDP.MKTP.CD', from: LAST_YEAR - 3, to: LAST_YEAR },
  gdpPc: { code: 'NY.GDP.PCAP.CD', from: LAST_YEAR - 3, to: LAST_YEAR },
  gni: { code: 'NY.GNP.PCAP.CD', from: LAST_YEAR - 3, to: LAST_YEAR - 1 },
  lifeExp: { code: 'SP.DYN.LE00.IN', from: LAST_YEAR - 2, to: LAST_YEAR - 1 },
}

const EXTRA_INDICATORS = {
  gdpGrowth: { code: 'NY.GDP.MKTP.KD.ZG', from: LAST_YEAR - 3, to: LAST_YEAR },
  inflation: { code: 'FP.CPI.TOTL.ZG', from: LAST_YEAR - 3, to: LAST_YEAR },
  unemployment: { code: 'SL.UEM.TOTL.ZS', from: LAST_YEAR - 3, to: LAST_YEAR },
  urban: { code: 'SP.URB.TOTL.IN.ZS', from: LAST_YEAR - 3, to: LAST_YEAR },
  internet: { code: 'IT.NET.USER.ZS', from: LAST_YEAR - 4, to: LAST_YEAR },
  gini: { code: 'SI.POV.GINI', from: LAST_YEAR - 10, to: LAST_YEAR },
  co2: { code: 'EN.GHG.CO2.PC.CE.AR5', from: LAST_YEAR - 3, to: LAST_YEAR - 1 },
}

const CACHE_KEY = 'atlas-info-cache-v1'
const CACHE_VERSION = 1
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000

const allCountries = ref([])
const activeRegion = ref('')
const searchQuery = ref('')
const selectedCode = ref(null)
const onlySovereign = ref(false)
const sortBy = ref('pop')
const loading = ref(true)
const errorMsg = ref('')
const extrasState = ref('idle')
const usdRates = ref(null)
const dataUpdatedAt = ref(null)
const dataStale = ref(false)
const trend = ref(null)
const trendState = ref('idle')
const compareOpen = ref(false)
const compareA = ref('')
const compareB = ref('')
let mapInstance = null
let trendToken = 0
let dataToken = 0
let alive = true
let syncingFromUrl = false
const trendCache = new Map()

const initialQuery = normalizeAtlasQuery(route.query, REGION_KEYS, VALID_SORTS)
sortBy.value = initialQuery.sort || 'pop'
activeRegion.value = initialQuery.region || ''
onlySovereign.value = !!initialQuery.sovereign

const filteredCountries = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  let list = allCountries.value
  if (activeRegion.value) {
    list = list.filter((c) => (c.region || '').toLowerCase() === activeRegion.value)
  }
  if (onlySovereign.value) list = list.filter((c) => c.independent)
  if (q) list = list.filter((c) => (c.searchText || '').includes(q))

  const sorted = [...list]
  if (sortBy.value === 'name') {
    sorted.sort((a, b) => countryName(a).localeCompare(countryName(b), locale()))
  } else if (sortBy.value === 'area') {
    sorted.sort((a, b) => (areaValue(b) || 0) - (areaValue(a) || 0))
  } else if (sortBy.value === 'density') {
    sorted.sort((a, b) => (densityValue(b) ?? -1) - (densityValue(a) ?? -1))
  } else {
    sorted.sort((a, b) => (b.stats?.population?.value || 0) - (a.stats?.population?.value || 0))
  }
  return sorted
})

function normalizedRouteQuery(q = route.query) {
  return normalizeAtlasQuery(q, REGION_KEYS, VALID_SORTS)
}

function stateQuery() {
  return buildAtlasQuery({
    sort: sortBy.value,
    region: activeRegion.value,
    sovereign: onlySovereign.value,
    country: selectedCode.value,
  })
}

function sameQuery(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function rawQueryForCompare(q = route.query) {
  const out = {}
  for (const key of ['sort', 'region', 'sovereign', 'country']) {
    const value = q[key]
    if (typeof value === 'string' && value !== '') out[key] = value
  }
  return out
}

function applyUrlQuery(q) {
  syncingFromUrl = true
  const next = normalizedRouteQuery(q)
  sortBy.value = next.sort || 'pop'
  activeRegion.value = next.region || ''
  onlySovereign.value = !!next.sovereign
  if (next.country && allCountries.value.some((c) => c.cca3 === next.country)) {
    if (selectedCode.value !== next.country) openCountry(next.country)
  } else if (selectedCode.value) {
    closeDetail()
  }
  nextTick(() => {
    syncingFromUrl = false
    const state = stateQuery()
    if (!sameQuery(rawQueryForCompare(), state)) {
      router.replace({ query: state }).catch(() => {})
    }
  })
}

const selectedCountry = computed(() => allCountries.value.find((x) => x.cca3 === selectedCode.value) || null)

const borders = computed(() => {
  const c = selectedCountry.value
  if (!c || !c.borders?.length) return []
  return c.borders.map((code) => {
    const bc = allCountries.value.find((x) => x.cca3 === code)
    return {
      code,
      name: bc ? countryName(bc) : code,
      flagImg: bc ? flagImg(bc.cca2, 40) : '',
      latlng: bc?.latlng || null,
    }
  })
})

function selectRegion(k) {
  if (!k) {
    activeRegion.value = ''
    return
  }
  activeRegion.value = activeRegion.value === k ? '' : k
}

function mapContainer() {
  return document.querySelector('.crow-detail .d-map')
}

function scrollToCountry(code) {
  const el = document.querySelector(`.crow[data-code="${code}"]`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function closeDetail() {
  destroyMap()
  selectedCode.value = null
  trendToken++
  trend.value = null
  trendState.value = 'idle'
}

function ensureVisible(code) {
  const target = allCountries.value.find((c) => c.cca3 === code)
  if (!target) return
  if (onlySovereign.value && !target.independent) onlySovereign.value = false
  if (activeRegion.value && (target.region || '').toLowerCase() !== activeRegion.value) {
    activeRegion.value = ''
  }
  const q = searchQuery.value.trim().toLowerCase()
  if (q && !(target.searchText || '').includes(q)) searchQuery.value = ''
}

function openCountry(code) {
  const target = allCountries.value.find((c) => c.cca3 === code)
  if (!target) return
  ensureVisible(code)
  if (selectedCode.value === code) {
    nextTick(() => scrollToCountry(code))
    return
  }
  destroyMap()
  selectedCode.value = code
  trend.value = null
  trendState.value = 'idle'
  loadTrend(code)
  nextTick(() => {
    initMap()
    scrollToCountry(code)
  })
}

function onRowClick(code) {
  if (selectedCode.value === code) closeDetail()
  else openCountry(code)
}

watch(
  () => themeState.theme,
  () => {
    if (selectedCountry.value) initMap()
  },
)

function initMap() {
  const c = selectedCountry.value
  const el = mapContainer()
  if (!c || !c.latlng || !el) return
  destroyMap()
  const f = countryFacts[c.cca3] || {}
  mapInstance = L.map(el, { scrollWheelZoom: false, attributionControl: true })
  L.tileLayer(mapTileUrl(themeState.theme), {
    attribution: MAP_ATTRIBUTION,
    maxZoom: 18,
  }).addTo(mapInstance)
  mapInstance.setView([c.latlng[0], c.latlng[1]], zoomByArea(areaValue(c)))
  L.circleMarker([c.latlng[0], c.latlng[1]], {
    radius: 7,
    color: '#4090ff',
    weight: 2,
    fillColor: '#4090ff',
    fillOpacity: 0.6,
  })
    .addTo(mapInstance)
    .bindTooltip(countryName(c))

  if (f.capitalLat != null && f.capitalLng != null) {
    L.circleMarker([f.capitalLat, f.capitalLng], {
      radius: 5,
      color: '#f0c040',
      weight: 2,
      fillColor: '#f0c040',
      fillOpacity: 0.75,
    })
      .addTo(mapInstance)
      .bindTooltip(`${t.value('mapCapital')}: ${capitalTextFor(c)}`)
  }

  borders.value.forEach((b) => {
    if (!b.latlng) return
    L.circleMarker([b.latlng[0], b.latlng[1]], {
      radius: 4,
      color: '#c7b299',
      fillColor: '#c7b299',
      fillOpacity: 0.5,
    })
      .addTo(mapInstance)
      .bindTooltip(b.name)
  })
}

function destroyMap() {
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
}

function zoomByArea(area) {
  if (!area) return 4
  if (area > 5000000) return 3
  if (area > 1000000) return 4
  if (area > 100000) return 5
  return 6
}

onBeforeUnmount(() => {
  alive = false
  destroyMap()
  trendToken++
})

async function loadTrend(cca3) {
  const token = ++trendToken
  const cached = trendCache.get(cca3)
  if (cached) {
    trend.value = cached
    trendState.value = 'loaded'
    return
  }
  trendState.value = 'loading'
  trend.value = null
  const start = LAST_YEAR - 9
  const end = LAST_YEAR
  try {
    const code = wbCode(cca3)
    const [popRes, gdpRes] = await Promise.allSettled([
      wbPage(`${WB}/country/${code}/indicator/SP.POP.TOTL?format=json&date=${start}:${end}&per_page=100`),
      wbPage(`${WB}/country/${code}/indicator/NY.GDP.MKTP.CD?format=json&date=${start}:${end}&per_page=100`),
    ])
    if (token !== trendToken) return
    const popRows = popRes.status === 'fulfilled' && Array.isArray(popRes.value?.[1]) ? popRes.value[1] : []
    const gdpRows = gdpRes.status === 'fulfilled' && Array.isArray(gdpRes.value?.[1]) ? gdpRes.value[1] : []
    const popByYear = {}
    const gdpByYear = {}
    popRows.forEach((r) => {
      if (r.value != null) popByYear[Number(r.date)] = r.value
    })
    gdpRows.forEach((r) => {
      if (r.value != null) gdpByYear[Number(r.date)] = r.value
    })
    const rows = Array.from({ length: 10 }, (_, i) => {
      const y = start + i
      return { y, pop: popByYear[y] ?? null, gdp: gdpByYear[y] ?? null }
    })
    if (!rows.some((r) => r.pop != null || r.gdp != null)) throw new Error('no trend data')
    const data = {
      rows,
      start,
      end,
    }
    trendCache.set(cca3, data)
    trend.value = data
    trendState.value = 'loaded'
  } catch (e) {
    if (token === trendToken) trendState.value = 'error'
  }
}

const WB_CONCURRENCY = 4
let wbActive = 0
const wbQueue = []

function withWbSlot(task) {
  return new Promise((resolve, reject) => {
    const run = () => {
      wbActive++
      task()
        .then(resolve, reject)
        .finally(() => {
          wbActive--
          const next = wbQueue.shift()
          if (next) next()
        })
    }
    if (wbActive < WB_CONCURRENCY) run()
    else wbQueue.push(run)
  })
}

function fetchWBJSON(url) {
  return withWbSlot(() => fetchJSON(url, { timeout: 20000 }))
}

async function wbPage(url) {
  try {
    return await fetchWBJSON(url)
  } catch (e) {
    return fetchWBJSON(url)
  }
}

async function fetchWBIndicator(code, from, to) {
  const base = `${WB}/country/all/indicator/${code}?format=json&per_page=1000&date=${from}:${to}`
  const first = await wbPage(base)
  if (!Array.isArray(first?.[1])) throw new Error('indicator unavailable')
  const rows = first[1].slice()
  const pages = Number(first?.[0]?.pages || 1)
  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) =>
        wbPage(base + '&page=' + (i + 2))
          .then((d) => (Array.isArray(d?.[1]) ? d[1] : []))
          .catch(() => []),
      ),
    )
    rest.forEach((pageRows) => rows.push(...pageRows))
  }
  return bestByIso(rows)
}

function applyIndicator(data, key, map) {
  for (const c of data) {
    const s = map?.[wbCode(c.cca3)]
    if (s) c.stats[key] = s
  }
}

async function loadExtras() {
  if (!alive || !allCountries.value.length) return
  if (extrasState.value === 'loading' || extrasState.value === 'loaded') return
  const token = dataToken
  extrasState.value = 'loading'
  const entries = Object.entries(EXTRA_INDICATORS)
  const results = await Promise.allSettled(entries.map(([, cfg]) => fetchWBIndicator(cfg.code, cfg.from, cfg.to)))
  if (!alive || token !== dataToken) return
  let failed = 0
  results.forEach((res, i) => {
    if (res.status === 'fulfilled') applyIndicator(allCountries.value, entries[i][0], res.value)
    else failed++
  })
  extrasState.value = failed === entries.length ? 'error' : 'loaded'
  writeCountryCache(failed === 0)
}

function readCountryCache() {
  const raw = lsGet(CACHE_KEY)
  if (!raw) return null
  try {
    const cache = JSON.parse(raw)
    if (!cache || cache.version !== CACHE_VERSION) return null
    if (cache.year !== LAST_YEAR) return null
    if (!Array.isArray(cache.countries) || !cache.countries.length) return null
    if (!Number.isFinite(cache.savedAt)) return null
    return cache
  } catch (e) {
    lsRemove(CACHE_KEY)
    return null
  }
}

function writeCountryCache(extrasReady) {
  if (!allCountries.value.length || !dataUpdatedAt.value) return
  const entry = {
    version: CACHE_VERSION,
    year: LAST_YEAR,
    savedAt: dataUpdatedAt.value,
    extrasReady,
    usdRates: usdRates.value,
    countries: allCountries.value,
  }
  try {
    lsSet(CACHE_KEY, JSON.stringify(entry))
  } catch (e) {}
}

function applyCachedData(cache, stale) {
  allCountries.value = cache.countries
  usdRates.value = cache.usdRates || null
  dataUpdatedAt.value = cache.savedAt
  dataStale.value = stale
  extrasState.value = cache.extrasReady ? 'loaded' : 'idle'
  errorMsg.value = ''
  loading.value = false
}

function finishLoad(applyInitialQuery, extrasReady) {
  if (applyInitialQuery && allCountries.value.length) {
    nextTick(() => applyUrlQuery(route.query))
  }
  if (allCountries.value.length && !extrasReady) {
    setTimeout(loadExtras, 50)
  }
}

async function loadAll(applyInitialQuery = false, force = false) {
  dataToken++
  const cached = readCountryCache()
  if (!force && cached && Date.now() - cached.savedAt < CACHE_TTL) {
    applyCachedData(cached, false)
    finishLoad(applyInitialQuery, cached.extrasReady)
    return
  }

  try {
    const coreEntries = Object.entries(CORE_INDICATORS)
    const [countriesRes, fxRes, ...indicatorRes] = await Promise.allSettled([
      fetchJSON(COUNTRIES_URL),
      getUsdRates(),
      ...coreEntries.map(([, cfg]) => fetchWBIndicator(cfg.code, cfg.from, cfg.to)),
    ])
    if (countriesRes.status === 'rejected') throw countriesRes.reason
    const countries = countriesRes.value
    if (!Array.isArray(countries)) throw new Error('countries not array')

    usdRates.value = fxRes.status === 'fulfilled' && fxRes.value?.rates ? fxRes.value.rates : null

    const data = countries.map((c) => ({
      ...c,
      stats: {},
      searchText: buildSearchText(c),
    }))
    indicatorRes.forEach((res, i) => {
      if (res.status === 'fulfilled') applyIndicator(data, coreEntries[i][0], res.value)
    })
    applyPopulationFallback(data, countryFacts)
    data.sort((a, b) => countryName(a).localeCompare(countryName(b), locale()))
    allCountries.value = data
    dataUpdatedAt.value = Date.now()
    dataStale.value = false
    writeCountryCache(false)
    loading.value = false
    finishLoad(applyInitialQuery, false)
  } catch (e) {
    console.warn('Atlas Info load failed:', e)
    if (cached) {
      applyCachedData(cached, true)
      finishLoad(applyInitialQuery, cached.extrasReady)
    } else {
      errorMsg.value = t.value('error')
      loading.value = false
    }
  }
}

function refreshData() {
  if (loading.value) return
  errorMsg.value = ''
  closeDetail()
  trendCache.clear()
  extrasState.value = 'idle'
  dataStale.value = false
  loading.value = true
  loadAll(false, true)
}

watch([activeRegion, searchQuery, onlySovereign], () => {
  if (selectedCode.value && !filteredCountries.value.some((c) => c.cca3 === selectedCode.value)) {
    closeDetail()
  }
})

watch([selectedCode, sortBy, activeRegion, onlySovereign], () => {
  if (!allCountries.value.length || syncingFromUrl) return
  const state = stateQuery()
  if (sameQuery(normalizedRouteQuery(), state)) return
  router.push({ query: state }).catch(() => {})
})

watch(
  () => route.query,
  (q) => {
    if (syncingFromUrl) return
    const next = normalizedRouteQuery(q)
    if (!allCountries.value.length) {
      sortBy.value = next.sort || 'pop'
      activeRegion.value = next.region || ''
      onlySovereign.value = !!next.sovereign
      return
    }
    const state = stateQuery()
    if (sameQuery(next, state)) {
      if (!sameQuery(rawQueryForCompare(q), state)) {
        router.replace({ query: state }).catch(() => {})
      }
      return
    }
    applyUrlQuery(q)
  },
)

onMounted(() => loadAll(true))
</script>

<template>
  <UiPage
    class="atlas-info"
    :title="t('title')"
    :sources="[
      { name: 'world-countries', url: 'https://github.com/mledoze/countries' },
      { name: 'World Bank', url: 'https://api.worldbank.org/' },
      { name: 'ExchangeRate-API', url: 'https://www.exchangerate-api.com/' },
      { name: 'flagcdn', url: 'https://flagcdn.com/' },
      { name: 'Natural Earth', url: 'https://www.naturalearthdata.com/' },
      { name: 'Esri', url: 'https://www.esri.com/' },
      { name: 'country-json', url: 'https://github.com/samayo/country-json' },
      { name: 'country-list-js', url: 'https://www.npmjs.com/package/country-list-js' },
    ]"
    spacing="compact"
  >
    <UiPageHead :description="t('lead')" />

    <CountryDirectory
      v-model:search-query="searchQuery"
      v-model:sort-by="sortBy"
      v-model:only-sovereign="onlySovereign"
      :compare-open="compareOpen"
      :active-region="activeRegion"
      :countries="filteredCountries"
      :selected-code="selectedCode"
      :data-updated-at="dataUpdatedAt"
      :data-stale="dataStale"
      :loading="loading"
      :error-msg="errorMsg"
      :t="t"
      @select-region="selectRegion"
      @toggle-compare="compareOpen = !compareOpen"
      @row-click="onRowClick"
    >
      <template #compare>
        <ComparePanel
          v-if="compareOpen"
          v-model:a="compareA"
          v-model:b="compareB"
          :countries="allCountries"
          :t="t"
          @close="compareOpen = false"
        />
      </template>
      <template #detail="{ country }">
        <CountryDetail
          :country="country"
          :borders="borders"
          :usd-rates="usdRates"
          :extras-state="extrasState"
          :trend="trend"
          :trend-state="trendState"
          :t="t"
          @open-country="openCountry"
        />
      </template>
    </CountryDirectory>

    <details v-if="!loading && !errorMsg" class="about-data">
      <summary>{{ t('aboutData') }}</summary>
      <p>{{ t('dataNote') }}</p>
      <UiButton variant="link" class="refresh-btn" :disabled="loading" @click="refreshData">
        {{ t('refreshData') }}
      </UiButton>
    </details>
  </UiPage>
</template>

<style scoped>
.atlas-info {
  --atlas-gold: #b45309;
}

:root[data-theme='dark'] .atlas-info {
  --atlas-gold: #d29922;
}

.about-data {
  margin-top: 2rem;
  padding-top: 0.8rem;
  border-top: 1px solid var(--ok-line);
  color: var(--ok-muted);
  font-size: 0.76rem;
}

.about-data summary {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  list-style: none;
  font-size: 0.78rem;
  cursor: pointer;
}

.about-data summary::-webkit-details-marker {
  display: none;
}

.about-data summary::before {
  content: '+';
  width: 0.8rem;
  color: var(--ok-accent);
  line-height: 1;
}

.about-data[open] summary::before {
  content: '−';
}

.about-data p {
  max-width: 65ch;
  margin: 0.6rem 0 0;
  line-height: 1.65;
}

.refresh-btn {
  margin-top: 0.6rem;
}

@media (max-width: 700px) {
  .about-data p {
    max-width: none;
  }
}
</style>
