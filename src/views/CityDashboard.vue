<script setup>
/* ============================================================
   City Dashboard — 城市环境仪表盘（Vue 3 SFC）
   多 API 协作：地理编码 + 天气 + 空气质量 + 地震。
   输入任意城市，一屏展示该城市的环境全貌。
   ============================================================ */

import { ref, computed, onMounted } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, geocode, haversineKm, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- 文案字典（中英双语） ---------- */
const copy = {
  en: {
    eyebrow: 'Open-Meteo · USGS · Multi-API',
    lead: 'A full environmental picture of any city: live weather, 24-hour temperature curve, air quality, sunrise & sunset, and nearby earthquakes.',
    searchPlaceholder: 'Enter a city…',
    search: 'Search',
    useLocation: 'Use my location',
    locating: 'Locating…',
    loading: 'Loading…',
    candidates: 'Multiple matches, pick one:',
    currentLocation: 'Current location',
    noResults: 'No matching cities',
    geoError: 'City search failed. Please try again.',
    weatherError: 'Weather data unavailable.',
    airError: 'Air quality data unavailable.',
    quakeError: 'Earthquake data unavailable.',
    chartError: 'Curve data unavailable.',
    emptyHint: 'Enter a city name or use your location to begin.',
    currentWeather: 'Current Weather',
    feelsLike: 'Feels like',
    humidity: 'Humidity',
    pressure: 'Pressure',
    wind: 'Wind',
    uv: 'UV Index',
    tempCurve: 'Temperature & AQI — next 24h',
    temperature: 'Temperature',
    aqi: 'AQI',
    airQuality: 'Air Quality',
    pollutants: 'Pollutants',
    sunriseSunset: 'Sunrise & Sunset',
    sunrise: 'Sunrise',
    sunset: 'Sunset',
    solarNoon: 'Solar noon',
    daylight: 'Daylight',
    earthquakes: 'Nearby Earthquakes (500km / 30d)',
    noQuakes: 'No significant earthquakes recently.',
    place: 'Location',
    distance: 'Distance',
    aqiGood: 'Good',
    aqiModerate: 'Moderate',
    aqiUsg: 'Unhealthy for Sensitive',
    aqiUnhealthy: 'Unhealthy',
    aqiVeryUnhealthy: 'Very Unhealthy',
    weatherClear: 'Clear',
    weatherMainlyClear: 'Mainly clear',
    weatherCloudy: 'Partly cloudy',
    weatherOvercast: 'Overcast',
    weatherFog: 'Fog',
    weatherDrizzle: 'Drizzle',
    weatherRain: 'Rain',
    weatherSnow: 'Snow',
    weatherThunder: 'Thunderstorm',
    windUnit: 'km/h',
    pressureUnit: 'hPa',
    refresh: 'Refresh'
  },
  zh: {
    eyebrow: 'Open-Meteo · USGS · 多 API 协作',
    lead: '一屏展示任意城市的环境全貌：实时天气、24 小时温度曲线、空气质量、日出日落与周边地震。',
    searchPlaceholder: '输入城市…',
    search: '查询',
    useLocation: '使用我的位置',
    locating: '定位中…',
    loading: '加载中…',
    candidates: '多个匹配结果，请选择：',
    currentLocation: '当前位置',
    noResults: '未找到匹配的城市',
    geoError: '城市搜索失败，请重试。',
    weatherError: '天气数据不可用。',
    airError: '空气质量数据不可用。',
    quakeError: '地震数据不可用。',
    chartError: '曲线数据不可用。',
    emptyHint: '输入城市名或使用我的位置开始查询。',
    currentWeather: '当前天气',
    feelsLike: '体感温度',
    humidity: '湿度',
    pressure: '气压',
    wind: '风',
    uv: '紫外线指数',
    tempCurve: '温度与空气质量曲线 — 未来 24h',
    temperature: '温度',
    aqi: 'AQI',
    airQuality: '空气质量',
    pollutants: '污染物',
    sunriseSunset: '日出日落',
    sunrise: '日出',
    sunset: '日落',
    solarNoon: '正午',
    daylight: '白昼时长',
    earthquakes: '周边地震（500km / 近 30 天）',
    noQuakes: '近期无显著地震。',
    place: '地点',
    distance: '距城市',
    aqiGood: '好',
    aqiModerate: '中等',
    aqiUsg: '敏感人群不健康',
    aqiUnhealthy: '不健康',
    aqiVeryUnhealthy: '很差',
    weatherClear: '晴',
    weatherMainlyClear: '晴间多云',
    weatherCloudy: '多云',
    weatherOvercast: '阴',
    weatherFog: '雾',
    weatherDrizzle: '毛毛雨',
    weatherRain: '雨',
    weatherSnow: '雪',
    weatherThunder: '雷阵雨',
    windUnit: '公里/时',
    pressureUnit: '百帕',
    refresh: '刷新'
  }
}
const t = useT(copy)

/* ---------- 常量 ---------- */
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast'
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const QUAKE_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query'

// AQI 等级颜色（US AQI 标准）
const AQI_COLORS = {
  good: '#16a34a',
  moderate: '#eab308',
  usg: '#f97316',
  unhealthy: '#dc2626',
  veryUnhealthy: '#a855f7'
}
const AQI_LABEL_KEY = {
  good: 'aqiGood',
  moderate: 'aqiModerate',
  usg: 'aqiUsg',
  unhealthy: 'aqiUnhealthy',
  veryUnhealthy: 'aqiVeryUnhealthy'
}

