<script setup>
import { ref, computed, onMounted, onActivated, onDeactivated, onBeforeUnmount } from 'vue'
import { RefreshCw, Rocket } from '@lucide/vue'
import { useT } from '../../i18n.js'
import { locale } from '../../ok.js'
import { getUpcomingLaunches } from '../../lib/space-data.js'
import { pad2 } from '../../lib/format.js'
import {
  UiBadge,
  UiButton,
  UiCard,
  UiDialog,
  UiEmptyState,
  UiField,
  UiIconButton,
  UiInput,
  UiLoading,
  UiSectionHead,
  UiSelect,
  UiTooltip,
} from '../../components/ui/index.js'
import copy from '../../copy/launch-board.js'

const t = useT(copy)

const STATUS_CATS = ['go', 'tbd', 'hold', 'failed', 'inflight']

const allLaunches = ref([])
const nextLaunch = ref(null)
const usingFallback = ref(false)
const loading = ref(true)
const agencyFilter = ref('')
const statusFilter = ref('')
const searchQuery = ref('')
const modalLaunch = ref(null)

const countdown = ref({ days: 0, hours: 0, mins: 0, secs: 0, ended: false })

let countdownTimer = null

function statusCategory(launch) {
  const id = launch && launch.status && launch.status.id
  if (id === 1) return 'go'
  if (id === 2 || id === 3 || id === 8) return 'tbd'
  if (id === 4) return 'hold'
  if (id === 5) return 'inflight'
  if (id === 6 || id === 7) return 'failed'
  return 'tbd'
}

function statusLabel(cat) {
  return t.value('status' + cat.charAt(0).toUpperCase() + cat.slice(1))
}

function statusVariant(cat) {
  if (cat === 'go' || cat === 'success') return 'up'
  if (cat === 'failed') return 'down'
  if (cat === 'hold' || cat === 'inflight') return 'accent'
  return 'warn'
}

function agencyName(launch) {
  return (launch.launch_service_provider && launch.launch_service_provider.name) || t.value('notAvailable')
}

function padName(launch) {
  const pad = launch.pad
  if (!pad) return t.value('notAvailable')
  const loc = pad.location && pad.location.name ? pad.location.name : ''
  return pad.name ? (loc ? pad.name + ' · ' + loc : pad.name) : loc || t.value('notAvailable')
}

function rocketName(launch) {
  const cfg = launch.rocket && launch.rocket.configuration
  return (cfg && cfg.full_name) || (cfg && cfg.name) || t.value('notAvailable')
}

function missionName(launch) {
  return (launch.mission && launch.mission.name) || launch.name || t.value('notAvailable')
}

function isTbdLaunch(launch) {
  const cat = statusCategory(launch)
  if (cat !== 'tbd') return false
  const d = launch && launch.net ? new Date(launch.net) : null
  if (!d || isNaN(d.getTime())) return true

  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0
}

