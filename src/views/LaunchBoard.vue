<script setup>
/* ============================================================
   Launch Board — 火箭发射日程（Vue 3 SFC 迁移版）
   数据源：Launch Library 2 API（失败时降级到内嵌 mock 数据）
   功能：下一次发射倒计时、即将发射列表、筛选/搜索、详情弹窗、中英 i18n
   - 共享 i18n：useT（来自 ../i18n.js），语言切换由 AppHeader 负责
   - 共享工具：fetchJSON / locale（来自 ../ok.js）
   - 共享组件：AppHeader / AppFooter
   ============================================================ */

import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- i18n 文案字典（中英双语） ---------- */
const copy = {
  en: {
    title: 'Launch Board',
    eyebrow: 'Rocket launch schedule',
    heroTitle: 'Launch Board',
    lead: 'Live countdowns and mission details for upcoming orbital launches worldwide.',
    refresh: 'Refresh',
    loading: 'Loading…',
    loadingNext: 'Loading next launch…',
    error: 'Failed to load launch data. Showing sample schedule.',
    noResults: 'No launches match your filters.',
    noUpcoming: 'No upcoming launches scheduled.',
    fallbackNotice: 'Showing sample data (API unavailable).',
    dataSource: 'Data: Launch Library 2',
    allProjects: 'All projects',
    nextLaunch: '🚀 Next Launch',
    countdownLabel: 'Countdown',
    days: 'Days',
    hours: 'Hours',
    minutes: 'Minutes',
    seconds: 'Seconds',
    launched: 'Launch window open',
    upcoming: 'Upcoming Launches',
    agency: 'Agency',
    status: 'Status',
    search: 'Search',
    searchPlaceholder: 'Search mission or rocket…',
    allAgencies: 'All agencies',
    allStatuses: 'All statuses',
    resultCount: '{n} launches',
    mission: 'Mission',
    rocket: 'Rocket',
    launchProvider: 'Launch provider',
    launchSite: 'Launch site',
    launchWindow: 'Launch window',
    description: 'Mission description',
    rocketDetails: 'Rocket details',
    payload: 'Payload',
    missionType: 'Mission type',
    orbit: 'Orbit',
    coordinates: 'Coordinates',
    webcast: 'Webcast',
    watchLive: '▶ Watch live',
    noWebcast: 'No webcast link available.',
    close: 'Close',
    notAvailable: 'Not available',
    utcLabel: 'UTC',
    localLabel: 'Local',
    /* 状态分类 */
    statusGo: 'Go',
    statusTbd: 'TBD',
    statusHold: 'Hold',
    statusSuccess: 'Success',
    statusFailed: 'Failed',
    statusInflight: 'In flight'
  },
  zh: {
    title: '发射日程',
    eyebrow: '火箭发射日程',
    heroTitle: '发射日程',
    lead: '全球即将到来的轨道发射实时倒计时与任务详情。',
    refresh: '刷新',
    loading: '加载中…',
    loadingNext: '正在加载下一次发射…',
    error: '加载发射数据失败，已显示示例日程。',
    noResults: '没有符合筛选条件的发射。',
    noUpcoming: '暂无即将到来的发射。',
    fallbackNotice: '当前显示示例数据（API 不可用）。',
    dataSource: '数据来源：Launch Library 2',
    allProjects: '全部项目',
    nextLaunch: '🚀 下一次发射',
    countdownLabel: '倒计时',
    days: '天',
    hours: '时',
    minutes: '分',
    seconds: '秒',
    launched: '发射窗口已开启',
    upcoming: '即将发射',
    agency: '发射机构',
    status: '状态',
    search: '搜索',
    searchPlaceholder: '搜索任务或火箭…',
    allAgencies: '全部机构',
    allStatuses: '全部状态',
    resultCount: '{n} 次发射',
    mission: '任务',
    rocket: '火箭',
    launchProvider: '发射机构',
    launchSite: '发射场',
    launchWindow: '发射窗口',
    description: '任务描述',
    rocketDetails: '火箭详情',
    payload: '载荷',
    missionType: '任务类型',
    orbit: '轨道',
    coordinates: '坐标',
    webcast: '直播',
    watchLive: '▶ 观看直播',
    noWebcast: '暂无直播链接。',
    close: '关闭',
    notAvailable: '暂无',
    utcLabel: 'UTC',
    localLabel: '本地',
    statusGo: '就绪',
    statusTbd: '待定',
    statusHold: '暂停',
    statusSuccess: '成功',
    statusFailed: '失败',
    statusInflight: '飞行中'
  }
}

const t = useT(copy)

/* ---------- 常量 ---------- */
const API_URL = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=30&ordering=net'
const ROCKET_EMOJIS = ['🚀', '🛰️', '🛸', '☄️', '🌠']
// 状态分类固定列表（用于筛选下拉）
const STATUS_CATS = ['go', 'tbd', 'hold', 'failed', 'inflight']

/* ---------- 响应式状态 ---------- */
const allLaunches = ref([])        // 全量数据
const nextLaunch = ref(null)       // 下一次发射（用于 hero）
const usingFallback = ref(false)   // 是否使用降级数据
const loading = ref(true)          // 是否正在加载（首屏与刷新）
const agencyFilter = ref('')       // 机构筛选值
const statusFilter = ref('')       // 状态筛选值
const searchQuery = ref('')        // 搜索关键字
const modalLaunch = ref(null)      // 当前打开的详情弹窗对应发射对象（null=关闭）
// 倒计时数值；ended=true 表示发射窗口已开启（diff<=0）
const countdown = ref({ days: 0, hours: 0, mins: 0, secs: 0, ended: false })

