<script setup>
import { ref, computed, onMounted } from 'vue'
import { CalendarDays, Globe2, RefreshCw, Table2, Thermometer } from '@lucide/vue'
import { i18nState, useT } from '../../i18n.js'
import { themeState } from '../../theme.js'
import { locale, lsGet, lsSet } from '../../ok.js'
import { getMarsWeather } from '../../lib/space-data.js'
import { buildMockSols, approxSolarLongitude, seasonFromLs, oppositeSeason, MARS_SEASONS } from '../../lib/mars.js'
import { chartTheme, Line } from '../../lib/charts.js'
import {
  UiBadge,
  UiButton,
  UiCard,
  UiEmptyState,
  UiErrorState,
  UiIconButton,
  UiLoading,
  UiSegmented,
  UiStat,
  UiTooltip,
} from '../../components/ui/index.js'
import copy from '../../copy/mars-weather.js'

const t = useT(copy)

const UV_MAP = {
  low: { en: 'Low', zh: '低' },
  moderate: { en: 'Moderate', zh: '中等' },
  high: { en: 'High', zh: '高' },
  'very high': { en: 'Very high', zh: '极高' },
  extreme: { en: 'Extreme', zh: '极强' },
}

const SKY_MAP = {
  sunny: { en: 'Sunny', zh: '晴朗' },
  cloudy: { en: 'Cloudy', zh: '多云' },
  fog: { en: 'Fog', zh: '有雾' },
  foggy: { en: 'Foggy', zh: '有雾' },
  storm: { en: 'Storm', zh: '风暴' },
  dusty: { en: 'Dusty', zh: '浮尘' },
}

function localizedWord(map, raw) {
  if (!raw) return '—'
  const hit = map[String(raw).toLowerCase()]
  if (!hit) return raw
  return i18nState.lang === 'zh' ? hit.zh : hit.en
}

function seasonName(season) {
  return i18nState.lang === 'zh' ? season.zh : season.en
}

function toF(c) {
  return (c * 9) / 5 + 32
}

function fmtTemp(c) {
  if (c == null || !Number.isFinite(c)) return '—'
  const v = unit.value === 'F' ? toF(c) : c
  return v.toFixed(1) + '°' + unit.value
}

function fmtTempShort(c) {
  if (c == null || !Number.isFinite(c)) return '—'
  const v = unit.value === 'F' ? toF(c) : c
  return Math.round(v) + '°' + unit.value
}

