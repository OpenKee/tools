<script setup>
import { ref, computed, onActivated, onDeactivated, onMounted, onUnmounted } from 'vue'
import { useT } from '../i18n.js'
import { locale, geocode } from '../ok.js'
import { timeInZone, hourInZone } from '../lib/country-meta.js'
import {
  UiBadge,
  UiButton,
  UiCard,
  UiEmptyState,
  UiErrorState,
  UiField,
  UiIconButton,
  UiInput,
  UiLoading,
  UiSectionHead,
  UiSegmented,
  UiSelect,
} from '../components/ui/index.js'
import copy from '../copy/hour-bridge.js'

const t = useT(copy)

const KNOWN_CITIES = [
  'Shanghai',
  'Beijing',
  'Shenzhen',
  'Guangzhou',
  'Hong Kong',
  'Taipei',
  'Tokyo',
  'Seoul',
  'Singapore',
  'Bangkok',
  'Jakarta',
  'Manila',
  'Hanoi',
  'Kuala Lumpur',
  'Mumbai',
  'Delhi',
  'Dubai',
  'London',
  'Paris',
  'Berlin',
  'Amsterdam',
  'Madrid',
  'Rome',
  'Stockholm',
  'Warsaw',
  'Istanbul',
  'Moscow',
  'New York',
  'Los Angeles',
  'Chicago',
  'Toronto',
  'Vancouver',
  'Mexico City',
  'São Paulo',
  'Buenos Aires',
  'Sydney',
  'Melbourne',
  'Auckland',
  'Cairo',
  'Nairobi',
  'Johannesburg',
  'Lagos',
]

const PRESETS = {
  apac: ['Shanghai', 'Tokyo', 'Singapore', 'Sydney'],
  'us-eu': ['New York', 'London', 'Berlin'],
  global: ['Shanghai', 'London', 'New York'],
}

const presetOptions = computed(() => [
  { value: '', label: t.value('custom') },
  { value: 'apac', label: 'APAC Team' },
  { value: 'us-eu', label: 'US + Europe' },
  { value: 'global', label: 'Global (3 cities)' },
])

const DURATIONS = [
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 90, label: '1.5h' },
  { value: 120, label: '2h' },
]

const utcHours = Array.from({ length: 24 }, (_, i) => i)

const cities = ref([])
const duration = ref(60)
const selectedSlot = ref(null)
const cityInput = ref('')
const presetValue = ref('')
const cityError = ref('')
const resolving = ref(false)
const now = ref(new Date())
let clockTimer = null
let pendingAdds = 0

function utcTarget(utcHour) {
  const base = new Date()
  const today = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()))
  return new Date(today.getTime() + utcHour * 3600000)
}

function localHour(tz, utcHour) {
  return hourInZone(utcTarget(utcHour), tz)
}

function localTime(tz, utcHour) {
  return timeInZone(utcTarget(utcHour), tz)
}

function hourStatus(h) {
  if (h >= 9 && h <= 18) return 'good'
  if ((h >= 7 && h < 9) || (h > 18 && h <= 21)) return 'fair'
  return 'night'
}

function statusLabel(s) {
  return s === 'good' ? t.value('good') : s === 'fair' ? t.value('fair') : t.value('night')
}

const liveTime = computed(() =>
  now.value.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
)
const liveDate = computed(() =>
  now.value.toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' }),
)

const slotsNeeded = computed(() => Math.ceil(duration.value / 60))

function offsetLabel(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(
      new Date(),
    )
    const name = parts.find((part) => part.type === 'timeZoneName')?.value || ''
    return name.replace('GMT', 'UTC')
  } catch (e) {
    return ''
  }
}

