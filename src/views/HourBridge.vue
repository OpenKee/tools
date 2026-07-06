<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ============================================================
   Hour Bridge — 跨时区会议规划
   数据源：Open-Meteo Geocoding API（城市名 → 时区 / 经纬度）
   将 UTC 整点通过 Intl.DateTimeFormat 换算为各城市本地时间，
   按 9-18 上班 / 7-8、19-21 边缘 / 其余深夜 三档评分，
   排序得出对全员最公平的会议时段。
   ============================================================ */

/* ---------- 文案字典（中英双语） ---------- */
const copy = {
  en: {
    eyebrow: 'Cross-timezone meeting planner',
    title: 'Hour Bridge',
    lead: 'Pick cities, see who\u2019s awake, find the fairest meeting slot.',
    custom: 'Custom',
    add: 'Add',
    duration: 'Meeting duration',
    timeline: 'Timeline',
    timelineDesc: 'Click a slot to select meeting time. Green = business hours, yellow = edge, red = night.',
    selectedSlot: 'Selected slot',
    clear: 'Clear',
    bestSlots: 'Best meeting slots',
    good: 'Business hours',
    fair: 'Early / Late',
    night: 'Night',
    score: 'Score',
    remove: '\u00d7',
    enterCity: 'Type a city name\u2026',
    slotDetails: '{city}: {time} ({status})',
    loading: 'Resolving cities\u2026',
  },
  zh: {
    eyebrow: '跨时区会议规划',
    title: 'Hour Bridge',
    lead: '选城市，看谁醒着，找最公平的开会时间。',
    custom: '自定义',
    add: '添加',
    duration: '会议时长',
    timeline: '时间线',
    timelineDesc: '点击格子选会议时间。绿=上班时间，黄=边缘，红=深夜。',
    selectedSlot: '已选时段',
    clear: '清除',
    bestSlots: '最佳会议时段',
    good: '上班时间',
    fair: '偏早/偏晚',
    night: '深夜',
    score: '得分',
    remove: '\u00d7',
    enterCity: '输入城市名\u2026',
    slotDetails: '{city}: {time} ({status})',
    loading: '正在解析城市\u2026',
  },
}

const t = useT(copy)

/* ---------- 常量 ---------- */
const KNOWN_CITIES = [
  'Shanghai','Beijing','Shenzhen','Guangzhou','Hong Kong','Taipei',
  'Tokyo','Seoul','Singapore','Bangkok','Jakarta','Manila','Hanoi','Kuala Lumpur','Mumbai','Delhi','Dubai',
  'London','Paris','Berlin','Amsterdam','Madrid','Rome','Stockholm','Warsaw','Istanbul','Moscow',
  'New York','Los Angeles','Chicago','Toronto','Vancouver','Mexico City','São Paulo','Buenos Aires',
  'Sydney','Melbourne','Auckland','Cairo','Nairobi','Johannesburg','Lagos',
]

// 预设城市组合
const PRESETS = {
  apac: ['Shanghai', 'Tokyo', 'Singapore', 'Sydney'],
  'us-eu': ['New York', 'London', 'Berlin'],
  global: ['Shanghai', 'London', 'New York'],
}

// 时长按钮选项
const DURATIONS = [
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 90, label: '1.5h' },
  { value: 120, label: '2h' },
]

const utcHours = Array.from({ length: 24 }, (_, i) => i)
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search'

/* ---------- 响应式状态 ---------- */
const cities = ref([])          // 已解析的城市列表
const duration = ref(60)        // 会议时长（分钟）
const selectedSlot = ref(null)  // 已选起始 UTC 小时
const cityInput = ref('')       // 城市输入框
const presetValue = ref('')     // 预设下拉值
const now = ref(new Date())     // 实时时钟基准
let clockTimer = null

/* ---------- 时区换算工具 ---------- */
// 取今日 UTC 0 点对应的时间戳，加上 utcHour 小时得到目标时刻
function utcTarget(utcHour) {
  const base = new Date()
  const today = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()))
  return new Date(today.getTime() + utcHour * 3600000)
}

// 给定 UTC 整点，返回该时区下的本地小时数（0-23，午夜可能为 24）
function localHour(tz, utcHour) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(utcTarget(utcHour)))
}

// 给定 UTC 整点，返回该时区下的本地 HH:MM 文本
function localTime(tz, utcHour) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(utcTarget(utcHour))
}