function parseIsoDate(iso) {
  if (!iso) return null
  const d = new Date(iso + 'T00:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d
}

function fmtDate(iso, { long = false } = {}) {
  const d = parseIsoDate(iso)
  if (!d) return '—'
  return d.toLocaleDateString(
    locale(),
    long
      ? { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }
      : { month: 'short', day: 'numeric', timeZone: 'UTC' },
  )
}

const unit = ref(lsGet('mars-unit') === 'F' ? 'F' : 'C')
const days = ref([])
const isSimulated = ref(false)
const loading = ref(true)
const refreshing = ref(false)
const refreshFailed = ref(false)
const fetchedAt = ref(null)

const latestDay = computed(() => {
  const list = days.value
  return list.length ? list[list.length - 1] : null
})

const lsNow = computed(() => {
  const d = latestDay.value
  if (d && d.ls != null && Number.isFinite(d.ls)) return d.ls
  return approxSolarLongitude(new Date())
})

const northSeason = computed(() => seasonFromLs(lsNow.value))
const southSeason = computed(() => oppositeSeason(northSeason.value))
const northName = computed(() => seasonName(northSeason.value))
const southName = computed(() => seasonName(southSeason.value))
const lsText = computed(() => Math.round(lsNow.value) + '°')
const lsPercent = computed(() => Math.min(100, Math.max(0, (lsNow.value / 360) * 100)))

const seasonSegments = computed(() => MARS_SEASONS.map((s) => ({ key: s.key, label: seasonName(s) })))

const updatedText = computed(() => {
  if (!fetchedAt.value) return '—'
  return fetchedAt.value.toLocaleString(locale(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
})

const dataAgeDays = computed(() => {
  const d = latestDay.value
  const obs = d ? parseIsoDate(d.date) : null
  if (!obs) return null
  const base = fetchedAt.value ? fetchedAt.value.getTime() : Date.now()
  return Math.max(0, Math.round((base - obs.getTime()) / 86400000))
})

const delayText = computed(() => {
  const days = dataAgeDays.value
  if (days == null) return ''
  return t.value('delayNote').replace('{days}', days)
})

const showDelayNote = computed(() => !isSimulated.value && dataAgeDays.value != null && dataAgeDays.value > 10)

const solCards = computed(() => {
  const list = days.value.slice().reverse()
  return list.map((d, idx) => ({
    d,
    isLatest: idx === 0,
    pressureStr: d.pressure != null ? Math.round(d.pressure) + ' Pa' : '—',
    groundStr:
      d.groundMin == null && d.groundMax == null ? '—' : `${fmtTempShort(d.groundMin)} – ${fmtTempShort(d.groundMax)}`,
    uvStr: localizedWord(UV_MAP, d.uv),
    skyStr: localizedWord(SKY_MAP, d.opacity),
    sunStr: d.sunrise || d.sunset ? `${d.sunrise || '—'} / ${d.sunset || '—'}` : '—',
  }))
})

const reading = computed(() => {
  const d = latestDay.value
  if (!d) return null
  return {
    sol: d.sol,
    date: fmtDate(d.date, { long: true }),
    high: fmtTemp(d.maxTemp),
    low: fmtTemp(d.minTemp),
    pressure: d.pressure != null ? Math.round(d.pressure) + ' Pa' : '—',
  }
})

const chartAria = computed(() => {
  const d = latestDay.value
  if (!d) return t.value('trendTitle')
  return `${t.value('trendTitle')} — Sol ${d.sol}: ${t.value('high')} ${fmtTemp(d.maxTemp)}, ${t.value('low')} ${fmtTemp(d.minTemp)}`
})

const trendData = computed(() => {
  const theme = chartTheme(themeState.theme)
  const convert = (c) => (c == null ? null : unit.value === 'F' ? toF(c) : c)
  return {
    labels: days.value.map((d) => String(d.sol)),
    datasets: [
      {
        label: t.value('high'),
        data: days.value.map((d) => convert(d.maxTemp)),
        borderColor: theme.accent,
        backgroundColor: theme.accent,
        pointRadius: 2.5,
        pointHoverRadius: 4,
        borderWidth: 2,
        tension: 0,
        spanGaps: true,
      },
      {
        label: t.value('low'),
        data: days.value.map((d) => convert(d.minTemp)),
        borderColor: theme.muted,
        backgroundColor: theme.muted,
        pointRadius: 2.5,
        pointHoverRadius: 4,
        borderWidth: 2,
        tension: 0,
        spanGaps: true,
      },
    ],
  }
})

const trendOptions = computed(() => {
  const theme = chartTheme(themeState.theme)
  const list = days.value
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
        callbacks: {
          title: (items) => {
            const d = list[items[0].dataIndex]
            return d ? 'Sol ' + d.sol + ' · ' + fmtDate(d.date, { long: true }) : ''
          },
          label: (item) => {
            const value = item.parsed.y
            return value == null ? '' : item.dataset.label + ': ' + value.toFixed(1) + '°' + unit.value
          },
          afterBody: (items) => {
            const d = list[items[0].dataIndex]
            if (!d) return ''
            return t.value('pressure') + ': ' + (d.pressure != null ? Math.round(d.pressure) + ' Pa' : '—')
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: theme.line },
        ticks: { color: theme.muted, font: { size: 10 } },
      },
      y: {
        grid: { color: theme.line, drawTicks: false, borderDash: [2, 4] },
        border: { display: false },
        ticks: {
          color: theme.muted,
          font: { size: 10 },
          callback: (v) => Math.round(v) + '°' + unit.value,
        },
      },
    },
  }
})

const COMPARE_ZH = [
  { key: 'distanceSun', mars: '2.279 亿 km', earth: '1.496 亿 km' },
  { key: 'dayLength', mars: '24h 39m', earth: '24h 00m' },
  { key: 'yearLength', mars: '687 地球日', earth: '365.25 天' },
  { key: 'atmosphere', mars: '95% CO₂', earth: '78% N₂ · 21% O₂' },
  { key: 'surfacePressure', mars: '约 0.6 kPa', earth: '101.3 kPa' },
  { key: 'avgTemp', mars: '−63 °C', earth: '15 °C' },
  { key: 'gravity', mars: '3.71 m/s²', earth: '9.81 m/s²' },
  { key: 'moons', mars: '2（火卫一 / 火卫二）', earth: '1（月球）' },
]

const COMPARE_EN = [
  { key: 'distanceSun', mars: '227.9M km', earth: '149.6M km' },
  { key: 'dayLength', mars: '24h 39m', earth: '24h 00m' },
  { key: 'yearLength', mars: '687 Earth days', earth: '365.25 days' },
  { key: 'atmosphere', mars: '95% CO₂', earth: '78% N₂ · 21% O₂' },
  { key: 'surfacePressure', mars: '~0.6 kPa', earth: '101.3 kPa' },
  { key: 'avgTemp', mars: '−63 °C', earth: '15 °C' },
  { key: 'gravity', mars: '3.71 m/s²', earth: '9.81 m/s²' },
  { key: 'moons', mars: '2 (Phobos, Deimos)', earth: '1 (Moon)' },
]

const compareData = computed(() => (i18nState.lang === 'zh' ? COMPARE_ZH : COMPARE_EN))

async function fetchWeather(force = false) {
  if (force && refreshing.value) return
  if (force) refreshing.value = true
  else loading.value = true

  try {
    const res = await getMarsWeather({ days: 7, force })
    days.value = Array.isArray(res.days) ? res.days : []
    fetchedAt.value = new Date(res.fetchedAt || Date.now())
    isSimulated.value = false
    refreshFailed.value = false
  } catch (err) {
    console.warn('NASA MSL weather fetch failed:', err)
    if (days.value.length && !isSimulated.value) {
      refreshFailed.value = true
    } else {
      days.value = buildMockSols(new Date(), 7)
      fetchedAt.value = new Date()
      isSimulated.value = true
    }
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function setUnit(u) {
  if (u === unit.value) return
  unit.value = u
  lsSet('mars-unit', u)
}

onMounted(() => {
  fetchWeather()
})
</script>

<template>
  <div class="mars-weather-app">
    <UiSectionHead class="page-head" :description="t('lead')">
      <template #actions>
        <UiSegmented
          :model-value="unit"
          :options="[
            { value: 'C', label: t('celsius') },
            { value: 'F', label: t('fahrenheit') },
          ]"
          :aria-label="t('unitLabel')"
          @update:model-value="setUnit"
        />
        <UiTooltip :label="t('refresh')">
          <UiIconButton
            :label="t('refresh')"
            variant="secondary"
            size="sm"
            :disabled="refreshing || loading"
            @click="fetchWeather(true)"
          >
            <RefreshCw :size="14" :class="{ 'spin-icon': refreshing }" aria-hidden="true" />
          </UiIconButton>
        </UiTooltip>
      </template>
    </UiSectionHead>

    <section class="stats" aria-live="polite">
      <UiStat
        card
        compact
        :label="t('dataSource')"
        :value="isSimulated ? t('sourceSim') : t('sourceMsl')"
        :tone="isSimulated ? 'down' : 'neutral'"
      />
      <UiStat
        card
        compact
        :label="t('latestObs')"
        :value="latestDay ? 'Sol ' + latestDay.sol : '—'"
        :sub="latestDay && latestDay.date ? latestDay.date : ''"
      />
      <UiStat
        card
        compact
        :label="t('season')"
        :value="northName + ' · Ls ' + lsText"
        :sub="t('southern') + ' · ' + southName"
      />
      <UiStat card compact :label="t('updated')" :value="updatedText" />
    </section>

    <div v-if="isSimulated" class="inline-alert alert-row">
      <span>{{ t('simulatedNote') }}</span>
      <UiButton variant="link" size="sm" @click="fetchWeather(true)">{{ t('refresh') }}</UiButton>
    </div>
    <UiErrorState
      v-else-if="refreshFailed"
      class="refresh-error"
      :message="t('refreshFailed')"
      :retry-label="t('refresh')"
      @retry="fetchWeather(true)"
    />
    <p v-else-if="showDelayNote" class="archive-note">{{ delayText }}</p>

    <UiCard
      as="section"
      class="panel season-panel"
      :title="t('martianSeason')"
      :description="t(northSeason.desc)"
      :icon="CalendarDays"
      :interactive="false"
      aria-label="Mars season"
    >
      <template #actions>
        <div class="ls-readout">
          <span>{{ t('solarLongitude') }}</span>
          <strong>{{ lsText }}</strong>
        </div>
      </template>
      <div class="season-row">
        <span
          >{{ northName }} <span class="muted">· {{ t('northern') }}</span></span
        >
        <span class="season-divider">/</span>
        <span
          >{{ southName }} <span class="muted">· {{ t('southern') }}</span></span
        >
      </div>
      <div class="ls-track" aria-hidden="true">
        <span
          v-for="seg in seasonSegments"
          :key="seg.key"
          class="ls-seg"
          :class="{ active: seg.key === northSeason.key }"
          >{{ seg.label }}</span
        >
        <span class="ls-marker" :style="{ left: lsPercent + '%' }"></span>
      </div>
      <div class="ls-ticks" aria-hidden="true">
        <span>0°</span><span>90°</span><span>180°</span><span>270°</span><span>360°</span>
      </div>
    </UiCard>

    <UiCard
      as="section"
      class="panel chart-panel"
      :title="t('trendTitle')"
      :description="t('trendHint')"
      :icon="Thermometer"
      :interactive="false"
      aria-label="Temperature trend chart"
    >
      <template #actions>
        <div class="legend">
          <span class="legend-item"><span class="legend-line max"></span>{{ t('high') }}</span>
          <span class="legend-item"><span class="legend-line min"></span>{{ t('low') }}</span>
        </div>
      </template>

      <div class="chart-readout" aria-live="polite">
        <template v-if="reading">
          <span class="ro-sol">Sol {{ reading.sol }}</span>
          <span class="ro-date">{{ reading.date }}</span>
          <span class="ro-item">
            <span>{{ t('high') }}</span>
            <span class="ro-val hi">{{ reading.high }}</span>
          </span>
          <span class="ro-item">
            <span>{{ t('low') }}</span>
            <span class="ro-val lo">{{ reading.low }}</span>
          </span>
          <span class="ro-item">
            <span>{{ t('pressure') }}</span>
            <span class="ro-val">{{ reading.pressure }}</span>
          </span>
        </template>
      </div>

      <div class="chart-wrap">
        <UiLoading v-if="loading" class="chart-loading" :label="t('loading')" />
        <Line
          v-else-if="days.length"
          class="trend-chart"
          :data="trendData"
          :options="trendOptions"
          role="img"
          :aria-label="chartAria"
        />
        <UiEmptyState v-else compact class="chart-empty" :description="t('noData')" />
      </div>
    </UiCard>

    <UiCard
      as="section"
      class="panel records-panel"
      :title="t('solDaysTitle')"
      :description="t('solHint')"
      :icon="Table2"
      :interactive="false"
    >
      <UiLoading v-if="loading" inline :label="t('loading')" />
      <UiEmptyState v-else-if="!solCards.length" compact :description="t('noData')" />
      <div v-else class="table-wrap">
        <table class="sol-table">
          <caption class="ok-sr-only">
            {{
              t('solDaysTitle')
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">{{ t('sol') }}</th>
              <th scope="col" class="num">{{ t('high') }}</th>
              <th scope="col" class="num">{{ t('low') }}</th>
              <th scope="col" class="num">{{ t('pressure') }}</th>
              <th scope="col" class="num">{{ t('ground') }}</th>
              <th scope="col">{{ t('uvIndex') }}</th>
              <th scope="col">{{ t('sky') }}</th>
              <th scope="col">{{ t('colSun') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="card in solCards" :key="card.d.sol" :class="{ latest: card.isLatest }">
              <td class="sol-cell">
                <span class="sol-line">
                  Sol {{ card.d.sol }}
                  <UiBadge v-if="card.isLatest" variant="accent" size="sm" class="latest-tag">{{
                    t('latest')
                  }}</UiBadge>
                </span>
                <span class="sol-sub">{{ card.d.date || '—' }}</span>
              </td>
              <td class="num hi" :data-label="t('high')">{{ fmtTemp(card.d.maxTemp) }}</td>
              <td class="num lo" :data-label="t('low')">{{ fmtTemp(card.d.minTemp) }}</td>
              <td class="num" :data-label="t('pressure')">{{ card.pressureStr }}</td>
              <td class="num" :data-label="t('ground')">{{ card.groundStr }}</td>
              <td class="muted-cell" :data-label="t('uvIndex')">{{ card.uvStr }}</td>
              <td class="muted-cell" :data-label="t('sky')">{{ card.skyStr }}</td>
              <td class="sun" :data-label="t('colSun')">{{ card.sunStr }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>

    <UiCard as="section" class="panel compare-panel" :title="t('compareTitle')" :icon="Globe2" :interactive="false">
      <div class="compare-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th scope="col"></th>
              <th scope="col">{{ t('mars') }}</th>
              <th scope="col">{{ t('earth') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in compareData" :key="row.key">
              <th scope="row">{{ t(row.key) }}</th>
              <td class="mars-col">{{ row.mars }}</td>
              <td class="earth-col">{{ row.earth }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>
  </div>
</template>

<style scoped>
.mars-weather-app {
  --chart-max: var(--ok-accent);
  --chart-min: var(--ok-muted);

  display: flex;
  flex-direction: column;
  min-height: 0;
  background: transparent;
  color: var(--ok-text);
  font-family: var(--ok-font);
  -webkit-font-smoothing: antialiased;
}

.mars-weather-app * {
  box-sizing: border-box;
}
.mars-weather-app a {
  color: var(--ok-accent);
  text-decoration: none;
}
.mars-weather-app h1,
.mars-weather-app h2,
.mars-weather-app h3,
.mars-weather-app p,
.mars-weather-app strong,
.mars-weather-app span,
.mars-weather-app small,
.mars-weather-app dl,
.mars-weather-app dd {
  margin: 0;
}

.page-head {
  margin-bottom: 0.85rem;
}

.spin-icon {
  animation: ui-spin 0.8s linear infinite;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.6rem;
  margin-bottom: 0.8rem;
}

.stats :deep(.ui-stat-value) {
  font-family: var(--ok-mono);
  overflow-wrap: anywhere;
}

.inline-alert {
  margin-bottom: 0.8rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-sm);
  background: var(--ok-down-bg);
  color: var(--ok-down);
  font-size: 0.74rem;
  line-height: 1.5;
}

.alert-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.refresh-error {
  margin-bottom: 0.8rem;
}

.archive-note {
  margin: -0.15rem 0 0.8rem;
  color: var(--ok-muted);
  font-size: 0.72rem;
  line-height: 1.5;
}

.panel + .panel {
  margin-top: 0.8rem;
}

.ls-readout {
  font-family: var(--ok-mono);
  font-size: 0.7rem;
  color: var(--ok-muted);
  white-space: nowrap;
}

.ls-readout strong {
  margin-left: 0.35rem;
  font-size: 0.92rem;
  color: var(--ok-text);
}

.season-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3rem 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.season-row .muted {
  font-size: 0.78rem;
  font-weight: 400;
  color: var(--ok-muted);
}

.season-divider {
  color: var(--ok-muted);
  opacity: 0.5;
  font-weight: 400;
}

.ls-track {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  height: 22px;
  margin-top: 0.7rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-sm);
  background: var(--ok-bg);
  overflow: hidden;
}

.ls-seg {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.64rem;
  color: var(--ok-muted);
  border-left: 1px solid var(--ok-line);
}

.ls-seg:first-child {
  border-left: 0;
}

.ls-seg.active {
  background: var(--ok-accent-soft);
  color: var(--ok-accent);
  font-weight: 600;
}

.ls-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--ok-accent);
  transform: translateX(-1px);
}

.ls-ticks {
  display: flex;
  justify-content: space-between;
  margin-top: 0.25rem;
  font-family: var(--ok-mono);
  font-size: 0.6rem;
  color: var(--ok-muted);
}

.legend {
  display: flex;
  gap: 0.9rem;
  font-size: 0.7rem;
  color: var(--ok-muted);
  padding-top: 0.1rem;
}

.legend-item {
  display: inline-flex;
  align-items: center;
}

.legend-line {
  display: inline-block;
  width: 14px;
  height: 2px;
  margin-right: 0.35rem;
}

.legend-line.max {
  background: var(--chart-max);
}
.legend-line.min {
  background: var(--chart-min);
}

.chart-readout {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.9rem;
  min-height: 1.5rem;
  padding: 0.5rem 0;
  margin-bottom: 0.45rem;
  border-top: 1px solid var(--ok-line);
  border-bottom: 1px solid var(--ok-line);
  font-size: 0.72rem;
  color: var(--ok-muted);
}

.ro-sol {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ok-text);
  font-variant-numeric: tabular-nums;
}

.ro-date {
  font-family: var(--ok-mono);
  font-size: 0.66rem;
}

.ro-item {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
}

.ro-val {
  font-family: var(--ok-mono);
  font-size: 0.74rem;
  color: var(--ok-text);
  font-variant-numeric: tabular-nums;
}

.ro-val.hi {
  color: var(--chart-max);
}
.ro-val.lo {
  color: var(--chart-min);
}

.chart-wrap {
  width: 100%;
  height: 280px;
  position: relative;
}

.chart-loading {
  height: 100%;
  min-height: 220px;
  justify-content: center;
}

.trend-chart {
  width: 100% !important;
  height: 100% !important;
  display: block;
  touch-action: pan-y;
}

.chart-empty {
  min-height: 220px;
  justify-content: center;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-sm);
}

.sol-table {
  width: 100%;
  min-width: 820px;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.sol-table th {
  padding: 0.5rem 0.65rem;
  text-align: left;
  background: var(--ok-bg);
  color: var(--ok-muted);
  font-size: 0.66rem;
  font-weight: 600;
  border-bottom: 1px solid var(--ok-line);
  white-space: nowrap;
}

.sol-table td {
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid var(--ok-line);
  white-space: nowrap;
  color: var(--ok-text);
}

.sol-table tbody tr:last-child td {
  border-bottom: 0;
}
.sol-table tbody tr:hover td {
  background: var(--ok-bg);
}

.sol-table .num {
  text-align: right;
  font-family: var(--ok-mono);
  font-variant-numeric: tabular-nums;
}

.sol-table .hi {
  color: var(--chart-max);
  font-weight: 600;
}
.sol-table .lo {
  color: var(--chart-min);
}
.sol-table .muted-cell {
  color: var(--ok-muted);
}

.sol-table .sun {
  font-family: var(--ok-mono);
  font-size: 0.72rem;
}

.sol-table tr.latest td {
  background: var(--ok-accent-soft);
}
.sol-table tr.latest td:first-child {
  box-shadow: inset 2px 0 0 var(--ok-accent);
}
.sol-table tr.latest:hover td {
  background: var(--ok-accent-soft);
}

.sol-cell {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.sol-line {
  display: inline-flex;
  align-items: baseline;
  gap: 0.1rem;
}

.sol-sub {
  display: block;
  margin-top: 0.08rem;
  font-family: var(--ok-mono);
  font-size: 0.64rem;
  font-weight: 400;
  color: var(--ok-muted);
}

.latest-tag {
  margin-left: 0.35rem;
}

.compare-wrap {
  overflow-x: auto;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-sm);
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.compare-table th,
.compare-table td {
  padding: 0.5rem 0.65rem;
  border-bottom: 1px solid var(--ok-line);
  text-align: left;
}

.compare-table thead th {
  background: var(--ok-bg);
  color: var(--ok-muted);
  font-size: 0.66rem;
  font-weight: 600;
}

.compare-table tbody th {
  width: 34%;
  color: var(--ok-muted);
  font-weight: 400;
}

.compare-table td {
  font-family: var(--ok-mono);
  font-size: 0.74rem;
  font-variant-numeric: tabular-nums;
}

.compare-table .mars-col {
  color: var(--ok-text);
  font-weight: 600;
}

.compare-table .earth-col {
  color: var(--ok-muted);
}

.compare-table tbody tr:last-child th,
.compare-table tbody tr:last-child td {
  border-bottom: 0;
}

@media (max-width: 860px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .ls-ticks {
    font-size: 0.56rem;
  }
}

@media (max-width: 620px) {
  .table-wrap {
    border: 0;
    border-radius: 0;
    overflow: visible;
  }

  .sol-table {
    min-width: 0;
  }

  .sol-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  .sol-table tbody tr {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.28rem 1rem;
    padding: 0.6rem 0.1rem 0.65rem;
    border-bottom: 1px solid var(--ok-line);
  }

  .sol-table tbody tr:last-child {
    border-bottom: 0;
  }

  .sol-table tbody tr.latest {
    background: var(--ok-accent-soft);
    border-radius: var(--ok-radius-sm);
    padding: 0.6rem 0.5rem 0.65rem;
  }

  .sol-table tbody tr:hover td,
  .sol-table tbody tr.latest td {
    background: transparent;
  }
  .sol-table tr.latest td:first-child {
    box-shadow: none;
  }

  .sol-table td {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.6rem;
    padding: 0;
    border: 0;
    font-size: 0.74rem;
    white-space: normal;
  }

  .sol-table td::before {
    content: attr(data-label);
    color: var(--ok-muted);
    font-family: var(--ok-font);
    font-size: 0.68rem;
    font-weight: 400;
  }

  .sol-table td.num {
    text-align: left;
  }

  .sol-cell {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.6rem;
    padding-bottom: 0.15rem;
  }

  .sol-cell::before {
    content: none;
  }
  .sol-sub {
    margin-top: 0;
  }

  .compare-table tbody th {
    width: 30%;
  }
}

@media (max-width: 380px) {
  .stats {
    grid-template-columns: 1fr;
  }

  .sol-table tbody tr {
    grid-template-columns: 1fr;
  }
}
</style>
