<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, lsGet, lsSet, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ============================================================
   Sun & Moon — 日出日落时间
   数据源：
     · Sunrise-Sunset API（日出日落及各阶段曙暮光，formatted=0 返回 UTC ISO 时间）
     · Open-Meteo Geocoding API（城市搜索，返回 name/latitude/longitude/country/timezone）
   所有时间按所选城市时区显示（通过 Intl.DateTimeFormat 转换）。
   ============================================================ */

/* ---------- 文案字典（中英双语） ---------- */
const copy = {
  en: {
    title: 'Sun & Moon',
    eyebrow: 'Sunrise · Sunset · Twilight',
    lead: "Sunrise, sunset, solar noon and twilight phases for any city on any date, shown in the city's local time.",
    searchPlaceholder: 'Search a city…',
    date: 'Date',
    favorites: 'Favorites',
    addFav: '★ Save',
    removeFav: '★ Saved',
    noFavs: 'No favorites yet — save a city for quick access.',
    timeline: 'Day Timeline',
    sunTimes: 'Sun',
    civilTwilight: 'Civil Twilight',
    nauticalTwilight: 'Nautical Twilight',
    astroTwilight: 'Astronomical Twilight',
    sunrise: 'Sunrise',
    sunset: 'Sunset',
    solarNoon: 'Solar Noon',
    dayLength: 'Day Length',
    civilBegin: 'Civil Dawn',
    civilEnd: 'Civil Dusk',
    nautBegin: 'Nautical Dawn',
    nautEnd: 'Nautical Dusk',
    astroBegin: 'Astronomical Dawn',
    astroEnd: 'Astronomical Dusk',
    now: 'Now',
    loading: 'Loading…',
    error: 'Failed to load data. Please try again.',
    noResults: 'No matching cities.',
    dataSource: 'Data: Sunrise-Sunset.org · Open-Meteo',
    builtBy: 'Built by',
    phaseNight: 'Night',
    phaseAstro: 'Astronomical',
    phaseNautical: 'Nautical',
    phaseCivil: 'Civil',
    phaseDay: 'Day'
  },
  zh: {
    title: '日出日落',
    eyebrow: '日出 · 日落 · 曙暮光',
    lead: '查询任意城市、任意日期的日出、日落、太阳正午及各阶段曙暮光，时间按所选城市时区显示。',
    searchPlaceholder: '搜索城市…',
    date: '日期',
    favorites: '收藏',
    addFav: '★ 收藏',
    removeFav: '★ 已收藏',
    noFavs: '暂无收藏——收藏常用城市可快速切换。',
    timeline: '当日时间轴',
    sunTimes: '太阳',
    civilTwilight: '民用曙暮光',
    nauticalTwilight: '航海曙暮光',
    astroTwilight: '天文曙暮光',
    sunrise: '日出',
    sunset: '日落',
    solarNoon: '太阳正午',
    dayLength: '白昼时长',
    civilBegin: '民用晨光始',
    civilEnd: '民用昏光终',
    nautBegin: '航海晨光始',
    nautEnd: '航海昏光终',
    astroBegin: '天文晨光始',
    astroEnd: '天文昏光终',
    now: '当前',
    loading: '加载中…',
    error: '数据加载失败，请重试。',
    noResults: '未找到匹配的城市。',
    dataSource: '数据：Sunrise-Sunset.org · Open-Meteo',
    builtBy: '由',
    phaseNight: '夜晚',
    phaseAstro: '天文',
    phaseNautical: '航海',
    phaseCivil: '民用',
    phaseDay: '白昼'
  }
}

const t = useT(copy)

/* ---------- 常量 ---------- */
const SUN_URL = 'https://api.sunrise-sunset.org/json'
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FAV_KEY = 'sun-moon-favorites'
// 默认北京
const BEIJING = { name: 'Beijing', lat: 39.9, lng: 116.4, country: 'China', timezone: 'Asia/Shanghai' }

// 各阶段配色（与时间轴渐变一致）
const PHASE_COLORS = {
  night: '#0a0f24',
  astro: '#1e1b4b',
  nautical: '#4338ca',
  civil: '#fb923c',
  day: '#fcd34d',
  dayPeak: '#fef3c7'
}

// 时间轴上的小时刻度
const tickHours = [0, 6, 12, 18, 24]
function tickLeft(h) { return (h / 24 * 100).toFixed(2) }

/* ---------- 响应式状态 ---------- */
const city = ref(null)          // 当前选中城市
const data = ref(null)          // Sunrise-Sunset API 返回的 results
const error = ref(null)         // 错误信息
const loading = ref(false)
const dateValue = ref('')       // 日期输入 YYYY-MM-DD
const searchQuery = ref('')     // 城市搜索输入
const searchResults = ref([])
const showResults = ref(false)
const favorites = ref([])
const searchWrapRef = ref(null) // 搜索框容器引用，用于点击外部关闭下拉
let searchTimer = null

