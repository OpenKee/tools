<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, geocode, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ============================================================
   Trip Weather Advisor — 行程天气顾问
   数据源：
     · Open-Meteo Geocoding（城市搜索）
     · Open-Meteo Forecast（逐日预报）
     · Open-Meteo Air Quality（US AQI 空气质量）
   ============================================================ */

/* ---------- 文案字典（中英双语） ---------- */
const copy = {
  en: {
    title: 'Trip Weather Advisor',
    search: 'Search',
    city: 'City',
    startDate: 'Start Date',
    endDate: 'End Date',
    locate: 'My Location',
    loading: 'Loading weather data...',
    error: 'Failed to load data. Please try again.',
    noResults: 'No matching cities found.',
    searchError: 'City search failed. Please try again.',
    noTrips: 'Enter a city and select a date range to get weather advice for your trip.',
    summary: 'Your trip to {city}: {n} days, {best} days suitable for outdoor activities.',
    outdoorDays: 'suitable for outdoor activities',
    tripDays: 'trip weather',
    sunrise: 'Sunrise',
    sunset: 'Sunset',
    uv: 'UV',
    precip: 'Precip',
    high: 'H',
    low: 'L',
    aqi: 'AQI',
    aqiGood: 'Good',
    aqiFair: 'Fair',
    aqiModerate: 'Moderate',
    aqiPoor: 'Poor',
    aqiVpoor: 'Very Poor',
    suggestionUmbrella: 'Bring an umbrella',
    suggestionSunscreen: 'Use sunscreen',
    suggestionHeatstroke: 'Stay hydrated',
    suggestionMask: 'Consider wearing a mask',
    suggestionOutdoor: 'Great for outdoor activities',
    suggestionSunrise: 'Great for sunrise viewing',
    dateRangeError: 'Date range must be 7 days or less.',
    invalidDate: 'End date must be after start date.',
    selectCity: 'Select a city',
  },
  zh: {
    title: '行程天气顾问',
    search: '搜索',
    city: '城市',
    startDate: '出发日期',
    endDate: '返回日期',
    locate: '我的位置',
    loading: '正在加载天气数据...',
    error: '数据加载失败，请重试。',
    noResults: '未找到匹配的城市。',
    searchError: '城市搜索失败，请重试。',
    noTrips: '输入城市并选择日期范围，获取个性化行程天气建议。',
    summary: '前往 {city} 的行程：共 {n} 天，{best} 天适合户外活动。',
    outdoorDays: '适合户外活动',
    tripDays: '行程天气',
    sunrise: '日出',
    sunset: '日落',
    uv: '紫外线',
    precip: '降水',
    high: '最高',
    low: '最低',
    aqi: 'AQI',
    aqiGood: '优',
    aqiFair: '良',
    aqiModerate: '中',
    aqiPoor: '差',
    aqiVpoor: '极差',
    suggestionUmbrella: '建议带伞',
    suggestionSunscreen: '注意防晒',
    suggestionHeatstroke: '注意防暑',
    suggestionMask: '建议佩戴口罩',
    suggestionOutdoor: '适合户外活动',
    suggestionSunrise: '适合早起看日出',
    dateRangeError: '日期范围不能超过 7 天。',
    invalidDate: '返回日期必须晚于出发日期。',
    selectCity: '请选择一个城市',
  },
}

const t = useT(copy)

/* ---------- 类型定义 ---------- */
interface GeoResult {
  name: string
  latitude: number
  longitude: number
  country: string
  admin1: string
  timezone: string
}

interface GeoSearchResponse {
  results?: GeoResult[]
}

interface SelectedCity {
  name: string
  lat: number
  lon: number
  country: string
  admin1: string
  timezone: string
}

