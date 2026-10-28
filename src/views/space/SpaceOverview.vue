<script setup>
import { ref, computed, onMounted, onBeforeUnmount, onActivated, onDeactivated } from 'vue'
import { RefreshCw } from '@lucide/vue'
import { useT } from '../../i18n.js'
import { locale, usgsQuakes } from '../../ok.js'
import {
  getIssPosition,
  getKpIndex,
  getUpcomingLaunches,
  getMarsWeather,
  getPeopleInSpace,
} from '../../lib/space-data.js'
import SpaceQuakeCard from '../../components/space/cards/SpaceQuakeCard.vue'
import SpaceIssCard from '../../components/space/cards/SpaceIssCard.vue'
import SpaceAuroraCard from '../../components/space/cards/SpaceAuroraCard.vue'
import SpaceLaunchCard from '../../components/space/cards/SpaceLaunchCard.vue'
import SpaceMarsCard from '../../components/space/cards/SpaceMarsCard.vue'
import SpacePeopleCard from '../../components/space/cards/SpacePeopleCard.vue'
import copy from '../../copy/space-now.js'
import { UiButton } from '../../components/ui/index.js'

const t = useT(copy)
const emit = defineEmits(['navigate'])

const nowTick = ref(Date.now())
const quakeData = ref([])
const quakeState = ref('loading')
const issData = ref(null)
const issState = ref('loading')
const kpData = ref(null)
const kpState = ref('loading')
const launchData = ref(null)
const launchState = ref('loading')
const launchError = ref('')
const marsData = ref(null)
const marsState = ref('loading')
const peopleData = ref(null)
const peopleState = ref('loading')
const peopleError = ref('')

function errorKind(e) {
  return e && /429/.test(e.message || '') ? 'quota' : 'error'
}

async function loadQuakes() {
  const has = quakeData.value.length > 0
  if (!has) quakeState.value = 'loading'
  try {
    const feats = await usgsQuakes({ hours: 1, limit: 50 })
    quakeData.value = feats
      .map(function (f) {
        const p = f && f.properties
        const g = f && f.geometry && f.geometry.coordinates
        return {
          time: p && p.time,
          mag: p && p.mag,
          place: p && p.place,
          lon: g ? g[0] : null,
          lat: g ? g[1] : null,
        }
      })
      .filter((e) => e.mag != null)
      .sort((a, b) => (b.time || 0) - (a.time || 0))
    quakeState.value = 'loaded'
  } catch (e) {
    if (!has) quakeState.value = 'error'
  }
}

async function loadIss() {
  const has = !!issData.value
  if (!has) issState.value = 'loading'
  try {
    issData.value = await getIssPosition({ timeout: 15000 })
    issState.value = 'loaded'
  } catch (e) {
    if (!has) issState.value = 'error'
  }
}

function normalizeKpRow(r) {
  if (!r) return null
  if (Array.isArray(r)) return { time: r[0], kp: parseFloat(r[1]) }
  return { time: r.time_tag || r.time, kp: parseFloat(r.Kp != null ? r.Kp : r.kp) }
}

async function loadKp({ force = false } = {}) {
  const has = !!kpData.value
  if (!has) kpState.value = 'loading'
  try {
    const d = await getKpIndex({ timeout: 15000, force })
    if (!Array.isArray(d) || d.length < 2) throw new Error('bad kp')
    const rows = d.map(normalizeKpRow).filter((r) => r && !isNaN(r.kp))
    let latest = null
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].kp != null) {
        latest = rows[i]
        break
      }
    }
    if (!latest) throw new Error('no kp row')
    kpData.value = latest
    kpState.value = 'loaded'
  } catch (e) {
    if (!has) kpState.value = 'error'
  }
}

async function loadLaunch({ force = false } = {}) {
  const has = launchState.value === 'loaded'
  if (!has) launchState.value = 'loading'
  try {
    const results = await getUpcomingLaunches({ limit: 5, timeout: 15000, force })
    const now = Date.now()
    const next = results.find((l) => l && l.net && new Date(l.net).getTime() > now) || results[0] || null
    launchData.value = next
    launchState.value = next ? 'loaded' : 'empty'
    launchError.value = ''
  } catch (e) {
    if (!has) {
      launchState.value = 'error'
      launchError.value = errorKind(e)
    }
  }
}

async function loadMars({ force = false } = {}) {
  const has = !!marsData.value
  if (!has) marsState.value = 'loading'
  try {
    const res = await getMarsWeather({ days: 1, timeout: 20000, force })
    const d = res.days && res.days[res.days.length - 1]
    if (!d) throw new Error('bad mars')
    marsData.value = { sol: d.sol, date: d.date, max: d.maxTemp, min: d.minTemp, ls: d.ls }
    marsState.value = 'loaded'
  } catch (e) {
    if (!has) marsState.value = 'error'
  }
}

