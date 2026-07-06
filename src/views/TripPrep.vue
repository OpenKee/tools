<script setup>
/* ============================================================
   Trip Prep — 旅行准备台
   7 个 API 围绕"出行准备"场景协作：地理编码（入口）→ 国家百科 +
   天气/7天预报/日出日落 + 空气质量 + 汇率 + 时区时差 + 地震。
   坐标驱动，Promise.allSettled 并发，单卡失败不阻断其他。
   ============================================================ */

import { ref, computed, onMounted } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, geocode, haversineKm, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- 文案字典（中英双语） ---------- */
const copy = {
  en: {
    eyebrow: 'One-stop pre-trip briefing',
    title: 'Trip Prep',
    lead: 'Enter a destination and see country, weather, air, exchange, time zone and nearby quakes at a glance.',
    placeholder: 'Destination city, e.g. Tokyo',
    search: 'Search',
    myLocation: 'Use my location',
    locating: 'Locating…',
    candidates: 'Did you mean?',
    notFound: 'No matching city found.',
    geoFail: 'Geocoding failed. Please try again.',
    geoUnsupported: 'Geolocation is not supported by this browser.',
    geoDenied: 'Location permission denied or unavailable.',
    loading: 'Loading…',
    cardFail: 'Failed to load this data.',
    locationMode: 'Location mode',
    noData: 'No data',
    sameTz: 'Same as your time zone',
    faster: 'Ahead of you by {n} h',
    slower: 'Behind you by {n} h',
    sunrise: 'Sunrise',
    sunset: 'Sunset',
    countryCard: 'COUNTRY',
    capital: 'Capital',
    population: 'Population',
    languages: 'Languages',
    region: 'Region',
    borders: 'Neighbours',
    weatherCard: 'WEATHER',
    feels: 'Feels',
    humidity: 'Humidity',
    wind: 'Wind',
    precip: 'Precip',
    exchangeCard: 'EXCHANGE',
    usdRate: '1 USD =',
    cnyRate: '100 CNY =',
    currencyNA: 'Currency unavailable in location mode',
    tzCard: 'TIME ZONE',
    localTime: 'Local time',
    airCard: 'AIR QUALITY',
    pm25: 'PM2.5',
    pm10: 'PM10',
    ozone: 'O₃',
    no2: 'NO₂',
    quakeCard: 'EARTHQUAKES',
    quakeEmpty: 'No significant earthquakes nearby in the past 30 days.',
    km: 'km',
    startHint: 'Search a destination to begin.',
  },
  zh: {
    eyebrow: '一站式出行前简报',
    title: '旅行准备台',
    lead: '输入目的地，一屏聚合展示国家、天气、空气、汇率、时差与周边地震。',
    placeholder: '目的地城市，如 东京',
    search: '查询',
    myLocation: '使用我的位置',
    locating: '定位中…',
    candidates: '您是指？',
    notFound: '未找到匹配的城市。',
    geoFail: '地理编码失败，请重试。',
    geoUnsupported: '当前浏览器不支持定位。',
    geoDenied: '定位权限被拒绝或不可用。',
    loading: '加载中…',
    cardFail: '该数据获取失败。',
    locationMode: '定位模式',
    noData: '暂无数据',
    sameTz: '与您同时区',
    faster: '比您快 {n} 小时',
    slower: '比您慢 {n} 小时',
    sunrise: '日出',
    sunset: '日落',
    countryCard: '国家',
    capital: '首都',
    population: '人口',
    languages: '官方语言',
    region: '所在区域',
    borders: '邻国数',
    weatherCard: '天气',
    feels: '体感',
    humidity: '湿度',
    wind: '风速',
    precip: '降水',
    exchangeCard: '汇率',
    usdRate: '1 USD =',
    cnyRate: '100 CNY =',
    currencyNA: '定位模式下无法确定货币',
    tzCard: '时差',
    localTime: '当地时间',
    airCard: '空气质量',
    pm25: 'PM2.5',
    pm10: 'PM10',
    ozone: 'O₃',
    no2: 'NO₂',
    quakeCard: '地震',
    quakeEmpty: '近 30 天周边无显著地震。',
    km: '公里',
    startHint: '搜索一个目的地开始。',
  },
}
const t = useT(copy)

/* ---------- 响应式状态 ---------- */
const input = ref('')
const candidates = ref([])
const selected = ref(null)
const locating = ref(false)
const geoError = ref('')