interface DailyForecast {
  time: string[]
  weather_code: number[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
  precipitation_probability_max: number[]
  sunrise: string[]
  sunset: string[]
  uv_index_max: number[]
}

interface ForecastResponse {
  daily: DailyForecast
}

interface AirQualityCurrent {
  us_aqi: number
}

interface AirQualityResponse {
  current: AirQualityCurrent
}

interface DayCard {
  date: string
  dateLabel: string
  dateShort: string
  icon: string
  hi: number
  lo: number
  precip: number | null
  uv: string | null
  sunrise: string
  sunset: string
  aqi: number | null
  aqiLabel: string | null
  aqiColor: string
  suggestions: string[]
  isOutdoor: boolean
}

/* ---------- WMO 天气代码映射（图标） ---------- */
const WMO = {
  0: '\u2600', 1: '\u2600', 2: '\u26c5', 3: '\u2601', 45: '\ud83c\udf2b', 48: '\ud83c\udf2b',
  51: '\ud83c\udf26', 53: '\ud83c\udf26', 55: '\ud83c\udf26', 61: '\ud83c\udf27', 63: '\ud83c\udf27', 65: '\ud83c\udf27',
  71: '\ud83c\udf28', 73: '\ud83c\udf28', 75: '\ud83c\udf28', 80: '\ud83c\udf26', 81: '\ud83c\udf27', 82: '\u26c8',
  95: '\u26c8', 96: '\u26c8', 99: '\u26c8',
}

/* ---------- 响应式状态 ---------- */
const cityQuery = ref('')
const searchResults = ref<GeoResult[]>([])
const searchActive = ref(-1)
const showDropdown = ref(false)
const searchErrored = ref(false)
const searchWrapRef = ref<HTMLElement | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const selectedCity = ref<SelectedCity | null>(null)
const startDate = ref('')
const endDate = ref('')
const loading = ref(false)
const errorMsg = ref('')
const forecastData = ref<ForecastResponse | null>(null)
const airQualityData = ref<AirQualityResponse | null>(null)
const cityLabel = ref('')

/* ---------- 工具函数 ---------- */
function weatherIcon(code: number): string { return WMO[code as keyof typeof WMO] || '\ud83c\udf21' }

function aqiLevel(v: number | null): string {
  if (v == null || isNaN(v)) return 'good'
  if (v <= 50) return 'good'
  if (v <= 100) return 'fair'
  if (v <= 150) return 'moderate'
  if (v <= 200) return 'poor'
  return 'vpoor'
}

function aqiLabel(v: number | null): string {
  const level = aqiLevel(v)
  const map: Record<string, string> = { good: 'aqiGood', fair: 'aqiFair', moderate: 'aqiModerate', poor: 'aqiPoor', vpoor: 'aqiVpoor' }
  return t.value(map[level])
}

function aqiColor(v: number | null): string {
  if (v == null || isNaN(v)) return 'var(--ok-accent)'
  if (v <= 50) return '#22c55e'
  if (v <= 100) return '#8bc34a'
  if (v <= 150) return '#eab308'
  if (v <= 200) return '#f97316'
  return '#ef4444'
}

function fmtTime(iso: string): string {
  if (!iso) return '--'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '--'
  return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale(), { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtDateShort(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale(), { month: 'short', day: 'numeric' })
}

/* ---------- 日期范围 ---------- */
function getTodayStr() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function getDefaultEnd() {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

const todayStr = getTodayStr()
const defaultEnd = getDefaultEnd()

// 初始化日期
startDate.value = todayStr
endDate.value = defaultEnd

/* ---------- 城市搜索 ---------- */
function resultMeta(r: GeoResult): string {
  const meta = [r.admin1, r.country].filter(Boolean).join(', ')
  if (meta) return meta
  return Number(r.latitude).toFixed(2) + ', ' + Number(r.longitude).toFixed(2)
}

async function runSearch(query: string) {
  const url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(query) + '&count=5&language=' + (i18nState.lang === 'zh' ? 'zh' : 'en') + '&format=json'
  try {
    const res = await fetchJSON<GeoSearchResponse>(url)
    searchResults.value = (res && res.results) ? res.results : []
    searchErrored.value = false
  } catch (e) {
    searchResults.value = []
    searchErrored.value = true
  } finally {
    searchActive.value = -1
    showDropdown.value = true
  }
}

function hideResults() {
  showDropdown.value = false
  searchResults.value = []
  searchErrored.value = false
  searchActive.value = -1
}

function pickResult(r: GeoResult) {
  selectedCity.value = {
    name: r.name,
    lat: Number(r.latitude),
    lon: Number(r.longitude),
    country: r.country || '',
    admin1: r.admin1 || '',
    timezone: r.timezone || '',
  }
  cityQuery.value = [r.name, r.admin1, r.country].filter(Boolean).join(', ')
  hideResults()
}

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    hideResults()
    return
  }
  const n = searchResults.value.length
  if (!n) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    searchActive.value = (searchActive.value + 1) % n
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    searchActive.value = (searchActive.value - 1 + n) % n
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (searchActive.value >= 0) pickResult(searchResults.value[searchActive.value])
  }
}

