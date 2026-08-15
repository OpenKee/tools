<script setup lang="ts">
/* ============================================================
   Night Sky Guide — 今晚观天指南（Vue 3 SFC）
   融合数据源：
     · Open-Meteo Geocoding（城市搜索）
     · Open Notify ISS Pass Predictions（空间站过境）
     · NOAA SWPC Kp Index（极光）
     · Sunrise-Sunset API（月相）
     · Launch Library 2（火箭发射）
   ============================================================ */

import { ref, computed, onMounted } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, geocode, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- 文案字典 ---------- */
const copy = {
  en: {
    title: 'Night Sky Guide',
    eyebrow: 'Tonight sky',
    lead: 'Enter a city or use your location to find out what is visible in the sky tonight.',
    searchPlaceholder: 'Search city…',
    myLocation: 'Use My Location',
    highlight: "Tonight's Highlight",
    loading: 'Loading…',
    issPasses: 'ISS Passes Tonight',
    issPassesEmpty: 'No ISS passes visible from your location in the next 24 hours.',
    issPassesLoading: 'Loading ISS passes…',
    issPassesError: 'Failed to load ISS pass data.',
    passTime: 'Time',
    passDuration: 'Duration',
    passDirection: 'Direction',
    seconds: 's',
    aurora: 'Aurora Visibility',
    auroraLoading: 'Loading aurora data…',
    auroraError: 'Failed to load aurora data.',
    currentKp: 'Current Kp Index',
    kpLevel: 'Level',
    kpQuiet: 'Quiet',
    kpWeak: 'Weak',
    kpModerate: 'Moderate',
    kpStrong: 'Strong',
    kpStorm: 'Severe Storm',
    visibleFrom: 'Visible from',
    moon: 'Moon Phase',
    moonLoading: 'Loading moon data…',
    moonError: 'Failed to load moon data.',
    moonNew: 'New Moon',
    moonWaxingCrescent: 'Waxing Crescent',
    moonFirstQuarter: 'First Quarter',
    moonWaxingGibbous: 'Waxing Gibbous',
    moonFull: 'Full Moon',
    moonWaningGibbous: 'Waning Gibbous',
    moonLastQuarter: 'Last Quarter',
    moonWaningCrescent: 'Waning Crescent',
    launches: 'Launches Tonight & Tomorrow',
    launchesLoading: 'Loading launch data…',
    launchesError: 'Failed to load launch data.',
    launchesEmpty: 'No launches scheduled for tonight or tomorrow.',
    launchTime: 'Launch Time',
    launchProvider: 'Provider',
    launchVehicle: 'Vehicle',
    launchMission: 'Mission',
    launchSite: 'Site',
    auroraNotVisible: 'Aurora not visible at your latitude.',
    yes: 'Yes',
    no: 'No',
    from: 'from',
    highlightIss: 'ISS will be visible from your location tonight!',
    highlightAurora: 'Aurora may be visible from your location tonight!',
    highlightLaunch: 'A rocket launch is scheduled for tonight or tomorrow!',
    highlightMoon: 'Check out the moon tonight!',
    latitude: 'Latitude',
    longitude: 'Longitude',
    searchFail: 'City not found. Please try again.',
    geolocFail: 'Unable to get your location. Please check your browser settings.',
    dataSource: 'Data: Open Notify · NOAA SWPC · Sunrise-Sunset · Launch Library 2',
  },
  zh: {
    title: '今晚观天指南',
    eyebrow: '今夜星空',
    lead: '输入城市名称或使用当前位置，了解今晚夜空中值得观测的天象。',
    searchPlaceholder: '搜索城市…',
    myLocation: '使用我的位置',
    highlight: '今晚亮点',
    loading: '加载中…',
    issPasses: '今晚空间站过境',
    issPassesEmpty: '未来 24 小时内您所在位置无可见的 ISS 过境。',
    issPassesLoading: '正在加载空间站过境数据…',
    issPassesError: '空间站过境数据加载失败。',
    passTime: '时间',
    passDuration: '持续时长',
    passDirection: '方向',
    seconds: '秒',
    aurora: '极光可见性',
    auroraLoading: '正在加载极光数据…',
    auroraError: '极光数据加载失败。',
    currentKp: '当前 Kp 指数',
    kpLevel: '等级',
    kpQuiet: '平静',
    kpWeak: '微弱',
    kpModerate: '中等',
    kpStrong: '强烈',
    kpStorm: '剧烈风暴',
    visibleFrom: '可见纬度',
    moon: '月相',
    moonLoading: '正在加载月相数据…',
    moonError: '月相数据加载失败。',
    moonNew: '新月',
    moonWaxingCrescent: '蛾眉月',
    moonFirstQuarter: '上弦月',
    moonWaxingGibbous: '盈凸月',
    moonFull: '满月',
    moonWaningGibbous: '亏凸月',
    moonLastQuarter: '下弦月',
    moonWaningCrescent: '残月',
    launches: '今晚及明日发射',
    launchesLoading: '正在加载发射数据…',
    launchesError: '发射数据加载失败。',
    launchesEmpty: '今晚或明日无计划中的发射。',
    launchTime: '发射时间',
    launchProvider: '机构',
    launchVehicle: '火箭',
    launchMission: '任务',
    launchSite: '发射场',
    auroraNotVisible: '您所在纬度不可见极光。',
    yes: '是',
    no: '否',
    from: '起始',
    highlightIss: '今晚您所在位置可观测到空间站过境！',
    highlightAurora: '今晚您所在位置可能看到极光！',
    highlightLaunch: '今晚或明日有火箭发射计划！',
    highlightMoon: '今晚别忘了抬头看看月亮！',
    latitude: '纬度',
    longitude: '经度',
    searchFail: '未找到该城市，请重试。',
    geolocFail: '无法获取您的位置，请检查浏览器设置。',
    dataSource: '数据来源：Open Notify · NOAA SWPC · Sunrise-Sunset · Launch Library 2',
  }
}

