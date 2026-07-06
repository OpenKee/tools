<script setup>
/* ============================================================
   ISS Tracker — 国际空间站实时位置追踪（Vue 3 SFC）
   数据来源：wheretheiss.at / howmanypeopleareinspacerightnow.com
   ============================================================ */

import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/* ---------- 国际化文案 ---------- */
const copy = {
  en: {
    eyebrow: 'Space tracking',
    title: 'ISS Tracker',
    lead: 'Follow the International Space Station as it orbits Earth at 27,600 km/h.',
    live: 'LIVE',
    coords: 'Coordinates',
    latitude: 'Latitude',
    longitude: 'Longitude',
    region: 'Region',
    orbit: 'Orbit',
    speed: 'Speed',
    altitude: 'Altitude',
    orbitPeriod: 'Orbital period',
    inSpace: 'in space',
    loadingAstros: 'Loading astronauts…',
    nextPass: 'Next pass over',
    check: 'Check',
    latPh: 'lat',
    lonPh: 'lon',
    useLocAria: 'Use my location',
    enterCoords: 'Enter a valid latitude and longitude.',
    noPass: 'No upcoming passes found.',
    fetchError: 'Failed to fetch data. Retrying…',
    locError: 'Unable to get your location.',
    updating: 'Updating…',
  },
  zh: {
    eyebrow: '太空追踪',
    title: '空间站追踪',
    lead: '实时追踪国际空间站，以每小时 27,600 公里的速度环绕地球。',
    live: '实时',
    coords: '坐标',
    latitude: '纬度',
    longitude: '经度',
    region: '所在区域',
    orbit: '轨道参数',
    speed: '速度',
    altitude: '高度',
    orbitPeriod: '轨道周期',
    inSpace: '人在太空',
    loadingAstros: '正在加载宇航员信息…',
    nextPass: '下次经过',
    check: '查询',
    latPh: '纬度',
    lonPh: '经度',
    useLocAria: '使用我的位置',
    enterCoords: '请输入有效的纬度和经度。',
    noPass: '暂无即将经过的记录。',
    fetchError: '数据获取失败，正在重试…',
    locError: '无法获取您的位置。',
    updating: '更新中…',
  }
}
const t = useT(copy)

/* ---------- 简化区域判断（粗略经纬度框，中英名称）---------- */
// [latMin, latMax, lonMin, lonMax, en, zh]
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

/* ---------- API 地址 ---------- */
// 使用支持 HTTPS 的 API，避免混合内容拦截
const ISS_NOW_URL = 'https://api.wheretheiss.at/v1/satellites/25544'
// howmanypeopleareinspacerightnow.com 未设置 CORS，通过 corsproxy.io 访问
const ASTROS_URL = 'https://corsproxy.io/?url=' + encodeURIComponent('https://www.howmanypeopleareinspacerightnow.com/peopleinspace.json')

const TRAIL_MAX = 360 // 轨迹点上限（约 30 分钟）

/* ---------- 响应式状态 ---------- */
const mapEl = ref(null)              // 地图容器引用
const lastPos = ref(null)            // 最新位置 { lat, lon, t, speed, alt }
const lastUpdateTs = ref(null)       // 最近更新时间戳
const astrosData = ref(null)         // 宇航员数据
const astrosState = ref('loading')   // loading | error | loaded
const passLat = ref('')              // 用户输入的纬度
const passLon = ref('')              // 用户输入的经度
const passState = ref('idle')        // idle | updating | loaded | empty | error
const passItems = ref([])            // 过境预测结果 [{ risetime, duration }]
const passError = ref('')            // 过境错误文案 key

/* ---------- 非响应式：Leaflet 实例与轨迹数据（避免被 Vue 响应式代理）---------- */
let map = null
let issMarker = null
let footprint = null
let trailLayer = null
let trail = []                       // 已采集的轨迹点 [{ lat, lon, t }]
let prevPos = null                   // 上一次位置（用于速度计算）
let positionTimer = null             // 位置刷新定时器