const cards = ref({
  country: { loading: false, error: '', data: null },
  weather: { loading: false, error: '', data: null },
  air: { loading: false, error: '', data: null },
  exchange: { loading: false, error: '', data: null },
  earthquake: { loading: false, error: '', data: null },
})

/* ---------- 静态国家列表缓存（world-countries） ---------- */
let countriesCache = null
async function loadCountries() {
  if (countriesCache) return countriesCache
  countriesCache = await fetchJSON('https://cdn.jsdelivr.net/npm/world-countries@5.1.0/countries.json')
  return countriesCache
}

/* ---------- WMO 天气代码映射（符号为 Unicode 字符，非 emoji） ---------- */
function wmo(code) {
  const m = {
    0: { en: 'Clear sky', zh: '晴', sym: '☀' },
    1: { en: 'Mainly clear', zh: '大致晴朗', sym: '☀' },
    2: { en: 'Partly cloudy', zh: '局部多云', sym: '☁' },
    3: { en: 'Overcast', zh: '阴', sym: '☁' },
    45: { en: 'Fog', zh: '雾', sym: '☁' },
    48: { en: 'Rime fog', zh: '冰雾', sym: '☁' },
    51: { en: 'Light drizzle', zh: '小毛毛雨', sym: '☂' },
    53: { en: 'Drizzle', zh: '毛毛雨', sym: '☂' },
    55: { en: 'Heavy drizzle', zh: '大毛毛雨', sym: '☂' },
    56: { en: 'Freezing drizzle', zh: '冻毛毛雨', sym: '☂' },
    57: { en: 'Freezing drizzle', zh: '冻雨', sym: '☂' },
    61: { en: 'Light rain', zh: '小雨', sym: '☂' },
    63: { en: 'Rain', zh: '雨', sym: '☂' },
    65: { en: 'Heavy rain', zh: '大雨', sym: '☂' },
    66: { en: 'Freezing rain', zh: '冻雨', sym: '☂' },
    67: { en: 'Freezing rain', zh: '冻雨', sym: '☂' },
    71: { en: 'Light snow', zh: '小雪', sym: '❄' },
    73: { en: 'Snow', zh: '雪', sym: '❄' },
    75: { en: 'Heavy snow', zh: '大雪', sym: '❄' },
    77: { en: 'Snow grains', zh: '米雪', sym: '❄' },
    80: { en: 'Light showers', zh: '小阵雨', sym: '☂' },
    81: { en: 'Showers', zh: '阵雨', sym: '☂' },
    82: { en: 'Violent showers', zh: '强阵雨', sym: '☂' },
    85: { en: 'Snow showers', zh: '阵雪', sym: '❄' },
    86: { en: 'Heavy snow showers', zh: '强阵雪', sym: '❄' },
    95: { en: 'Thunderstorm', zh: '雷暴', sym: '⚡' },
    96: { en: 'Thunderstorm + hail', zh: '雷暴伴冰雹', sym: '⚡' },
    99: { en: 'Severe thunderstorm + hail', zh: '强雷暴伴冰雹', sym: '⚡' },
  }
  return m[code] || { en: '—', zh: '—', sym: '·' }
}

/* ---------- AQI 等级 ---------- */
function aqiLevel(v) {
  if (v == null) return null
  if (v <= 50) return { en: 'Good', zh: '好', cls: 'good' }
  if (v <= 100) return { en: 'Moderate', zh: '中等', cls: 'moderate' }
  if (v <= 150) return { en: 'Unhealthy (sensitive)', zh: '敏感人群不良', cls: 'unhealthy' }
  if (v <= 200) return { en: 'Unhealthy', zh: '差', cls: 'unhealthy' }
  if (v <= 300) return { en: 'Very unhealthy', zh: '很差', cls: 'very' }
  return { en: 'Hazardous', zh: '危险', cls: 'hazard' }
}

/* ---------- 格式化工具 ---------- */
function formatNum(v, digits) {
  if (v == null || isNaN(v)) return '—'
  const d = digits || 0
  return Number(v).toLocaleString(locale(), { maximumFractionDigits: d, minimumFractionDigits: d })
}
function formatPop(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString(locale())
}
function formatTime(iso, tz) {
  if (!iso) return '—'
  const opts = { hour: '2-digit', minute: '2-digit', hour12: false }
  if (tz) opts.timeZone = tz
  return new Intl.DateTimeFormat('en-US', opts).format(new Date(iso))
}
function formatDateTime(ts, tz) {
  if (!ts) return '—'
  const opts = { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }
  if (tz) opts.timeZone = tz
  return new Intl.DateTimeFormat(locale(), opts).format(new Date(ts))
}