/* ---------- 工具函数 ---------- */
function pad2(n) { return n < 10 ? '0' + n : '' + n }

// 在指定时区下格式化时间为 HH:MM
function fmtTime(date, timeZone) {
  if (!date || isNaN(date.getTime())) return '—'
  const loc = locale()
  try {
    return new Intl.DateTimeFormat(loc, {
      timeZone: timeZone, hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date)
  } catch (e) {
    return date.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', hour12: false })
  }
}

// 取某时刻在指定时区下的小时（小数，0~24）
function localHours(date, timeZone) {
  if (!date || isNaN(date.getTime())) return null
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(date)
    let h = 0, m = 0, s = 0
    parts.forEach((p) => {
      if (p.type === 'hour') h = parseInt(p.value, 10)
      else if (p.type === 'minute') m = parseInt(p.value, 10)
      else if (p.type === 'second') s = parseInt(p.value, 10)
    })
    if (h === 24) h = 0
    return h + m / 60 + s / 3600
  } catch (e) {
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  }
}

// 取指定时区下今天的日期字符串 YYYY-MM-DD
function todayInTZ(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date())
    let y, mo, d
    parts.forEach((p) => {
      if (p.type === 'year') y = p.value
      else if (p.type === 'month') mo = p.value
      else if (p.type === 'day') d = p.value
    })
    return y + '-' + mo + '-' + d
  } catch (e) {
    const n = new Date()
    return n.getFullYear() + '-' + pad2(n.getMonth() + 1) + '-' + pad2(n.getDate())
  }
}

// 将 YYYY-MM-DD 格式化为带星期的本地日期文字（按当前语言）
function fmtDateLabel(ymd) {
  if (!ymd) return ''
  const parts = ymd.split('-')
  if (parts.length !== 3) return ymd
  const d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]))
  if (isNaN(d.getTime())) return ymd
  const loc = locale()
  try {
    return d.toLocaleDateString(loc, {
      timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    })
  } catch (e) {
    return ymd
  }
}

// 白昼时长（秒）转 "Xh Ym" / "X 小时 Y 分"
function fmtDayLength(seconds) {
  if (seconds == null || isNaN(seconds)) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (i18nState.lang === 'zh') return h + ' 小时 ' + m + ' 分'
  return h + 'h ' + m + 'm'
}

function safeDate(iso) { return iso ? new Date(iso) : null }

/* ---------- 派生：判断所选日期是否为该城市时区的今天 ---------- */
const isToday = computed(() => {
  if (!city.value || !dateValue.value) return false
  return dateValue.value === todayInTZ(city.value.timezone)
})

/* ---------- 收藏管理 ---------- */
function loadFavs() {
  try { return JSON.parse(lsGet(FAV_KEY) || '[]') } catch (e) { return [] }
}
function persistFavs() {
  lsSet(FAV_KEY, JSON.stringify(favorites.value))
}
function isFav(c) {
  if (!c) return false
  return favorites.value.some((f) => f.lat === c.lat && f.lng === c.lng)
}
// 当前城市是否已收藏（控制收藏按钮文案/样式）
const isCurrentFav = computed(() => isFav(city.value))
function toggleFav() {
  const c = city.value
  if (!c) return
  const idx = favorites.value.findIndex((f) => f.lat === c.lat && f.lng === c.lng)
  if (idx >= 0) {
    favorites.value.splice(idx, 1)
  } else {
    favorites.value.push({ name: c.name, lat: c.lat, lng: c.lng, country: c.country, timezone: c.timezone })
  }
  persistFavs()
}
function removeFav(idx) {
  if (idx >= 0 && idx < favorites.value.length) {
    favorites.value.splice(idx, 1)
    persistFavs()
  }
}
function selectFav(f) {
  selectCity(f)
}

/* ---------- 城市搜索 ---------- */
async function searchCities(query) {
  const url = GEO_URL + '?name=' + encodeURIComponent(query) + '&count=5&language=en&format=json'
  try {
    const result = await fetchJSON(url)
    searchResults.value = (result && result.results) || []
    showResults.value = true
  } catch (e) {
    searchResults.value = []
    showResults.value = true
  }
}

function hideSearchResults() {
  showResults.value = false
}

// 搜索结果项的标签：name, admin1, country
function resultLabel(r) {
  let label = r.name
  if (r.admin1) label += ', ' + r.admin1
  if (r.country) label += ', ' + r.country
  return label
}
// 搜索结果项的副标题：经纬度 + 时区
function resultSub(r) {
  return (r.latitude != null ? r.latitude.toFixed(2) : '—') + ', ' +
    (r.longitude != null ? r.longitude.toFixed(2) : '—') +
    (r.timezone ? ' · ' + r.timezone : '')
}

