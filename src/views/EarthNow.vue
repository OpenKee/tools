<script setup>
/* ============================================================
   Earth Now — 此刻地球
   多 API 协作的融合应用：展示此刻地球上正在发生的实时事件。
   数据源（6 个 API 围绕"此刻"时间切片协作）：
     · USGS 地震（最近 1 小时）
     · wheretheiss.at（ISS 当前位置）
     · NOAA SWPC（行星 Kp 指数）
     · Launch Library 2（即将发射）
     · MAAS2（火星天气，经 corsproxy）
     · howmanypeopleareinspacerightnow.com（在轨人数，经 corsproxy）
   每 60 秒自动刷新；各模块独立 loading/error，Promise.allSettled 并发。
   ============================================================ */

import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- i18n 文案 ---------- */
const copy = {
  en: {
    eyebrow: 'Real-time planet pulse',
    title: 'Earth Now',
    lead: 'A single screen of what is happening on Earth right now: earthquakes, the ISS overhead, aurora, launches, Mars weather, and humans in orbit.',
    now: 'Now',
    refreshHint: 'Auto-refresh every 60s',
    quakes: 'Past 1 Hour Earthquakes',
    iss: 'International Space Station',
    aurora: 'Aurora Activity',
    launch: 'Next Launch',
    mars: 'Mars Right Now',
    people: 'People in Space',
    /* earthquake */
    quakeStat: '{n} quakes in the past hour, max M{m}',
    noQuakes: 'No earthquakes in the past hour.',
    /* iss */
    flyingOver: 'Flying over {region}',
    latitude: 'Latitude',
    longitude: 'Longitude',
    region: 'Region',
    speed: 'Speed',
    altitude: 'Altitude',
    /* aurora */
    visibleRange: 'Visible range',
    visibleAbove: 'Visible above {lat}° N',
    levelQuiet: 'Quiet',
    levelWeak: 'Weak',
    levelModerate: 'Moderate',
    levelStrong: 'Strong',
    levelStorm: 'Severe Storm',
    auroraNote: 'Higher Kp pushes the aurora oval toward the equator.',
    /* launch */
    days: 'D',
    hours: 'H',
    minutes: 'M',
    seconds: 'S',
    rocket: 'Rocket',
    pad: 'Launch site',
    mission: 'Mission',
    noLaunch: 'No upcoming launches.',
    launched: 'Launch window open',
    /* mars */
    marsHigh: 'High',
    marsLow: 'Low',
    marsSol: 'Sol',
    marsSeason: 'Season',
    marsVsEarth: 'Earth avg ~15°C · Mars is {diff}°C colder',
    marsFailed: 'Mars data unavailable.',
    /* people */
    inOrbit: 'in orbit',
    onIss: 'on ISS',
    /* states */
    loading: 'Loading…',
    error: 'Failed to load.',
  },
  zh: {
    eyebrow: '实时地球脉搏',
    title: '此刻地球',
    lead: '一屏看清此刻地球上正在发生什么：地震、空间站位、极光、火箭发射、火星天气与在轨人数。',
    now: '此刻',
    refreshHint: '每 60 秒自动刷新',
    quakes: '过去 1 小时地震',
    iss: '国际空间站',
    aurora: '极光活动',
    launch: '下次发射',
    mars: '火星当前',
    people: '人在太空',
    /* earthquake */
    quakeStat: '过去 1 小时 {n} 次地震，最大 M{m}',
    noQuakes: '过去 1 小时无地震记录。',
    /* iss */
    flyingOver: '正在飞越 {region}',
    latitude: '纬度',
    longitude: '经度',
    region: '所在区域',
    speed: '速度',
    altitude: '高度',
    /* aurora */
    visibleRange: '可见范围',
    visibleAbove: '北纬 {lat}° 以上可见',
    levelQuiet: '平静',
    levelWeak: '弱',
    levelModerate: '中等',
    levelStrong: '强',
    levelStorm: '强风暴',
    auroraNote: 'Kp 越高，极光椭圆越向赤道方向扩展。',
    /* launch */
    days: '天',
    hours: '时',
    minutes: '分',
    seconds: '秒',
    rocket: '火箭',
    pad: '发射场',
    mission: '任务',
    noLaunch: '暂无即将发射。',
    launched: '发射窗口已开启',
    /* mars */
    marsHigh: '最高温',
    marsLow: '最低温',
    marsSol: '火星日',
    marsSeason: '季节',
    marsVsEarth: '地球均温约 15°C · 火星比地球冷 {diff}°C',
    marsFailed: '火星数据获取失败。',
    /* people */
    inOrbit: '在轨',
    onIss: '在 ISS',
    /* states */
    loading: '加载中…',
    error: '数据获取失败。',
  }
}
const t = useT(copy)