/* ---------- 搜索 / 候选 / 定位 ---------- */
function resetCards() {
  Object.keys(cards.value).forEach((k) => {
    cards.value[k] = { loading: false, error: '', data: null }
  })
}

async function search() {
  const name = input.value.trim()
  if (!name) return
  geoError.value = ''
  candidates.value = []
  selected.value = null
  resetCards()
  try {
    const results = await geocode(name, { count: 6 })
    if (!results.length) {
      geoError.value = t.value('notFound')
      return
    }
    if (results.length === 1) {
      selectCity(results[0])
    } else {
      candidates.value = results
    }
  } catch (e) {
    geoError.value = t.value('geoFail')
  }
}

function selectCity(c) {
  candidates.value = []
  selected.value = c
  loadAll(c)
}

function useMyLocation() {
  if (!navigator.geolocation) {
    geoError.value = t.value('geoUnsupported')
    return
  }
  locating.value = true
  geoError.value = ''
  candidates.value = []
  selected.value = null
  resetCards()
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locating.value = false
      const c = {
        name: t.value('myLocation'),
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        country: '',
        countryCode: '',
        admin1: '',
        timezone: '',
        locationMode: true,
      }
      selected.value = c
      loadAll(c)
    },
    () => {
      locating.value = false
      geoError.value = t.value('geoDenied')
    },
    { timeout: 10000, enableHighAccuracy: false }
  )
}

/* ---------- 各 API 加载器 ---------- */
async function loadCountry(city) {
  if (city.locationMode) return { locationMode: true }
  const list = await loadCountries()
  return list.find((x) => x.cca2 === city.countryCode) || null
}
async function loadWeather(city) {
  const url =
    'https://api.open-meteo.com/v1/forecast?latitude=' + city.lat +
    '&longitude=' + city.lon +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max' +
    '&timezone=auto&forecast_days=7'
  return await fetchJSON(url)
}
async function loadAir(city) {
  const url =
    'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + city.lat +
    '&longitude=' + city.lon +
    '&current=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide&timezone=auto'
  const d = await fetchJSON(url)
  return d.current || null
}
async function loadExchange() {
  const d = await fetchJSON('https://open.er-api.com/v6/latest/USD')
  return d.rates || null
}
async function loadEarthquake(city) {
  const now = new Date()
  const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
  const url =
    'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
    '&starttime=' + start.toISOString() +
    '&endtime=' + now.toISOString() +
    '&latitude=' + city.lat + '&longitude=' + city.lon +
    '&maxradiuskm=1000&minmagnitude=4&limit=20&orderby=time'
  const d = await fetchJSON(url)
  return (d.features || []).map((f) => {
    const c = f.geometry.coordinates
    return {
      time: f.properties.time,
      mag: f.properties.mag,
      place: f.properties.place || '',
      distance: haversineKm(city.lat, city.lon, c[1], c[0]),
    }
  })
}

/* ---------- 并发加载（Promise.allSettled，单卡失败不影响其他） ---------- */
async function loadAll(city) {
  const tasks = [
    { key: 'country', fn: () => loadCountry(city) },
    { key: 'weather', fn: () => loadWeather(city) },
    { key: 'air', fn: () => loadAir(city) },
    { key: 'exchange', fn: () => loadExchange() },
    { key: 'earthquake', fn: () => loadEarthquake(city) },
  ]
  tasks.forEach((tk) => {
    cards.value[tk.key].loading = true
    cards.value[tk.key].error = ''
    cards.value[tk.key].data = null
  })
  const results = await Promise.allSettled(tasks.map((tk) => tk.fn()))
  results.forEach((r, i) => {
    const key = tasks[i].key
    cards.value[key].loading = false
    if (r.status === 'fulfilled') {
      cards.value[key].data = r.value
    } else {
      cards.value[key].error = t.value('cardFail')
    }
  })
}

/* ---------- 派生：选城市元信息 ---------- */
const cityMeta = computed(() => {
  const c = selected.value
  if (!c) return ''
  const parts = []
  if (c.admin1) parts.push(c.admin1)
  if (c.country) parts.push(c.country)
  if (c.timezone) parts.push(c.timezone)
  return parts.join(' · ')
})

/* ---------- 派生：国家展示 ---------- */
const countryData = computed(() => cards.value.country.data)
const countryName = computed(() => {
  if (selected.value && selected.value.country) return selected.value.country
  const d = countryData.value
  return d && d.name ? d.name.common : ''
})
const languageList = computed(() => {
  const d = countryData.value
  if (!d || !d.languages) return '—'
  return Object.values(d.languages).join(', ')
})