const timelineRows = computed(() => {
  const sel = selectedSlot.value
  const sn = slotsNeeded.value
  return cities.value.map((c) => {
    const slots = utcHours.map((uh) => {
      const lh = localHour(c.tz, uh)
      const lt = localTime(c.tz, uh)
      const s = hourStatus(lh)
      const selected = sel === uh
      const inRange = sel !== null && uh > sel && uh < sel + sn
      return {
        uh,
        lt,
        s,
        selected,
        inRange,
        title: `${c.name}: ${lt} (${statusLabel(s)})`,
      }
    })
    return {
      name: c.name,
      tzLabel: offsetLabel(c.tz) || c.tz.split('/').pop().replace(/_/g, ' '),
      slots,
    }
  })
})

const resultItems = computed(() => {
  if (selectedSlot.value === null || cities.value.length < 2) return null
  return cities.value.map((c) => {
    const lt = localTime(c.tz, selectedSlot.value)
    const lh = localHour(c.tz, selectedSlot.value)
    const s = hourStatus(lh)
    return { name: c.name, lt, s, label: statusLabel(s) }
  })
})
const showResult = computed(() => resultItems.value !== null)

function scoreSlot(utcHour) {
  let total = 0
  cities.value.forEach((c) => {
    for (let minute = 0; minute < duration.value; minute += 15) {
      const h = localHour(c.tz, utcHour + minute / 60)
      const s = hourStatus(h)
      total += s === 'good' ? 2 : s === 'fair' ? 1 : -3
    }
  })
  return total
}

const bestSlots = computed(() => {
  const n = cities.value.length
  if (n < 2) return []
  const sampleCount = Math.ceil(duration.value / 15)
  return utcHours
    .map((uh) => ({ uh, score: scoreSlot(uh) }))
    .sort((a, b) => b.score - a.score || a.uh - b.uh)
    .slice(0, 6)
    .map((s, i) => {
      const range = n * sampleCount
      const pct = Math.max(0, Math.min(100, Math.round(((s.score + range * 3) / (range * 5)) * 100)))
      const cls = pct >= 70 ? 'high' : pct >= 40 ? 'mid' : 'low'
      const details = cities.value
        .map((c) => {
          const lt = localTime(c.tz, s.uh)
          const end = localTime(c.tz, s.uh + duration.value / 60)
          const st = hourStatus(localHour(c.tz, s.uh))
          return `${c.name} ${lt}–${end} (${statusLabel(st)})`
        })
        .join(' · ')
      return { uh: s.uh, rank: i + 1, pct, cls, details }
    })
})

async function resolveCity(name) {
  const [place] = await geocode(name, { count: 1, lang: 'en' })
  if (!place || !place.timezone) throw new Error(`Not found: ${name}`)
  return { name: place.name, tz: place.timezone, lat: place.lat, lon: place.lon }
}

async function addCity(name) {
  const clean = String(name || '').trim()
  if (!clean) return false
  if (cities.value.find((c) => c.name.toLowerCase() === clean.toLowerCase())) return false
  if (cities.value.length >= 8) {
    cityError.value = t.value('maxCities')
    return false
  }
  cityError.value = ''
  pendingAdds += 1
  resolving.value = true
  try {
    const resolved = await resolveCity(clean)
    cities.value.push(resolved)
    return true
  } catch (e) {
    cityError.value = t.value('cityNotFound')
    return false
  } finally {
    pendingAdds -= 1
    resolving.value = pendingAdds > 0
  }
}

function removeCity(i) {
  cities.value.splice(i, 1)
  cityError.value = ''
}

async function onAddCity() {
  if (resolving.value) return
  const val = cityInput.value.trim()
  if (!val) return
  const added = await addCity(val)
  if (added) cityInput.value = ''
}

function selectSlot(uh) {
  selectedSlot.value = selectedSlot.value === uh ? null : uh
}

function selectBest(uh) {
  selectedSlot.value = uh
}

function clearSelection() {
  selectedSlot.value = null
}

async function onPresetChange(value) {
  presetValue.value = value
  await applyPreset()
}