// 污染物配置
const POLLUTANTS = [
  { key: 'pm2_5', chem: 'PM2.5' },
  { key: 'pm10', chem: 'PM10' },
  { key: 'carbon_monoxide', chem: 'CO' },
  { key: 'nitrogen_dioxide', chem: 'NO₂' },
  { key: 'sulphur_dioxide', chem: 'SO₂' },
  { key: 'ozone', chem: 'O₃' }
]

// 风向 8 点位
const DIR8_EN = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const DIR8_ZH = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']

/* ---------- 响应式状态 ---------- */
const query = ref('')
const inputRef = ref(null)
const candidates = ref([])        // geocode 多候选
const city = ref(null)            // 当前选中城市 {name,lat,lon,country,admin1,timezone}

const geoLoading = ref(false)
const geoError = ref('')          // 文案 key
const locating = ref(false)       // 浏览器定位中

const weather = ref(null)
const weatherLoading = ref(false)
const weatherError = ref('')

const air = ref(null)
const airLoading = ref(false)
const airError = ref('')

const quakeRaw = ref(null)
const quakeLoading = ref(false)
const quakeError = ref('')

/* ---------- 工具函数 ---------- */
// US AQI -> 等级 key
function aqiLevel(aqi) {
  if (aqi == null || isNaN(aqi)) return 'good'
  if (aqi <= 50) return 'good'
  if (aqi <= 100) return 'moderate'
  if (aqi <= 150) return 'usg'
  if (aqi <= 200) return 'unhealthy'
  return 'veryUnhealthy'
}

// 风向度数 -> 方位文案（随语言）
function dirText(deg) {
  if (deg == null || isNaN(deg)) return ''
  const idx = Math.round(deg / 45) % 8
  return i18nState.lang === 'zh' ? DIR8_ZH[idx] : DIR8_EN[idx]
}

// weather_code -> { i18n key, theme }
function weatherInfo(code) {
  const c = code == null ? 0 : code
  if (c === 0) return { key: 'weatherClear', theme: 'clear' }
  if (c === 1) return { key: 'weatherMainlyClear', theme: 'clear' }
  if (c === 2) return { key: 'weatherCloudy', theme: 'cloud' }
  if (c === 3) return { key: 'weatherOvercast', theme: 'overcast' }
  if (c === 45 || c === 48) return { key: 'weatherFog', theme: 'fog' }
  if (c >= 51 && c <= 57) return { key: 'weatherDrizzle', theme: 'rain' }
  if (c >= 61 && c <= 67) return { key: 'weatherRain', theme: 'rain' }
  if (c >= 71 && c <= 77) return { key: 'weatherSnow', theme: 'snow' }
  if (c >= 80 && c <= 82) return { key: 'weatherRain', theme: 'rain' }
  if (c >= 85 && c <= 86) return { key: 'weatherSnow', theme: 'snow' }
  if (c >= 95) return { key: 'weatherThunder', theme: 'thunder' }
  return { key: 'weatherCloudy', theme: 'cloud' }
}

// 污染物数值格式化（μg/m³）
function fmtVal(v) {
  if (v == null || isNaN(v)) return '—'
  if (v < 10) return v.toFixed(1)
  if (v < 100) return v.toFixed(1)
  return Math.round(v).toString()
}

// 震级 -> 徽章颜色类
function magClass(m) {
  if (m == null || isNaN(m)) return 'g'
  if (m < 3) return 'g'   // 灰
  if (m < 4) return 'gn'  // 绿
  if (m < 5) return 'yl'  // 黄
  return 'rd'             // 橙红
}

// 解析 "HH:MM" 为分钟数
function parseHM(s) {
  if (!s) return null
  const m = /(\d{1,2}):(\d{2})/.exec(s)
  return m ? +m[1] * 60 + +m[2] : null
}
// 分钟数 -> "HH:MM"
function fmtMin(min) {
  const h = Math.floor(min / 60) % 24
  const m = Math.round(min % 60)
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')
}

// 从逐小时数组中切片未来 24h（以当前小时为起点）
function slice24(times, vals, nowHourStr) {
  if (!times || !vals) return []
  let start = -1
  for (let i = 0; i < times.length; i++) {
    if (times[i].slice(0, 13) >= nowHourStr) { start = i; break }
  }
  if (start < 0) start = 0
  const out = []
  for (let i = 0; i < 24 && start + i < times.length; i++) {
    out.push({ time: times[start + i], val: vals[start + i] })
  }
  return out
}

/* ---------- 搜索 / 定位 ---------- */
async function search() {
  const name = query.value.trim()
  if (!name) return
  geoLoading.value = true
  geoError.value = ''
  candidates.value = []
  try {
    const results = await geocode(name)
    if (results.length === 0) {
      geoError.value = 'noResults'
    } else if (results.length === 1) {
      selectCity(results[0])
    } else {
      candidates.value = results
    }
  } catch (e) {
    geoError.value = 'geoError'
  } finally {
    geoLoading.value = false
  }
}

function selectCity(r) {
  city.value = {
    name: r.name,
    lat: r.lat,
    lon: r.lon,
    country: r.country || '',
    admin1: r.admin1 || '',
    timezone: r.timezone || ''
  }
  candidates.value = []
  geoError.value = ''
  query.value = ''
  loadAll()
}