// 搜索框键盘事件：Enter 立即搜索，Escape 关闭下拉
function onSearchKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    clearTimeout(searchTimer)
    const q = searchQuery.value.trim()
    if (q) searchCities(q)
  } else if (e.key === 'Escape') {
    hideSearchResults()
  }
}

// 聚焦时若已有结果则重新展开下拉
function onSearchFocus() {
  if (searchQuery.value.trim() && searchResults.value.length) showResults.value = true
}

// 点击页面外部关闭搜索下拉
function onDocClick(e) {
  if (searchWrapRef.value && !searchWrapRef.value.contains(e.target)) {
    hideSearchResults()
  }
}

/* ---------- 选择城市 ---------- */
function selectCity(c) {
  city.value = c
  searchQuery.value = ''
  showResults.value = false
  searchResults.value = []
  // 若未选日期，默认填充该城市时区的今天
  if (!dateValue.value) dateValue.value = todayInTZ(c.timezone)
  // 城市/日期变化由 watch([city, dateValue]) 触发 load
}

/* ---------- 加载日出日落数据 ---------- */
async function load() {
  if (!city.value) return
  loading.value = true
  error.value = null
  const date = dateValue.value || todayInTZ(city.value.timezone)
  const url = SUN_URL + '?lat=' + city.value.lat + '&lng=' + city.value.lng +
    '&date=' + encodeURIComponent(date) + '&formatted=0'
  try {
    const result = await fetchJSON(url)
    if (!result || result.status !== 'OK') throw new Error(result && result.status ? result.status : 'error')
    data.value = result.results
  } catch (e) {
    data.value = null
    error.value = (e && e.message) ? e.message : 'error'
  } finally {
    loading.value = false
  }
}

/* ---------- 派生：当前城市信息 ---------- */
const currentCityInfo = computed(() => {
  if (!city.value) return null
  const c = city.value
  const coords = (c.lat != null ? c.lat.toFixed(2) : '—') + '°, ' + (c.lng != null ? c.lng.toFixed(2) : '—') + '°'
  return {
    name: c.name,
    country: c.country || '',
    coords,
    timezone: c.timezone || 'UTC',
    dateLabel: fmtDateLabel(dateValue.value)
  }
})

/* ---------- 派生：信息卡片数据 ---------- */
const infoRows = computed(() => {
  const d = data.value
  if (!d) return null
  const tz = city.value ? city.value.timezone : null
  return {
    sunrise: fmtTime(safeDate(d.sunrise), tz),
    solarNoon: fmtTime(safeDate(d.solar_noon), tz),
    sunset: fmtTime(safeDate(d.sunset), tz),
    dayLength: fmtDayLength(d.day_length),
    civilBegin: fmtTime(safeDate(d.civil_twilight_begin), tz),
    civilEnd: fmtTime(safeDate(d.civil_twilight_end), tz),
    nautBegin: fmtTime(safeDate(d.nautical_twilight_begin), tz),
    nautEnd: fmtTime(safeDate(d.nautical_twilight_end), tz),
    astroBegin: fmtTime(safeDate(d.astronomical_twilight_begin), tz),
    astroEnd: fmtTime(safeDate(d.astronomical_twilight_end), tz)
  }
})

/* ---------- 派生：时间轴事件列表 ---------- */
const timelineEvents = computed(() => {
  const d = data.value
  if (!d) return []
  const tz = city.value ? city.value.timezone : null
  // 按时间顺序排列的事件定义
  const defs = [
    { key: 'astroBegin', iso: d.astronomical_twilight_begin, phase: 'astro', label: t.value('astroBegin') },
    { key: 'nautBegin', iso: d.nautical_twilight_begin, phase: 'nautical', label: t.value('nautBegin') },
    { key: 'civilBegin', iso: d.civil_twilight_begin, phase: 'civil', label: t.value('civilBegin') },
    { key: 'sunrise', iso: d.sunrise, phase: 'sunrise', label: t.value('sunrise') },
    { key: 'solarNoon', iso: d.solar_noon, phase: 'day', label: t.value('solarNoon') },
    { key: 'sunset', iso: d.sunset, phase: 'sunset', label: t.value('sunset') },
    { key: 'civilEnd', iso: d.civil_twilight_end, phase: 'civil', label: t.value('civilEnd') },
    { key: 'nautEnd', iso: d.nautical_twilight_end, phase: 'nautical', label: t.value('nautEnd') },
    { key: 'astroEnd', iso: d.astronomical_twilight_end, phase: 'astro', label: t.value('astroEnd') }
  ]
  const events = []
  defs.forEach((e) => {
    if (!e.iso) return
    const date = new Date(e.iso)
    const h = localHours(date, tz)
    if (h == null) return
    events.push({
      key: e.key,
      hours: h,
      date,
      phase: e.phase,
      label: e.label,
      time: fmtTime(date, tz),
      left: (h / 24 * 100).toFixed(2)
    })
  })
  return events
})