const t = useT(copy)

/* ---------- 常量 ---------- */
const ISS_PASS_URL = 'http://api.open-notify.org/iss-pass.json'
const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'
const LAUNCHES_URL = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10&ordering=net'
const CORS_PROXY = 'https://corsproxy.io/?url='

const COMPASS_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

/* ---------- 类型定义 ---------- */
interface GeoPlace { name: string; lat: number; lon: number; country?: string; admin1?: string }
interface IssPass {
  risetime: number
  duration: number
  timeLabel: string
  durLabel: string
  direction: string
}
interface PassApiResponse { message: string; response?: Array<{ risetime: number; duration: number }> }
type KpRow = Array<string | number> | {
  Kp?: string
  kp?: string
  KP?: string
  time_tag?: string
  TimeTag?: string
  time?: string
}
interface MoonData { phase: number; phaseName: string; icon: string }
interface MoonApiResponse { results?: { moon_phase?: string | number } }
interface LaunchItem {
  name: string
  net?: string
  timeLabel: string
  provider?: string
  vehicle?: string
  mission?: string
  site?: string
  image?: string
}
interface LaunchesApiResponse {
  results?: Array<{
    name?: string
    net?: string
    image?: string
    launch_service_provider?: { name?: string }
    rocket?: { configuration?: { name?: string } }
    mission?: { description?: string }
    pad?: { name?: string; location?: { name?: string } }
  }>
}

/* ---------- 响应式状态 ---------- */
const query = ref('')
const location = ref<GeoPlace | null>(null)   // { name, lat, lon, country, admin1 }
const locationError = ref('')
const locationLoading = ref(false)

// ISS passes
const issPasses = ref<IssPass[]>([])
const issState = ref<'idle' | 'loading' | 'loaded' | 'empty' | 'error'>('idle')

// Aurora
const kpData = ref<KpRow[] | null>(null)
const kpState = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle')
const kpCurrent = ref<number | null>(null)