// 倒计时定时器（非响应式，避免被 Vue 代理）
let countdownTimer = null

/* ---------- 辅助函数 ---------- */

// 状态分类：根据 Launch Library 2 的 status.id 映射到颜色类别
// API 实测：1=Go for Launch, 2=To Be Determined, 3=TBC, 4=Hold,
//          5=In Flight, 6=Partial Failure, 7=Failure, 8=To Be Confirmed
function statusCategory(launch) {
  const id = launch && launch.status && launch.status.id
  if (id === 1) return 'go'
  if (id === 2 || id === 3 || id === 8) return 'tbd'
  if (id === 4) return 'hold'
  if (id === 5) return 'inflight'
  if (id === 6 || id === 7) return 'failed'
  return 'tbd'
}

// 状态分类对应的 i18n 文案
function statusLabel(cat) {
  return t.value('status' + cat.charAt(0).toUpperCase() + cat.slice(1))
}

// 火箭图标：根据任务名 hash 取一个 emoji 占位
function rocketIcon(launch) {
  const name = (launch.name || '') + (launch.id || '')
  let sum = 0
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
  return ROCKET_EMOJIS[sum % ROCKET_EMOJIS.length]
}

// 取发射机构名
function agencyName(launch) {
  return (launch.launch_service_provider && launch.launch_service_provider.name) || t.value('notAvailable')
}

// 取发射场名（含地区）
function padName(launch) {
  const pad = launch.pad
  if (!pad) return t.value('notAvailable')
  const loc = pad.location && pad.location.name ? pad.location.name : ''
  return pad.name ? (loc ? pad.name + ' · ' + loc : pad.name) : (loc || t.value('notAvailable'))
}

// 取火箭配置名
function rocketName(launch) {
  const cfg = launch.rocket && launch.rocket.configuration
  return (cfg && cfg.full_name) || (cfg && cfg.name) || t.value('notAvailable')
}

// 取任务名
function missionName(launch) {
  return (launch.mission && launch.mission.name) || launch.name || t.value('notAvailable')
}

// 判断是否为 TBD 发射（时间未确定，API 常返回月初 UTC 午夜占位）
function isTbdLaunch(launch) {
  const cat = statusCategory(launch)
  if (cat !== 'tbd') return false
  const d = launch && launch.net ? new Date(launch.net) : null
  if (!d || isNaN(d.getTime())) return true
  // 占位时间特征：UTC 00:00:00
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0
}

// 时间格式化：本地时区 + UTC 标注，使用 Intl.DateTimeFormat
function formatTime(iso, launch) {
  if (!iso) return { local: t.value('notAvailable'), utc: '' }
  // TBD 占位时间不显示具体时刻
  if (launch && isTbdLaunch(launch)) {
    return { local: t.value('statusTbd'), utc: '' }
  }
  const d = new Date(iso)
  if (isNaN(d.getTime())) return { local: t.value('notAvailable'), utc: '' }
  const loc = locale()
  const local = new Intl.DateTimeFormat(loc, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  }).format(d)
  const utc = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC', timeZoneName: 'short'
  }).format(d)
  return { local, utc }
}