function onDocClick(e: MouseEvent) {
  if (searchWrapRef.value && !searchWrapRef.value.contains(e.target as Node)) {
    hideResults()
  }
}

watch(cityQuery, (q) => {
  if (searchTimer) clearTimeout(searchTimer)
  const trimmed = q.trim()
  if (trimmed.length < 2) {
    hideResults()
    return
  }
  searchTimer = setTimeout(function () { runSearch(trimmed) }, 350)
})

/* ---------- 定位 ---------- */
function locate() {
  if (!navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      selectedCity.value = {
        name: i18nState.lang === 'zh' ? '当前位置' : 'Current Location',
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        country: '',
        admin1: '',
        timezone: '',
      }
      cityQuery.value = selectedCity.value.name
      hideResults()
    },
    function () {}
  )
}

/* ---------- 加载天气数据 ---------- */
async function loadWeather() {
  const city = selectedCity.value
  if (!city) return
  if (!startDate.value || !endDate.value) return

  const s = new Date(startDate.value)
  const e = new Date(endDate.value)
  if (e < s) {
    errorMsg.value = 'invalidDate'
    return
  }
  const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (diffDays > 7) {
    errorMsg.value = 'dateRangeError'
    return
  }

  loading.value = true
  errorMsg.value = ''
  forecastData.value = null
  airQualityData.value = null

  try {
    const fUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + city.lat + '&longitude=' + city.lon +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max' +
      '&timezone=auto&forecast_days=7&start_date=' + startDate.value + '&end_date=' + endDate.value
    const aUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + city.lat + '&longitude=' + city.lon +
      '&current=us_aqi&timezone=auto'

    const [f, air] = await Promise.all([
      fetchJSON<ForecastResponse>(fUrl),
      fetchJSON<AirQualityResponse>(aUrl),
    ])

    forecastData.value = f
    airQualityData.value = air
    cityLabel.value = cityQuery.value
  } catch (e) {
    errorMsg.value = 'error'
  } finally {
    loading.value = false
  }
}

/* ---------- 搜索 ---------- */
function search() {
  if (!selectedCity.value) {
    errorMsg.value = 'selectCity'
    return
  }
  loadWeather()
}

