<script setup>
import { ref, computed, defineAsyncComponent, watch, onMounted } from 'vue'
import { ArrowRight, Moon, Rocket, Satellite, Sparkles, Sunrise, Sunset } from '@lucide/vue'
import { getMoonIllumination, getMoonTimes } from 'suncalc'
import { i18nState, useT } from '../../i18n.js'
import { geocode, locale, locateMe, lsGet, lsSet, issPasses as predictIssPasses } from '../../ok.js'
import { getKpIndex, getUpcomingLaunches } from '../../lib/space-data.js'
import { kpBand, kpVisibleLat } from '../../lib/kp.js'
import copy from '../../copy/night-sky-guide.js'
import kpScale from '../../copy/kp-scale.js'
import { UiBadge, UiButton, UiCard, UiEmptyState, UiErrorState, UiInput, UiLoading } from '../../components/ui/index.js'

const AuroraForecast = defineAsyncComponent(() => import('./AuroraForecast.vue'))

const props = defineProps({
  view: { type: String, default: 'tonight' },
})
const emit = defineEmits(['navigate'])

const t = useT(copy)
const kpText = useT(kpScale)

const COMPASS_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

const query = ref('')
const location = ref(null)
const locationError = ref('')
const locationLoading = ref(false)

const LOCATION_KEY = 'openkee-sky-location'

function readSavedLocation() {
  const raw = lsGet(LOCATION_KEY)
  if (!raw) return null
  try {
    const loc = JSON.parse(raw)
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) return null
    return loc
  } catch (e) {
    return null
  }
}

function saveLocation() {
  if (!location.value) return
  lsSet(LOCATION_KEY, JSON.stringify(location.value))
}

const issPasses = ref([])
const issState = ref('idle')

const kpData = ref(null)
const kpState = ref('idle')
const kpCurrent = ref(null)

const moonData = ref(null)
const moonState = ref('idle')

const launches = ref([])
const launchesState = ref('idle')

const loading = ref(false)

const tab = computed(function () {
  return props.view === 'aurora' ? 'aurora' : 'tonight'
})

function setTab(next) {
  emit('navigate', next === 'aurora' ? 'aurora' : 'tonight')
}