// 按本地小时判定时段档次
function hourStatus(h) {
  if (h >= 9 && h <= 18) return 'good'
  if ((h >= 7 && h < 9) || (h > 18 && h <= 21)) return 'fair'
  return 'night'
}

// 时段对应文案
function statusLabel(s) {
  return s === 'good' ? t.value('good') : s === 'fair' ? t.value('fair') : t.value('night')
}

/* ---------- 实时时钟（每秒刷新） ---------- */
const liveTime = computed(() =>
  now.value.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
)
const liveDate = computed(() =>
  now.value.toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' })
)

/* ---------- 派生：选中时段所需格子数 ---------- */
const slotsNeeded = computed(() => Math.ceil(duration.value / 60))

/* ---------- 派生：时间线行数据 ---------- */
const timelineRows = computed(() => {
  const sel = selectedSlot.value
  const sn = slotsNeeded.value
  return cities.value.map(c => {
    const slots = utcHours.map(uh => {
      const lh = localHour(c.tz, uh)
      const lt = localTime(c.tz, uh)
      const s = hourStatus(lh)
      const selected = sel === uh
      const inRange = sel !== null && uh > sel && uh < sel + sn
      return {
        uh,
        lt,
        s,
        selected,
        inRange,
        title: `${c.name}: ${lt} (${statusLabel(s)})`,
      }
    })
    return {
      name: c.name,
      tzLabel: c.tz.split('/').pop().replace(/_/g, ' '),
      slots,
    }
  })
})

/* ---------- 派生：已选时段详情 ---------- */
const resultItems = computed(() => {
  if (selectedSlot.value === null || cities.value.length < 2) return null
  return cities.value.map(c => {
    const lt = localTime(c.tz, selectedSlot.value)
    const lh = localHour(c.tz, selectedSlot.value)
    const s = hourStatus(lh)
    return { name: c.name, lt, s, label: statusLabel(s) }
  })
})
const showResult = computed(() => resultItems.value !== null)

/* ---------- 派生：最佳时段（按得分排序取前 6） ---------- */
function scoreSlot(utcHour) {
  let total = 0
  cities.value.forEach(c => {
    const h = localHour(c.tz, utcHour)
    const s = hourStatus(h)
    total += s === 'good' ? 2 : s === 'fair' ? 1 : -3
  })
  return total
}