/* ---------- API 地址 ---------- */
const ISS_URL = 'https://api.wheretheiss.at/v1/satellites/25544'
const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'
const LAUNCH_URL = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=5&ordering=net'
const MARS_URL = 'https://corsproxy.io/?url=https%3A%2F%2Fapi.maas2.apollorion.com%2F'
const PEOPLE_URL = 'https://corsproxy.io/?url=' + encodeURIComponent('https://www.howmanypeopleareinspacerightnow.com/peopleinspace.json')

function quakeUrl() {
  const now = new Date()
  const start = new Date(now.getTime() - 3600000)
  return 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=' +
    start.toISOString() + '&endtime=' + now.toISOString() + '&orderby=time&limit=50'
}

/* ---------- 简化区域判断（粗略经纬度框，中英名称）---------- */
const CONTINENTS = [
  [25, 72, -168, -52, 'North America', '北美洲'],
  [-56, 13, -82, -34, 'South America', '南美洲'],
  [36, 71, -10, 40, 'Europe', '欧洲'],
  [-35, 37, -18, 52, 'Africa', '非洲'],
  [5, 77, 40, 145, 'Asia', '亚洲'],
  [-10, 25, 95, 141, 'Southeast Asia', '东南亚'],
  [-44, -10, 112, 154, 'Australia', '澳大利亚'],
  [60, 83, -55, -20, 'Greenland', '格陵兰'],
]
const OCEANS = [
  [-60, 60, -180, -130, 'Pacific Ocean', '太平洋'],
  [-60, 60, 120, 180, 'Pacific Ocean', '太平洋'],
  [-60, 60, -70, -15, 'Atlantic Ocean', '大西洋'],
  [-30, 25, 45, 100, 'Indian Ocean', '印度洋'],
]

function detectRegion(lat, lon) {
  if (lat > 66.5) return { en: 'Arctic region', zh: '北极地区' }
  if (lat < -66.5) return { en: 'Antarctic region', zh: '南极地区' }
  for (let i = 0; i < CONTINENTS.length; i++) {
    const c = CONTINENTS[i]
    if (lat >= c[0] && lat <= c[1] && lon >= c[2] && lon <= c[3]) {
      return { en: c[4], zh: c[5] }
    }
  }
  for (let i = 0; i < OCEANS.length; i++) {
    const o = OCEANS[i]
    if (lat >= o[0] && lat <= o[1] && lon >= o[2] && lon <= o[3]) {
      return { en: o[4], zh: o[5] }
    }
  }
  return { en: 'Open ocean', zh: '开阔海域' }
}

/* ---------- 模块状态（各模块独立 loading/error）---------- */
const nowTick = ref(Date.now())            // 每秒更新（驱动"此刻"时间戳 + 倒计时）
const quakeData = ref([])
const quakeState = ref('loading')          // loading | loaded | error
const issData = ref(null)
const issState = ref('loading')
const kpData = ref(null)
const kpState = ref('loading')
const launchData = ref(null)
const launchState = ref('loading')         // loading | loaded | empty | error
const marsData = ref(null)
const marsState = ref('loading')
const peopleData = ref(null)
const peopleState = ref('loading')

/* ---------- 各模块独立加载函数 ---------- */
async function loadQuakes() {
  quakeState.value = 'loading'
  try {
    const d = await fetchJSON(quakeUrl(), { timeout: 15000 })
    const feats = (d && d.features) || []
    quakeData.value = feats
      .map(function (f) {
        const p = f && f.properties
        return {
          time: p && p.time,
          mag: p && p.mag,
          place: p && p.place,
        }
      })
      .filter(function (e) { return e.mag != null })
      .sort(function (a, b) { return (b.time || 0) - (a.time || 0) })
    quakeState.value = 'loaded'
  } catch (e) {
    quakeState.value = 'error'
  }
}