function openAurora() {
  setTab('aurora')
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function openLaunchTab() {
  emit('navigate', 'launch')
}

function degToCompass(deg) {
  const index = Math.round(deg / 45) % 8
  return COMPASS_DIRECTIONS[index]
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(locale(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatPassTime(ts) {
  const d = new Date(ts * 1000)
  return d.toLocaleString(locale(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function moonPhaseName(phase) {
  if (phase < 0.06) return t.value('moonNew')
  if (phase < 0.19) return t.value('moonWaxingCrescent')
  if (phase < 0.31) return t.value('moonFirstQuarter')
  if (phase < 0.44) return t.value('moonWaxingGibbous')
  if (phase < 0.56) return t.value('moonFull')
  if (phase < 0.69) return t.value('moonWaningGibbous')
  if (phase < 0.81) return t.value('moonLastQuarter')
  if (phase < 0.94) return t.value('moonWaningCrescent')
  return t.value('moonNew')
}

const highlight = computed(() => {
  if (issPasses.value.length > 0) {
    return { type: 'iss', text: t.value('highlightIss') }
  }
  if (kpCurrent.value) {
    const kp = kpCurrent.value
    const visLat = kpVisibleLat(kp)
    const userLatAbs = Math.abs(location.value ? location.value.lat : 0)
    if (userLatAbs >= visLat) {
      return { type: 'aurora', text: t.value('highlightAurora') }
    }
  }
  if (launches.value.length > 0) {
    return { type: 'launch', text: t.value('highlightLaunch') }
  }
  if (moonData.value) {
    return { type: 'moon', text: t.value('highlightMoon') }
  }
  return null
})

const auroraVisible = computed(() => {
  if (!kpCurrent.value || !location.value) return null
  const kp = kpCurrent.value
  const visLat = kpVisibleLat(kp)
  const band = kpBand(kp)
  const userLatAbs = Math.abs(location.value.lat)
  return {
    kp: kp,
    level: kpText.value(band.key),
    color: band.color,
    visibleLat: visLat,
    isVisible: userLatAbs >= visLat,
    userLat: Math.round(userLatAbs),
    userHemi: location.value.lat >= 0 ? t.value('hemiN') : t.value('hemiS'),
  }
})

async function fetchIssPasses(lat, lon) {
  issState.value = 'loading'
  try {
    const raw = await predictIssPasses({ lat, lon, limit: 5, withinHours: 24 })
    if (!raw.length) {
      issState.value = 'empty'
      issPasses.value = []
      return
    }
    issPasses.value = raw.map(function (p) {
      return {
        risetime: p.risetime,
        duration: p.duration,
        timeLabel: formatPassTime(p.risetime),
        durLabel: p.duration + ' ' + t.value('seconds'),
        direction: degToCompass(p.az),
      }
    })
    issState.value = 'loaded'
  } catch (e) {
    console.warn('ISS pass prediction failed:', e)
    issState.value = 'error'
    issPasses.value = []
  }
}

async function fetchKp() {
  kpState.value = 'loading'
  try {
    const data = await getKpIndex({ timeout: 15000 })
    if (!data || !data.length) throw new Error('Bad Kp response')

    let latest = null
    for (let i = data.length - 1; i >= 0; i--) {
      const row = data[i]
      let kpVal
      if (Array.isArray(row)) {
        kpVal = parseFloat(row[1])
      } else {
        kpVal = parseFloat(row.Kp || row.kp || row.KP)
      }
      if (!isNaN(kpVal) && kpVal >= 0) {
        latest = kpVal
        break
      }
    }
    if (latest == null) throw new Error('No valid Kp value found')
    kpCurrent.value = latest
    kpData.value = data
    kpState.value = 'loaded'
  } catch (e) {
    console.warn('Kp fetch failed:', e)
    kpState.value = 'error'
  }
}

function computeMoon(lat, lon) {
  const date = new Date()
  const illum = getMoonIllumination(date)
  const times = getMoonTimes(date, lat, lon)
  moonData.value = {
    phase: illum.phase,
    fraction: illum.fraction,
    phaseName: moonPhaseName(illum.phase),
    rise: times.rise || null,
    set: times.set || null,
    alwaysUp: !!times.alwaysUp,
    alwaysDown: !!times.alwaysDown,
  }
  moonState.value = 'loaded'
}

function fmtMoonTime(d) {
  if (!d) return '—'
  return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
}

const moonRiseText = computed(() => {
  if (!moonData.value) return '—'
  if (moonData.value.rise) return fmtMoonTime(moonData.value.rise)
  return moonData.value.alwaysUp ? t.value('alwaysUp') : moonData.value.alwaysDown ? t.value('alwaysDown') : '—'
})

const moonSetText = computed(() => {
  if (!moonData.value) return '—'
  if (moonData.value.set) return fmtMoonTime(moonData.value.set)
  return moonData.value.alwaysUp ? t.value('alwaysUp') : moonData.value.alwaysDown ? t.value('alwaysDown') : '—'
})

const moonLitPath = computed(function () {
  if (!moonData.value) return ''
  const p = ((moonData.value.phase % 1) + 1) % 1
  const R = 22
  const cx = 24
  const cy = 24
  const rx = R * Math.abs(Math.cos(2 * Math.PI * p))
  if (p <= 0.5) {
    const sweep = p < 0.25 ? 0 : 1
    return (
      'M ' +
      cx +
      ' ' +
      (cy - R) +
      ' A ' +
      R +
      ' ' +
      R +
      ' 0 0 1 ' +
      cx +
      ' ' +
      (cy + R) +
      ' A ' +
      rx +
      ' ' +
      R +
      ' 0 0 ' +
      sweep +
      ' ' +
      cx +
      ' ' +
      (cy - R) +
      ' Z'
    )
  }
  const sweep = p < 0.75 ? 0 : 1
  return (
    'M ' +
    cx +
    ' ' +
    (cy - R) +
    ' A ' +
    R +
    ' ' +
    R +
    ' 0 0 0 ' +
    cx +
    ' ' +
    (cy + R) +
    ' A ' +
    rx +
    ' ' +
    R +
    ' 0 0 ' +
    sweep +
    ' ' +
    cx +
    ' ' +
    (cy - R) +
    ' Z'
  )
})

async function fetchLaunches() {
  launchesState.value = 'loading'
  try {
    const results = await getUpcomingLaunches({ limit: 10, timeout: 15000 })
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 172800000)
    const filtered = results
      .filter(function (l) {
        const net = l.net ? new Date(l.net) : null
        return net && net >= now && net <= tomorrow
      })
      .slice(0, 5)
      .map(function (l) {
        return {
          name: l.name || '—',
          net: l.net,
          timeLabel: formatDateTime(l.net),
          provider: l.launch_service_provider ? l.launch_service_provider.name : '—',
          vehicle: l.rocket ? l.rocket.configuration.name : '—',
          mission: l.mission && l.mission.description ? l.mission.description : '—',
          site: l.pad ? l.pad.location.name + ' / ' + l.pad.name : '—',
          image: l.image,
        }
      })
    if (!filtered.length) {
      launchesState.value = 'empty'
      launches.value = []
      return
    }
    launches.value = filtered
    launchesState.value = 'loaded'
  } catch (e) {
    console.warn('Launches fetch failed:', e)
    launchesState.value = 'error'
  }
}

async function loadAll(lat, lon) {
  loading.value = true
  computeMoon(lat, lon)
  const tasks = [fetchKp()]

  if (tab.value === 'tonight') {
    tasks.push(fetchIssPasses(lat, lon), fetchLaunches())
  }
  await Promise.all(tasks)
  loading.value = false
}

watch(tab, function (next) {
  if (next !== 'tonight' || !location.value) return
  if (issState.value === 'idle') fetchIssPasses(location.value.lat, location.value.lon)
  if (launchesState.value === 'idle') fetchLaunches()
})

async function doSearch() {
  const q = query.value.trim()
  if (!q) return
  locationError.value = ''
  locationLoading.value = true
  try {
    const results = await geocode(q, { count: 5 })
    if (!results.length) {
      locationError.value = t.value('searchFail')
      locationLoading.value = false
      return
    }
    const place = results[0]
    location.value = {
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      country: place.country,
      admin1: place.admin1,
    }
    saveLocation()
    locationLoading.value = false

    issPasses.value = []
    issState.value = 'idle'
    kpCurrent.value = null
    kpState.value = 'idle'
    moonData.value = null
    moonState.value = 'idle'
    launches.value = []
    launchesState.value = 'idle'

    loadAll(place.lat, place.lon)
  } catch (e) {
    locationError.value = e.message || t.value('searchFail')
    locationLoading.value = false
  }
}

function useMyLocation() {
  locationError.value = ''
  locationLoading.value = true
  locateMe()
    .then((loc) => {
      const isIp = loc.precision === 'ip'
      location.value = {
        name: isIp && loc.city ? loc.city : i18nState.lang === 'zh' ? '当前位置' : 'My Location',
        lat: loc.lat,
        lon: loc.lon,
        country: '',
        admin1: '',
      }
      saveLocation()
      locationLoading.value = false
      issPasses.value = []
      issState.value = 'idle'
      kpCurrent.value = null
      kpState.value = 'idle'
      moonData.value = null
      moonState.value = 'idle'
      launches.value = []
      launchesState.value = 'idle'
      loadAll(loc.lat, loc.lon)
    })
    .catch(() => {
      locationError.value = t.value('geolocFail')
      locationLoading.value = false
    })
}

onMounted(function () {
  const saved = readSavedLocation()
  if (saved) {
    location.value = saved
    query.value = saved.name
    loadAll(saved.lat, saved.lon)
    return
  }

  query.value = 'Beijing'
  doSearch()
})
</script>

<template>
  <div class="night-sky-app">
    <p class="lead-desc">{{ t('lead') }}</p>

    <section class="search-section">
      <form class="search-form" @submit.prevent="doSearch">
        <UiInput
          v-model="query"
          class="search-field"
          size="lg"
          type="text"
          :placeholder="t('searchPlaceholder')"
          :aria-label="t('searchAria')"
          autocomplete="off"
        />
        <UiButton type="submit" variant="primary" size="lg" :loading="locationLoading">
          {{ t('search') }}
        </UiButton>
        <UiButton type="button" variant="secondary" size="lg" :disabled="locationLoading" @click="useMyLocation">
          {{ t('myLocation') }}
        </UiButton>
      </form>
      <UiErrorState v-if="locationError" class="search-error" :message="locationError" retry-label="" />
      <p v-if="location && !locationError" class="location-label">
        {{ location.name }}<template v-if="location.admin1">, {{ location.admin1 }}</template>
        <template v-if="location.country">, {{ location.country }}</template>
        <span class="coords-hint">
          ({{ t('latitude') }}: {{ location.lat.toFixed(2) }}, {{ t('longitude') }}:
          {{ location.lon.toFixed(2) }})</span
        >
      </p>
    </section>

    <div v-show="tab === 'tonight'" class="tonight-view">
      <UiLoading v-if="loading && !location" :label="t('loading')" />

      <template v-if="location">
        <UiCard
          v-if="highlight"
          :label="t('highlight')"
          :icon="Sparkles"
          accent="#38bdf8"
          :interactive="false"
          class="highlight-card"
        >
          <div class="highlight-body">
            <span class="highlight-icon" :class="'hl-' + highlight.type"></span>
            <p class="highlight-text">{{ highlight.text }}</p>
          </div>
        </UiCard>

        <UiCard :label="t('issPasses')" :icon="Satellite" accent="#38bdf8" :interactive="false">
          <UiLoading v-if="issState === 'loading'" compact :label="t('issPassesLoading')" />
          <UiErrorState v-else-if="issState === 'error'" :message="t('issPassesError')" retry-label="" />
          <UiEmptyState v-else-if="issState === 'empty'" :description="t('issPassesEmpty')" compact />
          <div v-else-if="issState === 'loaded'" class="iss-list">
            <div v-for="(pass, i) in issPasses" :key="i" class="iss-row">
              <div class="iss-time">{{ pass.timeLabel }}</div>
              <div class="iss-dur">{{ pass.durLabel }}</div>
              <div class="iss-dir">{{ t('passDirection') }}: {{ pass.direction }}</div>
            </div>
          </div>
        </UiCard>

        <div class="duo-grid">
          <UiCard :label="t('aurora')" :icon="Sparkles" accent="#22c55e" :interactive="false">
            <UiLoading v-if="kpState === 'loading'" compact :label="t('auroraLoading')" />
            <UiErrorState v-else-if="kpState === 'error'" :message="t('auroraError')" retry-label="" />
            <div v-else-if="auroraVisible" class="aurora-body">
              <div class="kp-display">
                <span class="kp-value" :style="{ color: auroraVisible.color }">{{ auroraVisible.kp.toFixed(1) }}</span>
                <UiBadge class="kp-level" :style="{ borderColor: auroraVisible.color, color: auroraVisible.color }">{{
                  auroraVisible.level
                }}</UiBadge>
              </div>
              <div class="kp-meta">
                <div class="meta-row">
                  <span class="meta-label">{{ t('visibleFrom') }}</span>
                  <span class="meta-value">{{ auroraVisible.visibleLat }}° {{ t('hemiBoth') }}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">{{ t('yourLatitude') }}</span>
                  <span class="meta-value">{{ auroraVisible.userLat }}° {{ auroraVisible.userHemi }}</span>
                </div>
              </div>
              <UiBadge class="aurora-verdict" :variant="auroraVisible.isVisible ? 'up' : 'neutral'">
                {{ auroraVisible.isVisible ? t('yes') : t('auroraNotVisible') }}
              </UiBadge>
            </div>
            <template #footer>
              <UiButton variant="soft" size="sm" @click="openAurora">
                {{ t('openAurora') }} <ArrowRight :size="14" aria-hidden="true" />
              </UiButton>
            </template>
          </UiCard>

          <UiCard :label="t('moon')" :icon="Moon" accent="#a78bfa" :interactive="false">
            <UiLoading v-if="moonState === 'loading'" compact :label="t('moonLoading')" />
            <UiErrorState v-else-if="moonState === 'error'" :message="t('moonError')" retry-label="" />
            <div v-else-if="moonData" class="moon-body">
              <div class="moon-icon">
                <svg viewBox="0 0 48 48" class="moon-svg" aria-hidden="true">
                  <circle
                    cx="24"
                    cy="24"
                    r="22"
                    fill="#0a0a0a"
                    opacity="0.92"
                    stroke="rgba(255, 255, 255, 0.14)"
                    stroke-width="1"
                  />
                  <path :d="moonLitPath" fill="#f5f5f3" />
                </svg>
              </div>
              <div class="moon-name">{{ moonData.phaseName }}</div>
              <div class="moon-phase-num">{{ Math.round((moonData.fraction || 0) * 100) }}% {{ t('illuminated') }}</div>
              <div class="moon-times">
                <div class="moon-time">
                  <Sunrise :size="14" aria-hidden="true" />
                  <span>{{ t('moonrise') }}</span>
                  <strong>{{ moonRiseText }}</strong>
                </div>
                <div class="moon-time">
                  <Sunset :size="14" aria-hidden="true" />
                  <span>{{ t('moonset') }}</span>
                  <strong>{{ moonSetText }}</strong>
                </div>
              </div>
            </div>
          </UiCard>
        </div>

        <UiCard :label="t('launches')" :icon="Rocket" accent="#f59e0b" :interactive="false">
          <UiLoading v-if="launchesState === 'loading'" compact :label="t('launchesLoading')" />
          <UiErrorState v-else-if="launchesState === 'error'" :message="t('launchesError')" retry-label="" />
          <UiEmptyState v-else-if="launchesState === 'empty'" :description="t('launchesEmpty')" compact />
          <div v-else-if="launchesState === 'loaded'" class="launch-list">
            <div v-for="(l, i) in launches" :key="i" class="launch-card">
              <div class="launch-header">
                <span class="launch-name">{{ l.name }}</span>
                <span class="launch-time">{{ l.timeLabel }}</span>
              </div>
              <div class="launch-details">
                <div class="launch-detail">
                  <span class="detail-label">{{ t('launchProvider') }}</span>
                  <span class="detail-value">{{ l.provider }}</span>
                </div>
                <div class="launch-detail">
                  <span class="detail-label">{{ t('launchVehicle') }}</span>
                  <span class="detail-value">{{ l.vehicle }}</span>
                </div>
                <div class="launch-detail">
                  <span class="detail-label">{{ t('launchSite') }}</span>
                  <span class="detail-value">{{ l.site }}</span>
                </div>
                <div v-if="l.mission !== '—'" class="launch-detail">
                  <span class="detail-label">{{ t('launchMission') }}</span>
                  <span class="detail-value mission-text">{{ l.mission }}</span>
                </div>
              </div>
            </div>
          </div>
          <template #footer>
            <UiButton variant="soft" size="sm" @click="openLaunchTab">
              {{ t('openLaunchBoard') }} <ArrowRight :size="14" aria-hidden="true" />
            </UiButton>
          </template>
        </UiCard>
      </template>
    </div>

    <AuroraForecast v-if="tab === 'aurora'" :latitude="location ? location.lat : null" />
  </div>
</template>

<style scoped>
.night-sky-app {
  --ok-content-width: 1100px;
  --ok-content-gutter: 1.25rem;
  --bg: var(--ok-bg);
  --panel: var(--ok-panel);
  --surface: var(--ok-panel);
  --text: var(--ok-text);
  --muted: var(--ok-muted);
  --border: var(--ok-line);
  --accent: var(--ok-accent);
  --accent-soft: var(--ok-accent-soft);
  --green: var(--ok-up);
  --orange: #ea580c;

  min-height: 0;
  font-family: var(--ok-font);
  color: var(--text);
  background: transparent;
  -webkit-font-smoothing: antialiased;
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

.lead-desc {
  margin-bottom: 0.85rem;
  color: var(--ok-muted);
  font-size: 0.8rem;
  line-height: 1.55;
  max-width: 76ch;
}

.search-section {
  padding: 1rem 0;
  border-bottom: 1px solid var(--border);
}

.search-form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.search-field {
  flex: 1 1 220px;
}

.search-error {
  margin-top: 0.5rem;
}

.tonight-view {
  margin-top: 0.9rem;
}

.tonight-view > .ui-card {
  margin-top: 1rem;
}

.duo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1rem;
}

.duo-grid .ui-card {
  margin-top: 0;
}

.location-label {
  margin-top: 0.5rem;
  font-size: 0.82rem;
  color: var(--accent);
  font-weight: 500;
}

.coords-hint {
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 400;
}

.highlight-card {
  border-color: var(--accent);
}

.highlight-body {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.highlight-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}

.hl-iss {
  background: rgba(56, 189, 248, 0.2);
}

.hl-iss::after {
  content: '';
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
}

.hl-aurora {
  background: rgba(74, 222, 128, 0.2);
}

.hl-aurora::after {
  content: '';
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 14px solid var(--green);
}

.hl-launch {
  background: rgba(249, 115, 22, 0.2);
}

.hl-launch::after {
  content: '';
  width: 4px;
  height: 16px;
  background: var(--orange);
  border-radius: 2px;
}

.hl-moon {
  background: rgba(245, 245, 243, 0.15);
}

.hl-moon::after {
  content: '';
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text);
  box-shadow: 4px 0 0 -2px var(--bg);
}

.highlight-text {
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--text);
  font-weight: 500;
}

.iss-list {
  display: flex;
  flex-direction: column;
}

.iss-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.55rem 0.1rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.82rem;
}

.iss-row:first-child {
  border-top: 1px solid var(--border);
}

.iss-time {
  font-family: var(--ok-mono);
  font-weight: 600;
  color: var(--text);
  min-width: 120px;
}

.iss-dur {
  color: var(--text);
  font-weight: 500;
  min-width: 80px;
}

.iss-dir {
  color: var(--muted);
  font-size: 0.76rem;
  margin-left: auto;
}

.aurora-body {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.kp-display {
  display: flex;
  align-items: baseline;
  gap: 0.8rem;
}

.kp-value {
  font-family: var(--ok-mono);
  font-size: 3rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
}

.kp-level {
  background: transparent;
}

.kp-meta {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.7rem 0;
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
  color: var(--muted);
}

.meta-value {
  font-family: var(--ok-mono);
  font-weight: 600;
  font-size: 0.9rem;
}

.aurora-verdict {
  width: 100%;
  justify-content: center;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
  white-space: normal;
}

.moon-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.moon-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 0.3rem;
}

.moon-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.moon-name {
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.moon-phase-num {
  font-family: var(--ok-mono);
  font-size: 0.78rem;
  color: var(--muted);
}

.moon-times {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-top: 0.55rem;
  padding-top: 0.55rem;
  border-top: 1px solid var(--border);
  font-size: 0.76rem;
}

.moon-time {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--muted);
}

.moon-time svg {
  flex: none;
  color: var(--accent);
}

.moon-time strong {
  margin-left: auto;
  font-family: var(--ok-mono);
  font-weight: 600;
  color: var(--text);
}

.launch-list {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.launch-card {
  padding: 0.8rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--ok-radius-sm);
  background: var(--ok-bg);
}

.launch-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}

.launch-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--accent);
}

.launch-time {
  font-family: var(--ok-mono);
  font-size: 0.76rem;
  color: var(--muted);
  flex-shrink: 0;
}

.launch-details {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.launch-detail {
  display: flex;
  gap: 0.5rem;
  font-size: 0.78rem;
  line-height: 1.5;
}

.detail-label {
  color: var(--muted);
  min-width: 56px;
  flex-shrink: 0;
}

.detail-value {
  color: var(--text);
}

.mission-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (max-width: 720px) {
  .duo-grid {
    grid-template-columns: 1fr;
  }
  .search-form {
    flex-direction: column;
  }
  .search-form :deep(.ui-btn) {
    width: 100%;
  }
  .iss-row {
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .iss-time {
    min-width: auto;
  }
  .iss-dur {
    min-width: auto;
  }
  .iss-dir {
    margin-left: 0;
  }
  .kp-value {
    font-size: 2.4rem;
  }
  .launch-header {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 480px) {
  .tonight-view > .ui-card {
    margin-top: 0.8rem;
  }
}
</style>