/* ---------- 派生：UI 显示值 ---------- */
// 纬度显示
const latText = computed(() => lastPos.value ? lastPos.value.lat.toFixed(3) + '°' : '--')
// 经度显示
const lonText = computed(() => lastPos.value ? lastPos.value.lon.toFixed(3) + '°' : '--')
// 地图徽章坐标
const badgeText = computed(() => {
  if (!lastPos.value) return '--'
  return formatCoord(lastPos.value.lat, 'lat') + ', ' + formatCoord(lastPos.value.lon, 'lon')
})
// 所在区域（随语言切换）
const regionText = computed(() => {
  if (!lastPos.value) return '--'
  const r = detectRegion(lastPos.value.lat, lastPos.value.lon)
  return i18nState.lang === 'zh' ? r.zh : r.en
})
// 速度
const speedText = computed(() => {
  const s = lastPos.value && lastPos.value.speed
  if (s != null && s > 0) return Math.round(s).toLocaleString(locale()) + ' km/h'
  return '~27,600 km/h'
})
// 高度
const altText = computed(() => {
  const a = lastPos.value && lastPos.value.alt
  return (a ? '~' + Math.round(a) : '~408') + ' km'
})
// 最近更新时间（随语言切换 locale）
const lastUpdateText = computed(() => {
  if (!lastUpdateTs.value) return '--:--:--'
  return new Date(lastUpdateTs.value).toLocaleTimeString(locale(), {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
})
// 宇航员数量
const astrosCountText = computed(() => astrosData.value ? astrosData.value.number : '--')
// 宇航员列表
const astrosList = computed(() => (astrosData.value && astrosData.value.people) || [])
// 输入框占位符（随语言切换）
const latPh = computed(() => t.value('latPh'))
const lonPh = computed(() => t.value('lonPh'))

/* ---------- 区域检测 ---------- */
function detectRegion(lat, lon) {
  // 极地
  if (lat > 66.5) return { en: 'Arctic region', zh: '北极地区' }
  if (lat < -66.5) return { en: 'Antarctic region', zh: '南极地区' }
  // 大陆优先匹配
  for (let i = 0; i < CONTINENTS.length; i++) {
    const c = CONTINENTS[i]
    if (lat >= c[0] && lat <= c[1] && lon >= c[2] && lon <= c[3]) {
      return { en: c[4], zh: c[5] }
    }
  }
  // 海洋
  for (let i = 0; i < OCEANS.length; i++) {
    const o = OCEANS[i]
    if (lat >= o[0] && lat <= o[1] && lon >= o[2] && lon <= o[3]) {
      return { en: o[4], zh: o[5] }
    }
  }
  return { en: 'Open ocean', zh: '开阔海域' }
}

/* ---------- 坐标格式化（带 N/S/E/W）---------- */
function formatCoord(v, type) {
  const dir = type === 'lat' ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W')
  return Math.abs(v).toFixed(2) + '° ' + dir
}

/* ---------- Haversine 距离（公里）---------- */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371 // 地球半径 km
  const toRad = function (d) { return d * Math.PI / 180 }
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * R * Math.asin(Math.sqrt(a))
}

/* ---------- 地图初始化 ---------- */
function initMap() {
  map = L.map(mapEl.value, {
    zoomControl: true,
    worldCopyJump: true,
    minZoom: 2,
    maxZoom: 8,
    attributionControl: true,
  }).setView([20, 0], 2)

  // 深色瓦片（CartoDB Dark Matter）
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map)

  // 轨迹图层组
  trailLayer = L.layerGroup().addTo(map)

  // ISS 标记（自定义 div 图标 + 脉冲环）
  const icon = L.divIcon({
    className: 'iss-marker',
    html: '<div class="iss-icon"><span class="iss-ring"></span><span class="iss-core"></span></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
  issMarker = L.marker([0, 0], { icon: icon, zIndexOffset: 1000 }).addTo(map)

  // 可见范围圆（约 1500 km 半径，表示地面可观测范围）
  footprint = L.circle([0, 0], {
    radius: 1500000,
    color: '#38bdf8',
    weight: 1,
    opacity: 0.4,
    fillColor: '#38bdf8',
    fillOpacity: 0.06,
  }).addTo(map)
}

/* ---------- 获取 ISS 位置 ---------- */
async function fetchISSPosition() {
  try {
    const data = await fetchJSON(ISS_NOW_URL, { timeout: 20000 })
    if (!data || typeof data.latitude === 'undefined') {
      throw new Error('Bad iss-now response')
    }
    const lat = parseFloat(data.latitude)
    const lon = parseFloat(data.longitude)
    const ts = data.timestamp ? data.timestamp * 1000 : Date.now()
    // wheretheiss.at 直接返回速度和高度
    const speed = data.velocity ? parseFloat(data.velocity) : null
    const alt = data.altitude ? parseFloat(data.altitude) : null
    handleNewPosition(lat, lon, ts, speed, alt)
  } catch (err) {
    console.warn('ISS position fetch failed:', err)
    // 不打断定时器，下次继续尝试
  }
}

function handleNewPosition(lat, lon, ts, apiSpeed, apiAlt) {
  const newPos = { lat: lat, lon: lon, t: ts }

  // 优先使用 API 返回的速度；否则根据前后两点计算
  let speed = apiSpeed || null
  if (speed == null && prevPos) {
    const dist = haversine(prevPos.lat, prevPos.lon, lat, lon) // km
    const dt = (ts - prevPos.t) / 3600000 // 小时
    if (dt > 0) speed = dist / dt
  }
  prevPos = newPos
  trail.push(newPos)
  if (trail.length > TRAIL_MAX) trail.shift()

  // 更新标记与可见范围
  issMarker.setLatLng([lat, lon])
  footprint.setLatLng([lat, lon])

  // 首次定位时飞到 ISS
  if (trail.length === 1) {
    map.setView([lat, lon], 4)
  }

  redrawTrail()
  // 更新响应式状态（驱动 UI 重渲染）
  lastPos.value = { lat, lon, t: ts, speed, alt: apiAlt }
  lastUpdateTs.value = ts
}

/* ---------- 重绘轨迹（处理 ±180° 日期变更线）---------- */
function redrawTrail() {
  trailLayer.clearLayers()
  if (trail.length < 2) return

  // 拆分跨越日期变更线的段
  const segments = [[]]
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i]
    const seg = segments[segments.length - 1]
    if (seg.length > 0) {
      const prev = seg[seg.length - 1]
      if (Math.abs(p.lon - prev[1]) > 180) {
        segments.push([])
      }
    }
    segments[segments.length - 1].push([p.lat, p.lon])
  }

  segments.forEach(function (seg) {
    if (seg.length >= 2) {
      L.polyline(seg, {
        color: '#38bdf8',
        weight: 2,
        opacity: 0.5,
        dashArray: '4 4',
      }).addTo(trailLayer)
    }
  })
}