async function loadIss() {
  issState.value = 'loading'
  try {
    const d = await fetchJSON(ISS_URL, { timeout: 15000 })
    if (!d || typeof d.latitude === 'undefined') throw new Error('bad iss')
    issData.value = {
      lat: parseFloat(d.latitude),
      lon: parseFloat(d.longitude),
      ts: d.timestamp ? d.timestamp * 1000 : Date.now(),
      speed: d.velocity != null ? parseFloat(d.velocity) : null,
      alt: d.altitude != null ? parseFloat(d.altitude) : null,
    }
    issState.value = 'loaded'
  } catch (e) {
    issState.value = 'error'
  }
}

// NOAA Kp 兼容两种格式：嵌套数组 [['time_tag','Kp',...], ...] 或对象数组
function normalizeKpRow(r) {
  if (!r) return null
  if (Array.isArray(r)) {
    return { time: r[0], kp: parseFloat(r[1]) }
  }
  const time = r.time_tag || r.time
  const kp = r.Kp != null ? r.Kp : r.kp
  return { time: time, kp: parseFloat(kp) }
}

async function loadKp() {
  kpState.value = 'loading'
  try {
    const d = await fetchJSON(KP_URL, { timeout: 15000 })
    if (!Array.isArray(d) || d.length < 2) throw new Error('bad kp')
    const rows = d
      .map(normalizeKpRow)
      .filter(function (r) { return r && !isNaN(r.kp) })
    let latest = null
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].kp != null) { latest = rows[i]; break }
    }
    if (!latest) throw new Error('no kp row')
    kpData.value = latest
    kpState.value = 'loaded'
  } catch (e) {
    kpState.value = 'error'
  }
}

async function loadLaunch() {
  launchState.value = 'loading'
  try {
    const d = await fetchJSON(LAUNCH_URL, { timeout: 15000 })
    const results = (d && d.results) || []
    const now = Date.now()
    const next = results.find(function (l) {
      return l && l.net && new Date(l.net).getTime() > now
    }) || results[0] || null
    launchData.value = next
    launchState.value = next ? 'loaded' : 'empty'
  } catch (e) {
    launchState.value = 'error'
  }
}

async function loadMars() {
  marsState.value = 'loading'
  try {
    const d = await fetchJSON(MARS_URL, { timeout: 15000 })
    if (!d || d.sol == null) throw new Error('bad mars')
    marsData.value = {
      sol: d.sol,
      max: d.max_temp != null ? d.max_temp : null,
      min: d.min_temp != null ? d.min_temp : null,
      season: d.season || '',
    }
    marsState.value = 'loaded'
  } catch (e) {
    marsState.value = 'error'
  }
}

async function loadPeople() {
  peopleState.value = 'loading'
  try {
    const d = await fetchJSON(PEOPLE_URL, { timeout: 15000 })
    if (!d || typeof d.number === 'undefined') throw new Error('bad people')
    peopleData.value = {
      number: d.number,
      people: Array.isArray(d.people) ? d.people : [],
    }
    peopleState.value = 'loaded'
  } catch (e) {
    peopleState.value = 'error'
  }
}

// 并发拉取全部数据；单个失败不影响其他
function loadAll() {
  Promise.allSettled([loadQuakes(), loadIss(), loadKp(), loadLaunch(), loadMars(), loadPeople()])
}