/* ---------- 派生：天气展示 ---------- */
const weatherCurrent = computed(() => {
  const d = cards.value.weather.data
  return d && d.current ? d.current : null
})
const weatherDaily = computed(() => {
  const d = cards.value.weather.data
  return d && d.daily ? d.daily : null
})
const dailyForecast = computed(() => {
  const d = weatherDaily.value
  if (!d || !d.time) return []
  return d.time.map((t, i) => ({
    weekday: new Date(t + 'T00:00:00').toLocaleDateString(locale(), { weekday: 'short' }),
    max: d.temperature_2m_max[i],
    min: d.temperature_2m_min[i],
    code: d.weather_code[i],
  }))
})
const sunTimes = computed(() => {
  const d = weatherDaily.value
  if (!d || !d.sunrise || !d.sunrise.length) return null
  return { sunrise: d.sunrise[0], sunset: d.sunset[0] }
})

/* ---------- 派生：汇率展示（依赖国家货币代码 + USD 汇率表） ---------- */
const countryCurrency = computed(() => {
  const d = countryData.value
  if (!d || d.locationMode || !d.currencies) return null
  const code = Object.keys(d.currencies)[0]
  if (!code) return null
  return { code, name: d.currencies[code].name, symbol: d.currencies[code].symbol }
})
const exchangeInfo = computed(() => {
  const cur = countryCurrency.value
  const rates = cards.value.exchange.data
  if (!cur || !rates) return null
  const rate = rates[cur.code]
  if (rate == null) return null
  const cny = rates.CNY
  const cny100 = cny ? (100 * rate) / cny : null
  return { usdToLocal: rate, cny100ToLocal: cny100, code: cur.code, name: cur.name, symbol: cur.symbol }
})

/* ---------- 派生：时区 / 时差（Intl 计算，无独立 API） ---------- */
const tz = computed(() => {
  if (selected.value && selected.value.timezone) return selected.value.timezone
  return (cards.value.weather.data && cards.value.weather.data.timezone) || ''
})
const localTimeStr = computed(() => {
  const z = tz.value
  if (!z) return ''
  return new Intl.DateTimeFormat('en-US', { timeZone: z, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
})
const tzDiff = computed(() => {
  const z = tz.value
  if (!z) return null
  const now = new Date()
  const destH = Number(new Intl.DateTimeFormat('en-US', { timeZone: z, hour: 'numeric', hour12: false }).format(now))
  const userH = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false }).format(now))
  let diff = destH - userH
  if (diff > 12) diff -= 24
  if (diff < -12) diff += 24
  return diff
})
const tzDiffLabel = computed(() => {
  const d = tzDiff.value
  if (d == null) return ''
  if (d === 0) return t.value('sameTz')
  if (d > 0) return t.value('faster').replace('{n}', d)
  return t.value('slower').replace('{n}', Math.abs(d))
})

/* ---------- 派生：空气质量 / 地震 ---------- */
const airCurrent = computed(() => cards.value.air.data || null)
const airLevel = computed(() => aqiLevel(airCurrent.value && airCurrent.value.us_aqi))
const quakeList = computed(() => cards.value.earthquake.data || [])

/* ---------- 生命周期：默认载入东京演示融合效果 ---------- */
onMounted(() => {
  input.value = 'Tokyo'
  search()
})
</script>

