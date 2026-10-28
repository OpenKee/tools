<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, locale } from '../ok.js'
import { parseDateOnly, monthDay } from '../lib/format.js'
import { HOLIDAY_COUNTRY_CODES, countryName } from '../lib/country-meta.js'
import {
  UiBadge,
  UiCard,
  UiEmptyState,
  UiErrorState,
  UiField,
  UiLoading,
  UiSectionHead,
  UiSelect,
  UiStat,
} from '../components/ui/index.js'
import copy from '../copy/offday-planner.js'

const t = useT(copy)

const countries = computed(() =>
  HOLIDAY_COUNTRY_CODES.map((code) => ({ code, name: countryName(code, i18nState.lang) })),
)

const countryOptions = computed(() => countries.value.map((c) => ({ value: c.code, label: c.name })))

const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAYS_ZH = ['一', '二', '三', '四', '五', '六', '日']
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

const OPTIMIZATION_UNAVAILABLE_COUNTRIES = new Set(['CN'])

const now = new Date()
const currentYear = now.getFullYear()
const country = ref('CN')
const year = ref(currentYear)
const yearOptions = [currentYear - 1, currentYear, currentYear + 1]
const rawHolidays = ref([])
const loading = ref(false)
const hasError = ref(false)

const weekdays = computed(() => (i18nState.lang === 'zh' ? WEEKDAYS_ZH : WEEKDAYS_EN))
const months = computed(() => (i18nState.lang === 'zh' ? MONTHS_ZH : MONTHS_EN))
const dowLabels = computed(() =>
  i18nState.lang === 'zh'
    ? ['日', '一', '二', '三', '四', '五', '六']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
)
const loc = computed(() => locale())

function holidayLabel(h) {
  if (!h) return ''
  return i18nState.lang === 'zh' ? h.localName || h.name || '' : h.name || h.localName || ''
}