/* ---------- 派生：时间轴渐变样式 ---------- */
const gradientStyle = computed(() => {
  const events = timelineEvents.value
  function find(key) {
    for (let i = 0; i < events.length; i++) if (events[i].key === key) return events[i]
    return null
  }
  function pct(h) { return (h / 24 * 100).toFixed(2) }
  function stop(color, h) { return PHASE_COLORS[color] + ' ' + pct(h) + '%' }

  const sunrise = find('sunrise')
  const sunset = find('sunset')
  const solarNoon = find('solarNoon')
  const civilBegin = find('civilBegin')
  const civilEnd = find('civilEnd')
  const nautBegin = find('nautBegin')
  const nautEnd = find('nautEnd')
  const astroBegin = find('astroBegin')
  const astroEnd = find('astroEnd')

  // 极昼 / 极夜兜底（无日出日落）
  if (!sunrise && !sunset) {
    const dl = data.value && data.value.day_length
    if (dl != null && dl >= 86400) {
      return 'linear-gradient(90deg, ' + PHASE_COLORS.day + ' 0%, ' + PHASE_COLORS.dayPeak + ' 50%, ' + PHASE_COLORS.day + ' 100%)'
    }
    return 'linear-gradient(90deg, ' + PHASE_COLORS.night + ' 0%, ' + PHASE_COLORS.night + ' 100%)'
  }

  // 平滑渐变：深夜 → 天文 → 航海 → 民用 → 白昼（正午最亮）→ 民用 → 航海 → 天文 → 深夜
  const stops = [PHASE_COLORS.night + ' 0%']
  if (astroBegin) stops.push(stop('astro', astroBegin.hours))
  if (nautBegin) stops.push(stop('nautical', nautBegin.hours))
  if (civilBegin) stops.push(stop('civil', civilBegin.hours))
  if (sunrise) stops.push(stop('day', sunrise.hours))
  if (solarNoon) stops.push(stop('dayPeak', solarNoon.hours))
  if (sunset) stops.push(stop('day', sunset.hours))
  if (civilEnd) stops.push(stop('civil', civilEnd.hours))
  if (nautEnd) stops.push(stop('nautical', nautEnd.hours))
  if (astroEnd) stops.push(stop('astro', astroEnd.hours))
  stops.push(PHASE_COLORS.night + ' 100%')

  return 'linear-gradient(90deg, ' + stops.join(', ') + ')'
})

/* ---------- 派生：当前时刻线（仅查看该城市今天时显示） ---------- */
const nowMarker = computed(() => {
  if (!isToday.value || !city.value) return null
  const nowH = localHours(new Date(), city.value.timezone)
  if (nowH == null) return null
  return { left: (nowH / 24 * 100).toFixed(2) }
})

/* ---------- 监听：搜索输入防抖 ---------- */
watch(searchQuery, (q) => {
  clearTimeout(searchTimer)
  const trimmed = q.trim()
  if (!trimmed) {
    showResults.value = false
    searchResults.value = []
    return
  }
  searchTimer = setTimeout(() => { searchCities(trimmed) }, 300)
})

/* ---------- 监听：城市/日期变化时重新加载数据 ---------- */
watch([city, dateValue], () => {
  if (city.value) load()
})

/* ---------- 生命周期 ---------- */
onMounted(() => {
  // 载入本地收藏
  favorites.value = loadFavs()
  // 监听全局点击，用于关闭搜索下拉
  document.addEventListener('click', onDocClick)
  // 默认加载北京
  selectCity(BEIJING)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  clearTimeout(searchTimer)
})
</script>