<template>
  <div class="trip-prep">
    <AppHeader :title="{ en: 'Trip Prep', zh: '旅行准备台' }" :show-lang-toggle="true" />

    <main class="shell">
      <!-- 页头 -->
      <header class="masthead">
        <p class="eyebrow">{{ t('eyebrow') }}</p>
        <h1>{{ t('title') }}</h1>
        <p class="lead">{{ t('lead') }}</p>
      </header>

      <!-- 搜索区 -->
      <section class="search-bar">
        <input
          v-model="input"
          type="text"
          class="city-input"
          :placeholder="t('placeholder')"
          :disabled="locating"
          @keydown.enter="search"
        />
        <button type="button" class="btn primary" :disabled="locating" @click="search">{{ t('search') }}</button>
        <button type="button" class="btn ghost" :disabled="locating" @click="useMyLocation">{{ t('myLocation') }}</button>
      </section>

      <!-- 地理编码错误 -->
      <p v-if="geoError" class="geo-error">{{ geoError }}</p>

      <!-- 定位中 -->
      <p v-if="locating" class="hint-line"><span class="spinner"></span>{{ t('locating') }}</p>

      <!-- 多候选选择 -->
      <section v-if="candidates.length > 1" class="candidates">
        <p class="cand-title">{{ t('candidates') }}</p>
        <div class="cand-list">
          <button
            v-for="(c, i) in candidates"
            :key="i"
            type="button"
            class="cand-item"
            @click="selectCity(c)"
          >
            <span class="cand-name">{{ c.name }}</span>
            <span class="cand-sub">{{ [c.admin1, c.country].filter(Boolean).join(', ') }}</span>
            <span class="cand-tz">{{ c.timezone }}</span>
          </button>
        </div>
      </section>

      <!-- 选定城市横幅 -->
      <section v-if="selected" class="city-banner">
        <span class="city-name">{{ selected.name }}</span>
        <span class="city-meta">{{ cityMeta }}</span>
        <span class="city-coord">{{ formatNum(selected.lat, 2) }}°, {{ formatNum(selected.lon, 2) }}°</span>
      </section>

      <!-- 空状态提示 -->
      <p v-if="!selected && !candidates.length && !locating && !geoError" class="hint-line">{{ t('startHint') }}</p>

      <!-- 结果卡片网格 -->
      <section v-if="selected" class="card-grid">
        <!-- 国家卡片 -->
        <article class="card">
          <h2 class="card-title">{{ t('countryCard') }}</h2>
          <div v-if="cards.country.loading" class="card-state"><span class="spinner"></span>{{ t('loading') }}</div>
          <div v-else-if="cards.country.error" class="card-state error">{{ cards.country.error }}</div>
          <div v-else-if="countryData && countryData.locationMode" class="card-state muted">{{ t('locationMode') }}</div>
          <div v-else-if="countryData" class="card-body">
            <div class="country-head">
              <span class="flag">{{ countryData.flag }}</span>
              <span class="country-name">{{ countryName }}</span>
            </div>
            <dl class="kv">
              <dt>{{ t('capital') }}</dt><dd>{{ countryData.capital && countryData.capital[0] ? countryData.capital[0] : '—' }}</dd>
              <dt>{{ t('population') }}</dt><dd>{{ formatPop(countryData.population) }}</dd>
              <dt>{{ t('languages') }}</dt><dd>{{ languageList }}</dd>
              <dt>{{ t('region') }}</dt><dd>{{ countryData.region }}<span v-if="countryData.subregion"> · {{ countryData.subregion }}</span></dd>
              <dt>{{ t('borders') }}</dt><dd>{{ countryData.borders ? countryData.borders.length : 0 }}</dd>
            </dl>
          </div>
          <div v-else class="card-state muted">{{ t('noData') }}</div>
        </article>

        <!-- 天气卡片 -->
        <article class="card">
          <h2 class="card-title">{{ t('weatherCard') }}</h2>
          <div v-if="cards.weather.loading" class="card-state"><span class="spinner"></span>{{ t('loading') }}</div>
          <div v-else-if="cards.weather.error" class="card-state error">{{ cards.weather.error }}</div>
          <div v-else-if="weatherCurrent" class="card-body">
            <div class="weather-head">
              <span class="weather-sym">{{ wmo(weatherCurrent.weather_code).sym }}</span>
              <span class="weather-temp">{{ formatNum(weatherCurrent.temperature_2m, 0) }}°</span>
              <span class="weather-desc">{{ wmo(weatherCurrent.weather_code)[i18nState.lang] }}</span>
            </div>
            <dl class="kv">
              <dt>{{ t('feels') }}</dt><dd>{{ formatNum(weatherCurrent.apparent_temperature, 0) }}°</dd>
              <dt>{{ t('humidity') }}</dt><dd>{{ formatNum(weatherCurrent.relative_humidity_2m, 0) }}%</dd>
              <dt>{{ t('wind') }}</dt><dd>{{ formatNum(weatherCurrent.wind_speed_10m, 0) }} km/h</dd>
              <dt>{{ t('precip') }}</dt><dd>{{ formatNum(weatherCurrent.precipitation, 1) }} mm</dd>
            </dl>
            <div v-if="dailyForecast.length" class="forecast">
              <div v-for="(d, i) in dailyForecast" :key="i" class="fc-day">
                <span class="fc-wd">{{ d.weekday }}</span>
                <span class="fc-sym">{{ wmo(d.code).sym }}</span>
                <span class="fc-max">{{ formatNum(d.max, 0) }}°</span>
                <span class="fc-min">{{ formatNum(d.min, 0) }}°</span>
              </div>
            </div>
          </div>
          <div v-else class="card-state muted">{{ t('noData') }}</div>
        </article>

        <!-- 汇率卡片 -->
        <article class="card">
          <h2 class="card-title">{{ t('exchangeCard') }}</h2>
          <div v-if="cards.exchange.loading" class="card-state"><span class="spinner"></span>{{ t('loading') }}</div>
          <div v-else-if="cards.exchange.error" class="card-state error">{{ cards.exchange.error }}</div>
          <div v-else-if="exchangeInfo" class="card-body">
            <div class="rate-row big">
              <span class="rate-label">{{ t('usdRate') }}</span>
              <span class="rate-value">{{ formatNum(exchangeInfo.usdToLocal, 2) }} {{ exchangeInfo.code }}</span>
            </div>
            <div class="rate-row">
              <span class="rate-label">{{ t('cnyRate') }}</span>
              <span class="rate-value">{{ formatNum(exchangeInfo.cny100ToLocal, 2) }} {{ exchangeInfo.code }}</span>
            </div>
            <p class="rate-meta">{{ exchangeInfo.symbol }} {{ exchangeInfo.name }} ({{ exchangeInfo.code }})</p>
          </div>
          <div v-else-if="selected && selected.locationMode" class="card-state muted">{{ t('currencyNA') }}</div>
          <div v-else class="card-state muted">{{ t('noData') }}</div>
        </article>

        <!-- 时差卡片 -->
        <article class="card">
          <h2 class="card-title">{{ t('tzCard') }}</h2>
          <div v-if="cards.weather.loading && !tz" class="card-state"><span class="spinner"></span>{{ t('loading') }}</div>
          <div v-else-if="!tz" class="card-state muted">{{ t('noData') }}</div>
          <div v-else class="card-body">
            <div class="tz-head">
              <span class="tz-time">{{ localTimeStr }}</span>
              <span class="tz-name">{{ tz }}</span>
            </div>
            <p class="tz-diff">{{ tzDiffLabel }}</p>
            <dl class="kv">
              <dt>{{ t('sunrise') }}</dt><dd>{{ formatTime(sunTimes ? sunTimes.sunrise : null, tz) }}</dd>
              <dt>{{ t('sunset') }}</dt><dd>{{ formatTime(sunTimes ? sunTimes.sunset : null, tz) }}</dd>
            </dl>
          </div>
        </article>

        <!-- 空气质量卡片 -->
        <article class="card">
          <h2 class="card-title">{{ t('airCard') }}</h2>
          <div v-if="cards.air.loading" class="card-state"><span class="spinner"></span>{{ t('loading') }}</div>
          <div v-else-if="cards.air.error" class="card-state error">{{ cards.air.error }}</div>
          <div v-else-if="airCurrent" class="card-body">
            <div class="aqi-head">
              <span class="aqi-value" :class="airLevel ? airLevel.cls : ''">{{ formatNum(airCurrent.us_aqi, 0) }}</span>
              <span class="aqi-level" :class="airLevel ? airLevel.cls : ''">{{ airLevel ? airLevel[i18nState.lang] : '—' }}</span>
            </div>
            <dl class="kv">
              <dt>{{ t('pm25') }}</dt><dd>{{ formatNum(airCurrent.pm2_5, 1) }} µg/m³</dd>
              <dt>{{ t('pm10') }}</dt><dd>{{ formatNum(airCurrent.pm10, 1) }} µg/m³</dd>
              <dt>{{ t('ozone') }}</dt><dd>{{ formatNum(airCurrent.ozone, 1) }} µg/m³</dd>
              <dt>{{ t('no2') }}</dt><dd>{{ formatNum(airCurrent.nitrogen_dioxide, 1) }} µg/m³</dd>
            </dl>
          </div>
          <div v-else class="card-state muted">{{ t('noData') }}</div>
        </article>

        <!-- 地震卡片 -->
        <article class="card">
          <h2 class="card-title">{{ t('quakeCard') }}</h2>
          <div v-if="cards.earthquake.loading" class="card-state"><span class="spinner"></span>{{ t('loading') }}</div>
          <div v-else-if="cards.earthquake.error" class="card-state error">{{ cards.earthquake.error }}</div>
          <div v-else-if="quakeList.length" class="card-body quake-body">
            <div v-for="(q, i) in quakeList" :key="i" class="quake-item">
              <span class="q-mag" :class="q.mag >= 5 ? 'hi' : 'md'">M{{ formatNum(q.mag, 1) }}</span>
              <div class="q-info">
                <span class="q-place">{{ q.place || '—' }}</span>
                <span class="q-time">{{ formatDateTime(q.time, tz) }}</span>
              </div>
              <span class="q-dist">{{ formatNum(q.distance, 0) }} {{ t('km') }}</span>
            </div>
          </div>
          <div v-else class="card-state muted">{{ t('quakeEmpty') }}</div>
        </article>
      </section>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