async function loadPeople({ force = false } = {}) {
  const has = !!peopleData.value
  if (!has) peopleState.value = 'loading'
  try {
    peopleData.value = await getPeopleInSpace({ timeout: 15000, force })
    peopleState.value = 'loaded'
    peopleError.value = ''
  } catch (e) {
    if (!has) {
      peopleState.value = 'error'
      peopleError.value = errorKind(e)
    }
  }
}

const refreshing = ref(false)
let lastLoaded = 0

async function loadAll({ force = false } = {}) {
  lastLoaded = Date.now()
  await Promise.allSettled([
    loadQuakes(),
    loadIss(),
    loadKp({ force }),
    loadLaunch({ force }),
    loadMars({ force }),
    loadPeople({ force }),
  ])
}

async function refreshNow() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await loadAll({ force: true })
  } finally {
    refreshing.value = false
  }
}

const nowText = computed(() =>
  new Date(nowTick.value).toLocaleString(locale(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }),
)

function go(target) {
  emit('navigate', target)
}

let nowTimer = null
let refreshTimer = null
let active = false

function stopTimers() {
  if (nowTimer) clearInterval(nowTimer)
  if (refreshTimer) clearInterval(refreshTimer)
  nowTimer = null
  refreshTimer = null
}

function startTimers() {
  stopTimers()
  nowTick.value = Date.now()
  nowTimer = setInterval(function () {
    if (!document.hidden) nowTick.value = Date.now()
  }, 1000)
  refreshTimer = setInterval(function () {
    if (!document.hidden && !refreshing.value) loadAll()
  }, 60000)
}

function onVisibility() {
  if (!document.hidden && active && Date.now() - lastLoaded > 60000) loadAll()
}

onMounted(function () {
  active = true
  startTimers()
  loadAll()
  document.addEventListener('visibilitychange', onVisibility)
})

onActivated(function () {
  if (active) return
  active = true
  startTimers()
  if (Date.now() - lastLoaded > 60000) loadAll()
})

onDeactivated(function () {
  active = false
  stopTimers()
})

onBeforeUnmount(function () {
  active = false
  stopTimers()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <div class="space-overview">
    <p class="overview-lead">{{ t('lead') }}</p>

    <div class="now-bar">
      <span class="now-dot" aria-hidden="true"></span>
      <span class="now-label">{{ t('now') }}</span>
      <span class="now-time">{{ nowText }}</span>
      <span class="now-hint">{{ t('refreshHint') }}</span>
      <UiButton size="sm" variant="secondary" :loading="refreshing" class="now-refresh" @click="refreshNow">
        <RefreshCw v-if="!refreshing" :size="13" aria-hidden="true" />
        {{ refreshing ? t('refreshing') : t('refresh') }}
      </UiButton>
    </div>

    <section class="grid">
      <SpaceQuakeCard :state="quakeState" :quakes="quakeData" :now="nowTick" @retry="loadQuakes" @navigate="go" />
      <SpaceIssCard :state="issState" :iss="issData" @retry="loadIss" @navigate="go" />
      <SpaceAuroraCard
        :state="kpState"
        :kp="kpData ? kpData.kp : null"
        @retry="loadKp({ force: true })"
        @navigate="go"
      />
      <SpaceLaunchCard
        :state="launchState"
        :error-kind="launchError"
        :launch="launchData"
        :now="nowTick"
        @retry="loadLaunch({ force: true })"
        @navigate="go"
      />
      <SpaceMarsCard :state="marsState" :mars="marsData" @retry="loadMars({ force: true })" @navigate="go" />
      <SpacePeopleCard
        :state="peopleState"
        :error-kind="peopleError"
        :people="peopleData"
        @retry="loadPeople({ force: true })"
        @navigate="go"
      />
    </section>
  </div>
</template>

<style scoped>
.space-overview {
  min-width: 0;
}

.overview-lead {
  margin-bottom: 0.85rem;
  color: var(--ok-muted);
  font-size: 0.8rem;
  line-height: 1.55;
  max-width: 76ch;
}

.now-bar {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  row-gap: 0.4rem;
  padding: 0.7rem 0.95rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-lg);
  background: linear-gradient(100deg, color-mix(in srgb, var(--ok-accent) 9%, var(--ok-panel)), var(--ok-panel) 62%);
  box-shadow: var(--ok-shadow-card);
}

.now-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ok-up);
  flex-shrink: 0;
  animation: now-pulse 1.6s ease-in-out infinite;
}

@keyframes now-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

.now-label {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--ok-muted);
}

.now-time {
  font-family: var(--ok-mono);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ok-text);
  font-variant-numeric: tabular-nums;
}

.now-hint {
  margin-left: auto;
  font-size: 0.7rem;
  color: var(--ok-muted);
}

@media (prefers-reduced-motion: reduce) {
  .now-dot {
    animation: none;
  }
}

.grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 1rem;
  align-items: stretch;
}

.card-wide {
  grid-column: span 2;
}
.card-full {
  grid-column: 1 / -1;
}

@media (max-width: 680px) {
  .card-wide,
  .card-full {
    grid-column: auto;
  }
  .now-hint {
    display: none;
  }
  .now-refresh {
    margin-left: auto;
  }
}
</style>