/* ---------- 派生：逐日天气卡片 ---------- */
const dayCards = computed(() => {
  const f = forecastData.value
  if (!f || !f.daily) return []
  const daily = f.daily
  const aqi = airQualityData.value ? airQualityData.value.current : null
  const aqiVal = aqi ? aqi.us_aqi : null
  const cards: DayCard[] = []

  for (let i = 0; i < daily.time.length; i++) {
    const date = daily.time[i]
    const wmo = daily.weather_code[i]
    const hi = daily.temperature_2m_max[i]
    const lo = daily.temperature_2m_min[i]
    const precip = daily.precipitation_probability_max[i]
    const sunrise = daily.sunrise[i]
    const sunset = daily.sunset[i]
    const uv = daily.uv_index_max[i]

    // 生成个性化建议
    const suggestions: string[] = []
    if (precip > 50) {
      suggestions.push(t.value('suggestionUmbrella'))
    }
    if (uv > 6) {
      suggestions.push(t.value('suggestionSunscreen'))
    }
    if (hi > 35) {
      suggestions.push(t.value('suggestionHeatstroke'))
    }
    if (aqiVal != null && aqiVal > 100) {
      suggestions.push(t.value('suggestionMask'))
    }
    if ((precip < 20 || precip == null) && lo >= 15 && hi <= 28) {
      suggestions.push(t.value('suggestionOutdoor'))
    }
    // sunrise before 6:30 AM local time
    if (sunrise) {
      const sr = new Date(sunrise)
      if (!isNaN(sr.getTime()) && sr.getHours() * 60 + sr.getMinutes() < 390) {
        suggestions.push(t.value('suggestionSunrise'))
      }
    }

    cards.push({
      date: date,
      dateLabel: fmtDate(date),
      dateShort: fmtDateShort(date),
      icon: weatherIcon(wmo),
      hi: Math.round(hi),
      lo: Math.round(lo),
      precip: precip != null ? Math.round(precip) : null,
      uv: uv != null ? uv.toFixed(1) : null,
      sunrise: fmtTime(sunrise),
      sunset: fmtTime(sunset),
      aqi: aqiVal,
      aqiLabel: aqiVal != null ? aqiLabel(aqiVal) : null,
      aqiColor: aqiColor(aqiVal),
      suggestions: suggestions,
      isOutdoor: precip < 20 && lo >= 15 && hi <= 28,
    })
  }
  return cards
})

/* ---------- 派生：总结 ---------- */
const summary = computed(() => {
  const cards = dayCards.value
  if (!cards.length) return null
  const outdoorCount = cards.filter(function (c: DayCard) { return c.isOutdoor }).length
  return {
    text: t.value('summary').replace('{city}', cityLabel.value).replace('{n}', String(cards.length)).replace('{best}', String(outdoorCount)),
    outdoorCount: outdoorCount,
    totalDays: cards.length,
  }
})

/* ---------- 生命周期 ---------- */
onMounted(function () {
  document.addEventListener('click', onDocClick)
})