.trip-prep {
  min-height: 100vh;
  background: var(--ok-bg);
  color: var(--ok-text);
  font-family: var(--ok-font);
}

.shell {
  width: min(1200px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1rem 0 2.5rem;
}

/* ---------- masthead ---------- */
.masthead {
  padding: 0.6rem 0 1.2rem;
  border-bottom: 1px solid var(--ok-line);
}
.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--ok-accent);
}
.masthead h1 {
  margin-top: 0.3rem;
  font-size: clamp(1.8rem, 4.5vw, 2.8rem);
  line-height: 1;
  letter-spacing: -0.03em;
  font-weight: 800;
}
.lead {
  margin-top: 0.5rem;
  color: var(--ok-muted);
  font-size: 0.9rem;
  max-width: 60ch;
  line-height: 1.6;
}

/* ---------- search bar ---------- */
.search-bar {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}
.city-input {
  flex: 1;
  min-width: 200px;
  height: 2.4rem;
  padding: 0 0.7rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-sm);
  background: var(--ok-panel);
  color: var(--ok-text);
  font: inherit;
  font-size: 0.9rem;
}
.city-input:focus {
  outline: 2px solid var(--ok-accent);
  outline-offset: -1px;
  border-color: var(--ok-accent);
}
.btn {
  height: 2.4rem;
  padding: 0 0.9rem;
  font: inherit;
  font-size: 0.85rem;
  border-radius: var(--ok-radius-sm);
  cursor: pointer;
  border: 1px solid var(--ok-line);
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn.primary {
  background: var(--ok-accent);
  border-color: var(--ok-accent);
  color: #fff;
  font-weight: 600;
}
.btn.primary:hover:not(:disabled) {
  filter: brightness(1.06);
}
.btn.ghost {
  background: transparent;
  color: var(--ok-text);
}
.btn.ghost:hover:not(:disabled) {
  border-color: var(--ok-accent);
  color: var(--ok-accent);
}

/* ---------- hints / errors ---------- */
.geo-error {
  margin-top: 0.8rem;
  color: var(--ok-down);
  background: var(--ok-down-bg);
  border: 1px solid rgba(220, 38, 38, 0.2);
  padding: 0.55rem 0.7rem;
  border-radius: var(--ok-radius-sm);
  font-size: 0.85rem;
}
.hint-line {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 1.2rem;
  color: var(--ok-muted);
  font-size: 0.88rem;
}
.spinner {
  width: 0.95rem;
  height: 0.95rem;
  border: 2px solid var(--ok-line);
  border-top-color: var(--ok-accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ---------- candidates ---------- */
.candidates {
  margin-top: 1rem;
  background: var(--ok-panel);
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius);
  padding: 0.8rem;
}
.cand-title {
  font-size: 0.78rem;
  color: var(--ok-muted);
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.cand-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.5rem;
}
.cand-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  text-align: left;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-sm);
  background: var(--ok-bg);
  cursor: pointer;
  font: inherit;
  transition: border-color 0.15s, background 0.15s;
}
.cand-item:hover {
  border-color: var(--ok-accent);
  background: var(--ok-accent-soft);
}
.cand-name { font-weight: 700; font-size: 0.9rem; color: var(--ok-text); }
.cand-sub { font-size: 0.78rem; color: var(--ok-muted); }
.cand-tz { font-size: 0.72rem; color: var(--ok-muted); font-family: var(--ok-mono); }