/* ---------- 宇航员 ---------- */
async function fetchAstronauts() {
  astrosState.value = 'loading'
  try {
    const data = await fetchJSON(ASTROS_URL, { timeout: 20000 })
    if (!data || typeof data.number === 'undefined') throw new Error('Bad astros response')
    astrosData.value = data
    astrosState.value = 'loaded'
  } catch (err) {
    console.warn('Astronauts fetch failed:', err)
    astrosState.value = 'error'
  }
}

/* ---------- 下一次经过指定位置 ---------- */
async function fetchPass(lat, lon) {
  passState.value = 'updating'
  passItems.value = []
  // 通过 CORS 代理请求 Open Notify 过境预测 API
  const targetUrl = 'http://api.open-notify.org/iss-pass.json?lat=' +
    encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon) + '&n=3'
  const url = 'https://corsproxy.io/?url=' + encodeURIComponent(targetUrl)
  try {
    const data = await fetchJSON(url)
    if (!data || data.message !== 'success') throw new Error('Bad pass response')
    const passes = data.response || []
    if (!passes.length) {
      passState.value = 'empty'
      return
    }
    passItems.value = passes.map(function (p) {
      return { risetime: p.risetime, duration: p.duration }
    })
    passState.value = 'loaded'
  } catch (err) {
    console.warn('Pass fetch failed:', err)
    passError.value = 'fetchError'
    passState.value = 'error'
  }
}

/* ---------- 过境时间格式化（按当前语言 locale）---------- */
function formatPassTime(risetime) {
  return new Date(risetime * 1000).toLocaleString(locale(), {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

/* ---------- 事件：查询过境 ---------- */
function onPassBtn() {
  const lat = parseFloat(passLat.value)
  const lon = parseFloat(passLon.value)
  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    passError.value = 'enterCoords'
    passState.value = 'error'
    return
  }
  fetchPass(lat, lon)
}

/* ---------- 事件：使用我的位置 ---------- */
function onUseLocBtn() {
  if (!navigator.geolocation) {
    passError.value = 'locError'
    passState.value = 'error'
    return
  }
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      passLat.value = pos.coords.latitude.toFixed(2)
      passLon.value = pos.coords.longitude.toFixed(2)
      fetchPass(pos.coords.latitude, pos.coords.longitude)
    },
    function () {
      passError.value = 'locError'
      passState.value = 'error'
    }
  )
}