// 列表卡片用的紧凑时间
function formatShort(iso, launch) {
  if (!iso) return t.value('notAvailable')
  if (launch && isTbdLaunch(launch)) return t.value('statusTbd')
  const d = new Date(iso)
  if (isNaN(d.getTime())) return t.value('notAvailable')
  const loc = locale()
  return new Intl.DateTimeFormat(loc, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(d)
}

// 倒时数字补零
function pad2(v) {
  return v < 10 ? '0' + v : String(v)
}

/* ---------- 内嵌 mock 数据（API 失败时降级） ---------- */
function mockLaunches() {
  const now = Date.now()
  const hr = 3600 * 1000
  const day = 24 * hr
  // 用相对时间生成，保证倒计时始终有效
  return [
    {
      id: 'mock-1',
      name: 'Falcon 9 Block 5 | Starlink Group 8-12',
      status: { id: 2, name: 'To Be Determined', abbrev: 'TBD' },
      net: new Date(now + 1 * day + 5 * hr).toISOString(),
      window_start: new Date(now + 1 * day + 5 * hr).toISOString(),
      window_end: new Date(now + 1 * day + 6 * hr).toISOString(),
      launch_service_provider: { id: 121, name: 'SpaceX', type: 'Commercial' },
      rocket: { configuration: { name: 'Falcon 9', family: 'Falcon', full_name: 'Falcon 9 Block 5', variant: 'Block 5' } },
      mission: { name: 'Starlink Group 8-12', description: 'A batch of Starlink v2 mini satellites for SpaceX\'s low-Earth-orbit internet constellation.', type: 'Communications', orbit: { name: 'Low Earth Orbit', abbrev: 'LEO' } },
      pad: { name: 'Space Launch Complex 40', latitude: 28.562, longitude: -80.577, location: { name: 'Cape Canaveral, FL, USA' } },
      image: null, webcast_live: false, vidURLs: []
    },
    {
      id: 'mock-2',
      name: 'Long March 5 | Chang\'e 7',
      status: { id: 2, name: 'To Be Determined', abbrev: 'TBD' },
      net: new Date(now + 4 * day + 11 * hr).toISOString(),
      window_start: new Date(now + 4 * day + 11 * hr).toISOString(),
      window_end: new Date(now + 4 * day + 12 * hr).toISOString(),
      launch_service_provider: { id: 88, name: 'CASC', type: 'Government' },
      rocket: { configuration: { name: 'Long March 5', family: 'Long March', full_name: 'Long March 5', variant: '' } },
      mission: { name: 'Chang\'e 7', description: 'Chinese lunar exploration mission to the Moon\'s south pole, including an orbiter, lander, rover and hopper.', type: 'Planetary Science', orbit: { name: 'Lunar', abbrev: 'LUN' } },
      pad: { name: 'LC-101', latitude: 19.614, longitude: 110.952, location: { name: 'Wenchang, China' } },
      image: null, webcast_live: false, vidURLs: []
    },
    {
      id: 'mock-3',
      name: 'Soyuz 2.1b | Glonass-K2',
      status: { id: 1, name: 'Go', abbrev: 'GO' },
      net: new Date(now + 6 * day + 8 * hr).toISOString(),
      window_start: new Date(now + 6 * day + 8 * hr).toISOString(),
      window_end: new Date(now + 6 * day + 9 * hr).toISOString(),
      launch_service_provider: { id: 98, name: 'Roscosmos', type: 'Government' },
      rocket: { configuration: { name: 'Soyuz 2.1b', family: 'Soyuz', full_name: 'Soyuz 2.1b', variant: 'b' } },
      mission: { name: 'Glonass-K2 No. 13', description: 'Navigation satellite for the Russian GLONASS global positioning system.', type: 'Navigation', orbit: { name: 'Medium Earth Orbit', abbrev: 'MEO' } },
      pad: { name: 'Site 43/4', latitude: 45.964, longitude: 63.305, location: { name: 'Plesetsk, Russia' } },
      image: null, webcast_live: false, vidURLs: []
    },
    {
      id: 'mock-4',
      name: 'Ariane 6 | Galactic 02',
      status: { id: 2, name: 'To Be Determined', abbrev: 'TBD' },
      net: new Date(now + 9 * day + 14 * hr).toISOString(),
      window_start: new Date(now + 9 * day + 14 * hr).toISOString(),
      window_end: new Date(now + 9 * day + 15 * hr).toISOString(),
      launch_service_provider: { id: 115, name: 'Arianespace', type: 'Commercial' },
      rocket: { configuration: { name: 'Ariane 6', family: 'Ariane', full_name: 'Ariane 62', variant: '62' } },
      mission: { name: 'Galactic 02', description: 'Commercial communications payload delivered to geostationary transfer orbit.', type: 'Communications', orbit: { name: 'Geostationary Transfer Orbit', abbrev: 'GTO' } },
      pad: { name: 'ELA-4', latitude: 5.236, longitude: -52.775, location: { name: 'Kourou, French Guiana' } },
      image: null, webcast_live: false, vidURLs: []
    },
    {
      id: 'mock-5',
      name: 'Electron | The Beat Goes On',
      status: { id: 1, name: 'Go', abbrev: 'GO' },
      net: new Date(now + 12 * day + 3 * hr).toISOString(),
      window_start: new Date(now + 12 * day + 3 * hr).toISOString(),
      window_end: new Date(now + 12 * day + 4 * hr).toISOString(),
      launch_service_provider: { id: 147, name: 'Rocket Lab', type: 'Commercial' },
      rocket: { configuration: { name: 'Electron', family: 'Electron', full_name: 'Electron', variant: '' } },
      mission: { name: 'The Beat Goes On', description: 'Dedicated small-satellite rideshare mission carrying multiple commercial and academic payloads to low Earth orbit.', type: 'Dedicated Rideshare', orbit: { name: 'Low Earth Orbit', abbrev: 'LEO' } },
      pad: { name: 'Launch Complex 1', latitude: -39.261, longitude: 177.865, location: { name: 'Mahia, New Zealand' } },
      image: null, webcast_live: true, vidURLs: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ']
    },
    {
      id: 'mock-6',
      name: 'Vulcan VC6 | Dream Chaser 1',
      status: { id: 2, name: 'To Be Determined', abbrev: 'TBD' },
      net: new Date(now + 18 * day + 9 * hr).toISOString(),
      window_start: new Date(now + 18 * day + 9 * hr).toISOString(),
      window_end: new Date(now + 18 * day + 10 * hr).toISOString(),
      launch_service_provider: { id: 124, name: 'ULA', type: 'Commercial' },
      rocket: { configuration: { name: 'Vulcan', family: 'Vulcan', full_name: 'Vulcan VC6', variant: 'VC6' } },
      mission: { name: 'Dream Chaser 1', description: 'First operational cargo resupply mission of the Dream Chaser spaceplane to the International Space Station.', type: 'Resupply', orbit: { name: 'Low Earth Orbit', abbrev: 'LEO' } },
      pad: { name: 'Space Launch Complex 41', latitude: 28.583, longitude: -80.583, location: { name: 'Cape Canaveral, FL, USA' } },
      image: null, webcast_live: false, vidURLs: []
    }
  ]
}

/* ---------- 派生：机构筛选选项（从数据中提取唯一机构） ---------- */
const agencyOptions = computed(() => {
  const set = new Set()
  allLaunches.value.forEach((l) => {
    const n = agencyName(l)
    if (n && n !== t.value('notAvailable')) set.add(n)
  })
  return Array.from(set).sort()
})

/* ---------- 派生：状态筛选选项（固定分类） ---------- */
const statusOptions = computed(() => STATUS_CATS.map((c) => ({ value: c, label: statusLabel(c) })))

/* ---------- 派生：应用筛选后的列表 ---------- */
const filteredLaunches = computed(() => {
  const agency = agencyFilter.value
  const status = statusFilter.value
  const q = searchQuery.value.trim().toLowerCase()
  return allLaunches.value.filter((l) => {
    if (agency && agencyName(l) !== agency) return false
    if (status && statusCategory(l) !== status) return false
    if (q) {
      const hay = ((l.name || '') + ' ' + missionName(l) + ' ' + rocketName(l) + ' ' + agencyName(l)).toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
})

/* ---------- 派生：结果计数文本 ---------- */
const resultCountText = computed(() => t.value('resultCount').replace('{n}', String(filteredLaunches.value.length)))

/* ---------- 派生：hero 卡片时间 ---------- */
const heroTime = computed(() => nextLaunch.value ? formatTime(nextLaunch.value.net, nextLaunch.value) : null)

/* ---------- 派生：hero 是否为 TBD 发射 ---------- */
const heroIsTbd = computed(() => nextLaunch.value ? isTbdLaunch(nextLaunch.value) : false)

/* ---------- 派生：详情弹窗展示数据 ---------- */
const modalData = computed(() => {
  if (!modalLaunch.value) return null
  const l = modalLaunch.value
  const cat = statusCategory(l)
  const time = formatTime(l.net, l)
  const cfg = (l.rocket && l.rocket.configuration) || {}
  const mission = l.mission || {}
  const pad = l.pad || {}
  const orbit = (mission.orbit && mission.orbit.name) || t.value('notAvailable')
  const desc = mission.description || t.value('notAvailable')
  const coords = (pad.latitude != null && pad.longitude != null)
    ? pad.latitude.toFixed(3) + ', ' + pad.longitude.toFixed(3)
    : t.value('notAvailable')
  // 视频链接：取 vidURLs 数组中的第一个
  const vidUrl = (l.vidURLs && l.vidURLs.length) ? l.vidURLs[0] : ''
  return {
    cat,
    statusLabel: statusLabel(cat),
    time,
    missionName: missionName(l),
    sub: l.name || rocketName(l),
    agencyName: agencyName(l),
    padName: padName(l),
    cfgFullName: cfg.full_name || cfg.name || t.value('notAvailable'),
    cfgFamily: cfg.family || t.value('notAvailable'),
    cfgVariant: cfg.variant || t.value('notAvailable'),
    missionType: mission.type || t.value('notAvailable'),
    orbit,
    desc,
    coords,
    vidUrl
  }
})

/* ---------- 数据加载 ---------- */
async function loadData() {
  loading.value = true
  stopCountdown()
  try {
    const data = await fetchJSON(API_URL, { timeout: 10000 })
    const results = (data && data.results) || []
    if (!results.length) {
      // 空结果也降级
      useFallback(mockLaunches())
      return
    }
    usingFallback.value = false
    allLaunches.value = results
    afterDataLoad()
  } catch (e) {
    // API 失败，降级到 mock 数据
    useFallback(mockLaunches())
  }
}

function useFallback(data) {
  usingFallback.value = true
  allLaunches.value = data
  afterDataLoad()
}

// 数据就绪后：确定下一次发射、启动倒计时
function afterDataLoad() {
  // 下一次发射：net 在未来且最早的一条
  const now = Date.now()
  nextLaunch.value = null
  for (const l of allLaunches.value) {
    const net = new Date(l.net).getTime()
    if (!isNaN(net) && net > now) {
      nextLaunch.value = l
      break
    }
  }
  // 若没有未来的，取第一条
  if (!nextLaunch.value && allLaunches.value.length) nextLaunch.value = allLaunches.value[0]
  loading.value = false
  startCountdown()
}

/* ---------- 倒计时 ---------- */
function tickCountdown() {
  if (!nextLaunch.value) return
  // TBD 发射不显示倒计时（与原始逻辑一致：原始通过 cdEl 不存在直接 return）
  if (isTbdLaunch(nextLaunch.value)) return
  const target = new Date(nextLaunch.value.net).getTime()
  if (isNaN(target)) return
  const diff = target - Date.now()
  if (diff <= 0) {
    countdown.value = { days: 0, hours: 0, mins: 0, secs: 0, ended: true }
    // 倒计时归零，停止定时器（原始实现通过 outerHTML 替换后 cdEl 查找失败来停止更新）
    stopCountdown()
    return
  }
  const totalSec = Math.floor(diff / 1000)
  countdown.value = {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    mins: Math.floor((totalSec % 3600) / 60),
    secs: totalSec % 60,
    ended: false
  }
}

function startCountdown() {
  stopCountdown()
  countdown.value = { days: 0, hours: 0, mins: 0, secs: 0, ended: false }
  tickCountdown()
  countdownTimer = setInterval(tickCountdown, 1000)
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

/* ---------- 详情弹窗控制 ---------- */
function openModal(launch) {
  modalLaunch.value = launch
}

function closeModal() {
  modalLaunch.value = null
}

/* ---------- 全局事件处理 ---------- */
function onKeydown(e) {
  if (e.key === 'Escape' && modalLaunch.value) closeModal()
}

// 页面切换/隐藏时清理倒计时定时器，避免后台空跑
function onVisibility() {
  if (document.hidden) {
    stopCountdown()
  } else if (nextLaunch.value && !loading.value) {
    startCountdown()
  }
}

/* ---------- watch：弹窗打开/关闭时切换 body 滚动 ---------- */
watch(modalLaunch, (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
})

/* ---------- 生命周期 ---------- */
onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('visibilitychange', onVisibility)
  loadData()
})

onBeforeUnmount(() => {
  stopCountdown()
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('visibilitychange', onVisibility)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="launch-board-app">
    <!-- 顶部栏：标题 + 语言切换（语言切换由 AppHeader 内部处理） -->
    <AppHeader :title="t('title')" :show-lang-toggle="true" />

    <main class="shell">
      <!-- 页头 + 刷新按钮 -->
      <header class="masthead">
        <div>
          <p class="eyebrow">{{ t('eyebrow') }}</p>
          <h1>{{ t('heroTitle') }}</h1>
          <p class="lead">{{ t('lead') }}</p>
        </div>
        <button class="ok-btn-ghost refresh-btn" type="button" @click="loadData">{{ t('refresh') }}</button>
      </header>

      <!-- 下一次发射大卡片 -->
      <section class="hero-card">
        <!-- 加载中 -->
        <div v-if="loading" class="ok-loading">
          <span class="ok-spinner"></span>
          <span>{{ t('loadingNext') }}</span>
        </div>
        <!-- 暂无即将到来的发射 -->
        <div v-else-if="!nextLaunch" class="hero-empty">{{ t('noUpcoming') }}</div>
        <!-- hero 内容 -->
        <template v-else>
          <div class="hero-badge">{{ t('nextLaunch') }}</div>
          <div class="hero-name">{{ nextLaunch.name || missionName(nextLaunch) }}</div>
          <div class="hero-mission">{{ t('mission') }}: {{ missionName(nextLaunch) }}</div>
          <div class="hero-meta">
            <span class="hm-item">
              <span class="hm-key">{{ t('launchProvider') }}:</span>
              <span class="hm-val">{{ agencyName(nextLaunch) }}</span>
            </span>
            <span class="hm-item">
              <span class="hm-key">{{ t('launchSite') }}:</span>
              <span class="hm-val">{{ padName(nextLaunch) }}</span>
            </span>
          </div>
          <div class="hero-time">
            {{ t('localLabel') }}: {{ heroTime.local }}
            <span class="ht-utc">· {{ t('utcLabel') }}: {{ heroTime.utc }}</span>
          </div>
          <!-- TBD 发射时间未定，不显示倒计时 -->
          <div v-if="heroIsTbd" class="cd-launched">{{ t('statusTbd') }}</div>
          <div v-else-if="countdown.ended" class="cd-launched">{{ t('launched') }}</div>
          <div v-else class="countdown">
            <div class="cd-unit">
              <span class="cd-val">{{ pad2(countdown.days) }}</span>
              <span class="cd-label">{{ t('days') }}</span>
            </div>
            <div class="cd-unit">
              <span class="cd-val">{{ pad2(countdown.hours) }}</span>
              <span class="cd-label">{{ t('hours') }}</span>
            </div>
            <div class="cd-unit">
              <span class="cd-val">{{ pad2(countdown.mins) }}</span>
              <span class="cd-label">{{ t('minutes') }}</span>
            </div>
            <div class="cd-unit">
              <span class="cd-val">{{ pad2(countdown.secs) }}</span>
              <span class="cd-label">{{ t('seconds') }}</span>
            </div>
          </div>
          <div v-if="usingFallback" class="fallback-notice">{{ t('fallbackNotice') }}</div>
        </template>
      </section>

      <!-- 筛选区 -->
      <section class="filters">
        <div class="filter-group">
          <label class="filter-label" for="agencyFilter">{{ t('agency') }}</label>
          <select id="agencyFilter" v-model="agencyFilter" class="filter-select">
            <option value="">{{ t('allAgencies') }}</option>
            <option v-for="a in agencyOptions" :key="a" :value="a">{{ a }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label" for="statusFilter">{{ t('status') }}</label>
          <select id="statusFilter" v-model="statusFilter" class="filter-select">
            <option value="">{{ t('allStatuses') }}</option>
            <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>
        <div class="filter-group filter-search">
          <label class="filter-label" for="searchInput">{{ t('search') }}</label>
          <input
            id="searchInput"
            v-model="searchQuery"
            type="search"
            class="filter-input"
            :placeholder="t('searchPlaceholder')"
          />
        </div>
      </section>

      <!-- 即将发射列表 -->
      <section class="list-section">
        <div class="section-head">
          <h2>{{ t('upcoming') }}</h2>
          <span class="result-count">{{ resultCountText }}</span>
        </div>
        <div class="launch-grid">
          <!-- 加载中 -->
          <div v-if="loading" class="ok-loading">
            <span class="ok-spinner"></span>
            <span>{{ t('loading') }}</span>
          </div>
          <!-- 空状态 -->
          <div v-else-if="!filteredLaunches.length" class="empty-state">{{ t('noResults') }}</div>
          <!-- 卡片列表 -->
          <div
            v-for="l in filteredLaunches"
            :key="l.id"
            class="launch-card"
            @click="openModal(l)"
          >
            <div class="lc-top">
              <div class="lc-icon">{{ rocketIcon(l) }}</div>
              <div class="lc-name">
                <div class="lc-mission">{{ missionName(l) }}</div>
                <div class="lc-rocket">{{ rocketName(l) }}</div>
              </div>
            </div>
            <div class="lc-body">
              <div class="lc-row">
                <span class="lc-key">{{ t('launchProvider') }}:</span>
                <span class="lc-val">{{ agencyName(l) }}</span>
              </div>
              <div class="lc-row">
                <span class="lc-key">{{ t('launchSite') }}:</span>
                <span class="lc-val">{{ padName(l) }}</span>
              </div>
            </div>
            <div class="lc-foot">
              <span class="lc-time">{{ formatShort(l.net, l) }}</span>
              <span class="status-badge" :class="statusCategory(l)">{{ statusLabel(statusCategory(l)) }}</span>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- 详情弹窗 -->
    <div v-if="modalLaunch" class="modal">
      <div class="modal-backdrop" @click="closeModal"></div>
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <button class="modal-close" type="button" :aria-label="t('close')" @click="closeModal">×</button>
        <div v-if="modalData" class="modal-body">
          <div class="modal-eyebrow">{{ t('mission') }}</div>
          <h3 class="modal-title" id="modalTitle">{{ modalData.missionName }}</h3>
          <p class="modal-sub">{{ modalData.sub }}</p>
          <div class="modal-status-row">
            <span class="status-badge" :class="modalData.cat">{{ modalData.statusLabel }}</span>
            <span class="lc-time">{{ t('localLabel') }}: {{ modalData.time.local }} · {{ t('utcLabel') }}: {{ modalData.time.utc }}</span>
          </div>
          <div class="modal-section">
            <h4>{{ t('description') }}</h4>
            <p>{{ modalData.desc }}</p>
          </div>
          <div class="modal-section">
            <h4>{{ t('rocketDetails') }}</h4>
            <div class="modal-grid">
              <div class="mg-row">
                <span class="mg-key">{{ t('rocket') }}</span>
                <span class="mg-val">{{ modalData.cfgFullName }}</span>
              </div>
              <div class="mg-row">
                <span class="mg-key">Family</span>
                <span class="mg-val">{{ modalData.cfgFamily }}</span>
              </div>
              <div class="mg-row">
                <span class="mg-key">Variant</span>
                <span class="mg-val">{{ modalData.cfgVariant }}</span>
              </div>
              <div class="mg-row">
                <span class="mg-key">{{ t('launchProvider') }}</span>
                <span class="mg-val">{{ modalData.agencyName }}</span>
              </div>
            </div>
          </div>
          <div class="modal-section">
            <h4>{{ t('payload') }}</h4>
            <div class="modal-grid">
              <div class="mg-row">
                <span class="mg-key">{{ t('missionType') }}</span>
                <span class="mg-val">{{ modalData.missionType }}</span>
              </div>
              <div class="mg-row">
                <span class="mg-key">{{ t('orbit') }}</span>
                <span class="mg-val">{{ modalData.orbit }}</span>
              </div>
            </div>
          </div>
          <div class="modal-section">
            <h4>{{ t('launchSite') }}</h4>
            <div class="modal-grid">
              <div class="mg-row">
                <span class="mg-key">{{ t('launchSite') }}</span>
                <span class="mg-val">{{ modalData.padName }}</span>
              </div>
              <div class="mg-row">
                <span class="mg-key">{{ t('coordinates') }}</span>
                <span class="mg-val">{{ modalData.coords }}</span>
              </div>
            </div>
          </div>
          <div class="modal-section">
            <h4>{{ t('webcast') }}</h4>
            <a v-if="modalData.vidUrl" class="modal-link" :href="modalData.vidUrl" target="_blank" rel="noreferrer">{{ t('watchLive') }}</a>
            <p v-else class="ms-muted">{{ t('noWebcast') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据来源说明（保留原始 footer 中的 attribution） -->
    <p class="data-source">{{ t('dataSource') }}</p>
    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Launch Board — 深色航天主题
   原 :root 变量迁移到组件根类 .launch-board-app 上，
   --ok-* 令牌在此覆盖，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.launch-board-app {
  /* 表面与文字 */
  --bg: #0c0c14;
  --surface: #16161f;
  --surface-2: #1d1d2a;
  --text: #f0f0f5;
  --text-muted: #8a8a9a;
  --border: #2a2a3a;
  --accent: #ff6b35;
  --accent-2: #f5c518;
  color-scheme: dark;

  /* 映射到共享设计 token（shared.css 真实存在的 token） */
  --ok-bg: var(--bg);
  --ok-panel: var(--surface);
  --ok-line: var(--border);
  --ok-text: var(--text);
  --ok-muted: var(--text-muted);
  --ok-accent: var(--accent);
  --ok-accent-soft: rgba(255, 107, 53, 0.14);
  --ok-topbar-line: var(--border);
  --ok-footer-line: var(--border);
  --ok-footer-text: var(--text-muted);
  --ok-footer-link: var(--accent);
  --ok-radius: 12px;
  /* app 私有 token（shared.css 未定义，仅本 app 内部使用） */
  --ok-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  --ok-topbar-h: 3rem;
  --ok-accent-contrast: #0c0c14;

  /* 状态语义色 */
  --st-go: #16a34a;
  --st-go-bg: rgba(22, 163, 74, 0.14);
  --st-tbd: #f5c518;
  --st-tbd-bg: rgba(245, 197, 24, 0.14);
  --st-hold: #3b82f6;
  --st-hold-bg: rgba(59, 130, 246, 0.14);
  --st-success: #16a34a;
  --st-success-bg: rgba(22, 163, 74, 0.14);
  --st-failed: #ef4444;
  --st-failed-bg: rgba(239, 68, 68, 0.14);
  --st-inflight: #3b82f6;
  --st-inflight-bg: rgba(59, 130, 246, 0.14);

  /* 原 body 样式迁移到根元素 */
  font-family: "Inter", system-ui, sans-serif;
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  /* 深空背景：径向星辉渐变 */
  background-image:
    radial-gradient(900px 500px at 85% -10%, rgba(255, 107, 53, 0.10), transparent 60%),
    radial-gradient(700px 500px at 0% 0%, rgba(59, 130, 246, 0.08), transparent 55%);
  background-attachment: fixed;
  min-height: 100vh;
}

.launch-board-app :deep(a) { color: var(--accent); text-decoration: none; }
.launch-board-app h1, .launch-board-app h2, .launch-board-app h3,
.launch-board-app p, .launch-board-app strong, .launch-board-app span,
.launch-board-app small { margin: 0; }

/* ---------- 顶部栏（覆盖 AppHeader 内的 .ok-topbar） ---------- */
.launch-board-app :deep(.ok-topbar) {
  height: var(--ok-topbar-h);
  padding: 0 1.2rem;
  gap: 0.75rem;
  background: rgba(22, 22, 31, 0.7);
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
  z-index: 20;
}

.launch-board-app :deep(.topbar-title) {
  font-weight: 700;
  font-size: 0.92rem;
  letter-spacing: -0.01em;
  opacity: 1;
  color: var(--text);
}

/* ---------- 主容器 ---------- */
.shell {
  width: min(1120px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1.2rem 0 3rem;
}

.masthead {
  padding: 0.4rem 0 1.2rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent);
}

.masthead h1 {
  margin-top: 0.3rem;
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
  font-weight: 800;
}

.lead {
  margin-top: 0.55rem;
  color: var(--text-muted);
  font-size: 0.92rem;
  line-height: 1.6;
  max-width: 60ch;
}

.refresh-btn {
  flex-shrink: 0;
}

/* ---------- 下一次发射大卡片 ---------- */
.hero-card {
  margin-top: 1.2rem;
  background: linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%);
  border: 1px solid var(--border);
  border-radius: var(--ok-radius);
  padding: 1.5rem;
  box-shadow: var(--ok-shadow);
  position: relative;
  overflow: hidden;
}

.hero-card::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(600px 200px at 100% 0%, rgba(255, 107, 53, 0.12), transparent 60%);
  pointer-events: none;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--accent);
  background: rgba(255, 107, 53, 0.12);
  border: 1px solid rgba(255, 107, 53, 0.3);
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  position: relative;
}

.hero-name {
  margin-top: 0.9rem;
  font-size: clamp(1.4rem, 3.5vw, 2rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  position: relative;
}

.hero-mission {
  margin-top: 0.35rem;
  font-size: 1rem;
  color: var(--text);
  position: relative;
}

.hero-meta {
  margin-top: 0.8rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.2rem;
  font-size: 0.85rem;
  color: var(--text-muted);
  position: relative;
}

.hero-meta .hm-item { display: inline-flex; align-items: center; gap: 0.35rem; }
.hero-meta .hm-key { color: var(--text-muted); }
.hero-meta .hm-val { color: var(--text); font-weight: 500; }

.hero-time {
  margin-top: 0.6rem;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.82rem;
  color: var(--text-muted);
  position: relative;
}
.hero-time .ht-utc { color: var(--accent-2); }

/* 倒计时 */
.countdown {
  margin-top: 1.2rem;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.6rem;
  position: relative;
}

.cd-unit {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.7rem 0.4rem;
  text-align: center;
}

.cd-val {
  display: block;
  font-family: "JetBrains Mono", monospace;
  font-size: clamp(1.6rem, 6vw, 2.4rem);
  font-weight: 700;
  color: var(--accent);
  line-height: 1;
  letter-spacing: -0.02em;
}

.cd-label {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

.cd-launched {
  margin-top: 1.2rem;
  padding: 0.9rem;
  text-align: center;
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--st-go);
  background: var(--st-go-bg);
  border: 1px solid rgba(22, 163, 74, 0.3);
  border-radius: 10px;
  position: relative;
}

.hero-empty {
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
}

/* ---------- 筛选区 ---------- */
.filters {
  margin-top: 1.4rem;
  display: grid;
  grid-template-columns: 1fr 1fr 1.6fr;
  gap: 0.8rem;
  padding: 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--ok-radius);
}

.filter-group { display: flex; flex-direction: column; gap: 0.35rem; }

.filter-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  color: var(--text-muted);
}

.filter-select,
.filter-input {
  font: inherit;
  height: 2.4rem;
  padding: 0 0.7rem;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  border-radius: 8px;
  font-size: 0.88rem;
  outline: none;
  transition: border-color 0.15s;
}

.filter-select:focus,
.filter-input:focus { border-color: var(--accent); }

.filter-select { appearance: none; cursor: pointer; }

/* ---------- 列表区 ---------- */
.list-section { margin-top: 1.6rem; }

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 0.9rem;
}

.section-head h2 {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.result-count {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.launch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

/* 发射卡片 */
.launch-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--ok-radius);
  padding: 1rem;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.launch-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: var(--ok-shadow);
}

.lc-top {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.lc-icon {
  width: 2.6rem;
  height: 2.6rem;
  flex-shrink: 0;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(255, 107, 53, 0.18), rgba(245, 197, 24, 0.12));
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
}

.lc-name {
  flex: 1;
  min-width: 0;
}

.lc-mission {
  font-weight: 700;
  font-size: 0.95rem;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.lc-rocket {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-top: 0.15rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lc-body {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.lc-body .lc-row { display: flex; gap: 0.4rem; align-items: center; }
.lc-body .lc-row .lc-key { color: var(--text-muted); flex-shrink: 0; }
.lc-body .lc-row .lc-val { color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.lc-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border);
}

.lc-time {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.74rem;
  color: var(--text-muted);
}

/* 状态标签 */
.status-badge {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;
}

.status-badge.go { color: var(--st-go); background: var(--st-go-bg); border-color: rgba(22, 163, 74, 0.35); }
.status-badge.tbd { color: var(--st-tbd); background: var(--st-tbd-bg); border-color: rgba(245, 197, 24, 0.35); }
.status-badge.hold { color: var(--st-hold); background: var(--st-hold-bg); border-color: rgba(59, 130, 246, 0.35); }
.status-badge.success { color: var(--st-success); background: var(--st-success-bg); border-color: rgba(22, 163, 74, 0.35); }
.status-badge.failed { color: var(--st-failed); background: var(--st-failed-bg); border-color: rgba(239, 68, 68, 0.35); }
.status-badge.inflight { color: var(--st-inflight); background: var(--st-inflight-bg); border-color: rgba(59, 130, 246, 0.35); }

/* 空状态 / 错误 */
.empty-state,
.error-state {
  grid-column: 1 / -1;
  padding: 2.5rem 1rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.92rem;
  border: 1px dashed var(--border);
  border-radius: var(--ok-radius);
}

.error-state { color: var(--st-failed); border-color: rgba(239, 68, 68, 0.3); }

.fallback-notice {
  margin-top: 0.9rem;
  font-size: 0.74rem;
  color: var(--accent-2);
  background: rgba(245, 197, 24, 0.08);
  border: 1px solid rgba(245, 197, 24, 0.25);
  padding: 0.5rem 0.8rem;
  border-radius: 8px;
  position: relative;
}

/* ---------- 详情弹窗 ---------- */
.modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(8, 8, 14, 0.75);
  backdrop-filter: blur(4px);
  animation: fade-in 0.18s ease;
}

.modal-dialog {
  position: relative;
  width: min(640px, 100%);
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--ok-radius);
  box-shadow: var(--ok-shadow);
  padding: 1.5rem;
  animation: pop-in 0.2s ease;
}

@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes pop-in { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: none; } }

.modal-close {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-muted);
  border-radius: 8px;
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.modal-close:hover { color: var(--accent); border-color: var(--accent); }

.modal-eyebrow {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--accent);
  font-weight: 700;
}

.modal-title {
  margin-top: 0.3rem;
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.modal-sub {
  margin-top: 0.3rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.modal-status-row {
  margin-top: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.modal-section { margin-top: 1.2rem; }
.modal-section h4 {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 0.4rem;
}
.modal-section p { font-size: 0.9rem; line-height: 1.6; color: var(--text); }
.modal-section .ms-muted { color: var(--text-muted); }

.modal-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.6rem 1rem;
  font-size: 0.85rem;
}
.modal-grid .mg-row { display: flex; flex-direction: column; gap: 0.1rem; }
.modal-grid .mg-key { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.modal-grid .mg-val { color: var(--text); }

.modal-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.6rem;
  padding: 0.55rem 0.9rem;
  background: var(--accent);
  color: var(--ok-accent-contrast);
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.85rem;
}
.modal-link:hover { opacity: 0.9; }

/* ---------- 数据来源说明（位于 AppFooter 上方） ---------- */
.data-source {
  text-align: center;
  font-size: 0.72rem;
  color: var(--text-muted);
  padding: 0 1rem 0.5rem;
}

/* ---------- 响应式 ---------- */
@media (max-width: 760px) {
  .filters { grid-template-columns: 1fr; }
  .countdown { grid-template-columns: repeat(4, 1fr); gap: 0.4rem; }
  .cd-unit { padding: 0.5rem 0.2rem; }
  .modal-grid { grid-template-columns: 1fr; }
  .masthead { flex-direction: column; align-items: flex-start; }
}

@media (max-width: 420px) {
  .countdown { grid-template-columns: repeat(2, 1fr); }
}
</style>