/* ---------- city banner ---------- */
.city-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.6rem;
  margin-top: 1rem;
  padding: 0.7rem 0.9rem;
  background: var(--ok-accent-soft);
  border: 1px solid var(--ok-line);
  border-left: 3px solid var(--ok-accent);
  border-radius: var(--ok-radius-sm);
}
.city-banner .city-name {
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.city-banner .city-meta { font-size: 0.82rem; color: var(--ok-muted); }
.city-banner .city-coord {
  margin-left: auto;
  font-family: var(--ok-mono);
  font-size: 0.75rem;
  color: var(--ok-muted);
}

/* ---------- card grid ---------- */
.card-grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}
.card {
  background: var(--ok-panel);
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.card-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ok-accent);
  margin-bottom: 0.7rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--ok-line);
}
.card-state {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--ok-muted);
  font-size: 0.85rem;
  padding: 0.5rem 0;
}
.card-state.error { color: var(--ok-down); }
.card-state.muted { color: var(--ok-muted); }
.card-body { display: flex; flex-direction: column; gap: 0.6rem; }

/* ---------- key-value list ---------- */
.kv {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25rem 0.8rem;
  margin: 0;
  font-size: 0.82rem;
}
.kv dt { color: var(--ok-muted); font-weight: 500; }
.kv dd { margin: 0; color: var(--ok-text); font-weight: 600; text-align: right; }