<template>
  <div class="sun-moon-app">
    <!-- 顶部栏：标题 + 语言切换（语言切换由 AppHeader 内部处理） -->
    <AppHeader :title="t('title')" />

    <main class="shell">
      <!-- 页头说明 -->
      <header class="masthead">
        <p class="eyebrow">{{ t('eyebrow') }}</p>
        <p class="lead">{{ t('lead') }}</p>
      </header>

      <!-- 控件：城市搜索 + 日期 + 收藏 -->
      <section class="control-bar">
        <div ref="searchWrapRef" class="search-wrap">
          <input
            v-model="searchQuery"
            type="text"
            class="city-input"
            autocomplete="off"
            :placeholder="t('searchPlaceholder')"
            aria-label="Search city"
            @keydown="onSearchKeydown"
            @focus="onSearchFocus"
          />
          <!-- 搜索结果下拉 -->
          <div v-if="showResults" class="search-results">
            <div v-if="!searchResults.length" class="sr-empty">{{ t('noResults') }}</div>
            <button
              v-for="(r, i) in searchResults"
              :key="i"
              type="button"
              class="sr-item"
              @click="selectCity({ name: r.name, lat: r.latitude, lng: r.longitude, country: r.country, timezone: r.timezone })"
            >
              <span class="sr-name">{{ resultLabel(r) }}</span>
              <span class="sr-sub">{{ resultSub(r) }}</span>
            </button>
          </div>
        </div>
        <label class="date-wrap">
          <span class="date-label">{{ t('date') }}</span>
          <input v-model="dateValue" type="date" class="date-input" aria-label="Date" />
        </label>
        <button
          v-if="city"
          class="ok-btn-ghost fav-btn"
          :class="{ 'is-saved': isCurrentFav }"
          type="button"
          @click="toggleFav"
        >
          {{ isCurrentFav ? t('removeFav') : t('addFav') }}
        </button>
      </section>

      <!-- 当前城市信息 -->
      <div v-if="currentCityInfo" class="current-city">
        <span class="cc-name">
          {{ currentCityInfo.name }}<template v-if="currentCityInfo.country">, {{ currentCityInfo.country }}</template>
        </span>
        <span class="cc-coords">{{ currentCityInfo.coords }} · {{ currentCityInfo.timezone }}</span>
        <span class="cc-date">{{ currentCityInfo.dateLabel }}</span>
      </div>

      <!-- 收藏栏 -->
      <section class="favorites-bar">
        <span class="fav-label">{{ t('favorites') }}</span>
        <div class="fav-strip">
          <span v-if="!favorites.length" class="fav-empty">{{ t('noFavs') }}</span>
          <button
            v-for="(f, i) in favorites"
            :key="f.lat + ',' + f.lng"
            class="fav-chip"
            type="button"
            :title="f.name + (f.country ? ', ' + f.country : '')"
            @click="selectFav(f)"
          >
            <span class="fav-chip-name">{{ f.name }}</span>
            <span
              class="fav-chip-remove"
              role="button"
              aria-label="remove"
              @click.stop="removeFav(i)"
            >×</span>
          </button>
        </div>
      </section>

      <!-- 加载状态 -->
      <div v-if="loading" class="ok-loading">
        <span class="ok-spinner"></span>
        <span>{{ t('loading') }}</span>
      </div>

      <!-- 错误状态 -->
      <div v-if="error" class="ok-error">{{ t('error') }}</div>

      <!-- 时间轴可视化 -->
      <section v-if="data && !error" class="card timeline-card">
        <div class="card-label">{{ t('timeline') }}</div>
        <div class="timeline">
          <div class="tl-stage">
            <!-- 渐变背景轨道 + 小时刻度线 -->
            <div class="tl-track" :style="{ background: gradientStyle }">
              <div
                v-for="h in tickHours"
                :key="'tick-' + h"
                class="tl-tick"
                :style="{ left: tickLeft(h) + '%' }"
              ></div>
            </div>
            <!-- 事件标记（上下交错避免重叠） -->
            <div
              v-for="(e, i) in timelineEvents"
              :key="e.key"
              class="tl-marker"
              :class="i % 2 === 0 ? 'above' : 'below'"
              :style="{ left: e.left + '%' }"
              :title="e.label + ' ' + e.time"
            >
              <div class="tl-marker-line"></div>
              <div class="tl-marker-dot" :class="'phase-' + e.phase"></div>
              <div class="tl-marker-label">
                <span class="tl-name">{{ e.label }}</span>
                <span class="tl-time">{{ e.time }}</span>
              </div>
            </div>
            <!-- 当前时刻线（仅查看该城市今天时显示） -->
            <div v-if="nowMarker" class="tl-now" :style="{ left: nowMarker.left + '%' }">
              <div class="tl-now-line"></div>
              <span class="tl-now-label">{{ t('now') }}</span>
            </div>
          </div>
          <!-- 小时刻度文字行 -->
          <div class="tl-hours">
            <span
              v-for="h in tickHours"
              :key="'hour-' + h"
              class="tl-hour"
              :style="{ left: tickLeft(h) + '%' }"
            >{{ pad2(h) }}:00</span>
          </div>
          <!-- 阶段图例 -->
          <div class="tl-legend">
            <span class="tl-legend-item">
              <span class="tl-legend-swatch" :style="{ background: PHASE_COLORS.night }"></span>{{ t('phaseNight') }}
            </span>
            <span class="tl-legend-item">
              <span class="tl-legend-swatch" :style="{ background: PHASE_COLORS.astro }"></span>{{ t('phaseAstro') }}
            </span>
            <span class="tl-legend-item">
              <span class="tl-legend-swatch" :style="{ background: PHASE_COLORS.nautical }"></span>{{ t('phaseNautical') }}
            </span>
            <span class="tl-legend-item">
              <span class="tl-legend-swatch" :style="{ background: PHASE_COLORS.civil }"></span>{{ t('phaseCivil') }}
            </span>
            <span class="tl-legend-item">
              <span class="tl-legend-swatch" :style="{ background: PHASE_COLORS.day }"></span>{{ t('phaseDay') }}
            </span>
          </div>
        </div>
      </section>

      <!-- 信息卡片 -->
      <div v-if="data && !error && infoRows" class="info-grid">
        <section class="card info-card is-sun">
          <div class="card-label">{{ t('sunTimes') }}</div>
          <div class="info-rows">
            <div class="info-row">
              <span class="ir-label">{{ t('sunrise') }}</span>
              <span class="ir-value">{{ infoRows.sunrise }}</span>
            </div>
            <div class="info-row">
              <span class="ir-label">{{ t('solarNoon') }}</span>
              <span class="ir-value">{{ infoRows.solarNoon }}</span>
            </div>
            <div class="info-row">
              <span class="ir-label">{{ t('sunset') }}</span>
              <span class="ir-value">{{ infoRows.sunset }}</span>
            </div>
            <div class="info-row highlight">
              <span class="ir-label">{{ t('dayLength') }}</span>
              <span class="ir-value">{{ infoRows.dayLength }}</span>
            </div>
          </div>
        </section>

        <section class="card info-card is-civil">
          <div class="card-label">{{ t('civilTwilight') }}</div>
          <div class="info-rows">
            <div class="info-row">
              <span class="ir-label">{{ t('civilBegin') }}</span>
              <span class="ir-value">{{ infoRows.civilBegin }}</span>
            </div>
            <div class="info-row">
              <span class="ir-label">{{ t('civilEnd') }}</span>
              <span class="ir-value">{{ infoRows.civilEnd }}</span>
            </div>
          </div>
        </section>

        <section class="card info-card is-nautical">
          <div class="card-label">{{ t('nauticalTwilight') }}</div>
          <div class="info-rows">
            <div class="info-row">
              <span class="ir-label">{{ t('nautBegin') }}</span>
              <span class="ir-value">{{ infoRows.nautBegin }}</span>
            </div>
            <div class="info-row">
              <span class="ir-label">{{ t('nautEnd') }}</span>
              <span class="ir-value">{{ infoRows.nautEnd }}</span>
            </div>
          </div>
        </section>

        <section class="card info-card is-astro">
          <div class="card-label">{{ t('astroTwilight') }}</div>
          <div class="info-rows">
            <div class="info-row">
              <span class="ir-label">{{ t('astroBegin') }}</span>
              <span class="ir-value">{{ infoRows.astroBegin }}</span>
            </div>
            <div class="info-row">
              <span class="ir-label">{{ t('astroEnd') }}</span>
              <span class="ir-value">{{ infoRows.astroEnd }}</span>
            </div>
          </div>
        </section>
      </div>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Sun & Moon — 日出日落时间样式
   深色日月主题，accent 用日出/日落的橙金色。
   原版 :root 变量映射到组件根类 .sun-moon-app 上。
   ============================================================ */