/* ---------- 生命周期 ---------- */
onMounted(() => {
  initMap()
  fetchISSPosition()
  fetchAstronauts()
  // 每 5 秒自动刷新位置
  positionTimer = setInterval(fetchISSPosition, 5000)
})

onBeforeUnmount(() => {
  if (positionTimer) {
    clearInterval(positionTimer)
    positionTimer = null
  }
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<template>
  <div class="iss-app">
    <!-- 顶栏：标题 + 语言切换（语言切换由 AppHeader 内部处理） -->
    <AppHeader :title="t('title')" :show-lang-toggle="true" />

    <main class="shell">
      <header class="masthead">
        <div class="masthead-left">
          <p class="eyebrow">{{ t('eyebrow') }}</p>
          <h1>{{ t('title') }}</h1>
          <p class="lead">{{ t('lead') }}</p>
        </div>
        <div class="header-right">
          <!-- LIVE 指示器 -->
          <div class="live-pill">
            <span class="live-dot" aria-hidden="true"></span>
            <span>{{ t('live') }}</span>
            <span class="live-time">{{ lastUpdateText }}</span>
          </div>
        </div>
      </header>

      <section class="dashboard">
        <!-- 地图区 -->
        <div class="map-wrap">
          <div ref="mapEl" class="map" role="application" aria-label="ISS real-time position map"></div>
          <div class="map-badge" aria-hidden="true">
            <span class="badge-label">{{ t('coords') }}</span>
            <span class="badge-value">{{ badgeText }}</span>
          </div>
        </div>

        <!-- 信息面板 -->
        <aside class="info-panel" aria-label="ISS information panels">
          <!-- 坐标与区域 -->
          <div class="info-card">
            <div class="card-head">
              <span class="card-icon" aria-hidden="true">📍</span>
              <span class="card-label">{{ t('coords') }}</span>
            </div>
            <div class="card-rows">
              <div class="row"><span>{{ t('latitude') }}</span><strong>{{ latText }}</strong></div>
              <div class="row"><span>{{ t('longitude') }}</span><strong>{{ lonText }}</strong></div>
              <div class="row"><span>{{ t('region') }}</span><strong>{{ regionText }}</strong></div>
            </div>
          </div>

          <!-- 轨道参数 -->
          <div class="info-card">
            <div class="card-head">
              <span class="card-icon" aria-hidden="true">🚀</span>
              <span class="card-label">{{ t('orbit') }}</span>
            </div>
            <div class="card-rows">
              <div class="row"><span>{{ t('speed') }}</span><strong>{{ speedText }}</strong></div>
              <div class="row"><span>{{ t('altitude') }}</span><strong>{{ altText }}</strong></div>
              <div class="row"><span>{{ t('orbitPeriod') }}</span><strong>~92 min</strong></div>
            </div>
          </div>

          <!-- 太空中的宇航员 -->
          <div class="info-card">
            <div class="card-head">
              <span class="card-icon" aria-hidden="true">👨‍🚀</span>
              <span class="card-label"><strong>{{ astrosCountText }}</strong> {{ t('inSpace') }}</span>
            </div>
            <div class="astros-list">
              <div v-if="astrosState === 'loading'" class="muted">{{ t('loadingAstros') }}</div>
              <div v-else-if="astrosState === 'error'" class="muted">{{ t('fetchError') }}</div>
              <template v-else>
                <div v-for="(p, i) in astrosList" :key="i" class="astro-item">
                  <span>{{ p.name }}</span>
                  <span class="craft">{{ p.craft }}</span>
                </div>
              </template>
            </div>
          </div>

          <!-- 下一次经过指定位置 -->
          <div class="info-card">
            <div class="card-head">
              <span class="card-icon" aria-hidden="true">🛰️</span>
              <span class="card-label">{{ t('nextPass') }}</span>
            </div>
            <div class="pass-form">
              <input v-model="passLat" type="number" step="0.01" min="-90" max="90" :placeholder="latPh" :aria-label="t('latitude')" />
              <input v-model="passLon" type="number" step="0.01" min="-180" max="180" :placeholder="lonPh" :aria-label="t('longitude')" />
              <button class="btn-ghost" type="button" :aria-label="t('useLocAria')" @click="onUseLocBtn">📍</button>
              <button class="btn-primary" type="button" @click="onPassBtn">{{ t('check') }}</button>
            </div>
            <div class="pass-result" aria-live="polite">
              <div v-if="passState === 'updating'" class="muted">{{ t('updating') }}</div>
              <div v-else-if="passState === 'empty'" class="muted">{{ t('noPass') }}</div>
              <div v-else-if="passState === 'error'" class="error-msg">{{ t(passError) }}</div>
              <template v-else-if="passState === 'loaded'">
                <div v-for="(p, i) in passItems" :key="i" class="pass-item">
                  <span class="pass-time">{{ formatPassTime(p.risetime) }}</span>
                  <span class="pass-dur">{{ p.duration }}s</span>
                </div>
              </template>
            </div>
          </div>
        </aside>
      </section>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   ISS Tracker — 深色太空主题
   原 :root 变量迁移到组件根类 .iss-app 上，
   --ok-* 令牌在此覆盖，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.iss-app {
  /* 主题变量 */
  --bg: #0a0e1a;
  --panel: #111827;
  --line: rgba(255, 255, 255, 0.08);
  --text: #e2e8f0;
  --muted: #94a3b8;
  --accent: #38bdf8;
  --accent-soft: rgba(56, 189, 248, 0.1);
  --green: #4ade80;
  --yellow: #facc15;

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
  --ok-topbar-line: var(--line);

  color-scheme: dark;

  /* 原 body 样式迁移到根元素 */
  margin: 0;
  font-family: "Sora", system-ui, sans-serif;
  color: var(--text);
  background: var(--bg);
  /* 星空背景：多层径向渐变模拟星点 + 深空辉光 */
  background-image:
    radial-gradient(1px 1px at 20% 30%, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(1px 1px at 70% 60%, rgba(255, 255, 255, 0.45), transparent),
    radial-gradient(1px 1px at 40% 82%, rgba(255, 255, 255, 0.5), transparent),
    radial-gradient(1px 1px at 85% 15%, rgba(255, 255, 255, 0.35), transparent),
    radial-gradient(1px 1px at 55% 45%, rgba(255, 255, 255, 0.4), transparent),
    radial-gradient(1px 1px at 12% 70%, rgba(255, 255, 255, 0.3), transparent),
    radial-gradient(1px 1px at 92% 78%, rgba(255, 255, 255, 0.35), transparent),
    radial-gradient(circle at 80% 0%, rgba(56, 189, 248, 0.12), transparent 42%),
    radial-gradient(circle at 0% 100%, rgba(99, 102, 241, 0.1), transparent 42%);
  background-attachment: fixed;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

.iss-app a { color: var(--accent); text-decoration: none; }
.iss-app h1, .iss-app h2, .iss-app h3, .iss-app p, .iss-app strong, .iss-app span, .iss-app small { margin: 0; }

.shell {
  width: min(1200px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

/* ---------- 页头 ---------- */
.masthead {
  display: flex;
  justify-content: space-between;
  align-items: end;
  padding: 0.3rem 0 1.2rem;
  border-bottom: 1px solid var(--line);
  gap: 1rem;
}

.eyebrow {
  font-family: "JetBrains Mono", monospace;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--accent);
}

.masthead h1 {
  margin-top: 0.3rem;
  font-size: clamp(2.2rem, 6vw, 3.4rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
  font-weight: 800;
}

.lead {
  margin-top: 0.5rem;
  color: var(--muted);
  font-size: 0.9rem;
  max-width: 50ch;
  line-height: 1.6;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-shrink: 0;
}

/* ---------- LIVE 指示器 ---------- */
.live-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(74, 222, 128, 0.06);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: var(--green);
  white-space: nowrap;
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 8px var(--green);
  animation: live-pulse 1.6s ease-in-out infinite;
}

@keyframes live-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

.live-time {
  color: var(--muted);
  font-weight: 500;
}

/* ---------- 仪表盘布局 ---------- */
.dashboard {
  margin-top: 1.2rem;
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 1rem;
  align-items: start;
}

.map-wrap {
  position: relative;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background: var(--panel);
  height: 560px;
}

.map {
  width: 100%;
  height: 100%;
  background: #0a0e1a;
}

.map-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 500;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.5rem 0.75rem;
  background: rgba(10, 14, 26, 0.75);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border: 1px solid var(--line);
  border-radius: 8px;
  pointer-events: none;
}

.badge-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}

.badge-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent);
}

/* ---------- 信息面板 ---------- */
.info-panel {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.info-card {
  background: rgba(17, 24, 39, 0.7);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 0.9rem 1rem;
}

.card-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--line);
}