async function applyPreset() {
  const key = presetValue.value
  if (!key || !PRESETS[key] || resolving.value) return
  cities.value = []
  presetValue.value = ''
  cityError.value = ''
  for (const c of PRESETS[key]) await addCity(c)
}

function startClock() {
  if (clockTimer !== null) return
  now.value = new Date()
  clockTimer = setInterval(() => {
    now.value = new Date()
  }, 1000)
}

function stopClock() {
  if (clockTimer === null) return
  clearInterval(clockTimer)
  clockTimer = null
}

onMounted(async () => {
  startClock()

  for (const c of ['Shanghai', 'London', 'New York']) await addCity(c)
})

onActivated(startClock)
onDeactivated(stopClock)
onUnmounted(stopClock)
</script>

<template>
  <div class="hour-bridge-app">
    <section class="hb-toolbar">
      <UiField :label="t('duration')">
        <UiSegmented v-model="duration" :options="DURATIONS" size="sm" :aria-label="t('duration')" />
      </UiField>
      <div class="live-clock">
        <span class="live-time">{{ liveTime }}</span>
        <span class="live-date">{{ liveDate }}</span>
      </div>
    </section>

    <UiCard class="setup-panel">
      <UiSectionHead :title="t('cities')" :meta="cities.length + ' / 8'" />
      <div class="city-chips">
        <UiBadge v-for="(c, i) in cities" :key="c.name + '-' + i" size="sm" class="city-chip">
          {{ c.name }}
          <UiIconButton variant="danger" size="sm" :label="t('removeCity')" @click="removeCity(i)">
            {{ t('remove') }}
          </UiIconButton>
        </UiBadge>
        <UiEmptyState v-if="!cities.length" compact :description="t('needCities')" class="city-empty" />
      </div>
      <form class="add-row" @submit.prevent="onAddCity">
        <UiSelect
          :model-value="presetValue"
          :options="presetOptions"
          :aria-label="t('presets')"
          class="preset-select"
          @update:model-value="onPresetChange"
        />
        <UiInput
          v-model="cityInput"
          type="text"
          :placeholder="t('enterCity')"
          list="cityList"
          :aria-label="t('enterCity')"
          class="city-input"
        />
        <datalist id="cityList">
          <option v-for="c in KNOWN_CITIES" :key="c" :value="c" />
        </datalist>
        <UiButton type="submit" variant="primary" class="add-btn" :disabled="resolving">{{ t('add') }}</UiButton>
      </form>
      <UiErrorState v-if="cityError" :message="cityError" retry-label="" />
      <UiLoading v-else-if="resolving" :label="t('loading')" inline compact />
    </UiCard>

    <UiCard class="timeline-section">
      <UiSectionHead :title="t('timeline')" :description="t('timelineDesc')">
        <template #meta>
          <div class="legend">
            <UiBadge variant="up" size="sm" dot>{{ t('good') }}</UiBadge>
            <UiBadge variant="warn" size="sm" dot>{{ t('fair') }}</UiBadge>
            <UiBadge variant="down" size="sm" dot>{{ t('night') }}</UiBadge>
          </div>
        </template>
      </UiSectionHead>
      <div class="timeline-scroll">
        <div class="timeline">
          <div v-for="(row, ri) in timelineRows" :key="ri" class="tl-row">
            <div class="tl-city">
              {{ row.name }}<small>{{ row.tzLabel }}</small>
            </div>
            <div class="tl-bar">
              <button
                v-for="slot in row.slots"
                :key="slot.uh"
                class="tl-slot"
                :class="[slot.s, { selected: slot.selected, 'in-range': slot.inRange }]"
                :title="slot.title"
                :aria-label="slot.title"
                type="button"
                @click="selectSlot(slot.uh)"
              >
                {{ slot.lt.slice(0, 2) }}
              </button>
            </div>
          </div>
        </div>
        <div class="hour-axis" aria-hidden="true">
          <span class="axis-label">UTC</span>
          <span v-for="uh in utcHours" :key="uh">{{ String(uh).padStart(2, '0') }}</span>
        </div>
      </div>
    </UiCard>

    <UiCard v-if="showResult" class="result-card">
      <UiSectionHead :title="t('selectedSlot')">
        <template #actions>
          <UiButton variant="secondary" size="sm" @click="clearSelection">{{ t('clear') }}</UiButton>
        </template>
      </UiSectionHead>
      <div class="result-body">
        <div v-for="(item, i) in resultItems" :key="i" class="result-item">
          <div class="city-name">{{ item.name }}</div>
          <div class="city-time">{{ item.lt }}</div>
          <UiBadge
            class="city-status"
            size="sm"
            :variant="item.s === 'good' ? 'up' : item.s === 'fair' ? 'warn' : 'down'"
          >
            {{ item.label }}
          </UiBadge>
        </div>
      </div>
    </UiCard>

    <UiCard class="best-section">
      <UiSectionHead :title="t('bestSlots')" />
      <UiEmptyState v-if="cities.length < 2" compact :description="t('needCities')" />
      <div v-else class="best-list">
        <button v-for="b in bestSlots" :key="b.uh" class="best-row" type="button" @click="selectBest(b.uh)">
          <span class="best-rank">#{{ b.rank }}</span>
          <span class="best-time">UTC {{ String(b.uh).padStart(2, '0') }}:00</span>
          <span class="best-detail">{{ b.details }}</span>
          <UiBadge
            class="best-score"
            size="sm"
            mono
            :variant="b.cls === 'high' ? 'up' : b.cls === 'mid' ? 'warn' : 'down'"
          >
            {{ b.pct }}%
          </UiBadge>
        </button>
      </div>
    </UiCard>
  </div>