const bestSlots = computed(() => {
  if (cities.value.length < 2) return []
  const maxScore = cities.value.length * 2
  return utcHours
    .map(uh => ({ uh, score: scoreSlot(uh) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((s, i) => {
      const pct = Math.round((s.score / maxScore) * 100)
      const cls = pct >= 70 ? 'high' : pct >= 40 ? 'mid' : 'low'
      const details = cities.value.map(c => {
        const lt = localTime(c.tz, s.uh)
        const st = hourStatus(localHour(c.tz, s.uh))
        return `${c.name} ${lt} (${statusLabel(st)})`
      }).join(' · ')
      return { uh: s.uh, rank: i + 1, pct, cls, details }
    })
})

/* ---------- 城市增删 ---------- */
async function resolveCity(name) {
  const url = `${GEO_URL}?name=${encodeURIComponent(name)}&count=1&language=en&format=json`
  const data = await fetchJSON(url)
  const place = data && data.results && data.results[0]
  if (!place) throw new Error(`Not found: ${name}`)
  return { name: place.name, tz: place.timezone, lat: place.latitude, lon: place.longitude }
}

async function addCity(name) {
  if (!name || cities.value.find(c => c.name.toLowerCase() === name.toLowerCase())) return
  if (cities.value.length >= 8) return
  try {
    const resolved = await resolveCity(name)
    cities.value.push(resolved)
  } catch (e) {
    const msg = i18nState.lang === 'zh' ? '未找到该城市' : 'City not found'
    alert(msg)
  }
}

function removeCity(i) {
  cities.value.splice(i, 1)
}

/* ---------- 交互事件 ---------- */
function onAddCity() {
  const val = cityInput.value.trim()
  if (val) {
    addCity(val)
    cityInput.value = ''
  }
}

function setDuration(d) {
  duration.value = d
}

function selectSlot(uh) {
  selectedSlot.value = selectedSlot.value === uh ? null : uh
}

function selectBest(uh) {
  selectedSlot.value = uh
}

function clearSelection() {
  selectedSlot.value = null
}

function applyPreset() {
  const key = presetValue.value
  if (!key || !PRESETS[key]) return
  cities.value = []
  presetValue.value = ''
  PRESETS[key].forEach(c => addCity(c))
}

/* ---------- 生命周期 ---------- */
onMounted(() => {
  // 启动实时时钟
  clockTimer = setInterval(() => { now.value = new Date() }, 1000)
  // 默认载入上海 / 伦敦 / 纽约
  ;['Shanghai', 'London', 'New York'].forEach(c => addCity(c))
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})
</script>

<template>
  <div class="hour-bridge-app">
    <!-- 顶部栏：标题 + 语言切换（语言切换由 AppHeader 内部处理） -->
    <AppHeader :title="t('title')" />

    <main class="shell">
      <!-- 页头：标题 + 实时时钟 -->
      <header class="masthead">
        <div>
          <p class="eyebrow">{{ t('eyebrow') }}</p>
          <h1>{{ t('title') }}</h1>
          <p class="lead">{{ t('lead') }}</p>
        </div>
        <div class="header-right">
          <div class="live-clock">
            <span class="live-time">{{ liveTime }}</span>
            <span class="live-date">{{ liveDate }}</span>
          </div>
        </div>
      </header>

      <!-- 城市设置 -->
      <section class="setup-bar">
        <div class="city-chips">
          <span v-for="(c, i) in cities" :key="c.name + '-' + i" class="chip">
            {{ c.name }}
            <span class="chip-remove" @click="removeCity(i)">{{ t('remove') }}</span>
          </span>
        </div>
        <div class="add-row">
          <select v-model="presetValue" @change="applyPreset">
            <option value="">{{ t('custom') }}</option>
            <option value="apac">APAC Team</option>
            <option value="us-eu">US + Europe</option>
            <option value="global">Global (3 cities)</option>
          </select>
          <input
            v-model="cityInput"
            type="text"
            :placeholder="t('enterCity')"
            list="cityList"
            aria-label="Add city"
            @keydown.enter.prevent="onAddCity"
          />
          <datalist id="cityList">
            <option v-for="c in KNOWN_CITIES" :key="c" :value="c" />
          </datalist>
          <button type="button" @click="onAddCity">{{ t('add') }}</button>
        </div>
      </section>

      <!-- 会议时长 -->
      <section class="duration-bar">
        <span class="dur-label">{{ t('duration') }}</span>
        <div class="dur-options">
          <button
            v-for="d in DURATIONS"
            :key="d.value"
            class="dur-btn"
            :class="{ active: duration === d.value }"
            type="button"
            @click="setDuration(d.value)"
          >{{ d.label }}</button>
        </div>
        <span class="dur-hint"></span>
      </section>

      <!-- 时间线 -->
      <section class="timeline-section">
        <div class="timeline-header">
          <h2>{{ t('timeline') }}</h2>
          <p class="timeline-desc">{{ t('timelineDesc') }}</p>
        </div>
        <div class="timeline">
          <div v-for="(row, ri) in timelineRows" :key="ri" class="tl-row">
            <div class="tl-city">
              {{ row.name }}<small>{{ row.tzLabel }}</small>
            </div>
            <div class="tl-bar">
              <div
                v-for="slot in row.slots"
                :key="slot.uh"
                class="tl-slot"
                :class="[slot.s, { selected: slot.selected, 'in-range': slot.inRange }]"
                :title="slot.title"
                @click="selectSlot(slot.uh)"
              >{{ slot.lt.slice(0, 2) }}</div>
            </div>
          </div>
        </div>
        <div class="hour-axis">
          <span v-for="uh in utcHours" :key="uh">{{ String(uh).padStart(2, '0') }}</span>
        </div>
      </section>

      <!-- 已选时段 -->
      <section v-if="showResult" class="result-card">
        <div class="result-head">
          <h2>{{ t('selectedSlot') }}</h2>
          <button type="button" @click="clearSelection">{{ t('clear') }}</button>
        </div>
        <div class="result-body">
          <div v-for="(item, i) in resultItems" :key="i" class="result-item">
            <div class="city-name">{{ item.name }}</div>
            <div class="city-time">{{ item.lt }}</div>
            <div class="city-status" :class="item.s">{{ item.label }}</div>
          </div>
        </div>
      </section>

      <!-- 最佳时段 -->
      <section class="best-section">
        <h2>{{ t('bestSlots') }}</h2>
        <div class="best-grid">
          <div
            v-for="b in bestSlots"
            :key="b.uh"
            class="best-card"
            @click="selectBest(b.uh)"
          >
            <span class="best-rank">#{{ b.rank }}</span>
            <div class="best-time">UTC {{ String(b.uh).padStart(2, '0') }}:00</div>
            <div class="best-detail">{{ b.details }}</div>
            <span class="best-score" :class="b.cls">{{ t('score') }}: {{ b.pct }}%</span>
          </div>
        </div>
      </section>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Hour Bridge — 跨时区会议规划样式
   原版 :root 变量映射到组件根类 .hour-bridge-app 上。
   ============================================================ */

.hour-bridge-app {
  --ink: #171411;
  --muted: #6b625a;
  --line: rgba(23, 20, 17, 0.12);
  --panel: rgba(255, 251, 245, 0.86);
  --accent: #c56b1a;
  --accent-soft: rgba(197, 107, 26, 0.08);
  --good: rgba(34, 197, 94, 0.35);
  --good-bg: rgba(34, 197, 94, 0.08);
  --fair: rgba(234, 179, 8, 0.3);
  --fair-bg: rgba(234, 179, 8, 0.06);
  --night: rgba(239, 68, 68, 0.2);
  --night-bg: rgba(239, 68, 68, 0.04);
  --selected: rgba(197, 107, 26, 0.25);

  /* 共享组件主题映射 */
  --ok-bg: #f8f4ee;
  --ok-panel: var(--panel);
  --ok-line: var(--line);
  --ok-text: var(--ink);
  --ok-muted: var(--muted);
  --ok-accent: var(--accent);
  --ok-accent-soft: var(--accent-soft);
  --ok-footer-line: var(--line);
  --ok-footer-text: var(--muted);
  --ok-footer-link: var(--accent);
  --ok-topbar-line: rgba(128, 128, 128, 0.1);

  margin: 0;
  font-family: "Manrope", system-ui, sans-serif;
  color: var(--ink);
  background: radial-gradient(circle at top left, rgba(197,107,26,0.1), transparent 28%), linear-gradient(180deg, #f8f4ee 0%, #eee5da 100%);
  min-height: 100vh;
}

* { box-sizing: border-box; }

h1, h2, p, strong, span, small { margin: 0; }

.shell {
  width: min(1200px, calc(100% - 1.25rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

.masthead {
  display: flex;
  justify-content: space-between;
  align-items: start;
  padding: 0.3rem 0 1.2rem;
  border-bottom: 1px solid var(--line);
}

.eyebrow {
  font-family: "IBM Plex Mono", monospace;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
  color: var(--accent);
}

h1 {
  margin-top: 0.25rem;
  font-size: clamp(2.2rem, 6vw, 3.5rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
}

.lead {
  margin-top: 0.5rem;
  color: var(--muted);
  font-size: 0.9rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-shrink: 0;
}

.live-clock {
  text-align: right;
}

.live-time {
  font-family: "IBM Plex Mono", monospace;
  font-size: 1.4rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.live-date {
  display: block;
  font-size: 0.72rem;
  color: var(--muted);
}

/* Setup bar */
.setup-bar {
  margin-top: 1rem;
  padding: 0.8rem 0;
  border-bottom: 1px solid var(--line);
}

.city-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--line);
  background: var(--panel);
  font-size: 0.82rem;
  font-weight: 500;
}

.chip-remove {
  cursor: pointer;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1;
}

.chip-remove:hover { color: #c33; }

.add-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.add-row select,
.add-row input {
  font: inherit;
  height: 2.2rem;
  padding: 0 0.6rem;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--ink);
  font-size: 0.82rem;
}

.add-row input { flex: 1; min-width: 120px; }

.add-row button {
  font: inherit;
  height: 2.2rem;
  padding: 0 0.8rem;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: white;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
}

/* Duration */
.duration-bar {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--line);
}

.dur-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
}

.dur-options {
  display: flex;
  gap: 0;
}

.dur-btn {
  min-height: 2rem;
  padding: 0 0.7rem;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-family: "IBM Plex Mono", monospace;
}

.dur-btn + .dur-btn { border-left: none; }
.dur-btn:first-child { border-radius: 3px 0 0 3px; }
.dur-btn:last-child { border-radius: 0 3px 3px 0; }

.dur-btn:hover { color: var(--ink); }

.dur-btn.active {
  background: var(--ink);
  color: var(--panel);
  border-color: var(--ink);
}

.dur-hint {
  font-size: 0.72rem;
  color: var(--muted);
}

/* Timeline */
.timeline-section {
  margin-top: 1.2rem;
}

.timeline-header {
  margin-bottom: 0.6rem;
}

.timeline-header h2 {
  font-size: 1.05rem;
}

.timeline-desc {
  font-size: 0.76rem;
  color: var(--muted);
  margin-top: 0.2rem;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-x: auto;
}

.tl-row {
  display: flex;
  min-width: 720px;
}

.tl-city {
  width: 100px;
  flex-shrink: 0;
  padding: 0.5rem 0.5rem;
  font-size: 0.82rem;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-bottom: 1px solid var(--line);
}

.tl-city small {
  font-weight: 400;
  font-size: 0.68rem;
  color: var(--muted);
}

.tl-bar {
  flex: 1;
  display: flex;
  border-bottom: 1px solid var(--line);
}

.tl-slot {
  flex: 1;
  min-width: 26px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.62rem;
  font-family: "IBM Plex Mono", monospace;
  color: var(--muted);
  cursor: pointer;
  transition: all 100ms ease;
  border-right: 1px solid rgba(0,0,0,0.03);
  position: relative;
}

.tl-slot.good { background: var(--good); }
.tl-slot.fair { background: var(--fair); }
.tl-slot.night { background: var(--night); }

.tl-slot:hover {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  z-index: 1;
}

.tl-slot.selected {
  background: var(--selected) !important;
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  z-index: 2;
}

.tl-slot.in-range {
  background: var(--selected) !important;
}

.hour-axis {
  display: flex;
  padding-left: 100px;
  min-width: 720px;
  overflow-x: auto;
}

.hour-axis span {
  flex: 1;
  min-width: 26px;
  text-align: center;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.62rem;
  color: var(--muted);
  padding: 0.3rem 0;
}

/* Result */
.result-card {
  margin-top: 1.2rem;
  background: var(--panel);
  border: 1px solid var(--accent);
  padding: 1rem;
}

.result-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.6rem;
}

.result-head h2 {
  font-size: 1rem;
  color: var(--accent);
}

.result-head button {
  font: inherit;
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--line);
  background: transparent;
  cursor: pointer;
  font-size: 0.76rem;
  color: var(--muted);
}

.result-body {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.6rem;
}

.result-item {
  padding: 0.5rem;
  border: 1px solid var(--line);
  background: white;
}

.result-item .city-name {
  font-weight: 700;
  font-size: 0.88rem;
}

.result-item .city-time {
  font-family: "IBM Plex Mono", monospace;
  font-size: 1.2rem;
  font-weight: 600;
  margin-top: 0.2rem;
}

.result-item .city-status {
  font-size: 0.72rem;
  margin-top: 0.15rem;
}

.result-item .city-status.good { color: #16a34a; }
.result-item .city-status.fair { color: #ca8a04; }
.result-item .city-status.night { color: #dc2626; }

/* Best slots */
.best-section {
  margin-top: 1.5rem;
}

.best-section h2 {
  font-size: 1.05rem;
  margin-bottom: 0.6rem;
}

.best-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.6rem;
}

.best-card {
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 0.8rem;
  cursor: pointer;
  transition: border-color 150ms;
}

.best-card:hover {
  border-color: var(--accent);
}

.best-rank {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.68rem;
  color: var(--accent);
  font-weight: 600;
}

.best-time {
  font-size: 1rem;
  font-weight: 700;
  margin-top: 0.2rem;
}

.best-detail {
  font-size: 0.78rem;
  color: var(--muted);
  margin-top: 0.3rem;
  line-height: 1.5;
}

.best-score {
  display: inline-block;
  margin-top: 0.4rem;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  border: 1px solid var(--line);
}

.best-score.high { border-color: #16a34a; color: #16a34a; }
.best-score.mid { border-color: #ca8a04; color: #ca8a04; }
.best-score.low { border-color: #dc2626; color: #dc2626; }

.loading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--muted);
  padding: 1.5rem;
  font-size: 0.88rem;
}

.spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 720px) {
  .masthead { flex-direction: column; gap: 0.6rem; }
  .header-right { align-self: start; }
  .add-row { flex-wrap: wrap; }
  .duration-bar { flex-wrap: wrap; }
  .tl-city { width: 75px; }
  .tl-slot { min-width: 22px; font-size: 0; }
  .hour-axis { padding-left: 75px; }
}
</style>