/* ---------- 派生：此刻时间戳 ---------- */
const nowText = computed(function () {
  return new Date(nowTick.value).toLocaleString(locale(), {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
})

/* ---------- 派生：地震模块 ---------- */
const quakeList = computed(function () { return quakeData.value.slice(0, 8) })
const quakeStat = computed(function () {
  const list = quakeData.value
  if (!list.length) return { n: 0, max: null }
  let max = -Infinity
  for (let i = 0; i < list.length; i++) {
    if (list[i].mag > max) max = list[i].mag
  }
  return { n: list.length, max: max }
})
function quakeTimeAgo(ts) {
  if (!ts) return '--'
  const sec = Math.max(0, Math.floor((nowTick.value - ts) / 1000))
  if (sec < 60) return sec + 's'
  const min = Math.floor(sec / 60)
  if (min < 60) return min + 'm'
  return Math.floor(min / 60) + 'h'
}
function magClass(m) {
  if (m == null) return 'mag-na'
  if (m < 4) return 'mag-low'
  if (m < 5) return 'mag-mid'
  if (m < 6) return 'mag-high'
  return 'mag-severe'
}

/* ---------- 派生：ISS 模块 ---------- */
const issRegion = computed(function () {
  if (!issData.value) return '--'
  const r = detectRegion(issData.value.lat, issData.value.lon)
  return i18nState.lang === 'zh' ? r.zh : r.en
})
const issLatText = computed(function () {
  return issData.value ? issData.value.lat.toFixed(3) + '°' : '--'
})
const issLonText = computed(function () {
  return issData.value ? issData.value.lon.toFixed(3) + '°' : '--'
})
const issSpeedText = computed(function () {
  const s = issData.value && issData.value.speed
  if (s == null) return '~27,600 km/h'
  return Math.round(s).toLocaleString(locale()) + ' km/h'
})
const issAltText = computed(function () {
  const a = issData.value && issData.value.alt
  return (a != null ? '~' + Math.round(a) : '~408') + ' km'
})

/* ---------- 派生：极光模块 ---------- */
function kpLevel(kp) {
  if (kp < 4) return { key: 'levelQuiet', cls: 'kp-quiet' }
  if (kp < 5) return { key: 'levelWeak', cls: 'kp-weak' }
  if (kp < 6) return { key: 'levelModerate', cls: 'kp-moderate' }
  if (kp < 7) return { key: 'levelStrong', cls: 'kp-strong' }
  return { key: 'levelStorm', cls: 'kp-storm' }
}
const kpValue = computed(function () { return kpData.value ? kpData.value.kp : null })
const kpDisplay = computed(function () {
  return kpValue.value != null ? kpValue.value.toFixed(1) : '--'
})
const kpLevelInfo = computed(function () {
  return kpValue.value != null ? kpLevel(kpValue.value) : null
})
const kpVisibleLat = computed(function () {
  if (kpValue.value == null) return '--'
  return Math.round(66 - 2 * kpValue.value)
})

/* ---------- 派生：发射倒计时（每秒 tick 由 nowTick 驱动）---------- */
const countdown = computed(function () {
  if (!launchData.value || !launchData.value.net) return null
  const target = new Date(launchData.value.net).getTime()
  if (isNaN(target)) return null
  let diff = target - nowTick.value
  const launched = diff <= 0
  diff = Math.max(0, diff)
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
    launched: launched,
  }
})
function pad2(n) { return n < 10 ? '0' + n : '' + n }
const launchRocket = computed(function () {
  const l = launchData.value
  if (!l || !l.rocket || !l.rocket.configuration) return ''
  const c = l.rocket.configuration
  return c.full_name || c.name || ''
})
const launchPad = computed(function () {
  const l = launchData.value
  if (!l || !l.pad) return ''
  if (l.pad.location && l.pad.location.name) return l.pad.location.name
  return l.pad.name || ''
})
const launchMission = computed(function () {
  const l = launchData.value
  if (!l) return ''
  return (l.mission && l.mission.name) || l.name || ''
})

/* ---------- 派生：火星模块 ---------- */
const marsSolText = computed(function () {
  return marsData.value ? marsData.value.sol : '--'
})
const marsHighText = computed(function () {
  return marsData.value && marsData.value.max != null ? marsData.value.max + '°C' : '--'
})
const marsLowText = computed(function () {
  return marsData.value && marsData.value.min != null ? marsData.value.min + '°C' : '--'
})
const marsSeasonText = computed(function () {
  return marsData.value ? marsData.value.season : '--'
})
const marsDiff = computed(function () {
  if (!marsData.value || marsData.value.max == null) return null
  return Math.round(15 - marsData.value.max)
})

/* ---------- 派生：在轨人数模块 ---------- */
const peopleNumber = computed(function () {
  return peopleData.value ? peopleData.value.number : '--'
})
const peopleOnIss = computed(function () {
  if (!peopleData.value) return '--'
  const list = peopleData.value.people || []
  let n = 0
  for (let i = 0; i < list.length; i++) if (list[i].craft === 'ISS') n++
  return n
})
const peopleTop = computed(function () {
  if (!peopleData.value) return []
  return (peopleData.value.people || []).slice(0, 3)
})

/* ---------- 生命周期：定时器 ---------- */
let nowTimer = null       // 每秒 tick（"此刻"时间戳 + 倒计时）
let refreshTimer = null   // 每 60 秒刷新全部数据

onMounted(function () {
  nowTick.value = Date.now()
  loadAll()
  nowTimer = setInterval(function () { nowTick.value = Date.now() }, 1000)
  refreshTimer = setInterval(loadAll, 60000)
})

onBeforeUnmount(function () {
  if (nowTimer) { clearInterval(nowTimer); nowTimer = null }
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null }
})
</script>