function formatTime(iso, launch) {
  if (!iso) return { local: t.value('notAvailable'), utc: '' }

  if (launch && isTbdLaunch(launch)) {
    return { local: t.value('statusTbd'), utc: '' }
  }
  const d = new Date(iso)
  if (isNaN(d.getTime())) return { local: t.value('notAvailable'), utc: '' }
  const loc = locale()
  const local = new Intl.DateTimeFormat(loc, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(d)
  const utc = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(d)
  return { local, utc }
}

function formatShort(iso, launch) {
  if (!iso) return t.value('notAvailable')
  if (launch && isTbdLaunch(launch)) return t.value('statusTbd')
  const d = new Date(iso)
  if (isNaN(d.getTime())) return t.value('notAvailable')
  const loc = locale()
  return new Intl.DateTimeFormat(loc, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function mockLaunches() {
  const now = Date.now()
  const hr = 3600 * 1000
  const day = 24 * hr

  return [
    {
      id: 'mock-1',
      name: 'Falcon 9 Block 5 | Starlink Group 8-12',
      status: { id: 2, name: 'To Be Determined', abbrev: 'TBD' },
      net: new Date(now + 1 * day + 5 * hr).toISOString(),
      window_start: new Date(now + 1 * day + 5 * hr).toISOString(),
      window_end: new Date(now + 1 * day + 6 * hr).toISOString(),
      launch_service_provider: { id: 121, name: 'SpaceX', type: 'Commercial' },
      rocket: {
        configuration: { name: 'Falcon 9', family: 'Falcon', full_name: 'Falcon 9 Block 5', variant: 'Block 5' },
      },
      mission: {
        name: 'Starlink Group 8-12',
        description: "A batch of Starlink v2 mini satellites for SpaceX's low-Earth-orbit internet constellation.",
        type: 'Communications',
        orbit: { name: 'Low Earth Orbit', abbrev: 'LEO' },
      },
      pad: {
        name: 'Space Launch Complex 40',
        latitude: 28.562,
        longitude: -80.577,
        location: { name: 'Cape Canaveral, FL, USA' },
      },
      image: null,
      webcast_live: false,
      vidURLs: [],
    },
    {
      id: 'mock-2',
      name: "Long March 5 | Chang'e 7",
      status: { id: 2, name: 'To Be Determined', abbrev: 'TBD' },
      net: new Date(now + 4 * day + 11 * hr).toISOString(),
      window_start: new Date(now + 4 * day + 11 * hr).toISOString(),
      window_end: new Date(now + 4 * day + 12 * hr).toISOString(),
      launch_service_provider: { id: 88, name: 'CASC', type: 'Government' },
      rocket: { configuration: { name: 'Long March 5', family: 'Long March', full_name: 'Long March 5', variant: '' } },
      mission: {
        name: "Chang'e 7",
        description:
          "Chinese lunar exploration mission to the Moon's south pole, including an orbiter, lander, rover and hopper.",
        type: 'Planetary Science',
        orbit: { name: 'Lunar', abbrev: 'LUN' },
      },
      pad: { name: 'LC-101', latitude: 19.614, longitude: 110.952, location: { name: 'Wenchang, China' } },
      image: null,
      webcast_live: false,
      vidURLs: [],
    },
    {
      id: 'mock-3',
      name: 'Soyuz 2.1b | Glonass-K2',
      status: { id: 1, name: 'Go', abbrev: 'GO' },
      net: new Date(now + 6 * day + 8 * hr).toISOString(),
      window_start: new Date(now + 6 * day + 8 * hr).toISOString(),
      window_end: new Date(now + 6 * day + 9 * hr).toISOString(),
      launch_service_provider: { id: 98, name: 'Roscosmos', type: 'Government' },
      rocket: { configuration: { name: 'Soyuz 2.1b', family: 'Soyuz', full_name: 'Soyuz 2.1b', variant: 'b' } },
      mission: {
        name: 'Glonass-K2 No. 13',
        description: 'Navigation satellite for the Russian GLONASS global positioning system.',
        type: 'Navigation',
        orbit: { name: 'Medium Earth Orbit', abbrev: 'MEO' },
      },
      pad: { name: 'Site 43/4', latitude: 45.964, longitude: 63.305, location: { name: 'Plesetsk, Russia' } },
      image: null,
      webcast_live: false,
      vidURLs: [],
    },
    {
      id: 'mock-4',
      name: 'Ariane 6 | Galactic 02',
      status: { id: 2, name: 'To Be Determined', abbrev: 'TBD' },
      net: new Date(now + 9 * day + 14 * hr).toISOString(),
      window_start: new Date(now + 9 * day + 14 * hr).toISOString(),
      window_end: new Date(now + 9 * day + 15 * hr).toISOString(),
      launch_service_provider: { id: 115, name: 'Arianespace', type: 'Commercial' },
      rocket: { configuration: { name: 'Ariane 6', family: 'Ariane', full_name: 'Ariane 62', variant: '62' } },
      mission: {
        name: 'Galactic 02',
        description: 'Commercial communications payload delivered to geostationary transfer orbit.',
        type: 'Communications',
        orbit: { name: 'Geostationary Transfer Orbit', abbrev: 'GTO' },
      },
      pad: { name: 'ELA-4', latitude: 5.236, longitude: -52.775, location: { name: 'Kourou, French Guiana' } },
      image: null,
      webcast_live: false,
      vidURLs: [],
    },
    {
      id: 'mock-5',
      name: 'Electron | The Beat Goes On',
      status: { id: 1, name: 'Go', abbrev: 'GO' },
      net: new Date(now + 12 * day + 3 * hr).toISOString(),
      window_start: new Date(now + 12 * day + 3 * hr).toISOString(),
      window_end: new Date(now + 12 * day + 4 * hr).toISOString(),
      launch_service_provider: { id: 147, name: 'Rocket Lab', type: 'Commercial' },
      rocket: { configuration: { name: 'Electron', family: 'Electron', full_name: 'Electron', variant: '' } },
      mission: {
        name: 'The Beat Goes On',
        description:
          'Dedicated small-satellite rideshare mission carrying multiple commercial and academic payloads to low Earth orbit.',
        type: 'Dedicated Rideshare',
        orbit: { name: 'Low Earth Orbit', abbrev: 'LEO' },
      },
      pad: {
        name: 'Launch Complex 1',
        latitude: -39.261,
        longitude: 177.865,
        location: { name: 'Mahia, New Zealand' },
      },
      image: null,
      webcast_live: true,
      vidURLs: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    },
    {
      id: 'mock-6',
      name: 'Vulcan VC6 | Dream Chaser 1',
      status: { id: 2, name: 'To Be Determined', abbrev: 'TBD' },
      net: new Date(now + 18 * day + 9 * hr).toISOString(),
      window_start: new Date(now + 18 * day + 9 * hr).toISOString(),
      window_end: new Date(now + 18 * day + 10 * hr).toISOString(),
      launch_service_provider: { id: 124, name: 'ULA', type: 'Commercial' },
      rocket: { configuration: { name: 'Vulcan', family: 'Vulcan', full_name: 'Vulcan VC6', variant: 'VC6' } },
      mission: {
        name: 'Dream Chaser 1',
        description:
          'First operational cargo resupply mission of the Dream Chaser spaceplane to the International Space Station.',
        type: 'Resupply',
        orbit: { name: 'Low Earth Orbit', abbrev: 'LEO' },
      },
      pad: {
        name: 'Space Launch Complex 41',
        latitude: 28.583,
        longitude: -80.583,
        location: { name: 'Cape Canaveral, FL, USA' },
      },
      image: null,
      webcast_live: false,
      vidURLs: [],
    },
  ]
}

const agencyOptions = computed(() => {
  const set = new Set()
  allLaunches.value.forEach((l) => {
    const n = agencyName(l)
    if (n && n !== t.value('notAvailable')) set.add(n)
  })
  return Array.from(set).sort()
})

const statusOptions = computed(() => STATUS_CATS.map((c) => ({ value: c, label: statusLabel(c) })))

const agencySelectOptions = computed(() => [
  { value: '', label: t.value('allAgencies') },
  ...agencyOptions.value.map((a) => ({ value: a, label: a })),
])

const statusSelectOptions = computed(() => [{ value: '', label: t.value('allStatuses') }, ...statusOptions.value])

const filteredLaunches = computed(() => {
  const agency = agencyFilter.value
  const status = statusFilter.value
  const q = searchQuery.value.trim().toLowerCase()
  return allLaunches.value.filter((l) => {
    if (agency && agencyName(l) !== agency) return false
    if (status && statusCategory(l) !== status) return false
    if (q) {
      const hay = ((l.name || '') + ' ' + missionName(l) + ' ' + rocketName(l) + ' ' + agencyName(l)).toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
})

const resultCountText = computed(() => t.value('resultCount').replace('{n}', String(filteredLaunches.value.length)))

const heroTime = computed(() => (nextLaunch.value ? formatTime(nextLaunch.value.net, nextLaunch.value) : null))

const heroIsTbd = computed(() => (nextLaunch.value ? isTbdLaunch(nextLaunch.value) : false))

const modalData = computed(() => {
  if (!modalLaunch.value) return null
  const l = modalLaunch.value
  const cat = statusCategory(l)
  const time = formatTime(l.net, l)
  const cfg = (l.rocket && l.rocket.configuration) || {}
  const mission = l.mission || {}
  const pad = l.pad || {}
  const orbit = (mission.orbit && mission.orbit.name) || t.value('notAvailable')
  const desc = mission.description || t.value('notAvailable')
  const padLat = parseFloat(pad.latitude)
  const padLon = parseFloat(pad.longitude)
  const coords =
    Number.isFinite(padLat) && Number.isFinite(padLon)
      ? padLat.toFixed(3) + ', ' + padLon.toFixed(3)
      : t.value('notAvailable')

  const vidUrl = l.vidURLs && l.vidURLs.length ? l.vidURLs[0] : ''
  return {
    cat,
    statusLabel: statusLabel(cat),
    time,
    missionName: missionName(l),
    sub: l.name || rocketName(l),
    agencyName: agencyName(l),
    padName: padName(l),
    cfgFullName: cfg.full_name || cfg.name || t.value('notAvailable'),
    cfgFamily: cfg.family || t.value('notAvailable'),
    cfgVariant: cfg.variant || t.value('notAvailable'),
    missionType: mission.type || t.value('notAvailable'),
    orbit,
    desc,
    coords,
    vidUrl,
  }
})

async function loadData(force = false) {
  loading.value = true
  stopCountdown()
  try {
    const results = await getUpcomingLaunches({ limit: 30, timeout: 10000, force })
    if (!results.length) {
      useFallback(mockLaunches())
      return
    }
    usingFallback.value = false
    allLaunches.value = results
    afterDataLoad()
  } catch (e) {
    useFallback(mockLaunches())
  }
}

function useFallback(data) {
  usingFallback.value = true
  allLaunches.value = data
  afterDataLoad()
}

function afterDataLoad() {
  const now = Date.now()
  nextLaunch.value = null
  for (const l of allLaunches.value) {
    const net = new Date(l.net).getTime()
    if (!isNaN(net) && net > now) {
      nextLaunch.value = l
      break
    }
  }

  if (!nextLaunch.value && allLaunches.value.length) nextLaunch.value = allLaunches.value[0]
  loading.value = false
  startCountdown()
}

function tickCountdown() {
  if (!nextLaunch.value) return

  if (isTbdLaunch(nextLaunch.value)) return
  const target = new Date(nextLaunch.value.net).getTime()
  if (isNaN(target)) return
  const diff = target - Date.now()
  if (diff <= 0) {
    countdown.value = { days: 0, hours: 0, mins: 0, secs: 0, ended: true }

    stopCountdown()
    return
  }
  const totalSec = Math.floor(diff / 1000)
  countdown.value = {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    mins: Math.floor((totalSec % 3600) / 60),
    secs: totalSec % 60,
    ended: false,
  }
}

function startCountdown() {
  stopCountdown()
  countdown.value = { days: 0, hours: 0, mins: 0, secs: 0, ended: false }
  tickCountdown()
  countdownTimer = setInterval(tickCountdown, 1000)
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function openModal(launch) {
  modalLaunch.value = launch
}

function closeModal() {
  modalLaunch.value = null

  document.body.style.overflow = ''
  document.body.style.pointerEvents = ''
  document.body.style.paddingRight = ''
  document.body.style.marginRight = ''
}

function onVisibility() {
  if (document.hidden) {
    stopCountdown()
  } else if (nextLaunch.value && !loading.value) {
    startCountdown()
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility)
  loadData()
})

onActivated(() => {
  if (!document.hidden && nextLaunch.value && !loading.value) startCountdown()
})

onDeactivated(() => {
  stopCountdown()
  closeModal()
})

onBeforeUnmount(() => {
  stopCountdown()
  closeModal()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <div class="launch-board-app">
    <UiSectionHead class="tab-head" :description="t('lead')">
      <template #actions>
        <UiTooltip :label="t('refresh')">
          <UiIconButton :label="t('refresh')" variant="secondary" size="sm" :disabled="loading" @click="loadData(true)">
            <RefreshCw :size="14" aria-hidden="true" />
          </UiIconButton>
        </UiTooltip>
      </template>
    </UiSectionHead>

    <UiCard class="hero-card" padding="none">
      <div class="hero-inner">
        <UiLoading v-if="loading" :label="t('loadingNext')" />

        <UiEmptyState v-else-if="!nextLaunch" :description="t('noUpcoming')" compact />

        <template v-else>
          <UiBadge variant="accent" class="hero-badge"
            ><Rocket :size="13" aria-hidden="true" /> {{ t('nextLaunch') }}</UiBadge
          >
          <div class="hero-name">{{ nextLaunch.name || missionName(nextLaunch) }}</div>
          <div class="hero-mission">{{ t('mission') }}: {{ missionName(nextLaunch) }}</div>
          <div class="hero-meta">
            <span class="hm-item">
              <span class="hm-key">{{ t('launchProvider') }}:</span>
              <span class="hm-val">{{ agencyName(nextLaunch) }}</span>
            </span>
            <span class="hm-item">
              <span class="hm-key">{{ t('launchSite') }}:</span>
              <span class="hm-val">{{ padName(nextLaunch) }}</span>
            </span>
          </div>
          <div class="hero-time">
            {{ t('localLabel') }}: {{ heroTime.local }}
            <span class="ht-utc">· {{ t('utcLabel') }}: {{ heroTime.utc }}</span>
          </div>

          <div v-if="heroIsTbd" class="cd-launched">{{ t('statusTbd') }}</div>
          <div v-else-if="countdown.ended" class="cd-launched">{{ t('launched') }}</div>
          <div v-else class="countdown">
            <div class="cd-unit">
              <span class="cd-val">{{ pad2(countdown.days) }}</span>
              <span class="cd-label">{{ t('days') }}</span>
            </div>
            <div class="cd-unit">
              <span class="cd-val">{{ pad2(countdown.hours) }}</span>
              <span class="cd-label">{{ t('hours') }}</span>
            </div>
            <div class="cd-unit">
              <span class="cd-val">{{ pad2(countdown.mins) }}</span>
              <span class="cd-label">{{ t('minutes') }}</span>
            </div>
            <div class="cd-unit">
              <span class="cd-val">{{ pad2(countdown.secs) }}</span>
              <span class="cd-label">{{ t('seconds') }}</span>
            </div>
          </div>
          <UiBadge v-if="usingFallback" variant="warn" class="fallback-notice">{{ t('fallbackNotice') }}</UiBadge>
        </template>
      </div>
    </UiCard>

    <section class="filters">
      <UiField :label="t('agency')">
        <UiSelect
          v-model="agencyFilter"
          :options="agencySelectOptions"
          :placeholder="t('allAgencies')"
          :aria-label="t('agency')"
        />
      </UiField>
      <UiField :label="t('status')">
        <UiSelect
          v-model="statusFilter"
          :options="statusSelectOptions"
          :placeholder="t('allStatuses')"
          :aria-label="t('status')"
        />
      </UiField>
      <UiField class="filter-search" :label="t('search')" label-for="searchInput">
        <UiInput
          id="searchInput"
          v-model="searchQuery"
          type="search"
          :placeholder="t('searchPlaceholder')"
          :aria-label="t('search')"
        />
      </UiField>
    </section>

    <section class="list-section">
      <UiSectionHead :title="t('upcoming')" :meta="resultCountText" />
      <div class="launch-grid">
        <UiLoading v-if="loading" :label="t('loading')" class="list-state" />

        <UiEmptyState v-else-if="!filteredLaunches.length" :description="t('noResults')" compact class="list-state" />

        <button v-for="l in filteredLaunches" :key="l.id" type="button" class="launch-card" @click="openModal(l)">
          <div class="lc-top">
            <div class="lc-name">
              <div class="lc-mission">{{ missionName(l) }}</div>
              <div class="lc-rocket">{{ rocketName(l) }}</div>
            </div>
          </div>
          <div class="lc-body">
            <div class="lc-row">
              <span class="lc-key">{{ t('launchProvider') }}:</span>
              <span class="lc-val">{{ agencyName(l) }}</span>
            </div>
            <div class="lc-row">
              <span class="lc-key">{{ t('launchSite') }}:</span>
              <span class="lc-val">{{ padName(l) }}</span>
            </div>
          </div>
          <div class="lc-foot">
            <span class="lc-time">{{ formatShort(l.net, l) }}</span>
            <UiBadge :variant="statusVariant(statusCategory(l))" size="sm" dot>{{
              statusLabel(statusCategory(l))
            }}</UiBadge>
          </div>
        </button>
      </div>
    </section>

    <UiDialog
      :open="!!modalLaunch"
      :title="modalData ? modalData.missionName : ''"
      :description="modalData ? modalData.sub : ''"
      @update:open="(open) => !open && closeModal()"
    >
      <template #eyebrow>{{ t('mission') }}</template>
      <div v-if="modalData" class="modal-body">
        <div class="modal-status-row">
          <UiBadge :variant="statusVariant(modalData.cat)" size="sm" dot>{{ modalData.statusLabel }}</UiBadge>
          <span class="lc-time"
            >{{ t('localLabel') }}: {{ modalData.time.local }} · {{ t('utcLabel') }}: {{ modalData.time.utc }}</span
          >
        </div>
        <div class="modal-section">
          <h4>{{ t('description') }}</h4>
          <p>{{ modalData.desc }}</p>
        </div>
        <div class="modal-section">
          <h4>{{ t('rocketDetails') }}</h4>
          <div class="modal-grid">
            <div class="mg-row">
              <span class="mg-key">{{ t('rocket') }}</span>
              <span class="mg-val">{{ modalData.cfgFullName }}</span>
            </div>
            <div class="mg-row">
              <span class="mg-key">Family</span>
              <span class="mg-val">{{ modalData.cfgFamily }}</span>
            </div>
            <div class="mg-row">
              <span class="mg-key">Variant</span>
              <span class="mg-val">{{ modalData.cfgVariant }}</span>
            </div>
            <div class="mg-row">
              <span class="mg-key">{{ t('launchProvider') }}</span>
              <span class="mg-val">{{ modalData.agencyName }}</span>
            </div>
          </div>
        </div>
        <div class="modal-section">
          <h4>{{ t('payload') }}</h4>
          <div class="modal-grid">
            <div class="mg-row">
              <span class="mg-key">{{ t('missionType') }}</span>
              <span class="mg-val">{{ modalData.missionType }}</span>
            </div>
            <div class="mg-row">
              <span class="mg-key">{{ t('orbit') }}</span>
              <span class="mg-val">{{ modalData.orbit }}</span>
            </div>
          </div>
        </div>
        <div class="modal-section">
          <h4>{{ t('launchSite') }}</h4>
          <div class="modal-grid">
            <div class="mg-row">
              <span class="mg-key">{{ t('launchSite') }}</span>
              <span class="mg-val">{{ modalData.padName }}</span>
            </div>
            <div class="mg-row">
              <span class="mg-key">{{ t('coordinates') }}</span>
              <span class="mg-val">{{ modalData.coords }}</span>
            </div>
          </div>
        </div>
        <div class="modal-section">
          <h4>{{ t('webcast') }}</h4>
          <UiButton
            v-if="modalData.vidUrl"
            class="modal-link"
            variant="primary"
            size="sm"
            :href="modalData.vidUrl"
            target="_blank"
            rel="noreferrer"
            >{{ t('watchLive') }}</UiButton
          >
          <p v-else class="ms-muted">{{ t('noWebcast') }}</p>
        </div>
      </div>
    </UiDialog>
  </div>
</template>

<style scoped>
.launch-board-app {
  --ok-content-width: 1180px;
  --ok-content-gutter: 1.5rem;

  --bg: var(--ok-bg);
  --surface: var(--ok-panel);
  --surface-2: var(--ok-bg);
  --text: var(--ok-text);
  --text-muted: var(--ok-muted);
  --border: var(--ok-line);
  --accent: var(--ok-accent);
  --accent-2: var(--ok-accent);
  --ok-accent-contrast: var(--ok-bg);

  --st-go: #4ade80;
  --st-go-bg: rgba(74, 222, 128, 0.12);

  font-family: var(--ok-font);
  color: var(--ok-text);
  -webkit-font-smoothing: antialiased;
}

.launch-board-app .hero-card {
  margin-top: 1.2rem;
}

.tab-head {
  margin-bottom: 0.4rem;
}

.launch-board-app :deep(a) {
  color: var(--accent);
  text-decoration: none;
}
.launch-board-app h1,
.launch-board-app h2,
.launch-board-app h3,
.launch-board-app p,
.launch-board-app strong,
.launch-board-app span,
.launch-board-app small {
  margin: 0;
}

.hero-inner {
  padding: 1.4rem;
  overflow: hidden;
}

.hero-badge {
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.hero-name {
  margin-top: 0.75rem;
  font-size: clamp(1.3rem, 3vw, 1.7rem);
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.15;
  position: relative;
}

.hero-mission {
  margin-top: 0.35rem;
  font-size: 1rem;
  color: var(--text);
  position: relative;
}

.hero-meta {
  margin-top: 0.8rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.2rem;
  font-size: 0.85rem;
  color: var(--text-muted);
  position: relative;
}

.hero-meta .hm-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.hero-meta .hm-key {
  color: var(--text-muted);
}
.hero-meta .hm-val {
  color: var(--text);
  font-weight: 500;
}

.hero-time {
  margin-top: 0.6rem;
  font-family: var(--ok-mono);
  font-size: 0.82rem;
  color: var(--text-muted);
  position: relative;
}
.hero-time .ht-utc {
  color: var(--ok-muted);
}

.countdown {
  margin-top: 1.2rem;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.6rem;
  position: relative;
}

.cd-unit {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--ok-radius-sm);
  padding: 0.7rem 0.4rem;
  text-align: center;
}

.cd-val {
  display: block;
  font-family: var(--ok-mono);
  font-size: clamp(1.6rem, 6vw, 2.4rem);
  font-weight: 700;
  color: var(--accent);
  line-height: 1;
  letter-spacing: -0.02em;
}

.cd-label {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

.cd-launched {
  margin-top: 1.2rem;
  padding: 0.9rem;
  text-align: center;
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--st-go);
  background: var(--st-go-bg);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: var(--ok-radius-sm);
  position: relative;
}

.filters {
  margin-top: 0.8rem;
  display: grid;
  grid-template-columns: 1fr 1fr 1.6fr;
  gap: 0.8rem;
  padding: 1rem;
  background: var(--ok-panel);
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-lg);
  box-shadow: var(--ok-shadow-card);
}

.list-section {
  margin-top: 1.4rem;
}

.list-state {
  grid-column: 1 / -1;
}

.launch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.8rem;
}

.launch-card {
  width: 100%;
  min-width: 0;
  text-align: left;
  color: var(--ok-text);
  background: var(--ok-panel);
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-lg);
  padding: 1rem;
  cursor: pointer;
  transition:
    border-color 0.15s,
    transform 0.15s,
    box-shadow 0.15s;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  box-shadow: var(--ok-shadow-card);
}

.launch-card:hover {
  border-color: var(--ok-accent);
  transform: translateY(-2px);
  box-shadow: var(--ok-shadow-card-hover);
}

.lc-top {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.lc-name {
  flex: 1;
  min-width: 0;
}

.lc-mission {
  font-weight: 600;
  font-size: 0.9rem;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.lc-rocket {
  font-size: 0.74rem;
  color: var(--text-muted);
  margin-top: 0.15rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lc-body {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.lc-body .lc-row {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}
.lc-body .lc-row .lc-key {
  color: var(--text-muted);
  flex-shrink: 0;
}
.lc-body .lc-row .lc-val {
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lc-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border);
}

.lc-time {
  font-family: var(--ok-mono);
  font-size: 0.74rem;
  color: var(--text-muted);
}

.fallback-notice {
  margin-top: 0.9rem;
  font-size: 0.72rem;
  white-space: normal;
}

.modal-status-row {
  margin-top: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.modal-section {
  margin-top: 1.2rem;
}
.modal-section h4 {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 0.4rem;
}
.modal-section p {
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--text);
}
.modal-section .ms-muted {
  color: var(--text-muted);
}

.modal-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.6rem 1rem;
  font-size: 0.84rem;
}
.modal-grid .mg-row {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.modal-grid .mg-key {
  font-size: 0.68rem;
  color: var(--text-muted);
}
.modal-grid .mg-val {
  color: var(--text);
}

.modal-link {
  margin-top: 0.6rem;
}

@media (max-width: 760px) {
  .filters {
    grid-template-columns: 1fr;
  }
  .countdown {
    grid-template-columns: repeat(4, 1fr);
    gap: 0.4rem;
  }
  .cd-unit {
    padding: 0.5rem 0.2rem;
  }
  .modal-grid {
    grid-template-columns: 1fr;
  }
  .tab-head {
    align-items: flex-start;
  }
}

@media (max-width: 420px) {
  .countdown {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