onUnmounted(function () {
  document.removeEventListener('click', onDocClick)
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <div class="trip-weather-app">
    <AppHeader :title="{ en: 'Trip Weather Advisor', zh: '\u884c\u7a0b\u5929\u6c14\u987e\u95ee' }" />

    <main class="shell">
      <!-- 搜索与日期选择 -->
      <section class="control-panel">
        <div class="search-row">
          <div ref="searchWrapRef" class="search-box">
            <input
              v-model="cityQuery"
              class="search-input"
              type="text"
              autocomplete="off"
              :placeholder="t('city')"
              @keydown="onSearchKeydown"
            />
            <ul v-if="showDropdown" class="search-results" role="listbox">
              <li v-if="searchErrored" class="res-empty">{{ t('searchError') }}</li>
              <li v-else-if="!searchResults.length" class="res-empty">{{ t('noResults') }}</li>
              <li
                v-for="(r, i) in searchResults"
                :key="i"
                role="option"
                :class="{ active: i === searchActive }"
                @click="pickResult(r)"
              >
                <span class="res-name">{{ r.name }}</span>
                <span class="res-meta">{{ resultMeta(r) }}</span>
              </li>
            </ul>
          </div>
          <button class="btn-locate" type="button" @click="locate">{{ t('locate') }}</button>
        </div>

        <div class="date-row">
          <div class="date-field">
            <label class="date-label">{{ t('startDate') }}</label>
            <input v-model="startDate" type="date" :min="todayStr" class="date-input" />
          </div>
          <div class="date-field">
            <label class="date-label">{{ t('endDate') }}</label>
            <input v-model="endDate" type="date" :min="startDate || todayStr" class="date-input" />
          </div>
          <button class="btn-search" type="button" @click="search">{{ t('search') }}</button>
        </div>
      </section>

      <!-- 加载状态 -->
      <div v-if="loading" class="ok-loading">
        <span class="ok-spinner"></span>
        <span>{{ t('loading') }}</span>
      </div>

      <!-- 错误提示 -->
      <div v-if="errorMsg && !loading" class="ok-error">
        <p>{{ t(errorMsg) }}</p>
      </div>

      <!-- 空状态 -->
      <div v-if="!loading && !errorMsg && !dayCards.length" class="empty-state">
        <div class="empty-icon">&#127758;</div>
        <p>{{ t('noTrips') }}</p>
      </div>

      <!-- 行程天气数据 -->
      <template v-if="dayCards.length && !loading">
        <!-- 总结 -->
        <section v-if="summary" class="summary-section">
          <p class="summary-text">{{ summary.text }}</p>
        </section>

        <!-- 逐日卡片 -->
        <section class="cards-section">
          <div
            v-for="(day, i) in dayCards"
            :key="i"
            class="day-card"
            :class="{ 'outdoor-day': day.isOutdoor }"
          >
            <div class="card-left">
              <div class="card-date">{{ day.dateLabel }}</div>
              <div class="card-icon">{{ day.icon }}</div>
            </div>
            <div class="card-center">
              <div class="card-temps">
                <span class="temp-high">{{ day.hi }}&deg;</span>
                <span class="temp-slash">/</span>
                <span class="temp-low">{{ day.lo }}&deg;</span>
              </div>
              <div class="card-meta">
                <span class="meta-item">
                  &#127782; {{ day.precip != null ? day.precip + '%' : '--' }}
                </span>
                <span class="meta-item">
                  &#127777; {{ t('uv') }} {{ day.uv || '--' }}
                </span>
              </div>
              <div class="card-meta">
                <span class="meta-item">{{ t('sunrise') }} {{ day.sunrise }}</span>
                <span class="meta-item">{{ t('sunset') }} {{ day.sunset }}</span>
              </div>
            </div>
            <div class="card-right">
              <div v-if="day.aqi != null" class="aqi-badge" :style="{ background: day.aqiColor }">
                {{ t('aqi') }} {{ Math.round(day.aqi) }}
              </div>
              <div class="suggestion-list">
                <span
                  v-for="(s, si) in day.suggestions"
                  :key="si"
                  class="suggestion-tag"
                >{{ s }}</span>
              </div>
            </div>
          </div>
        </section>
      </template>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Trip Weather Advisor — 行程天气顾问
   浅色主题，使用 --ok-* 设计 token。
   ============================================================ */

.trip-weather-app {
  --bg: #f3f6fb;
  --panel: #ffffff;
  --line: #d8e0ec;
  --text: #132033;
  --muted: #5c6b80;
  --accent: #1b74e4;
  --accent-soft: #e8f1ff;
  --good: #0f9d74;
  --warn: #c78012;
  --bad: #c03d3d;
  --outdoor-bg: #f0fdf4;

  /* 共享组件主题映射 */
  --ok-bg: var(--bg);
  --ok-panel: var(--panel);
  --ok-line: var(--line);
  --ok-text: var(--text);
  --ok-muted: var(--muted);
  --ok-accent: var(--accent);
  --ok-accent-soft: var(--accent-soft);
  --ok-footer-line: var(--line);
  --ok-footer-text: var(--muted);
  --ok-footer-link: var(--accent);
  --ok-topbar-line: rgba(128, 128, 128, 0.1);

  margin: 0;
  font-family: "Inter", system-ui, sans-serif;
  color: var(--text);
  background: var(--bg);
  min-height: 100vh;
}

h1, h2, h3, p, strong, span, small { margin: 0; }

/* ---------- 主容器 ---------- */
.shell {
  width: min(900px, calc(100% - 1.25rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

/* ---------- 控制面板 ---------- */
.control-panel {
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 1.2rem;
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.search-row {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 200px;
}

.search-input {
  font: inherit;
  width: 100%;
  height: 2.6rem;
  padding: 0 0.75rem;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.6);
  font-size: 0.95rem;
  box-sizing: border-box;
}

.search-input:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.search-results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  list-style: none;
  margin: 0;
  padding: 0.3rem;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  z-index: 40;
  max-height: 280px;
  overflow-y: auto;
}

.search-results li {
  padding: 0.5rem 0.7rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  transition: background 0.12s;
}

.search-results li:hover,
.search-results li.active {
  background: var(--accent-soft);
}

.search-results .res-name { color: var(--text); font-weight: 500; }
.search-results .res-meta { color: var(--muted); font-size: 0.74rem; }
.search-results .res-empty { color: var(--muted); cursor: default; }
.search-results .res-empty:hover { background: transparent; }

.btn-locate {
  font: inherit;
  height: 2.6rem;
  padding: 0 0.8rem;
  border: 1px solid var(--line);
  background: transparent;
  cursor: pointer;
  font-size: 0.8rem;
  white-space: nowrap;
}

.btn-locate:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.date-row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.date-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 140px;
}

.date-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-weight: 600;
}

.date-input {
  font: inherit;
  height: 2.6rem;
  padding: 0 0.75rem;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
  color: var(--text);
}

.date-input:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.btn-search {
  font: inherit;
  height: 2.6rem;
  padding: 0 1.5rem;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: white;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
}

.btn-search:hover {
  opacity: 0.9;
}

/* ---------- 加载状态 ---------- */
.ok-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--muted);
  padding: 2rem 0.5rem;
  margin-top: 1rem;
}