function dayOfWeek(y, m, d) {
  return new Date(y, m - 1, d).getDay()
}
function isWeekend(y, m, d) {
  const dow = dayOfWeek(y, m, d)
  return dow === 0 || dow === 6
}
function dateStr(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
function localToday() {
  const d = new Date()
  return dateStr(d.getFullYear(), d.getMonth() + 1, d.getDate())
}
function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate()
}
function shiftDate(ds, days) {
  const d = parseDateOnly(ds)
  d.setDate(d.getDate() + days)
  return dateStr(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

const expandedHolidays = computed(() => [...rawHolidays.value].sort((a, b) => a.date.localeCompare(b.date)))
const optimizationAvailable = computed(() => !OPTIMIZATION_UNAVAILABLE_COUNTRIES.has(country.value))

const longWeekends = computed(() => {
  if (!optimizationAvailable.value) return []
  const holidays = expandedHolidays.value
  const holiSet = new Set(holidays.map((h) => h.date))
  const results = []
  const y = year.value

  for (let m = 1; m <= 12; m++) {
    const days = daysInMonth(y, m)
    for (let d = 1; d <= days; d++) {
      const ds = dateStr(y, m, d)
      if (!holiSet.has(ds)) continue
      const dow = dayOfWeek(y, m, d)
      const hol = holidays.find((h) => h.date === ds)

      if (dow === 5) {
        results.push({ date: ds, type: 'friday', name: holidayLabel(hol), days: 3, leaveNeeded: 0, leaveDates: [] })
      }

      if (dow === 1) {
        results.push({ date: ds, type: 'monday', name: holidayLabel(hol), days: 3, leaveNeeded: 0, leaveDates: [] })
      }

      if (dow === 2) {
        results.push({
          date: ds,
          type: 'tuesday',
          name: holidayLabel(hol),
          days: 4,
          leaveNeeded: 1,
          leaveDates: [shiftDate(ds, -1)],
        })
      }

      if (dow === 4) {
        results.push({
          date: ds,
          type: 'thursday',
          name: holidayLabel(hol),
          days: 4,
          leaveNeeded: 1,
          leaveDates: [shiftDate(ds, 1)],
        })
      }

      if (dow === 3) {
        results.push({
          date: ds,
          type: 'wednesday',
          name: holidayLabel(hol),
          days: 5,
          leaveNeeded: 2,
          leaveDates: [shiftDate(ds, 1), shiftDate(ds, 2)],
        })
      }
    }
  }
  return results
    .map((result) => {
      const needed = result.leaveDates.filter((date) => !holiSet.has(date))
      return { ...result, leaveDates: needed, leaveNeeded: needed.length }
    })
    .sort((a, b) => b.days - a.days || a.date.localeCompare(b.date))
})

const leaveOptimizers = computed(() => {
  const seen = new Set()
  return longWeekends.value
    .filter((w) => w.leaveNeeded > 0)
    .sort((a, b) => b.days / b.leaveNeeded - a.days / a.leaveNeeded)
    .filter((w) => {
      const key = w.name || w.date
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 6)
})

const nextHoliday = computed(() => {
  const holidays = expandedHolidays.value
  const today = localToday()
  const upcoming = holidays.filter((h) => h.date >= today)
  if (!upcoming.length) return null
  const next = upcoming[0]
  const diff = Math.ceil((parseDateOnly(next.date) - parseDateOnly(today)) / 86400000)
  return { ...next, daysUntil: diff }
})

const summaryData = computed(() => ({
  total: expandedHolidays.value.length,
  freeLongWeekends: optimizationAvailable.value ? longWeekends.value.filter((w) => w.leaveNeeded === 0).length : null,
}))

const yearMonths = computed(() => {
  const y = year.value
  const holidays = expandedHolidays.value
  const holiMap = {}
  holidays.forEach((h) => {
    holiMap[h.date] = h
  })
  const todayStr = localToday()

  return Array.from({ length: 12 }, (_, mi) => {
    const m = mi + 1
    const days = daysInMonth(y, m)
    const firstDow = (dayOfWeek(y, m, 1) + 6) % 7
    const holCount = holidays.filter((h) => Number(h.date.slice(5, 7)) === m).length

    const cells = []

    for (let i = 0; i < firstDow; i++) {
      cells.push({ empty: true, day: '', title: '', cls: { empty: true } })
    }
    for (let d = 1; d <= days; d++) {
      const ds = dateStr(y, m, d)
      const we = isWeekend(y, m, d)
      const hInfo = holiMap[ds]
      const today = ds === todayStr
      const title = hInfo ? holidayLabel(hInfo) : ''
      cells.push({
        empty: false,
        day: d,
        title,
        cls: {
          weekend: we,
          today,
          holiday: !!hInfo,
          'holiday-single': !!hInfo,
        },
      })
    }
    return { m, mi, holCount, cells }
  })
})

const holidayGroups = computed(() => {
  const groups = []
  let current = null
  expandedHolidays.value.forEach((h) => {
    if (current && current.localName === h.localName && shiftDate(current.endDate, 1) === h.date) {
      current.endDate = h.date
      current.days++
      current.dates.push(h.date)
    } else {
      if (current) groups.push(current)
      current = { localName: h.localName, name: h.name, startDate: h.date, endDate: h.date, days: 1, dates: [h.date] }
    }
  })
  if (current) groups.push(current)
  return groups
})

function formatRange(g) {
  const start = parseDateOnly(g.startDate)
  const end = parseDateOnly(g.endDate)
  const opts = { month: 'short', day: 'numeric' }
  if (g.days > 1) {
    return `${start.toLocaleDateString(loc.value, opts)} – ${end.toLocaleDateString(loc.value, opts)}`
  }
  return start.toLocaleDateString(loc.value, { ...opts, weekday: 'short' })
}

function formatDate(ds) {
  return parseDateOnly(ds).toLocaleDateString(loc.value, { month: 'short', day: 'numeric', weekday: 'short' })
}

function dayChipLabel(ds) {
  return monthDay(ds)
}

function dayChipDow(ds) {
  return dowLabels.value[parseDateOnly(ds).getDay()]
}

function isWeekendDate(ds) {
  const dow = parseDateOnly(ds).getDay()
  return dow === 0 || dow === 6
}

function takeOffText(n) {
  return n === 1 ? t.value('takeOneDay') : t.value('takeDays').replace('{n}', n)
}
function breakText(n) {
  return t.value('getBreak').replace('{n}', n)
}

function monthCountText(n) {
  if (!n) return t.value('noPublic')
  return `${n} ${n === 1 ? t.value('publicOne') : t.value('publicMany')}`
}

let loadToken = 0

async function loadHolidays() {
  const token = ++loadToken
  loading.value = true
  hasError.value = false
  try {
    const data = await fetchJSON(`https://date.nager.at/api/v3/publicholidays/${year.value}/${country.value}`)
    if (token !== loadToken) return
    rawHolidays.value = Array.isArray(data) ? data : []
  } catch (e) {
    if (token !== loadToken) return
    rawHolidays.value = []
    hasError.value = true
  } finally {
    if (token === loadToken) loading.value = false
  }
}

watch([country, year], () => loadHolidays())

onMounted(() => loadHolidays())
</script>

<template>
  <div class="offday-app">
    <section class="toolbar">
      <UiField class="toolbar-field" :label="t('countryLabel')">
        <UiSelect v-model="country" :options="countryOptions" :aria-label="t('countryLabel')" />
      </UiField>
      <UiField class="toolbar-field" :label="t('yearLabel')">
        <UiSelect v-model="year" :options="yearOptions" :aria-label="t('yearLabel')" />
      </UiField>
    </section>

    <UiLoading v-if="loading" class="state-panel" :label="t('loading')" />
    <UiErrorState
      v-else-if="hasError"
      variant="block"
      :message="t('error')"
      :retry-label="t('retry')"
      @retry="loadHolidays"
    />

    <template v-else>
      <section class="summary-grid">
        <UiStat card :label="t('totalHolidays')" :value="summaryData.total" :sub="t('holidaysThisYear')" />
        <UiStat
          card
          :label="t('longWeekends')"
          :value="summaryData.freeLongWeekends === null ? t('notAvailable') : summaryData.freeLongWeekends"
          :sub="t(optimizationAvailable ? 'weekendsFound' : 'weekendsUnavailable')"
        />
        <UiStat
          card
          class="next-holiday"
          :label="t('nextHoliday')"
          :value="nextHoliday ? holidayLabel(nextHoliday) : t('noUpcoming').replace('{year}', String(year))"
          :sub="
            nextHoliday ? (nextHoliday.daysUntil === 0 ? t('today') : nextHoliday.daysUntil + ' ' + t('daysUntil')) : ''
          "
        />
      </section>

      <UiCard class="calendar-section">
        <UiSectionHead :title="t('calendar')" :description="countryName(country, i18nState.lang) + ' · ' + year">
          <template #meta>
            <UiBadge variant="down" size="sm" dot>{{ t('holidayLegend') }}</UiBadge>
            <UiBadge variant="accent" size="sm" dot>{{ t('todayLegend') }}</UiBadge>
          </template>
        </UiSectionHead>
        <div class="year-grid">
          <UiCard v-for="month in yearMonths" :key="month.m" padding="sm" class="month-card">
            <div class="month-name">
              {{ months[month.mi] }}
              <UiBadge size="sm" mono>{{ monthCountText(month.holCount) }}</UiBadge>
            </div>
            <div class="cal-grid">
              <div v-for="(d, i) in weekdays" :key="'h' + i" class="cal-head">{{ d }}</div>
              <div
                v-for="(cell, i) in month.cells"
                :key="'c' + i"
                class="cal-day"
                :class="cell.cls"
                :title="cell.title"
              >
                {{ cell.day }}
              </div>
            </div>
          </UiCard>
        </div>
      </UiCard>

      <section class="optimizer-section">
        <UiSectionHead :title="t('optimizer')" :description="optimizationAvailable ? t('optimizerDesc') : ''" />
        <div class="optimizer-grid">
          <UiEmptyState
            v-if="!leaveOptimizers.length"
            compact
            class="opt-empty"
            :description="t(optimizationAvailable ? 'noData' : 'optimizerDisabled')"
          />
          <UiCard v-for="(w, i) in leaveOptimizers" :key="i" padding="sm" class="optimize-card">
            <div class="opt-inner">
              <div class="opt-head">
                <span class="opt-title">{{ w.name || '—' }}</span>
                <span class="opt-break">{{ takeOffText(w.leaveNeeded) }} → {{ breakText(w.days) }}</span>
              </div>
              <div class="opt-detail">{{ formatDate(w.date) }}</div>
              <div class="opt-leave-label">{{ t('leaveDates') }}</div>
              <div class="opt-days">
                <UiBadge v-for="(d, j) in w.leaveDates" :key="j" variant="up" size="sm" mono>
                  {{ dayChipLabel(d) }} {{ dayChipDow(d) }}
                </UiBadge>
              </div>
            </div>
          </UiCard>
        </div>
      </section>

      <UiCard class="holiday-section">
        <UiSectionHead :title="t('allHolidays')" :meta="String(holidayGroups.length)" />
        <div class="holiday-list">
          <UiEmptyState v-if="!holidayGroups.length" compact :description="t('noData')" />
          <div v-for="(g, i) in holidayGroups" :key="i" class="holiday-row">
            <div class="holiday-left">
              <div class="holiday-range">{{ formatRange(g) }}</div>
              <div class="day-strip">
                <UiBadge
                  v-for="ds in g.dates"
                  :key="ds"
                  size="sm"
                  mono
                  :variant="isWeekendDate(ds) ? 'down' : 'neutral'"
                >
                  {{ dayChipLabel(ds) }} {{ dayChipDow(ds) }}
                </UiBadge>
              </div>
            </div>
            <div class="holiday-mid">
              <div class="holiday-name">{{ holidayLabel(g) }}</div>
              <div v-if="g.localName !== g.name" class="holiday-local">
                {{ holidayLabel(g) === g.localName ? g.name : g.localName }}
              </div>
            </div>
            <UiBadge class="holiday-badge" size="sm" mono :variant="g.days > 1 ? 'down' : 'neutral'">
              {{ g.days }}{{ t('daysUnit') }}
            </UiBadge>
          </div>
        </div>
      </UiCard>
    </template>
  </div>
</template>

<style scoped>
.offday-app {
  --holiday: var(--ok-down);
  --leave: var(--ok-up);

  color: var(--ok-text);
  font-family: var(--ok-font);
}

* {
  box-sizing: border-box;
}

.offday-app > * + * {
  margin-top: 0.8rem;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.6rem 1rem;
}

.toolbar-field {
  min-width: 9rem;
}

.state-panel {
  min-height: 200px;
  justify-content: center;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}

.summary-grid :deep(.ui-stat-value) {
  font-family: var(--ok-mono);
}

.next-holiday :deep(.ui-stat-value) {
  font-size: 0.9rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.calendar-section :deep(.ui-section-meta) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.year-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.6rem;
}

.year-grid .month-card {
  box-shadow: none;
}

.month-card :deep(.ui-card-body) {
  gap: 0.3rem;
}

.month-name {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.cal-head {
  font-size: 0.58rem;
  font-weight: 600;
  text-align: center;
  color: var(--ok-muted);
  padding: 0.15rem 0;
}

.cal-day {
  position: relative;
  padding: 0.18rem 0;
  text-align: center;
  font-family: var(--ok-mono);
  font-size: 0.68rem;
  line-height: 1.45;
  border-radius: 3px;
  cursor: default;
}

.cal-day.empty {
  visibility: hidden;
}

.cal-day.weekend {
  background: var(--ok-bg);
  color: var(--ok-muted);
}

.cal-day.holiday {
  background: var(--holiday);
  color: #fff;
  font-weight: 600;
}

.cal-day.holiday-start {
  border-radius: 4px 0 0 4px;
}
.cal-day.holiday-end {
  border-radius: 0 4px 4px 0;
}
.cal-day.holiday-single {
  border-radius: 4px;
}

.cal-day.today {
  outline: 2px solid var(--ok-accent);
  outline-offset: -1px;
}

.cal-day[title]:hover::after {
  content: attr(title);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.2rem 0.4rem;
  background: var(--ok-text);
  color: var(--ok-bg);
  font-family: var(--ok-font);
  font-size: 0.65rem;
  white-space: nowrap;
  border-radius: 3px;
  z-index: 10;
}

.optimizer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.6rem;
}

.opt-empty {
  grid-column: 1 / -1;
}

.opt-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.3rem 0.6rem;
}

.opt-title {
  font-size: 0.84rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.opt-break {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--leave);
}

.opt-detail {
  margin-top: 0.25rem;
  font-size: 0.72rem;
  color: var(--ok-muted);
}

.opt-leave-label {
  margin-top: 0.4rem;
  font-size: 0.64rem;
  color: var(--ok-muted);
}

.opt-days {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.holiday-list {
  display: flex;
  flex-direction: column;
}

.holiday-row {
  display: grid;
  grid-template-columns: minmax(140px, 0.9fr) minmax(0, 1.3fr) auto;
  gap: 0.6rem 1rem;
  align-items: start;
  padding: 0.55rem 0;
  border-top: 1px solid var(--ok-line);
}

.holiday-row:first-child {
  border-top: none;
}

.holiday-left,
.holiday-mid {
  min-width: 0;
}

.holiday-range {
  font-family: var(--ok-mono);
  font-size: 0.74rem;
  font-weight: 600;
}

.day-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.holiday-name {
  font-size: 0.82rem;
  overflow-wrap: anywhere;
}

.holiday-local {
  font-size: 0.7rem;
  color: var(--ok-muted);
  overflow-wrap: anywhere;
}

@media (max-width: 720px) {
  .toolbar {
    align-items: stretch;
  }
  .toolbar-field {
    flex: 1 1 9rem;
  }

  .year-grid {
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  }

  .holiday-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .holiday-left {
    grid-column: 1;
  }
  .holiday-mid {
    grid-column: 1;
  }
  .holiday-badge {
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: center;
  }
}

@media (max-width: 380px) {
  .year-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .summary-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