function useMyLocation() {
  if (!navigator.geolocation) {
    geoError.value = 'geoError'
    return
  }
  locating.value = true
  geoError.value = ''
  candidates.value = []
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locating.value = false
      city.value = {
        name: t.value('currentLocation'),
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        country: '',
        admin1: '',
        timezone: ''
      }
      loadAll()
    },
    () => {
      locating.value = false
      geoError.value = 'geoError'
    },
    { timeout: 10000, enableHighAccuracy: false }
  )
}

/* ---------- 数据加载（各 API 独立 loading/error，并发） ---------- */
function loadAll() {
  loadWeather()
  loadAir()
  loadQuakes()
}

async function loadWeather() {
  if (!city.value) return
  weatherLoading.value = true
  weatherError.value = ''
  const c = city.value
  const url =
    WEATHER_URL + '?latitude=' + c.lat + '&longitude=' + c.lon +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure' +
    '&hourly=temperature_2m,precipitation_probability,weather_code' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max' +
    '&timezone=auto&forecast_days=3'
  try {
    weather.value = await fetchJSON(url)
  } catch (e) {
    weather.value = null
    weatherError.value = 'weatherError'
  } finally {
    weatherLoading.value = false
  }
}

async function loadAir() {
  if (!city.value) return
  airLoading.value = true
  airError.value = ''
  const c = city.value
  const url =
    AIR_URL + '?latitude=' + c.lat + '&longitude=' + c.lon +
    '&current=us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone' +
    '&hourly=us_aqi&timezone=auto&forecast_days=1'
  try {
    air.value = await fetchJSON(url)
  } catch (e) {
    air.value = null
    airError.value = 'airError'
  } finally {
    airLoading.value = false
  }
}

async function loadQuakes() {
  if (!city.value) return
  quakeLoading.value = true
  quakeError.value = ''
  const c = city.value
  const end = new Date()
  const start = new Date(Date.now() - 30 * 86400000)
  const url =
    QUAKE_URL + '?format=geojson' +
    '&starttime=' + start.toISOString().slice(0, 10) +
    '&endtime=' + end.toISOString().slice(0, 10) +
    '&latitude=' + c.lat + '&longitude=' + c.lon +
    '&maxradiuskm=500&minmagnitude=3&limit=15&orderby=time'
  try {
    quakeRaw.value = await fetchJSON(url)
  } catch (e) {
    quakeRaw.value = null
    quakeError.value = 'quakeError'
  } finally {
    quakeLoading.value = false
  }
}

function refresh() {
  loadAll()
}

/* ---------- 派生：城市名展示 ---------- */
const cityDisplay = computed(() => {
  if (!city.value) return ''
  const c = city.value
  const parts = [c.name]
  if (c.admin1 && c.admin1 !== c.name) parts.push(c.admin1)
  if (c.country) parts.push(c.country)
  return parts.join(', ')
})
const coordsText = computed(() => {
  if (!city.value) return ''
  return city.value.lat.toFixed(2) + ', ' + city.value.lon.toFixed(2)
})
function resultMeta(r) {
  const meta = [r.admin1, r.country].filter(Boolean).join(', ')
  return meta || (r.lat.toFixed(2) + ', ' + r.lon.toFixed(2))
}

/* ---------- 派生：当前天气 ---------- */
const currentWeather = computed(() => (weather.value && weather.value.current) ? weather.value.current : null)
const weatherDescText = computed(() => {
  const c = currentWeather.value
  if (!c) return ''
  return t.value(weatherInfo(c.weather_code).key)
})
const weatherThemeClass = computed(() => {
  const c = currentWeather.value
  return 'theme-' + (c ? weatherInfo(c.weather_code).theme : 'clear')
})
const tempText = computed(() => {
  const v = currentWeather.value ? currentWeather.value.temperature_2m : null
  return v == null ? '—' : Math.round(v).toString()
})
const feelsText = computed(() => {
  const v = currentWeather.value ? currentWeather.value.apparent_temperature : null
  return v == null ? '—' : Math.round(v).toString()
})
const humidityText = computed(() => {
  const v = currentWeather.value ? currentWeather.value.relative_humidity_2m : null
  return v == null ? '—' : Math.round(v) + '%'
})
const pressureText = computed(() => {
  const v = currentWeather.value ? currentWeather.value.surface_pressure : null
  return v == null ? '—' : Math.round(v) + ' ' + t.value('pressureUnit')
})
const windText = computed(() => {
  const c = currentWeather.value
  if (!c) return '—'
  const sp = c.wind_speed_10m
  return Math.round(sp) + ' ' + t.value('windUnit') + ' ' + dirText(c.wind_direction_10m)
})
const uvText = computed(() => {
  const v = (weather.value && weather.value.daily && weather.value.daily.uv_index_max) ? weather.value.daily.uv_index_max[0] : null
  return v == null ? '—' : Math.round(v).toString()
})

/* ---------- 派生：空气质量 ---------- */
const currentAir = computed(() => (air.value && air.value.current) ? air.value.current : null)
const currentAqi = computed(() => currentAir.value ? currentAir.value.us_aqi : null)
const aqiLevelKey = computed(() => aqiLevel(currentAqi.value))
const aqiColor = computed(() => AQI_COLORS[aqiLevelKey.value])
const aqiText = computed(() => {
  const v = currentAqi.value
  return (v == null || isNaN(v)) ? '—' : Math.round(v).toString()
})
const aqiLevelText = computed(() => t.value(AQI_LABEL_KEY[aqiLevelKey.value]))
const aqiLineColor = computed(() => aqiColor.value)  // 双轴图中 AQI 折线颜色随当前等级
const pollutantCells = computed(() => {
  const cur = currentAir.value
  return POLLUTANTS.map((p) => ({
    chem: p.chem,
    val: fmtVal(cur ? cur[p.key] : null)
  }))
})