.ok-spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  display: inline-block;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ---------- 错误 ---------- */
.ok-error {
  margin-top: 1rem;
  padding: 0.8rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: var(--bad);
  font-size: 0.88rem;
}

/* ---------- 空状态 ---------- */
.empty-state {
  margin-top: 3rem;
  text-align: center;
  color: var(--muted);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 0.8rem;
  opacity: 0.5;
}

.empty-state p {
  font-size: 0.95rem;
  max-width: 36ch;
  margin: 0 auto;
  line-height: 1.6;
}

/* ---------- 总结 ---------- */
.summary-section {
  margin-top: 1.2rem;
  padding: 0.8rem 1rem;
  background: var(--accent-soft);
  border: 1px solid var(--accent);
  border-radius: 8px;
}

.summary-text {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.5;
}

/* ---------- 逐日卡片 ---------- */
.cards-section {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.day-card {
  display: grid;
  grid-template-columns: 130px 1fr auto;
  gap: 0.8rem;
  align-items: center;
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 1rem 1.2rem;
  transition: border-color 0.15s;
}

.day-card.outdoor-day {
  border-left: 4px solid var(--good);
  background: var(--outdoor-bg);
}

.card-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.card-date {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text);
  text-align: center;
}

.card-icon {
  font-size: 2.2rem;
  line-height: 1;
}

.card-center {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.card-temps {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
}

.temp-high {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text);
}

.temp-slash {
  font-size: 0.85rem;
  color: var(--muted);
}

.temp-low {
  font-size: 1rem;
  font-weight: 500;
  color: var(--muted);
}

.card-meta {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.meta-item {
  font-size: 0.78rem;
  color: var(--muted);
}

.card-right {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-end;
  min-width: 120px;
}

.aqi-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 700;
  color: white;
  white-space: nowrap;
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-end;
}

.suggestion-tag {
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  white-space: nowrap;
}

/* ---------- 响应式 ---------- */
@media (max-width: 720px) {
  .day-card {
    grid-template-columns: 1fr;
    gap: 0.6rem;
  }

  .card-left {
    flex-direction: row;
    justify-content: space-between;
  }

  .card-right {
    align-items: flex-start;
  }

  .suggestion-list {
    align-items: flex-start;
  }

  .date-row {
    flex-direction: column;
  }

  .btn-search {
    width: 100%;
  }
}
</style>