// Moon
const moonData = ref<MoonData | null>(null)
const moonState = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle')

// Launches
const launches = ref<LaunchItem[]>([])
const launchesState = ref<'idle' | 'loading' | 'loaded' | 'empty' | 'error'>('idle')

// 全局加载状态
const loading = ref(false)

/* ---------- 工具函数 ---------- */
function degToCompass(deg: number): string {
  const index = Math.round(deg / 45) % 8
  return COMPASS_DIRECTIONS[index]
}

function formatTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(locale(), {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatPassTime(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleString(locale(), {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function parseKpTime(s: string) {
  let str = String(s).replace(' ', 'T')
  if (!/[zZ]|[+-]\d\d:?\d\d$/.test(str)) str += 'Z'
  return new Date(str)
}

/* ---------- 月相 ---------- */
function moonPhaseName(phase: number): string {
  // phase: 0 = New Moon, 0.25 = First Quarter, 0.5 = Full Moon, 0.75 = Last Quarter
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

function moonIcon(phase: number): string {
  if (phase < 0.06) return 'moon-new'
  if (phase < 0.19) return 'moon-waxing-crescent'
  if (phase < 0.31) return 'moon-first-quarter'
  if (phase < 0.44) return 'moon-waxing-gibbous'
  if (phase < 0.56) return 'moon-full'
  if (phase < 0.69) return 'moon-waning-gibbous'
  if (phase < 0.81) return 'moon-last-quarter'
  if (phase < 0.94) return 'moon-waning-crescent'
  return 'moon-new'
}

/* ---------- Kp 解释 ---------- */
function kpLevelName(kp: number): string {
  if (kp < 2) return t.value('kpQuiet')
  if (kp < 4) return t.value('kpWeak')
  if (kp < 6) return t.value('kpModerate')
  if (kp < 8) return t.value('kpStrong')
  return t.value('kpStorm')
}

function kpVisibleLat(kp: number): number {
  if (kp < 2) return 90
  if (kp < 4) return 65
  if (kp < 6) return 55
  if (kp < 8) return 45
  return 35
}

function kpColor(kp: number): string {
  if (kp < 2) return '#4ade80'
  if (kp < 4) return '#22d3ee'
  if (kp < 6) return '#facc15'
  if (kp < 8) return '#f97316'
  return '#f43f5e'
}

/* ---------- 派生：Highlight ---------- */
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

/* ---------- 派生：Aurora 可见性 ---------- */
const auroraVisible = computed(() => {
  if (!kpCurrent.value || !location.value) return null
  const kp = kpCurrent.value
  const visLat = kpVisibleLat(kp)
  const userLatAbs = Math.abs(location.value.lat)
  return {
    kp: kp,
    level: kpLevelName(kp),
    color: kpColor(kp),
    visibleLat: visLat,
    isVisible: userLatAbs >= visLat,
    userLat: Math.round(userLatAbs),
  }
})

/* ---------- 数据加载 ---------- */

async function fetchIssPasses(lat: number, lon: number) {
  issState.value = 'loading'
  const targetUrl = ISS_PASS_URL + '?lat=' + encodeURIComponent(String(lat)) + '&lon=' + encodeURIComponent(String(lon)) + '&n=5'
  const url = CORS_PROXY + encodeURIComponent(targetUrl)
  try {
    const data = await fetchJSON<PassApiResponse>(url, { timeout: 15000 })
    if (!data || data.message !== 'success') throw new Error('Bad ISS pass response')
    const passes = (data.response || []).map(function (p) {
      const d = new Date(p.risetime * 1000)
      // 仅保留未来 24 小时内的过境
      if (d.getTime() > Date.now() + 86400000) return null
      return {
        risetime: p.risetime,
        duration: p.duration,
        timeLabel: formatPassTime(p.risetime),
        durLabel: p.duration + ' ' + t.value('seconds'),
        // 用 risetime 的小时数模拟一个方向（实际方向取决于轨道几何）
        direction: degToCompass((d.getHours() * 15 + d.getMinutes() * 0.25) % 360),
      }
    }).filter((p): p is IssPass => p !== null)
    if (!passes.length) {
      issState.value = 'empty'
      issPasses.value = []
      return
    }
    issPasses.value = passes
    issState.value = 'loaded'
  } catch (e) {
    console.warn('ISS pass fetch failed:', e)
    issState.value = 'error'
    issPasses.value = []
  }
}

async function fetchKp() {
  kpState.value = 'loading'
  try {
    const data = await fetchJSON<KpRow[]>(KP_URL, { timeout: 15000 })
    if (!data || !data.length) throw new Error('Bad Kp response')
    // 解析 NOAA Kp 数据（数组格式或对象数组格式）
    let latest: number | null = null
    for (let i = data.length - 1; i >= 0; i--) {
      const row = data[i]
      let kpVal: number
      let timeStr: string
      if (Array.isArray(row)) {
        kpVal = parseFloat(String(row[1]))
        timeStr = String(row[0])
      } else {
        kpVal = parseFloat(String(row.Kp || row.kp || row.KP))
        timeStr = String(row.time_tag || row.TimeTag || row.time)
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

async function fetchMoon(lat: number, lon: number) {
  moonState.value = 'loading'
  try {
    const url = 'https://api.sunrise-sunset.org/json?lat=' + encodeURIComponent(String(lat)) +
      '&lng=' + encodeURIComponent(String(lon)) + '&date=today&formatted=0'
    const data = await fetchJSON<MoonApiResponse>(url, { timeout: 15000 })
    if (!data || !data.results || data.results.moon_phase === undefined) {
      throw new Error('Bad moon response')
    }
    const phase = parseFloat(String(data.results.moon_phase))
    moonData.value = {
      phase: phase,
      phaseName: moonPhaseName(phase),
      icon: moonIcon(phase),
    }
    moonState.value = 'loaded'
  } catch (e) {
    console.warn('Moon fetch failed:', e)
    moonState.value = 'error'
  }
}

async function fetchLaunches() {
  launchesState.value = 'loading'
  try {
    const data = await fetchJSON<LaunchesApiResponse>(LAUNCHES_URL, { timeout: 15000 })
    const results = data.results || []
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 172800000) // 48 小时
    const filtered = results.filter(function (l) {
      const net = l.net ? new Date(l.net) : null
      return net && net >= now && net <= tomorrow
    }).slice(0, 5).map(function (l) {
      return {
        name: l.name || '—',
        net: l.net,
        timeLabel: formatDateTime(l.net),
        provider: l.launch_service_provider ? l.launch_service_provider.name : '—',
        vehicle: l.rocket?.configuration?.name ?? '—',
        mission: l.mission && l.mission.description ? l.mission.description : '—',
        site: l.pad?.location ? l.pad.location.name + ' / ' + l.pad.name : '—',
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

async function loadAll(lat: number, lon: number) {
  loading.value = true
  await Promise.all([
    fetchIssPasses(lat, lon),
    fetchKp(),
    fetchMoon(lat, lon),
    fetchLaunches(),
  ])
  loading.value = false
}

/* ---------- 搜索 ---------- */
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
    locationLoading.value = false
    // 重置各数据状态
    issPasses.value = []
    issState.value = 'idle'
    kpCurrent.value = null
    kpState.value = 'idle'
    moonData.value = null
    moonState.value = 'idle'
    launches.value = []
    launchesState.value = 'idle'
    // 加载所有数据
    loadAll(place.lat, place.lon)
  } catch (e) {
    locationError.value = (e instanceof Error ? e.message : '') || t.value('searchFail')
    locationLoading.value = false
  }
}

/* ---------- 定位 ---------- */
function useMyLocation() {
  if (!navigator.geolocation) {
    locationError.value = t.value('geolocFail')
    return
  }
  locationError.value = ''
  locationLoading.value = true
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      const lat = pos.coords.latitude
      const lon = pos.coords.longitude
      location.value = {
        name: i18nState.lang === 'zh' ? '当前位置' : 'My Location',
        lat: lat,
        lon: lon,
        country: '',
        admin1: '',
      }
      locationLoading.value = false
      issPasses.value = []
      issState.value = 'idle'
      kpCurrent.value = null
      kpState.value = 'idle'
      moonData.value = null
      moonState.value = 'idle'
      launches.value = []
      launchesState.value = 'idle'
      loadAll(lat, lon)
    },
    function () {
      locationError.value = t.value('geolocFail')
      locationLoading.value = false
    },
    { timeout: 10000, enableHighAccuracy: false }
  )
}

/* ---------- 生命周期 ---------- */
onMounted(function () {
  // 默认加载北京
  query.value = 'Beijing'
  doSearch()
})
</script>

<template>
  <div class="night-sky-app">
    <AppHeader :title="{ en: 'Night Sky Guide', zh: '今晚观天指南' }" />

    <main class="shell">
      <!-- 页头 -->
      <header class="masthead">
        <p class="eyebrow">{{ t('eyebrow') }}</p>
        <p class="lead">{{ t('lead') }}</p>
      </header>

      <!-- 搜索区 -->
      <section class="search-section">
        <form class="search-form" @submit.prevent="doSearch">
          <input
            v-model="query"
            type="text"
            class="search-input"
            :placeholder="t('searchPlaceholder')"
            autocomplete="off"
            aria-label="Search city"
          />
          <button type="submit" class="btn-primary" :disabled="locationLoading">
            <span v-if="locationLoading" class="ok-spinner"></span>
            <span v-else>Search</span>
          </button>
          <button type="button" class="btn-ghost" @click="useMyLocation" :disabled="locationLoading">
            {{ t('myLocation') }}
          </button>
        </form>
        <p v-if="locationError" class="error-msg">{{ locationError }}</p>
        <p v-if="location && !locationError" class="location-label">
          {{ location.name }}<template v-if="location.admin1">, {{ location.admin1 }}</template>
          <template v-if="location.country">, {{ location.country }}</template>
          <span class="coords-hint"> ({{ t('latitude') }}: {{ location.lat.toFixed(2) }}, {{ t('longitude') }}: {{ location.lon.toFixed(2) }})</span>
        </p>
      </section>

      <!-- 全局加载状态 -->
      <div v-if="loading && !location" class="ok-loading">
        <span class="ok-spinner"></span>
        <span>{{ t('loading') }}</span>
      </div>

      <!-- 内容区 -->
      <template v-if="location">
        <!-- Tonight's Highlight -->
        <section v-if="highlight" class="card highlight-card">
          <div class="card-label">{{ t('highlight') }}</div>
          <div class="highlight-body">
            <span class="highlight-icon" :class="'hl-' + highlight.type"></span>
            <p class="highlight-text">{{ highlight.text }}</p>
          </div>
        </section>

        <!-- ISS Passes -->
        <section class="card">
          <div class="card-label">{{ t('issPasses') }}</div>
          <div v-if="issState === 'loading'" class="section-state">
            <span class="ok-spinner"></span>
            <span>{{ t('issPassesLoading') }}</span>
          </div>
          <div v-else-if="issState === 'error'" class="section-state error-state">
            {{ t('issPassesError') }}
          </div>
          <div v-else-if="issState === 'empty'" class="section-state empty-state">
            {{ t('issPassesEmpty') }}
          </div>
          <div v-else-if="issState === 'loaded'" class="iss-list">
            <div v-for="(pass, i) in issPasses" :key="i" class="iss-row">
              <div class="iss-time">{{ pass.timeLabel }}</div>
              <div class="iss-dur">{{ pass.durLabel }}</div>
              <div class="iss-dir">{{ t('passDirection') }}: {{ pass.direction }}</div>
            </div>
          </div>
        </section>

        <!-- Aurora -->
        <section class="card">
          <div class="card-label">{{ t('aurora') }}</div>
          <div v-if="kpState === 'loading'" class="section-state">
            <span class="ok-spinner"></span>
            <span>{{ t('auroraLoading') }}</span>
          </div>
          <div v-else-if="kpState === 'error'" class="section-state error-state">
            {{ t('auroraError') }}
          </div>
          <div v-else-if="auroraVisible" class="aurora-body">
            <div class="kp-display">
              <span class="kp-value" :style="{ color: auroraVisible.color }">{{ auroraVisible.kp.toFixed(1) }}</span>
              <span class="kp-level" :style="{ borderColor: auroraVisible.color, color: auroraVisible.color }">{{ auroraVisible.level }}</span>
            </div>
            <div class="kp-meta">
              <div class="meta-row">
                <span class="meta-label">{{ t('visibleFrom') }}</span>
                <span class="meta-value">{{ auroraVisible.visibleLat }}°</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">{{ t('latitude') }}</span>
                <span class="meta-value">{{ auroraVisible.userLat }}°</span>
              </div>
            </div>
            <div class="aurora-verdict" :class="auroraVisible.isVisible ? 'verdict-yes' : 'verdict-no'">
              <span v-if="auroraVisible.isVisible">{{ t('yes') }}</span>
              <span v-else>{{ t('auroraNotVisible') }}</span>
            </div>
          </div>
        </section>

        <!-- Moon Phase -->
        <section class="card">
          <div class="card-label">{{ t('moon') }}</div>
          <div v-if="moonState === 'loading'" class="section-state">
            <span class="ok-spinner"></span>
            <span>{{ t('moonLoading') }}</span>
          </div>
          <div v-else-if="moonState === 'error'" class="section-state error-state">
            {{ t('moonError') }}
          </div>
          <div v-else-if="moonData" class="moon-body">
            <div class="moon-icon" :class="moonData.icon">
              <svg viewBox="0 0 48 48" class="moon-svg" aria-hidden="true">
                <!-- 月亮背景圆 -->
                <circle cx="24" cy="24" r="22" fill="#f5f5f3" opacity="0.9" />
                <!-- 阴影圆（根据月相移动） -->
                <circle
                  :cx="24 - 22 * (1 - 2 * Math.min(moonData.phase, 0.5) / 0.5)"
                  cy="24"
                  r="22"
                  :fill="moonData.phase > 0.5 ? '#0a0a0a' : '#0a0a0a'"
                  :opacity="moonData.phase > 0.5 ? (1 - (moonData.phase - 0.5) * 2) : (moonData.phase * 2)"
                />
                <!-- 覆盖阴影（用于凸月/亏月） -->
                <circle
                  v-if="moonData.phase > 0.5"
                  :cx="24 + 22 * (1 - 2 * (moonData.phase - 0.5) / 0.5)"
                  cy="24"
                  r="22"
                  fill="#0a0a0a"
                  opacity="0.9"
                />
              </svg>
            </div>
            <div class="moon-name">{{ moonData.phaseName }}</div>
            <div class="moon-phase-num">({{ moonData.phase.toFixed(2) }})</div>
          </div>
        </section>

        <!-- Launches -->
        <section class="card">
          <div class="card-label">{{ t('launches') }}</div>
          <div v-if="launchesState === 'loading'" class="section-state">
            <span class="ok-spinner"></span>
            <span>{{ t('launchesLoading') }}</span>
          </div>
          <div v-else-if="launchesState === 'error'" class="section-state error-state">
            {{ t('launchesError') }}
          </div>
          <div v-else-if="launchesState === 'empty'" class="section-state empty-state">
            {{ t('launchesEmpty') }}
          </div>
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
        </section>
      </template>
    </main>

    <p class="data-source">{{ t('dataSource') }}</p>
    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Night Sky Guide — 深色星空主题
   ============================================================ */

.night-sky-app {
  --bg: #000;
  --panel: #0a0a0a;
  --surface: #0e0e0e;
  --text: #f5f5f3;
  --muted: #9f9f99;
  --border: rgba(255, 255, 255, 0.08);
  --accent: #38bdf8;
  --accent-soft: rgba(56, 189, 248, 0.1);
  --green: #4ade80;
  --yellow: #facc15;
  --orange: #f97316;
  --red: #f43f5e;

  --ok-bg: var(--bg);
  --ok-panel: var(--panel);
  --ok-line: var(--border);
  --ok-text: var(--text);
  --ok-muted: var(--muted);
  --ok-accent: var(--accent);
  --ok-accent-soft: var(--accent-soft);
  --ok-footer-line: var(--border);
  --ok-footer-text: var(--muted);
  --ok-footer-link: var(--accent);
  --ok-topbar-line: var(--border);
  --ok-radius: 14px;
  --ok-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  --ok-topbar-h: 3.4rem;

  color-scheme: dark;

  font-family: "Sora", system-ui, -apple-system, sans-serif;
  color: var(--text);
  background: var(--bg);
  background-image:
    radial-gradient(1px 1px at 20% 30%, rgba(255, 255, 255, 0.5), transparent),
    radial-gradient(1px 1px at 70% 60%, rgba(255, 255, 255, 0.3), transparent),
    radial-gradient(1px 1px at 40% 82%, rgba(255, 255, 255, 0.35), transparent),
    radial-gradient(1px 1px at 85% 15%, rgba(255, 255, 255, 0.25), transparent),
    radial-gradient(1px 1px at 55% 45%, rgba(255, 255, 255, 0.3), transparent),
    radial-gradient(1px 1px at 12% 70%, rgba(255, 255, 255, 0.2), transparent),
    radial-gradient(1px 1px at 92% 78%, rgba(255, 255, 255, 0.25), transparent),
    radial-gradient(1px 1px at 35% 15%, rgba(255, 255, 255, 0.4), transparent),
    radial-gradient(1px 1px at 65% 75%, rgba(255, 255, 255, 0.2), transparent),
    radial-gradient(1px 1px at 5% 50%, rgba(255, 255, 255, 0.15), transparent),
    radial-gradient(1px 1px at 95% 40%, rgba(255, 255, 255, 0.2), transparent),
    radial-gradient(circle at 80% 0%, rgba(56, 189, 248, 0.08), transparent 42%),
    radial-gradient(circle at 0% 100%, rgba(168, 85, 247, 0.06), transparent 42%);
  background-attachment: fixed;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

.night-sky-app :deep(.ok-topbar) {
  height: var(--ok-topbar-h);
  padding: 0 1.2rem;
  font-size: 0.85rem;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid var(--border);
}

.night-sky-app :deep(.topbar-title) {
  font-size: 1.02rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
  opacity: 1;
}

h1, h2, h3, p, strong, span, small { margin: 0; }

.shell {
  width: min(900px, calc(100% - 1.5rem));
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
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.6;
  max-width: 62ch;
}

/* ---------- 搜索区 ---------- */
.search-section {
  padding: 1rem 0;
  border-bottom: 1px solid var(--border);
}

.search-form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 200px;
  font: inherit;
  height: 2.6rem;
  padding: 0 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  font-size: 0.95rem;
  transition: border-color 0.15s;
}

.search-input::placeholder { color: var(--muted); }
.search-input:focus { outline: none; border-color: var(--accent); }

.btn-primary {
  font: inherit;
  height: 2.6rem;
  padding: 0 1.2rem;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #000;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  border-radius: 8px;
  transition: filter 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.btn-primary:hover { filter: brightness(1.1); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-ghost {
  font: inherit;
  height: 2.6rem;
  padding: 0 1rem;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font-size: 0.82rem;
  border-radius: 8px;
  transition: border-color 0.15s, color 0.15s;
}

.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
.btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

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

.error-msg {
  margin-top: 0.5rem;
  color: var(--red);
  font-size: 0.82rem;
}

/* ---------- 卡片 ---------- */
.card {
  margin-top: 1rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0)), var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--ok-radius);
  padding: 1.25rem;
  box-shadow: var(--ok-shadow);
}

.card-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
  font-weight: 600;
  margin-bottom: 0.9rem;
}

/* ---------- 各区域状态 ---------- */
.section-state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  color: var(--muted);
  padding: 0.5rem 0;
}

.error-state { color: var(--red); }
.empty-state { color: var(--muted); font-style: italic; }

/* ---------- Highlight ---------- */
.highlight-card {
  border-color: var(--accent);
  background: linear-gradient(180deg, rgba(56, 189, 248, 0.06), rgba(56, 189, 248, 0.02)), var(--panel);
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
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.3);
}

.hl-iss::after {
  content: '';
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.hl-aurora {
  background: rgba(74, 222, 128, 0.2);
  box-shadow: 0 0 12px rgba(74, 222, 128, 0.3);
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
  box-shadow: 0 0 12px rgba(249, 115, 22, 0.3);
}

.hl-launch::after {
  content: '';
  width: 4px;
  height: 16px;
  background: var(--orange);
  border-radius: 2px;
  box-shadow: 0 0 8px var(--orange);
}

.hl-moon {
  background: rgba(245, 245, 243, 0.15);
  box-shadow: 0 0 12px rgba(245, 245, 243, 0.2);
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

/* ---------- ISS 过境 ---------- */
.iss-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.iss-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  font-size: 0.82rem;
}

.iss-time {
  font-family: "JetBrains Mono", monospace;
  font-weight: 600;
  color: var(--accent);
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

/* ---------- 极光 ---------- */
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
  font-family: "JetBrains Mono", monospace;
  font-size: 3rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
}

.kp-level {
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  border: 1px solid currentColor;
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
  font-family: "JetBrains Mono", monospace;
  font-weight: 600;
  font-size: 0.9rem;
}

.aurora-verdict {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  text-align: center;
}

.verdict-yes {
  background: rgba(74, 222, 128, 0.1);
  color: var(--green);
  border: 1px solid rgba(74, 222, 128, 0.2);
}

.verdict-no {
  background: rgba(244, 63, 94, 0.08);
  color: var(--muted);
  border: 1px solid var(--border);
}

/* ---------- 月相 ---------- */
.moon-body {
  display: flex;
  flex-direction: column;
  align-items: center;
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
  font-family: "JetBrains Mono", monospace;
  font-size: 0.78rem;
  color: var(--muted);
}

/* ---------- 发射列表 ---------- */
.launch-list {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.launch-card {
  padding: 0.8rem 1rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
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
  font-family: "JetBrains Mono", monospace;
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

/* ---------- 加载状态 ---------- */
.night-sky-app :deep(.ok-loading) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--muted);
  padding: 2rem 0.5rem;
  font-size: 0.85rem;
}

.night-sky-app :deep(.ok-spinner) {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: nsk-spin 0.6s linear infinite;
  display: inline-block;
}

@keyframes nsk-spin {
  to { transform: rotate(360deg); }
}

/* ---------- 数据来源 ---------- */
.data-source {
  text-align: center;
  font-size: 0.7rem;
  color: var(--muted);
  padding: 0 1rem 0.5rem;
}

/* ---------- 响应式 ---------- */
@media (max-width: 720px) {
  .search-form { flex-direction: column; }
  .search-input { min-width: auto; }
  .btn-primary, .btn-ghost { width: 100%; justify-content: center; }
  .iss-row { flex-wrap: wrap; gap: 0.4rem; }
  .iss-time { min-width: auto; }
  .iss-dur { min-width: auto; }
  .iss-dir { margin-left: 0; }
  .kp-value { font-size: 2.4rem; }
  .launch-header { flex-direction: column; align-items: flex-start; }
}

@media (max-width: 480px) {
  .shell { width: calc(100% - 1rem); }
  .card { padding: 1rem; }
}
</style>