.sun-moon-app {
  /* app 自有变量 */
  --bg: #0b1020;
  --surface: #131a2e;
  --surface-2: #1a2342;
  --text: #eef2ff;
  --text-muted: #93a0c0;
  --border: #283150;
  --accent: #f59e0b;       /* 日出金 */
  --accent-2: #fb923c;     /* 日落橙 */
  --accent-3: #fcd34d;     /* 正午亮金 */
  --indigo: #6366f1;
  --indigo-deep: #312e81;
  color-scheme: dark;

  /* 映射到共享设计 token（覆盖 shared.css 的浅色默认值） */
  --ok-bg: var(--bg);
  --ok-panel: var(--surface);
  --ok-text: var(--text);
  --ok-muted: var(--text-muted);
  --ok-line: var(--border);
  --ok-accent: var(--accent);
  --ok-accent-soft: rgba(245, 158, 11, 0.12);
  --ok-radius: 14px;
  --ok-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);

  /* 共享组件（topbar/footer）在深色主题下的适配 */
  --ok-topbar-line: var(--border);
  --ok-footer-line: var(--border);
  --ok-footer-text: var(--text-muted);
  --ok-footer-link: var(--accent);

  /* 字体 */
  --ok-font: "Outfit", system-ui, -apple-system, sans-serif;
  --ok-mono: "IBM Plex Mono", "SFMono-Regular", Menlo, monospace;

  /* 原版 body 背景：深色径向渐变 */
  margin: 0;
  font-family: var(--ok-font);
  color: var(--text);
  background:
    radial-gradient(1000px 520px at 82% -10%, rgba(251, 146, 60, 0.14), transparent 60%),
    radial-gradient(900px 500px at 8% -5%, rgba(245, 158, 11, 0.10), transparent 55%),
    radial-gradient(820px 600px at 50% 112%, rgba(99, 102, 241, 0.12), transparent 60%),
    var(--bg);
  background-attachment: fixed;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