<template>
  <div class="earth-now">
    <AppHeader :title="{ en: 'Earth Now', zh: '此刻地球' }" :show-lang-toggle="true" />

    <main class="shell">
      <header class="masthead">
        <p class="eyebrow">{{ t('eyebrow') }}</p>
        <h1>{{ t('title') }}</h1>
        <p class="lead">{{ t('lead') }}</p>
      </header>

      <!-- 顶部"此刻"时间戳条 -->
      <div class="now-bar" aria-live="polite">
        <span class="now-dot" aria-hidden="true">●</span>
        <span class="now-label">{{ t('now') }}</span>
        <span class="now-time">{{ nowText }}</span>
        <span class="now-hint">{{ t('refreshHint') }}</span>
      </div>

      <!-- 模块网格 -->
      <section class="grid">
        <!-- 1. 地震流模块（占 2 列宽） -->
        <article class="card card-wide quake-card">
          <div class="card-eyebrow">{{ t('quakes') }}</div>
          <div v-if="quakeState === 'loading'" class="card-state">{{ t('loading') }}</div>
          <div v-else-if="quakeState === 'error'" class="card-state card-error">{{ t('error') }}</div>
          <template v-else>
            <div class="stat-row">
              <span v-if="quakeStat.n > 0">
                {{ t('quakeStat').replace('{n}', quakeStat.n).replace('{m}', quakeStat.max != null ? quakeStat.max.toFixed(1) : '--') }}
              </span>
              <span v-else>{{ t('noQuakes') }}</span>
            </div>
            <ul class="quake-list">
              <li v-for="(q, i) in quakeList" :key="i" class="quake-item">
                <span class="quake-time">{{ quakeTimeAgo(q.time) }}</span>
                <span class="mag-badge" :class="magClass(q.mag)">M{{ q.mag.toFixed(1) }}</span>
                <span class="quake-place">{{ q.place || '--' }}</span>
              </li>
            </ul>
          </template>
        </article>

        <!-- 2. ISS 模块 -->
        <article class="card iss-card">
          <div class="card-eyebrow">{{ t('iss') }}</div>
          <div v-if="issState === 'loading'" class="card-state">{{ t('loading') }}</div>
          <div v-else-if="issState === 'error'" class="card-state card-error">{{ t('error') }}</div>
          <template v-else-if="issData">
            <div class="flying">{{ t('flyingOver').replace('{region}', issRegion) }}</div>
            <div class="metric-rows">
              <div class="metric"><span>{{ t('latitude') }}</span><strong>{{ issLatText }}</strong></div>
              <div class="metric"><span>{{ t('longitude') }}</span><strong>{{ issLonText }}</strong></div>
              <div class="metric"><span>{{ t('region') }}</span><strong>{{ issRegion }}</strong></div>
              <div class="metric"><span>{{ t('speed') }}</span><strong>{{ issSpeedText }}</strong></div>
              <div class="metric"><span>{{ t('altitude') }}</span><strong>{{ issAltText }}</strong></div>
            </div>
          </template>
        </article>

        <!-- 3. 极光模块 -->
        <article class="card aurora-card">
          <div class="card-eyebrow">{{ t('aurora') }}</div>
          <div v-if="kpState === 'loading'" class="card-state">{{ t('loading') }}</div>
          <div v-else-if="kpState === 'error'" class="card-state card-error">{{ t('error') }}</div>
          <template v-else>
            <div class="kp-main">
              <div class="kp-value">{{ kpDisplay }}</div>
              <div v-if="kpLevelInfo" class="kp-level" :class="kpLevelInfo.cls">{{ t(kpLevelInfo.key) }}</div>
            </div>
            <div class="metric"><span>{{ t('visibleRange') }}</span><strong>{{ t('visibleAbove').replace('{lat}', kpVisibleLat) }}</strong></div>
            <p class="aurora-note">{{ t('auroraNote') }}</p>
          </template>
        </article>

        <!-- 4. 发射倒计时模块 -->
        <article class="card launch-card">
          <div class="card-eyebrow">{{ t('launch') }}</div>
          <div v-if="launchState === 'loading'" class="card-state">{{ t('loading') }}</div>
          <div v-else-if="launchState === 'error'" class="card-state card-error">{{ t('error') }}</div>
          <div v-else-if="launchState === 'empty' || !launchData" class="card-state">{{ t('noLaunch') }}</div>
          <template v-else>
            <div v-if="countdown && countdown.launched" class="launch-launched">{{ t('launched') }}</div>
            <div v-else-if="countdown" class="countdown">
              <div class="cd-unit"><span class="cd-val">{{ pad2(countdown.d) }}</span><span class="cd-lab">{{ t('days') }}</span></div>
              <span class="cd-sep">:</span>
              <div class="cd-unit"><span class="cd-val">{{ pad2(countdown.h) }}</span><span class="cd-lab">{{ t('hours') }}</span></div>
              <span class="cd-sep">:</span>
              <div class="cd-unit"><span class="cd-val">{{ pad2(countdown.m) }}</span><span class="cd-lab">{{ t('minutes') }}</span></div>
              <span class="cd-sep">:</span>
              <div class="cd-unit"><span class="cd-val">{{ pad2(countdown.s) }}</span><span class="cd-lab">{{ t('seconds') }}</span></div>
            </div>
            <div class="metric"><span>{{ t('rocket') }}</span><strong>{{ launchRocket }}</strong></div>
            <div class="metric"><span>{{ t('pad') }}</span><strong>{{ launchPad }}</strong></div>
            <div class="metric"><span>{{ t('mission') }}</span><strong>{{ launchMission }}</strong></div>
          </template>
        </article>

        <!-- 5. 火星模块 -->
        <article class="card mars-card">
          <div class="card-eyebrow">{{ t('mars') }}</div>
          <div v-if="marsState === 'loading'" class="card-state">{{ t('loading') }}</div>
          <div v-else-if="marsState === 'error'" class="card-state card-error">{{ t('marsFailed') }}</div>
          <template v-else-if="marsData">
            <div class="mars-temp-row">
              <div class="mars-temp high">
                <span class="t-lab">{{ t('marsHigh') }}</span>
                <span class="t-val">{{ marsHighText }}</span>
              </div>
              <div class="mars-temp low">
                <span class="t-lab">{{ t('marsLow') }}</span>
                <span class="t-val">{{ marsLowText }}</span>
              </div>
            </div>
            <div class="metric"><span>{{ t('marsSol') }}</span><strong>Sol {{ marsSolText }}</strong></div>
            <div class="metric"><span>{{ t('marsSeason') }}</span><strong>{{ marsSeasonText }}</strong></div>
            <p v-if="marsDiff != null" class="mars-vs">{{ t('marsVsEarth').replace('{diff}', marsDiff) }}</p>
          </template>
        </article>

        <!-- 6. 在轨人数模块 -->
        <article class="card people-card">
          <div class="card-eyebrow">{{ t('people') }}</div>
          <div v-if="peopleState === 'loading'" class="card-state">{{ t('loading') }}</div>
          <div v-else-if="peopleState === 'error'" class="card-state card-error">{{ t('error') }}</div>
          <template v-else-if="peopleData">
            <div class="people-main">
              <div class="people-number">{{ peopleNumber }}</div>
              <div class="people-sub">{{ t('inOrbit') }} · {{ peopleOnIss }} {{ t('onIss') }}</div>
            </div>
            <ul class="people-list">
              <li v-for="(p, i) in peopleTop" :key="i" class="people-item">
                <span class="people-name">{{ p.name }}</span>
                <span class="people-craft">{{ p.craft }}</span>
              </li>
            </ul>
          </template>
        </article>
      </section>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Earth Now — 深色地球主题
   在组件根类 .earth-now 上覆盖 --ok-* 令牌，
   影响 AppHeader / AppFooter 等共享子组件。
   ============================================================ */