/* ---------- country card ---------- */
.country-head { display: flex; align-items: center; gap: 0.6rem; }
.flag { font-size: 2rem; line-height: 1; }
.country-name { font-size: 1.1rem; font-weight: 800; letter-spacing: -0.01em; }

/* ---------- weather card ---------- */
.weather-head { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; }
.weather-sym { font-size: 1.6rem; line-height: 1; }
.weather-temp { font-size: 2rem; font-weight: 800; letter-spacing: -0.03em; }
.weather-desc { font-size: 0.9rem; color: var(--ok-muted); }
.forecast {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.2rem;
  margin-top: 0.2rem;
}
.fc-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.35rem 0.1rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-sm);
  font-size: 0.66rem;
}
.fc-wd { color: var(--ok-muted); font-weight: 600; }
.fc-sym { font-size: 0.9rem; line-height: 1; }
.fc-max { font-weight: 700; color: var(--ok-text); }
.fc-min { color: var(--ok-muted); }

/* ---------- exchange card ---------- */
.rate-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.3rem 0;
  border-bottom: 1px dashed var(--ok-line);
}
.rate-row.big { border-bottom: none; }
.rate-label { font-size: 0.78rem; color: var(--ok-muted); }
.rate-value { font-family: var(--ok-mono); font-weight: 700; font-size: 0.95rem; }
.rate-row.big .rate-value { font-size: 1.2rem; }
.rate-meta { font-size: 0.78rem; color: var(--ok-muted); margin: 0.1rem 0 0; }

/* ---------- timezone card ---------- */
.tz-head { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; }
.tz-time {
  font-family: var(--ok-mono);
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.tz-name { font-size: 0.8rem; color: var(--ok-muted); font-family: var(--ok-mono); }
.tz-diff {
  font-size: 0.88rem;
  color: var(--ok-accent);
  font-weight: 600;
  margin: 0;
}

/* ---------- air quality card ---------- */
.aqi-head { display: flex; align-items: baseline; gap: 0.7rem; flex-wrap: wrap; }
.aqi-value {
  font-family: var(--ok-mono);
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
}
.aqi-level {
  font-size: 0.85rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: var(--ok-radius-sm);
  border: 1px solid var(--ok-line);
}
.aqi-value.good, .aqi-level.good { color: #16a34a; border-color: #16a34a; }
.aqi-value.moderate, .aqi-level.moderate { color: #ca8a04; border-color: #ca8a04; }
.aqi-value.unhealthy, .aqi-level.unhealthy { color: #ea580c; border-color: #ea580c; }
.aqi-value.very, .aqi-level.very { color: #dc2626; border-color: #dc2626; }
.aqi-value.hazard, .aqi-level.hazard { color: #7c3aed; border-color: #7c3aed; }

/* ---------- earthquake card ---------- */
.quake-body { gap: 0.2rem; }
.quake-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--ok-line);
}
.quake-item:last-child { border-bottom: none; }
.q-mag {
  flex-shrink: 0;
  font-family: var(--ok-mono);
  font-weight: 800;
  font-size: 0.78rem;
  padding: 0.12rem 0.4rem;
  border-radius: var(--ok-radius-sm);
}
.q-mag.hi { color: #dc2626; background: rgba(220, 38, 38, 0.1); }
.q-mag.md { color: #ca8a04; background: rgba(202, 138, 4, 0.1); }
.q-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.q-place {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ok-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.q-time { font-size: 0.7rem; color: var(--ok-muted); }
.q-dist {
  flex-shrink: 0;
  font-family: var(--ok-mono);
  font-size: 0.74rem;
  color: var(--ok-muted);
}

/* ---------- responsive ---------- */
@media (max-width: 720px) {
  .city-banner .city-coord { margin-left: 0; width: 100%; }
  .fc-day { padding: 0.25rem 0.05rem; }
}
</style>