/* ---------- 顶部栏（覆盖 AppHeader 内的 .ok-topbar 以贴合原版深色顶栏） ---------- */
.sun-moon-app :deep(.ok-topbar) {
  padding: 0 1.2rem;
  height: 3.4rem;
  font-size: 0.85rem;
  justify-content: space-between;
  background: rgba(11, 16, 32, 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 30;
}

.sun-moon-app :deep(.topbar-title) {
  font-size: 1.02rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
  opacity: 1;
}

/* ---------- 主容器 ---------- */
.shell {
  width: min(1040px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

/* ---------- 页头 ---------- */
.masthead {
  padding: 1.3rem 0 0.9rem;
  border-bottom: 1px solid var(--border);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent);
}

.lead {
  margin-top: 0.5rem;
  color: var(--text-muted);
  font-size: 0.92rem;
  line-height: 1.6;
  max-width: 62ch;
}

/* ---------- 控件栏 ---------- */
.control-bar {
  display: flex;
  gap: 0.7rem;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 1.1rem;
}

.search-wrap {
  position: relative;
  flex: 1 1 280px;
  min-width: 220px;
}

.city-input,
.date-input {
  font: inherit;
  width: 100%;
  height: 2.5rem;
  padding: 0 0.8rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.88rem;
  border-radius: 8px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.city-input::placeholder { color: var(--text-muted); }

.city-input:focus-visible,
.date-input:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
}

.date-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.date-wrap .date-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.date-input {
  width: auto;
  color-scheme: dark;
}

.fav-btn {
  height: 2.5rem;
  white-space: nowrap;
}

.fav-btn.is-saved {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--ok-accent-soft);
}

/* ---------- 搜索结果下拉 ---------- */
.search-results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 25;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  max-height: 320px;
  overflow-y: auto;
}

.sr-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  gap: 2px;
  padding: 0.55rem 0.8rem;
  background: transparent;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.sr-item:last-child { border-bottom: 0; }
.sr-item:hover { background: rgba(245, 158, 11, 0.10); }

.sr-name { font-size: 0.88rem; font-weight: 600; }
.sr-sub {
  font-family: var(--ok-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
}

.sr-empty {
  padding: 0.7rem 0.9rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* ---------- 当前城市信息 ---------- */
.current-city {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.6rem 1rem;
  margin-top: 1rem;
  padding: 0.9rem 1rem;
  background: linear-gradient(180deg, rgba(245, 158, 11, 0.06), rgba(245, 158, 11, 0));
  border: 1px solid var(--border);
  border-radius: 12px;
}

.cc-name {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
}

.cc-coords {
  font-family: var(--ok-mono);
  font-size: 0.78rem;
  color: var(--text-muted);
}

.cc-date {
  margin-left: auto;
  font-size: 0.82rem;
  color: var(--accent);
  font-weight: 500;
}

/* ---------- 收藏栏 ---------- */
.favorites-bar {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
  margin-top: 0.9rem;
}

.fav-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 600;
  color: var(--text-muted);
}

.fav-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  flex: 1;
}

.fav-empty {
  font-size: 0.78rem;
  color: var(--text-muted);
  font-style: italic;
}

.fav-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.28rem 0.6rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text);
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.fav-chip:hover {
  border-color: var(--accent);
  background: var(--ok-accent-soft);
}

.fav-chip-name { font-weight: 600; }

.fav-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 0.8rem;
  line-height: 1;
  color: var(--text-muted);
  cursor: pointer;
}

.fav-chip-remove:hover { color: #f87171; }

/* ---------- 卡片通用 ---------- */
.card {
  position: relative;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0)),
    var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--ok-radius);
  padding: 1.25rem;
  box-shadow: var(--ok-shadow);
  overflow: hidden;
}

.card-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  font-weight: 600;
  margin-bottom: 0.9rem;
}

/* ---------- 时间轴 ---------- */
.timeline-card { margin-top: 1rem; }

.timeline {
  padding: 0 30px;
}