.earth-now {
  /* 主题变量（按规范覆盖） */
  --ok-bg: #0a0e1a;
  --ok-panel: #131829;
  --ok-line: rgba(255, 255, 255, 0.08);
  --ok-text: #e8edf5;
  --ok-muted: #8a96b0;
  --ok-accent: #38bdf8;

  /* 共享组件主题映射 */
  --ok-accent-soft: rgba(56, 189, 248, 0.12);
  --ok-topbar-line: var(--ok-line);
  --ok-footer-line: var(--ok-line);
  --ok-footer-text: var(--ok-muted);
  --ok-footer-link: var(--ok-accent);

  color-scheme: dark;

  min-height: 100vh;
  color: var(--ok-text);
  background: var(--ok-bg);
  /* 简洁径向渐变模拟星空 */
  background-image:
    radial-gradient(circle at 18% 0%, rgba(56, 189, 248, 0.10), transparent 42%),
    radial-gradient(circle at 82% 8%, rgba(99, 102, 241, 0.08), transparent 44%),
    radial-gradient(1px 1px at 22% 32%, rgba(255, 255, 255, 0.55), transparent),
    radial-gradient(1px 1px at 68% 58%, rgba(255, 255, 255, 0.4), transparent),
    radial-gradient(1px 1px at 42% 80%, rgba(255, 255, 255, 0.35), transparent),
    radial-gradient(1px 1px at 88% 22%, rgba(255, 255, 255, 0.3), transparent),
    radial-gradient(1px 1px at 12% 70%, rgba(255, 255, 255, 0.28), transparent);
  background-attachment: fixed;
  -webkit-font-smoothing: antialiased;
}