.card-icon { font-size: 1rem; line-height: 1; }

.card-label {
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text);
}

.card-rows {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.8rem;
  gap: 0.5rem;
}

.row span { color: var(--muted); }
.row strong {
  font-family: "JetBrains Mono", monospace;
  font-weight: 600;
  color: var(--text);
  text-align: right;
}

/* ---------- 宇航员列表 ---------- */
.astros-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 150px;
  overflow-y: auto;
  padding-right: 0.2rem;
}

.astros-list::-webkit-scrollbar { width: 5px; }
.astros-list::-webkit-scrollbar-track { background: transparent; }
.astros-list::-webkit-scrollbar-thumb { background: var(--line); border-radius: 10px; }

.astro-item {
  font-size: 0.78rem;
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  line-height: 1.4;
}
.astro-item .craft {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.66rem;
  color: var(--muted);
  white-space: nowrap;
}

.muted { color: var(--muted); font-size: 0.8rem; }

/* ---------- 下次经过表单 ---------- */
.pass-form {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.pass-form input {
  font: inherit;
  font-family: "JetBrains Mono", monospace;
  width: 72px;
  height: 2.2rem;
  padding: 0 0.5rem;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  font-size: 0.78rem;
  border-radius: 6px;
}

.pass-form input::placeholder { color: var(--muted); }
.pass-form input:focus { border-color: var(--accent); outline: none; }

.btn-ghost,
.btn-primary {
  font: inherit;
  height: 2.2rem;
  padding: 0 0.7rem;
  cursor: pointer;
  font-size: 0.78rem;
  border-radius: 6px;
  transition: border-color 0.15s, color 0.15s, filter 0.15s;
}

.btn-ghost {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text);
}
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