.tl-stage {
  position: relative;
  height: 130px;
}

.tl-track {
  position: absolute;
  top: 44px;
  left: 0;
  right: 0;
  height: 40px;
  border-radius: 10px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.06),
    0 6px 24px rgba(0, 0, 0, 0.45);
}

.tl-tick {
  position: absolute;
  top: 0;
  height: 100%;
  width: 1px;
  background: rgba(255, 255, 255, 0.14);
  transform: translateX(-50%);
}

/* 事件标记（线 + 点 + 标签），上下交错 */
.tl-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
}

.tl-marker-line {
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 24px;
  width: 1px;
  background: rgba(255, 255, 255, 0.22);
  transform: translateX(-50%);
}

.tl-marker-dot {
  position: absolute;
  left: 0;
  top: 64px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #eef2ff;
  box-shadow: 0 0 8px rgba(238, 242, 255, 0.7);
  transform: translate(-50%, -50%);
}

.tl-marker-dot.phase-sunrise,
.tl-marker-dot.phase-sunset {
  background: var(--accent-2);
  box-shadow: 0 0 12px rgba(251, 146, 60, 0.85);
}

.tl-marker-dot.phase-day {
  background: var(--accent-3);
  box-shadow: 0 0 12px rgba(252, 211, 77, 0.9);
}

.tl-marker-dot.phase-civil {
  background: var(--accent);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.7);
}

.tl-marker-dot.phase-nautical {
  background: var(--indigo);
  box-shadow: 0 0 8px rgba(99, 102, 241, 0.7);
}

.tl-marker-dot.phase-astro {
  background: #818cf8;
  box-shadow: 0 0 8px rgba(129, 140, 248, 0.6);
}

.tl-marker-label {
  position: absolute;
  left: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.2;
  white-space: nowrap;
}

.tl-marker.above .tl-marker-label { top: 0; }
.tl-marker.below .tl-marker-label { bottom: 0; }

.tl-name {
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--text);
}

.tl-time {
  font-family: var(--ok-mono);
  font-size: 0.62rem;
  color: var(--accent);
}

/* 当前时刻线 */
.tl-now {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  z-index: 2;
}

.tl-now-line {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #fff;
  box-shadow: 0 0 8px #fff;
  transform: translateX(-50%);
}

.tl-now-label {
  position: absolute;
  left: 0;
  top: -4px;
  transform: translateX(-50%);
  font-size: 0.58rem;
  font-family: var(--ok-mono);
  color: #0b1020;
  background: #fff;
  padding: 1px 5px;
  border-radius: 4px;
  white-space: nowrap;
}

/* 小时刻度行 */
.tl-hours {
  position: relative;
  height: 20px;
  margin-top: 6px;
}

.tl-hour {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  font-family: var(--ok-mono);
  font-size: 0.66rem;
  color: var(--text-muted);
}

/* 图例 */
.tl-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 1rem;
  margin-top: 1rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--border);
}

.tl-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.tl-legend-swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}

/* ---------- 信息卡片网格 ---------- */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.info-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--accent);
}

.info-card.is-sun::before { background: linear-gradient(90deg, var(--accent-2), var(--accent-3)); }
.info-card.is-civil::before { background: linear-gradient(90deg, var(--accent-2), var(--accent)); }
.info-card.is-nautical::before { background: linear-gradient(90deg, var(--indigo-deep), var(--indigo)); }
.info-card.is-astro::before { background: linear-gradient(90deg, #1e1b4b, var(--indigo-deep)); }

.info-rows {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.06);
}

.info-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.info-row.highlight {
  margin-top: 0.2rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border);
  border-bottom: 0;
}

.ir-label {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.info-row.highlight .ir-label {
  color: var(--text);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.7rem;
}

.ir-value {
  font-family: var(--ok-mono);
  font-weight: 600;
  font-size: 1rem;
  color: var(--text);
}

.info-card.is-sun .ir-value { color: var(--accent-3); }
.info-row.highlight .ir-value { color: var(--accent); font-size: 1.05rem; }

/* ---------- 加载与错误（沿用 shared，微调） ---------- */
.ok-loading { padding: 1.6rem 0.5rem; }

.ok-error { margin-top: 1rem; }

/* ---------- 响应式 ---------- */
@media (max-width: 720px) {
  .timeline { padding: 0 18px; }
  .tl-name { font-size: 0.58rem; }
  .tl-time { font-size: 0.58rem; }
  .cc-date { margin-left: 0; width: 100%; }
  .ir-value { font-size: 0.92rem; }
}

@media (max-width: 480px) {
  .tl-marker-dot { width: 9px; height: 9px; }
  .tl-name { display: none; }
  .tl-time { font-size: 0.6rem; }
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
</style>