.earth-now h1, .earth-now h2, .earth-now h3,
.earth-now p, .earth-now strong, .earth-now span,
.earth-now small, .earth-now li { margin: 0; }

/* ---------- 主容器 ---------- */
.shell {
  width: min(1180px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

/* ---------- 页头 ---------- */
.masthead {
  padding: 0.4rem 0 1.1rem;
  border-bottom: 1px solid var(--ok-line);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--ok-accent);
}

.masthead h1 {
  margin-top: 0.3rem;
  font-size: clamp(2.1rem, 5.5vw, 3.2rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
  font-weight: 800;
}

.lead {
  margin-top: 0.5rem;
  color: var(--ok-muted);
  font-size: 0.9rem;
  line-height: 1.6;
  max-width: 60ch;
}

/* ---------- "此刻"时间戳条 ---------- */
.now-bar {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--ok-line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
}

.now-dot {
  color: #4ade80;
  font-size: 0.7rem;
  line-height: 1;
  animation: now-pulse 1.6s ease-in-out infinite;
}

@keyframes now-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
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
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--ok-text);
}

.now-hint {
  margin-left: auto;
  font-size: 0.7rem;
  color: var(--ok-muted);
}

/* ---------- 模块网格 ---------- */
.grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
  align-items: start;
}

.card-wide { grid-column: span 2; }

/* ---------- 卡片 ---------- */
.card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--ok-line);
  border-radius: 14px;
  padding: 1.1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--ok-muted);
}

.card-state {
  color: var(--ok-muted);
  font-size: 0.85rem;
  padding: 0.6rem 0;
}

.card-error {
  color: #f87171;
}

/* ---------- 通用 metric 行 ---------- */
.metric-rows {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.metric {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.6rem;
  font-size: 0.82rem;
}

.metric span { color: var(--ok-muted); }

.metric strong {
  font-family: var(--ok-mono);
  font-weight: 600;
  color: var(--ok-text);
  text-align: right;
}

/* ---------- 地震流模块 ---------- */
.stat-row {
  font-size: 0.86rem;
  color: var(--ok-text);
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--ok-line);
}