</template>

<style scoped>
.hour-bridge-app {
  --warn: #b45309;
  --warn-bg: rgba(180, 83, 9, 0.1);
  --good-bg: var(--ok-up-bg);
  --night-bg: var(--ok-down-bg);

  color: var(--ok-text);
  font-family: var(--ok-font);
}

:global(:root[data-theme='dark']) .hour-bridge-app {
  --warn: #d29922;
  --warn-bg: rgba(210, 153, 34, 0.14);
}

* {
  box-sizing: border-box;
}

.hour-bridge-app > * + * {
  margin-top: 0.8rem;
}

.hb-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem 1rem;
}

.live-clock {
  text-align: right;
}

.live-time {
  font-family: var(--ok-mono);
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.live-date {
  display: block;
  font-size: 0.68rem;
  color: var(--ok-muted);
}

.city-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.city-chip :deep(.ui-icon-btn) {
  width: 1.05rem;
  height: 1.05rem;
  border-radius: 50%;
  font-size: 0.85rem;
  line-height: 1;
}

.city-empty {
  flex: 1 1 100%;
}

.add-row {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  flex-wrap: wrap;
}

.preset-select {
  flex: 0 1 9rem;
}

.city-input {
  flex: 1 1 10rem;
  min-width: 0;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.timeline-scroll {
  overflow-x: auto;
}

.timeline {
  min-width: 720px;
}

.tl-row {
  display: flex;
  min-width: 720px;
}

.tl-city {
  position: sticky;
  left: 0;
  z-index: 2;
  width: 100px;
  flex-shrink: 0;
  padding: 0.45rem 0.5rem;
  background: var(--ok-panel);
  border-bottom: 1px solid var(--ok-line);
  border-right: 1px solid var(--ok-line);
  font-size: 0.78rem;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.tl-city small {
  font-weight: 400;
  font-size: 0.64rem;
  color: var(--ok-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tl-bar {
  flex: 1;
  display: flex;
  border-bottom: 1px solid var(--ok-line);
}

.tl-slot {
  flex: 1;
  min-width: 26px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-right: 1px solid var(--ok-line);
  background: transparent;
  color: var(--ok-muted);
  cursor: pointer;
  font-size: 0.6rem;
  font-family: var(--ok-mono);
  transition: box-shadow 0.1s ease;
}

.tl-slot:last-child {
  border-right: none;
}

.tl-slot.good {
  background: var(--good-bg);
  color: var(--ok-up);
}
.tl-slot.fair {
  background: var(--warn-bg);
  color: var(--warn);
}
.tl-slot.night {
  background: var(--night-bg);
  color: var(--ok-down);
}

.tl-slot:hover {
  box-shadow: inset 0 0 0 2px var(--ok-accent);
  z-index: 1;
}

.tl-slot.selected {
  background: var(--ok-accent-soft);
  color: var(--ok-accent);
  box-shadow: inset 0 0 0 2px var(--ok-accent);
  z-index: 1;
}

.tl-slot.in-range {
  background: var(--ok-accent-soft);
  color: var(--ok-accent);
}

.hour-axis {
  display: flex;
  min-width: 720px;
  border-top: 1px solid var(--ok-line);
}

.hour-axis .axis-label {
  position: sticky;
  left: 0;
  z-index: 2;
  width: 100px;
  flex-shrink: 0;
  padding: 0.25rem 0.5rem;
  background: var(--ok-panel);
  border-right: 1px solid var(--ok-line);
  text-align: left;
  font-family: var(--ok-mono);
  font-size: 0.6rem;
  color: var(--ok-muted);
}

.hour-axis span:not(.axis-label) {
  flex: 1;
  min-width: 26px;
  text-align: center;
  font-family: var(--ok-mono);
  font-size: 0.6rem;
  color: var(--ok-muted);
  padding: 0.25rem 0;
}

.result-card {
  border-color: var(--ok-accent);
}

.result-body {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.5rem;
}

.result-item {
  min-width: 0;
  padding: 0.55rem 0.6rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-sm);
  background: var(--ok-bg);
}

.result-item .city-name {
  font-weight: 600;
  font-size: 0.78rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-item .city-time {
  margin-top: 0.15rem;
  font-family: var(--ok-mono);
  font-size: 1.1rem;
  font-weight: 600;
}

.result-item .city-status {
  margin-top: 0.1rem;
}

.best-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.best-row {
  display: grid;
  grid-template-columns: 32px 88px minmax(0, 1fr) 52px;
  grid-template-areas: 'rank time detail score';
  gap: 0.5rem;
  align-items: center;
  width: 100%;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-sm);
  background: var(--ok-bg);
  color: var(--ok-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.best-row:hover {
  border-color: var(--ok-accent);
  background: var(--ok-accent-soft);
}

.best-rank {
  grid-area: rank;
  font-family: var(--ok-mono);
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--ok-accent);
}

.best-time {
  grid-area: time;
  font-family: var(--ok-mono);
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}

.best-detail {
  grid-area: detail;
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--ok-muted);
  overflow-wrap: anywhere;
}

.best-score {
  grid-area: score;
  justify-self: end;
}

@media (max-width: 720px) {
  .hb-toolbar {
    align-items: flex-start;
  }
  .live-clock {
    text-align: left;
  }

  .preset-select,
  .city-input {
    flex: 1 1 100%;
    max-width: none;
  }

  .add-btn {
    width: 100%;
  }

  .tl-city {
    width: 82px;
    font-size: 0.72rem;
  }
  .hour-axis .axis-label {
    width: 82px;
  }
  .tl-slot {
    min-width: 24px;
    height: 34px;
    font-size: 0.56rem;
  }
  .hour-axis span:not(.axis-label) {
    min-width: 24px;
  }
  .timeline,
  .tl-row,
  .hour-axis {
    min-width: 658px;
  }

  .best-row {
    grid-template-columns: 28px minmax(0, 1fr) auto;
    grid-template-areas:
      'rank time score'
      'detail detail detail';
  }

  .best-detail {
    margin-top: -0.1rem;
  }

  .result-body {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  }
}
</style>