.btn-primary {
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #0a0e1a;
  font-weight: 600;
  margin-left: auto;
}
.btn-primary:hover { filter: brightness(1.1); }

.pass-result {
  margin-top: 0.6rem;
  font-size: 0.78rem;
}

.pass-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.35rem 0;
  border-bottom: 1px dashed var(--line);
  gap: 0.5rem;
}
.pass-item:last-child { border-bottom: none; }
.pass-item .pass-time {
  font-family: "JetBrains Mono", monospace;
  color: var(--accent);
  font-weight: 500;
}
.pass-item .pass-dur { color: var(--muted); font-size: 0.72rem; }

.error-msg { color: #f87171; font-size: 0.78rem; }

/* ---------- Leaflet 深色主题覆盖（动态注入 DOM，需 :deep 穿透）---------- */
.iss-app :deep(.leaflet-container) {
  background: #0a0e1a;
  font-family: "Sora", sans-serif;
}
.iss-app :deep(.leaflet-control-zoom a) {
  background: rgba(17, 24, 39, 0.85) !important;
  color: var(--text) !important;
  border-color: var(--line) !important;
}
.iss-app :deep(.leaflet-control-zoom a:hover) {
  background: rgba(56, 189, 248, 0.2) !important;
  color: var(--accent) !important;
}
.iss-app :deep(.leaflet-control-attribution) {
  background: rgba(10, 14, 26, 0.7) !important;
  color: var(--muted) !important;
  font-size: 0.6rem !important;
}
.iss-app :deep(.leaflet-control-attribution a) {
  color: var(--accent) !important;
}
.iss-app :deep(.leaflet-bar) { border: none !important; }

/* ---------- ISS 自定义标记（divIcon 注入 DOM，需 :deep 穿透）---------- */
.iss-app :deep(.iss-marker) { background: transparent; border: none; }
.iss-app :deep(.iss-icon) {
  position: relative;
  width: 18px;
  height: 18px;
}
.iss-app :deep(.iss-core) {
  position: absolute;
  inset: 4px;
  background: var(--accent);
  border-radius: 50%;
  box-shadow: 0 0 12px 2px var(--accent);
}
.iss-app :deep(.iss-ring) {
  position: absolute;
  inset: 0;
  border: 2px solid var(--accent);
  border-radius: 50%;
  animation: iss-ping 2s ease-out infinite;
}
@keyframes iss-ping {
  0% { transform: scale(0.6); opacity: 0.9; }
  100% { transform: scale(2.6); opacity: 0; }
}

/* ---------- 响应式 ---------- */
@media (max-width: 880px) {
  .dashboard { grid-template-columns: 1fr; }
  .map-wrap { height: 420px; }
  .masthead { flex-direction: column; align-items: start; }
}

@media (max-width: 480px) {
  .map-wrap { height: 320px; }
  .pass-form input { width: 64px; }
  .header-right { flex-wrap: wrap; }
}
</style>