.quake-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.quake-item {
  display: grid;
  grid-template-columns: 44px 56px 1fr;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.8rem;
  padding: 0.25rem 0;
}

.quake-time {
  font-family: var(--ok-mono);
  font-size: 0.72rem;
  color: var(--ok-muted);
}

.quake-place {
  color: var(--ok-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mag-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--ok-mono);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.15rem 0.4rem;
  border-radius: 5px;
  border: 1px solid transparent;
}

.mag-low { color: #4ade80; background: rgba(74, 222, 128, 0.12); border-color: rgba(74, 222, 128, 0.35); }
.mag-mid { color: #facc15; background: rgba(250, 204, 21, 0.12); border-color: rgba(250, 204, 21, 0.35); }
.mag-high { color: #fb923c; background: rgba(251, 146, 60, 0.14); border-color: rgba(251, 146, 60, 0.38); }
.mag-severe { color: #ef4444; background: rgba(239, 68, 68, 0.16); border-color: rgba(239, 68, 68, 0.45); }
.mag-na { color: var(--ok-muted); background: rgba(255, 255, 255, 0.04); border-color: var(--ok-line); }

/* ---------- ISS 模块 ---------- */
.flying {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ok-accent);
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--ok-line);
}

/* ---------- 极光模块 ---------- */
.kp-main {
  display: flex;
  align-items: baseline;
  gap: 0.8rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--ok-line);
}

.kp-value {
  font-family: var(--ok-mono);
  font-size: 3.4rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--ok-text);
}

.kp-level {
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid currentColor;
}

.kp-quiet { color: var(--ok-muted); }
.kp-weak { color: #38bdf8; }
.kp-moderate { color: #a855f7; }
.kp-strong { color: #ef4444; }
.kp-storm { color: #f43f5e; }

.aurora-note {
  font-size: 0.74rem;
  color: var(--ok-muted);
  line-height: 1.5;
}

/* ---------- 发射倒计时模块 ---------- */
.countdown {
  display: flex;
  align-items: flex-end;
  gap: 0.25rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--ok-line);
}

.cd-unit {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}

.cd-val {
  font-family: var(--ok-mono);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
  color: var(--ok-accent);
}

.cd-lab {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ok-muted);
}

.cd-sep {
  font-family: var(--ok-mono);
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--ok-muted);
  padding-bottom: 0.15rem;
}

.launch-launched {
  font-family: var(--ok-mono);
  font-size: 1.1rem;
  font-weight: 700;
  color: #4ade80;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--ok-line);
}

/* ---------- 火星模块 ---------- */
.mars-temp-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--ok-line);
}

.mars-temp {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--ok-line);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
}

.mars-temp .t-lab {
  font-size: 0.64rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ok-muted);
}

.mars-temp .t-val {
  font-family: var(--ok-mono);
  font-size: 1.3rem;
  font-weight: 700;
}

.mars-temp.high .t-val { color: #fb923c; }
.mars-temp.low .t-val { color: #60a5fa; }

.mars-vs {
  font-size: 0.74rem;
  color: var(--ok-muted);
  line-height: 1.5;
}

/* ---------- 在轨人数模块 ---------- */
.people-main {
  display: flex;
  align-items: baseline;
  gap: 0.7rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--ok-line);
}

.people-number {
  font-family: var(--ok-mono);
  font-size: 3rem;
  font-weight: 700;
  line-height: 1;
  color: var(--ok-accent);
}

.people-sub {
  font-size: 0.78rem;
  color: var(--ok-muted);
}

.people-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.people-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.6rem;
  font-size: 0.8rem;
}

.people-name { color: var(--ok-text); }

.people-craft {
  font-family: var(--ok-mono);
  font-size: 0.68rem;
  color: var(--ok-muted);
}

/* ---------- 响应式：移动端单列 ---------- */
@media (max-width: 680px) {
  .card-wide { grid-column: auto; }
  .now-hint { display: none; }
  .quake-item { grid-template-columns: 40px 52px 1fr; }
}
</style>