/* ---------- 派生：24h 双轴图（温度 + AQI） ---------- */
const chart = computed(() => {
  const w = weather.value
  const a = air.value
  if (!w || !w.hourly || !a || !a.hourly) return null
  const nowHour = (w.current && w.current.time) ? w.current.time.slice(0, 13) : ''
  if (!nowHour) return null
  const temps = slice24(w.hourly.time, w.hourly.temperature_2m, nowHour)
  const aqis = slice24(a.hourly.time, a.hourly.us_aqi, nowHour)
  const n = temps.length
  if (n < 2) return null

  const W = 720, H = 280
  const padL = 46, padR = 46, padT = 24, padB = 34
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const x = (i) => padL + plotW * i / (n - 1)

  // 温度范围
  const tVals = temps.map((p) => p.val).filter((v) => v != null && !isNaN(v))
  const aVals = aqis.map((p) => p.val).filter((v) => v != null && !isNaN(v))
  if (!tVals.length && !aVals.length) return null
  let tMin = tVals.length ? Math.min.apply(null, tVals) : 0
  let tMax = tVals.length ? Math.max.apply(null, tVals) : 1
  if (tMin === tMax) { tMin -= 2; tMax += 2 }
  const tPad = (tMax - tMin) * 0.15
  tMin -= tPad; tMax += tPad
  const yT = (v) => padT + plotH - (v - tMin) / (tMax - tMin) * plotH

  // AQI 范围
  let aMax = 50
  aVals.forEach((v) => { if (v > aMax) aMax = v })
  aMax = Math.ceil(aMax / 50) * 50
  if (aMax > 300) aMax = 300
  const yA = (v) => padT + plotH - Math.min(v, aMax) / aMax * plotH

  // 折线点
  const tempPts = []
  temps.forEach((p, i) => {
    if (p.val != null && !isNaN(p.val)) tempPts.push({ x: x(i), y: yT(p.val), t: p.time, v: p.val })
  })
  const aqiPts = []
  aqis.forEach((p, i) => {
    if (p.val != null && !isNaN(p.val)) aqiPts.push({ x: x(i), y: yA(p.val), t: p.time, v: p.val })
  })

  const tempLine = tempPts.map((p, idx) => (idx ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ')
  const tempArea = tempPts.length
    ? tempLine +
      ' L' + tempPts[tempPts.length - 1].x.toFixed(1) + ' ' + (padT + plotH) +
      ' L' + tempPts[0].x.toFixed(1) + ' ' + (padT + plotH) + ' Z'
    : ''
  const aqiLine = aqiPts.map((p, idx) => (idx ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ')

  // x 轴时间标签（每 4 小时）
  const xLabels = []
  for (let i = 0; i < n; i += 4) {
    xLabels.push({ x: x(i), label: temps[i].time.slice(11, 16) })
  }
  if (xLabels[xLabels.length - 1].x !== x(n - 1)) {
    xLabels.push({ x: x(n - 1), label: temps[n - 1].time.slice(11, 16) })
  }

  // 左轴温度标签
  const tempLabels = [
    { y: yT(tMax), label: Math.round(tMax) + '°' },
    { y: yT((tMin + tMax) / 2), label: Math.round((tMin + tMax) / 2) + '°' },
    { y: yT(tMin), label: Math.round(tMin) + '°' }
  ]
  // 右轴 AQI 标签（等级边界）
  const aqiLabels = [0, 50, 100, 150, 200].filter((l) => l <= aMax).map((l) => ({ y: yA(l), label: l }))
  if (aMax > 200) aqiLabels.push({ y: yA(aMax), label: aMax })

  return { W, H, padL, padR, padT, padB, plotH, tempLine, tempArea, aqiLine, xLabels, tempLabels, aqiLabels, tempPts, aqiPts }
})

/* ---------- 派生：日出日落时间轴 ---------- */
const sun = computed(() => {
  const w = weather.value
  if (!w || !w.daily || !w.daily.sunrise || !w.daily.sunset) return null
  const sr = w.daily.sunrise[0]
  const ss = w.daily.sunset[0]
  if (!sr || !ss) return null
  const srMin = parseHM(sr.slice(11, 16))
  const ssMin = parseHM(ss.slice(11, 16))
  if (srMin == null || ssMin == null || ssMin <= srMin) return null
  const noonMin = (srMin + ssMin) / 2
  const dayMin = ssMin - srMin
  let nowPct = null
  const curStr = (w.current && w.current.time) ? w.current.time.slice(11, 16) : ''
  const curMin = parseHM(curStr)
  if (curMin != null) {
    if (curMin <= srMin) nowPct = 0
    else if (curMin >= ssMin) nowPct = 100
    else nowPct = (curMin - srMin) / (ssMin - srMin) * 100
  }
  return {
    sunrise: fmtMin(srMin),
    sunset: fmtMin(ssMin),
    noon: fmtMin(noonMin),
    dayMin,
    nowPct
  }
})
const daylightText = computed(() => {
  if (!sun.value) return '—'
  const h = Math.floor(sun.value.dayMin / 60)
  const m = Math.round(sun.value.dayMin % 60)
  return i18nState.lang === 'zh' ? (h + ' 时 ' + m + ' 分') : (h + 'h ' + m + 'm')
})

/* ---------- 派生：周边地震列表 ---------- */
const quakes = computed(() => {
  if (!quakeRaw.value || !quakeRaw.value.features || !city.value) return []
  const clat = city.value.lat
  const clon = city.value.lon
  return quakeRaw.value.features.map((f) => {
    const p = f.properties || {}
    const c = (f.geometry && f.geometry.coordinates) || [0, 0, 0]
    const dist = haversineKm(clat, clon, c[1], c[0])
    return {
      mag: p.mag,
      place: p.place || '',
      time: p.time,
      timeText: p.time ? new Date(p.time).toLocaleString(locale(), {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }) : '—',
      dist
    }
  }).sort((a, b) => b.time - a.time)
})

/* ---------- 生命周期 ---------- */
onMounted(() => {
  if (inputRef.value) inputRef.value.focus()
})
</script>

<template>
  <div class="city-dashboard">
    <AppHeader :title="{ en: 'City Dashboard', zh: '城市仪表盘' }" :show-lang-toggle="true" />

    <main class="shell">
      <!-- 页头 + 搜索区 -->
      <section class="masthead">
        <p class="eyebrow">{{ t('eyebrow') }}</p>
        <p class="lead">{{ t('lead') }}</p>

        <div class="search-row">
          <div class="search-box">
            <input
              ref="inputRef"
              v-model="query"
              class="search-input"
              type="text"
              autocomplete="off"
              :placeholder="t('searchPlaceholder')"
              @keydown.enter="search"
            />
            <!-- 多候选下拉 -->
            <ul v-if="candidates.length" class="candidates" role="listbox">
              <li class="cand-hint">{{ t('candidates') }}</li>
              <li
                v-for="(c, i) in candidates"
                :key="i"
                role="option"
                class="cand-item"
                @click="selectCity(c)"
              >
                <span class="cand-name">{{ c.name }}</span>
                <span class="cand-meta">{{ resultMeta(c) }}</span>
              </li>
            </ul>
          </div>
          <button class="btn-primary" type="button" :disabled="geoLoading" @click="search">
            {{ geoLoading ? t('loading') : t('search') }}
          </button>
          <button class="btn-ghost" type="button" :disabled="locating" @click="useMyLocation">
            {{ locating ? t('locating') : t('useLocation') }}
          </button>
        </div>

        <div v-if="geoError" class="ok-error">{{ t(geoError) }}</div>
      </section>

      <!-- 空状态 -->
      <div v-if="!city" class="empty-state">{{ t('emptyHint') }}</div>

      <!-- 仪表盘网格 -->
      <section v-if="city" class="grid">
        <!-- 1. 当前天气大卡（跨 2 列） -->
        <article class="card card-weather" :class="weatherThemeClass">
          <div v-if="weatherLoading" class="ok-loading"><span class="ok-spinner"></span><span>{{ t('loading') }}</span></div>
          <div v-else-if="weatherError" class="ok-error">{{ t(weatherError) }}</div>
          <template v-else-if="currentWeather">
            <div class="weather-head">
              <div>
                <div class="card-label">{{ t('currentWeather') }}</div>
                <div class="city-name">{{ cityDisplay }}</div>
                <div class="coords">{{ coordsText }}</div>
              </div>
              <div class="weather-desc">{{ weatherDescText }}</div>
            </div>
            <div class="weather-main">
              <div class="big-temp">{{ tempText }}<span class="deg">°</span></div>
              <div class="feels">{{ t('feelsLike') }} {{ feelsText }}°</div>
            </div>
            <div class="weather-stats">
              <div class="stat"><span class="s-l">{{ t('wind') }}</span><span class="s-v">{{ windText }}</span></div>
              <div class="stat"><span class="s-l">{{ t('humidity') }}</span><span class="s-v">{{ humidityText }}</span></div>
              <div class="stat"><span class="s-l">{{ t('pressure') }}</span><span class="s-v">{{ pressureText }}</span></div>
              <div class="stat"><span class="s-l">{{ t('uv') }}</span><span class="s-v">{{ uvText }}</span></div>
            </div>
          </template>
        </article>

        <!-- 2. 24h 温度 + AQI 双轴图卡（跨 2 列） -->
        <article class="card card-chart">
          <div class="chart-head">
            <div class="card-label">{{ t('tempCurve') }}</div>
            <div class="legend">
              <span class="lg"><i class="sw temp"></i>{{ t('temperature') }}</span>
              <span class="lg"><i class="sw" :style="{ background: aqiLineColor }"></i>{{ t('aqi') }}</span>
            </div>
          </div>
          <svg
            v-if="chart"
            class="chart-svg"
            :viewBox="'0 0 ' + chart.W + ' ' + chart.H"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            :aria-label="t('tempCurve')"
          >
            <defs>
              <linearGradient id="cd-temp-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--ok-accent)" stop-opacity="0.28" />
                <stop offset="100%" stop-color="var(--ok-accent)" stop-opacity="0" />
              </linearGradient>
            </defs>
            <!-- 横向网格线 -->
            <line
              v-for="(lb, i) in chart.tempLabels"
              :key="'g' + i"
              :x1="chart.padL"
              :y1="lb.y"
              :x2="chart.W - chart.padR"
              :y2="lb.y"
              class="grid-line"
            />
            <line
              :x1="chart.padL"
              :y1="chart.padT + chart.plotH"
              :x2="chart.W - chart.padR"
              :y2="chart.padT + chart.plotH"
              class="grid-base"
            />
            <!-- 左轴温度标签 -->
            <text
              v-for="(lb, i) in chart.tempLabels"
              :key="'tl' + i"
              :x="chart.padL - 6"
              :y="lb.y + 3"
              text-anchor="end"
              class="axis-label"
            >{{ lb.label }}</text>
            <!-- 右轴 AQI 标签 -->
            <text
              v-for="(lb, i) in chart.aqiLabels"
              :key="'al' + i"
              :x="chart.W - chart.padR + 6"
              :y="lb.y + 3"
              text-anchor="start"
              class="axis-label aqi-axis"
            >{{ lb.label }}</text>
            <!-- 温度面积 + 折线 -->
            <path :d="chart.tempArea" fill="url(#cd-temp-fill)" />
            <path
              :d="chart.tempLine"
              fill="none"
              stroke="var(--ok-accent)"
              stroke-width="2"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
            <!-- AQI 折线 -->
            <path
              :d="chart.aqiLine"
              fill="none"
              :stroke="aqiLineColor"
              stroke-width="2"
              stroke-dasharray="4 3"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
            <!-- x 轴时间标签 -->
            <text
              v-for="(lb, i) in chart.xLabels"
              :key="'xl' + i"
              :x="lb.x"
              :y="chart.H - 10"
              text-anchor="middle"
              class="axis-x"
            >{{ lb.label }}</text>
          </svg>
          <div v-else-if="weatherLoading || airLoading" class="ok-loading">
            <span class="ok-spinner"></span><span>{{ t('loading') }}</span>
          </div>
          <div v-else class="ok-error">{{ t('chartError') }}</div>
        </article>

        <!-- 3. 空气质量详情卡 -->
        <article class="card card-aqi">
          <div class="card-label">{{ t('airQuality') }}</div>
          <div v-if="airLoading" class="ok-loading"><span class="ok-spinner"></span><span>{{ t('loading') }}</span></div>
          <div v-else-if="airError" class="ok-error">{{ t(airError) }}</div>
          <template v-else-if="currentAir">
            <div class="aqi-main">
              <div class="aqi-big" :style="{ color: aqiColor }">{{ aqiText }}</div>
              <span class="aqi-badge" :style="{ color: aqiColor, borderColor: aqiColor, background: aqiColor + '22' }">{{ aqiLevelText }}</span>
            </div>
            <div class="pollutant-grid">
              <div v-for="cell in pollutantCells" :key="cell.chem" class="p-cell">
                <span class="p-chem">{{ cell.chem }}</span>
                <span class="p-val">{{ cell.val }}<span class="p-unit">μg/m³</span></span>
              </div>
            </div>
          </template>
        </article>

        <!-- 4. 日出日落时间轴卡 -->
        <article class="card card-sun">
          <div class="card-label">{{ t('sunriseSunset') }}</div>
          <div v-if="weatherLoading" class="ok-loading"><span class="ok-spinner"></span><span>{{ t('loading') }}</span></div>
          <div v-else-if="!sun" class="sun-empty">—</div>
          <template v-else>
            <div class="sun-axis">
              <div class="track"></div>
              <div v-if="sun.nowPct != null" class="sun-now" :style="{ left: sun.nowPct + '%' }"></div>
            </div>
            <div class="sun-labels">
              <div class="sl"><span class="sl-i rise"></span>{{ t('sunrise') }} {{ sun.sunrise }}</div>
              <div class="sl"><span class="sl-i noon"></span>{{ t('solarNoon') }} {{ sun.noon }}</div>
              <div class="sl"><span class="sl-i set"></span>{{ t('sunset') }} {{ sun.sunset }}</div>
            </div>
            <div class="daylight-info">{{ t('daylight') }}: {{ daylightText }}</div>
          </template>
        </article>

        <!-- 5. 周边地震卡（跨 2 列） -->
        <article class="card card-quake">
          <div class="quake-head">
            <div class="card-label">{{ t('earthquakes') }}</div>
            <button class="btn-ghost btn-sm" type="button" @click="refresh">{{ t('refresh') }}</button>
          </div>
          <div v-if="quakeLoading" class="ok-loading"><span class="ok-spinner"></span><span>{{ t('loading') }}</span></div>
          <div v-else-if="quakeError" class="ok-error">{{ t(quakeError) }}</div>
          <ul v-else-if="quakes.length" class="quake-list">
            <li v-for="(q, i) in quakes" :key="i" class="quake-item">
              <span class="mag" :class="magClass(q.mag)">{{ q.mag != null ? q.mag.toFixed(1) : '?' }}</span>
              <div class="qi">
                <div class="qp">{{ q.place || '—' }}</div>
                <div class="qm">{{ q.timeText }} · {{ t('distance') }} {{ Math.round(q.dist) }} km</div>
              </div>
            </li>
          </ul>
          <div v-else class="empty">{{ t('noQuakes') }}</div>
        </article>
      </section>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   City Dashboard — 浅色主题，Bento 网格
   复用全局 --ok-* 设计令牌。
   ============================================================ */

.city-dashboard {
  min-height: 100vh;
  background: var(--ok-bg);
  color: var(--ok-text);
  font-family: var(--ok-font);
  display: flex;
  flex-direction: column;
}

/* ---------- 主容器 ---------- */
.shell {
  width: min(1180px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1rem 0 2.5rem;
  flex: 1;
}

/* ---------- 页头 masthead ---------- */
.masthead {
  padding: 1.2rem 0 1rem;
  border-bottom: 1px solid var(--ok-line);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--ok-accent);
}

.lead {
  margin-top: 0.5rem;
  color: var(--ok-muted);
  font-size: 0.92rem;
  line-height: 1.6;
  max-width: 64ch;
}

/* ---------- 搜索区 ---------- */
.search-row {
  display: flex;
  gap: 0.6rem;
  margin-top: 1rem;
  flex-wrap: wrap;
  align-items: stretch;
}

.search-box {
  position: relative;
  flex: 1 1 280px;
  min-width: 220px;
}

.search-input {
  font: inherit;
  width: 100%;
  height: 2.6rem;
  padding: 0 0.9rem;
  border: 1px solid var(--ok-line);
  background: var(--ok-panel);
  color: var(--ok-text);
  font-size: 0.9rem;
  border-radius: var(--ok-radius-sm);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.search-input::placeholder { color: var(--ok-muted); }
.search-input:focus-visible {
  outline: none;
  border-color: var(--ok-accent);
  box-shadow: 0 0 0 3px var(--ok-accent-soft);
}

.btn-primary {
  font: inherit;
  height: 2.6rem;
  padding: 0 1.1rem;
  border: 1px solid var(--ok-accent);
  background: var(--ok-accent);
  color: #fff;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.86rem;
  border-radius: var(--ok-radius-sm);
  transition: opacity 0.15s;
}
.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.6; cursor: default; }

.btn-ghost {
  font: inherit;
  height: 2.6rem;
  padding: 0 0.9rem;
  border: 1px solid var(--ok-line);
  background: var(--ok-panel);
  color: var(--ok-text);
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 600;
  border-radius: var(--ok-radius-sm);
  transition: border-color 0.15s, color 0.15s;
}
.btn-ghost:hover { border-color: var(--ok-accent); color: var(--ok-accent); }
.btn-ghost:disabled { opacity: 0.6; cursor: default; }
.btn-sm { height: 2rem; padding: 0 0.7rem; font-size: 0.76rem; }

/* 多候选下拉 */
.candidates {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  list-style: none;
  margin: 0;
  padding: 0.3rem;
  background: var(--ok-panel);
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-sm);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  z-index: 40;
  max-height: 320px;
  overflow-y: auto;
}

.cand-hint {
  padding: 0.4rem 0.7rem;
  font-size: 0.72rem;
  color: var(--ok-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cand-item {
  padding: 0.55rem 0.7rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.86rem;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.6rem;
  transition: background 0.12s;
}
.cand-item:hover { background: var(--ok-accent-soft); }
.cand-name { color: var(--ok-text); font-weight: 500; }
.cand-meta { color: var(--ok-muted); font-family: var(--ok-mono); font-size: 0.74rem; }

/* ---------- 空状态 ---------- */
.empty-state {
  margin-top: 2.5rem;
  text-align: center;
  color: var(--ok-muted);
  font-size: 0.95rem;
  padding: 2rem;
}

/* ---------- Bento 网格 ---------- */
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-top: 1.2rem;
}

.card {
  background: var(--ok-panel);
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius);
  padding: 1.3rem;
  display: flex;
  flex-direction: column;
}

.card-weather { grid-column: span 2; }
.card-chart { grid-column: span 2; }
.card-aqi { grid-column: span 1; }
.card-sun { grid-column: span 1; }
.card-quake { grid-column: span 2; }

.card-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--ok-muted);
  font-weight: 600;
}

/* ---------- 当前天气大卡（按天气主题渐变背景） ---------- */
.card-weather {
  overflow: hidden;
  position: relative;
  color: var(--ok-text);
}
.card-weather.theme-clear { background: linear-gradient(135deg, #cfe8ff 0%, #eaf4ff 100%); }
.card-weather.theme-cloud { background: linear-gradient(135deg, #dbe4ec 0%, #eef2f6 100%); }
.card-weather.theme-overcast { background: linear-gradient(135deg, #cfd6dd 0%, #e3e8ed 100%); }
.card-weather.theme-fog { background: linear-gradient(135deg, #d8dde2 0%, #ecedf0 100%); }
.card-weather.theme-rain { background: linear-gradient(135deg, #aec4d6 0%, #cdd9e4 100%); }
.card-weather.theme-snow { background: linear-gradient(135deg, #e8f0f7 0%, #f6f9fc 100%); }
.card-weather.theme-thunder { background: linear-gradient(135deg, #b9b6cf 0%, #d8d6e4 100%); }

.weather-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}
.city-name {
  font-size: 1.15rem;
  font-weight: 700;
  margin-top: 0.25rem;
  letter-spacing: -0.01em;
}
.coords {
  font-family: var(--ok-mono);
  font-size: 0.72rem;
  color: var(--ok-muted);
  margin-top: 0.15rem;
}
.weather-desc {
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0.3rem 0.75rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 999px;
  white-space: nowrap;
}

.weather-main {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  margin: 0.9rem 0 1.1rem;
  flex-wrap: wrap;
}
.big-temp {
  font-family: var(--ok-mono);
  font-size: clamp(3.8rem, 9vw, 5.5rem);
  font-weight: 600;
  line-height: 0.9;
  letter-spacing: -0.04em;
  color: var(--ok-text);
}
.big-temp .deg { font-size: 0.5em; vertical-align: super; margin-left: 2px; }
.feels {
  font-size: 0.9rem;
  color: var(--ok-muted);
  font-weight: 500;
}

.weather-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.6rem 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.s-l {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ok-muted);
}
.s-v {
  font-family: var(--ok-mono);
  font-size: 0.95rem;
  font-weight: 600;
}

/* ---------- 24h 双轴图卡 ---------- */
.chart-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.6rem;
  flex-wrap: wrap;
}
.legend {
  display: flex;
  gap: 0.9rem;
  font-size: 0.78rem;
  color: var(--ok-muted);
}
.lg { display: inline-flex; align-items: center; gap: 0.35rem; }
.sw {
  display: inline-block;
  width: 14px;
  height: 3px;
  border-radius: 2px;
}
.sw.temp { background: var(--ok-accent); }

.chart-svg {
  width: 100%;
  height: auto;
  display: block;
}
.grid-line { stroke: var(--ok-line); stroke-width: 1; stroke-dasharray: 2 4; }
.grid-base { stroke: var(--ok-line); stroke-width: 1; }
.axis-label { fill: var(--ok-muted); font-size: 10px; font-family: var(--ok-mono); }
.axis-x { fill: var(--ok-muted); font-size: 10px; font-family: var(--ok-mono); }
.aqi-axis { fill: var(--ok-down); }

/* ---------- 空气质量详情卡 ---------- */
.aqi-main {
  display: flex;
  align-items: baseline;
  gap: 0.7rem;
  margin: 0.8rem 0 1rem;
  flex-wrap: wrap;
}
.aqi-big {
  font-family: var(--ok-mono);
  font-size: 3rem;
  font-weight: 700;
  line-height: 1;
}
.aqi-badge {
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  border: 1px solid;
}

.pollutant-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}
.p-cell {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.5rem 0.6rem;
  background: var(--ok-bg);
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-sm);
}
.p-chem {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--ok-muted);
}
.p-val {
  font-family: var(--ok-mono);
  font-size: 1.05rem;
  font-weight: 600;
}
.p-unit {
  font-family: var(--ok-mono);
  font-size: 0.62rem;
  color: var(--ok-muted);
  margin-left: 0.2rem;
}

/* ---------- 日出日落时间轴卡 ---------- */
.sun-empty {
  margin: 1.5rem 0;
  text-align: center;
  color: var(--ok-muted);
}
.sun-axis {
  position: relative;
  height: 30px;
  margin: 1.4rem 0 0.6rem;
}
.track {
  position: absolute;
  left: 0;
  right: 0;
  top: 12px;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(90deg, #475569, #fbbf24 50%, #475569);
}
.sun-now {
  position: absolute;
  top: 8px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fde047;
  border: 2px solid #fff;
  box-shadow: 0 0 8px rgba(253, 224, 71, 0.9);
  transform: translateX(-50%);
}
.sun-labels {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.74rem;
  color: var(--ok-muted);
  flex-wrap: wrap;
}
.sl { display: inline-flex; align-items: center; gap: 0.3rem; }
.sl-i {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.sl-i.rise { background: #f59e0b; }
.sl-i.noon { background: #fde047; }
.sl-i.set { background: #475569; }
.daylight-info {
  margin-top: 0.9rem;
  padding-top: 0.8rem;
  border-top: 1px solid var(--ok-line);
  font-family: var(--ok-mono);
  font-size: 0.8rem;
  color: var(--ok-text);
}

/* ---------- 周边地震卡 ---------- */
.quake-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.8rem;
}
.quake-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 360px;
  overflow-y: auto;
}
.quake-item {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.55rem 0.6rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-sm);
}
.mag {
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 800;
  font-family: var(--ok-mono);
  flex-shrink: 0;
}
.mag.g { background: rgba(120, 130, 145, 0.15); color: #5a6778; }
.mag.gn { background: rgba(22, 163, 74, 0.15); color: #16a34a; }
.mag.yl { background: rgba(234, 179, 8, 0.18); color: #b8860b; }
.mag.rd { background: rgba(220, 38, 38, 0.15); color: #dc2626; }

.qi { flex: 1; min-width: 0; }
.qp {
  font-size: 0.84rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.qm {
  font-size: 0.72rem;
  color: var(--ok-muted);
  margin-top: 0.15rem;
  font-family: var(--ok-mono);
}
.empty {
  padding: 1.2rem;
  text-align: center;
  color: var(--ok-muted);
  font-size: 0.88rem;
}

/* ---------- 加载 / 错误 ---------- */
.ok-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ok-muted);
  font-size: 0.85rem;
  padding: 0.8rem 0;
}
.ok-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--ok-line);
  border-top-color: var(--ok-accent);
  border-radius: 50%;
  animation: cd-spin 0.6s linear infinite;
}
@keyframes cd-spin { to { transform: rotate(360deg); } }
.ok-error {
  color: var(--ok-down);
  background: var(--ok-down-bg);
  border: 1px solid rgba(220, 38, 38, 0.2);
  padding: 0.7rem 0.8rem;
  border-radius: var(--ok-radius-sm);
  font-size: 0.85rem;
}

/* ---------- 响应式：移动端单列 ---------- */
@media (max-width: 860px) {
  .grid { grid-template-columns: 1fr; }
  .card-weather,
  .card-chart,
  .card-aqi,
  .card-sun,
  .card-quake { grid-column: span 1; }
}
@media (max-width: 480px) {
  .weather-stats { grid-template-columns: 1fr; }
  .pollutant-grid { grid-template-columns: 1fr; }
}
</style>
