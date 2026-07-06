<script setup>
/* ============================================================
   Offday Planner — 假期 & 请假优化器（Vue 3 SFC）
   数据来源：date.nager.at Public Holidays API
   ============================================================ */

import { ref, computed, watch, onMounted } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- i18n 文案字典（中英双语） ---------- */
const copy = {
  en: {
    eyebrow: 'Holiday & leave optimizer',
    title: 'Offday Planner',
    lead: 'See holidays at a glance, find long weekends, and get the smartest days to take off.',
    totalHolidays: 'Holidays',
    longWeekends: 'Long weekends',
    nextHoliday: 'Next holiday',
    daysUntil: 'days until',
    daysFromNow: 'days from now',
    today: 'today!',
    holidaysThisYear: 'public holidays this year',
    weekendsFound: '3-day+ breaks found',
    optimizer: 'Leave optimizer',
    optimizerDesc: 'Take these days off to get the longest consecutive breaks.',
    allHolidays: 'All holidays',
    loading: 'Loading holidays\u2026',
    error: 'Failed to load. Check your country/year selection.',
    takeDays: 'Take {n} day(s) off',
    getDays: 'Get {n} day(s) break',
    noData: 'No data available.',
    public: 'Public',
  },
  zh: {
    eyebrow: '假期 & 请假优化器',
    title: '假期规划',
    lead: '一目了然看假期，找长周末，算出最聪明的请假方案。',
    totalHolidays: '假期数',
    longWeekends: '长周末',
    nextHoliday: '下一个假期',
    daysUntil: '天后',
    daysFromNow: '天后',
    today: '就是今天！',
    holidaysThisYear: '个公共假期',
    weekendsFound: '个 3 天以上的连休',
    optimizer: '请假优化',
    optimizerDesc: '请这些天假，获得最长连续休息。',
    allHolidays: '全部假期',
    loading: '正在加载假期\u2026',
    error: '加载失败，请检查国家/年份选择。',
    takeDays: '请 {n} 天假',
    getDays: '获得 {n} 天连休',
    noData: '暂无数据。',
    public: '公共',
  },
}

const t = useT(copy)

/* ---------- 常量 ---------- */
// 国家列表：[代码, { en, zh 名称 }]
const COUNTRIES = [
  ['CN', { en: 'China', zh: '中国' }],
  ['US', { en: 'United States', zh: '美国' }],
  ['GB', { en: 'United Kingdom', zh: '英国' }],
  ['JP', { en: 'Japan', zh: '日本' }],
  ['DE', { en: 'Germany', zh: '德国' }],
  ['FR', { en: 'France', zh: '法国' }],
  ['KR', { en: 'South Korea', zh: '韩国' }],
  ['SG', { en: 'Singapore', zh: '新加坡' }],
  ['AU', { en: 'Australia', zh: '澳大利亚' }],
  ['CA', { en: 'Canada', zh: '加拿大' }],
  ['IN', { en: 'India', zh: '印度' }],
  ['BR', { en: 'Brazil', zh: '巴西' }],
]

const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAYS_ZH = ['一', '二', '三', '四', '五', '六', '日']
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

// 假期天数映射（仅适用于多天假期常见的国家）
const HOLIDAY_SPANS = {
  CN: {
    '元旦': 1, "New Year's Day": 1,
    '春节': 7, 'Chinese New Year (Spring Festival)': 7,
    '清明节': 1, 'Qingming Festival': 1,
    '劳动节': 5, 'Labour Day': 5,
    '端午节': 3, 'Dragon Boat Festival': 3,
    '中秋节': 1, 'Mid-Autumn Festival': 1,
    '国庆节': 7, 'National Day': 7,
  },
  JP: {
    '正月': 3, "New Year's Day": 3,
    'ゴールデンウィーク': 5, 'Showa Day': 1,
    '振替休日': 1,
  },
}

/* ---------- 响应式状态 ---------- */
const now = new Date()
const currentYear = now.getFullYear()
const country = ref('CN')                 // 选中国家
const year = ref(currentYear)             // 选中年份
const yearOptions = [currentYear - 1, currentYear, currentYear + 1]
const rawHolidays = ref([])               // API 原始数据
const loading = ref(false)                // 加载中
const hasError = ref(false)               // 加载失败

/* ---------- 语言相关派生 ---------- */
const weekdays = computed(() => i18nState.lang === 'zh' ? WEEKDAYS_ZH : WEEKDAYS_EN)
const months = computed(() => i18nState.lang === 'zh' ? MONTHS_ZH : MONTHS_EN)
const dowLabels = computed(() => i18nState.lang === 'zh' ? ['日', '一', '二', '三', '四', '五', '六'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
const loc = computed(() => locale())

/* ---------- 日期工具函数 ---------- */
function dayOfWeek(y, m, d) {
  return new Date(y, m - 1, d).getDay()
}
function isWeekend(y, m, d) {
  const dow = dayOfWeek(y, m, d)
  return dow === 0 || dow === 6
}
function dateStr(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate()
}

/* ---------- 假期展开：多天假期拆分为单日 ---------- */
function expandHolidays(holidays, c) {
  const spans = HOLIDAY_SPANS[c] || {}
  const expanded = new Map()
  holidays.forEach(h => {
    const span = Math.max(1, spans[h.localName] || spans[h.name] || 1)
    const base = new Date(h.date)
    for (let i = 0; i < span; i++) {
      const d = new Date(base.getTime() + i * 86400000)
      const ds = d.toISOString().slice(0, 10)
      if (!expanded.has(ds)) {
        expanded.set(ds, { ...h, date: ds, isMainDay: i === 0, spanDay: i + 1, spanTotal: span })
      }
    }
  })
  return [...expanded.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/* ---------- 派生：展开后的假期 ---------- */
const expandedHolidays = computed(() => expandHolidays(rawHolidays.value, country.value))

/* ---------- 派生：查找长周末（3 天以上连休） ---------- */
const longWeekends = computed(() => {
  const holidays = expandedHolidays.value
  const holiSet = new Set(holidays.map(h => h.date))
  const results = []
  const y = year.value

  for (let m = 1; m <= 12; m++) {
    const days = daysInMonth(y, m)
    for (let d = 1; d <= days; d++) {
      const ds = dateStr(y, m, d)
      if (!holiSet.has(ds)) continue
      const dow = dayOfWeek(y, m, d)
      const hol = holidays.find(h => h.date === ds)
      // 周五假期 = 周五六日连休 3 天
      if (dow === 5) {
        results.push({ date: ds, type: 'friday', name: hol?.localName || '', days: 3, leaveNeeded: 0 })
      }
      // 周一假期 = 周六日一连休 3 天
      if (dow === 1) {
        results.push({ date: ds, type: 'monday', name: hol?.localName || '', days: 3, leaveNeeded: 0 })
      }
      // 周二假期 = 请周一假 → 连休 4 天
      if (dow === 2) {
        results.push({ date: ds, type: 'tuesday', name: hol?.localName || '', days: 4, leaveNeeded: 1, leaveDate: dateStr(y, m, d - 1) })
      }
      // 周四假期 = 请周五假 → 连休 4 天
      if (dow === 4) {
        results.push({ date: ds, type: 'thursday', name: hol?.localName || '', days: 4, leaveNeeded: 1, leaveDate: dateStr(y, m, d + 1) })
      }
      // 周三假期 = 请周四周五假 → 连休 5 天
      if (dow === 3) {
        results.push({ date: ds, type: 'wednesday', name: hol?.localName || '', days: 5, leaveNeeded: 2, leaveDates: [dateStr(y, m, d + 1), dateStr(y, m, d + 2)] })
      }
    }
  }
  return results.sort((a, b) => b.days - a.days || a.date.localeCompare(b.date))
})

/* ---------- 派生：请假优化建议（性价比前 6） ---------- */
const leaveOptimizers = computed(() => {
  return longWeekends.value
    .filter(w => w.leaveNeeded > 0)
    .sort((a, b) => (b.days / b.leaveNeeded) - (a.days / a.leaveNeeded))
    .slice(0, 6)
})

/* ---------- 派生：下一个假期 ---------- */
const nextHoliday = computed(() => {
  const holidays = expandedHolidays.value
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = holidays.filter(h => h.date >= today)
  if (!upcoming.length) return null
  const next = upcoming[0]
  const diff = Math.ceil((new Date(next.date) - new Date(today)) / 86400000)
  return { ...next, daysUntil: diff }
})

/* ---------- 派生：汇总统计 ---------- */
const summaryData = computed(() => ({
  total: expandedHolidays.value.length,
  freeLongWeekends: longWeekends.value.filter(w => w.leaveNeeded === 0).length,
}))

/* ---------- 派生：年度日历结构（12 个月） ---------- */
const yearMonths = computed(() => {
  const y = year.value
  const holidays = expandedHolidays.value
  const holiMap = {}
  holidays.forEach(h => { holiMap[h.date] = h })
  const todayStr = new Date().toISOString().slice(0, 10)

  return Array.from({ length: 12 }, (_, mi) => {
    const m = mi + 1
    const days = daysInMonth(y, m)
    const firstDow = (dayOfWeek(y, m, 1) + 6) % 7 // 周一=0
    const holCount = holidays.filter(h => Number(h.date.slice(5, 7)) === m).length

    const cells = []
    // 月初空白占位
    for (let i = 0; i < firstDow; i++) {
      cells.push({ empty: true, day: '', title: '', cls: { empty: true } })
    }
    for (let d = 1; d <= days; d++) {
      const ds = dateStr(y, m, d)
      const we = isWeekend(y, m, d)
      const hInfo = holiMap[ds]
      const today = ds === todayStr
      const title = hInfo
        ? (hInfo.spanTotal > 1 ? `${hInfo.localName} (${hInfo.spanDay}/${hInfo.spanTotal})` : hInfo.localName)
        : ''
      cells.push({
        empty: false,
        day: d,
        title,
        cls: {
          weekend: we,
          today,
          holiday: !!hInfo,
          'holiday-start': hInfo && hInfo.spanTotal > 1 && hInfo.spanDay === 1,
          'holiday-end': hInfo && hInfo.spanTotal > 1 && hInfo.spanDay === hInfo.spanTotal,
          'holiday-single': hInfo && hInfo.spanTotal === 1,
        },
      })
    }
    return { m, mi, holCount, cells }
  })
})

/* ---------- 派生：假期分组（连续多日假期合并） ---------- */
const holidayGroups = computed(() => {
  const groups = []
  let current = null
  expandedHolidays.value.forEach(h => {
    if (current && current.localName === h.localName) {
      current.endDate = h.date
      current.days++
      current.dates.push(h.date)
    } else {
      if (current) groups.push(current)
      current = { localName: h.localName, name: h.name, startDate: h.date, endDate: h.date, days: 1, dates: [h.date] }
    }
  })
  if (current) groups.push(current)
  return groups
})

/* ---------- 模板辅助方法 ---------- */
// 取请假日期数组（兼容 leaveDate 单值与 leaveDates 数组）
function leaveDates(w) {
  return w.leaveDates || (w.leaveDate ? [w.leaveDate] : [])
}
// 格式化假期日期范围
function formatRange(g) {
  const start = new Date(g.startDate)
  const end = new Date(g.endDate)
  if (g.days > 1) {
    return `${start.toLocaleDateString(loc.value, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(loc.value, { month: 'short', day: 'numeric' })}`
  }
  return start.toLocaleDateString(loc.value, { month: 'short', day: 'numeric', weekday: 'short' })
}
// 日条标签：日/月
function dayChipLabel(ds) {
  const dd = new Date(ds)
  return `${dd.getDate()}/${dd.getMonth() + 1}`
}
// 日条星期标签
function dayChipDow(ds) {
  return dowLabels.value[new Date(ds).getDay()]
}
// 是否周末
function isWeekendDate(ds) {
  const dow = new Date(ds).getDay()
  return dow === 0 || dow === 6
}

/* ---------- 加载假期数据 ---------- */
async function loadHolidays() {
  loading.value = true
  hasError.value = false
  try {
    const data = await fetchJSON(`https://date.nager.at/api/v3/publicholidays/${year.value}/${country.value}`)
    rawHolidays.value = data
  } catch (e) {
    rawHolidays.value = []
    hasError.value = true
  } finally {
    loading.value = false
  }
}

/* ---------- 监听控件变化，重新加载 ---------- */
watch([country, year], () => loadHolidays())

/* ---------- 初始化 ---------- */
onMounted(() => loadHolidays())
</script>

<template>
  <div class="offday-app">
    <!-- 顶栏：语言切换由 AppHeader 内部处理 -->
    <AppHeader :show-lang-toggle="true" />

    <main class="shell">
      <!-- 标题区 -->
      <header class="masthead">
        <div>
          <p class="eyebrow">{{ t('eyebrow') }}</p>
          <h1>{{ t('title') }}</h1>
          <p class="lead">{{ t('lead') }}</p>
        </div>
        <div class="header-right">
          <form class="control-form">
            <select v-model="country">
              <option v-for="[c, n] in COUNTRIES" :key="c" :value="c">{{ n[i18nState.lang] }}</option>
            </select>
            <select v-model.number="year">
              <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
            </select>
          </form>
        </div>
      </header>

      <!-- 汇总卡片 -->
      <section v-if="rawHolidays.length" class="summary">
        <div class="summary-card">
          <div class="label">{{ t('totalHolidays') }}</div>
          <div class="value">{{ summaryData.total }}</div>
          <div class="sub">{{ t('holidaysThisYear') }}</div>
        </div>
        <div class="summary-card">
          <div class="label">{{ t('longWeekends') }}</div>
          <div class="value">{{ summaryData.freeLongWeekends }}</div>
          <div class="sub">{{ t('weekendsFound') }}</div>
        </div>
        <div class="summary-card">
          <div class="label">{{ t('nextHoliday') }}</div>
          <div class="value">{{ nextHoliday ? nextHoliday.localName : '—' }}</div>
          <div class="sub">
            <template v-if="nextHoliday">
              {{ nextHoliday.daysUntil === 0 ? t('today') : `${nextHoliday.daysUntil} ${t('daysUntil')}` }}
            </template>
          </div>
        </div>
      </section>

      <!-- 倒计时卡片 -->
      <section v-if="nextHoliday" class="countdown-card">
        <span class="countdown-days">{{ nextHoliday.daysUntil }}</span>
        <div class="countdown-info">
          <strong>{{ nextHoliday.localName }}</strong> · {{ nextHoliday.date }} ·
          {{ nextHoliday.daysUntil === 0 ? t('today') : `${nextHoliday.daysUntil} ${t('daysFromNow')}` }}
        </div>
      </section>

      <!-- 年度日历网格 -->
      <section class="year-grid">
        <div v-if="loading" class="loading">
          <span class="spinner"></span>
          <span>{{ t('loading') }}</span>
        </div>
        <p v-else-if="hasError" class="error-box">{{ t('error') }}</p>
        <template v-else>
          <div v-for="month in yearMonths" :key="month.m" class="month-card">
            <div class="month-name">
              {{ months[month.mi] }}
              <span class="month-count">{{ month.holCount }} {{ t('public') }}</span>
            </div>
            <div class="cal-grid">
              <div v-for="(d, i) in weekdays" :key="'h' + i" class="cal-head">{{ d }}</div>
              <div
                v-for="(cell, i) in month.cells"
                :key="'c' + i"
                class="cal-day"
                :class="cell.cls"
                :title="cell.title"
              >{{ cell.day }}</div>
            </div>
          </div>
        </template>
      </section>

      <!-- 请假优化 -->
      <section class="optimizer-section">
        <div class="section-head">
          <h2>{{ t('optimizer') }}</h2>
          <p class="section-desc">{{ t('optimizerDesc') }}</p>
        </div>
        <div class="optimizer-grid">
          <template v-if="!loading && !hasError">
            <p v-if="!leaveOptimizers.length" class="no-data">{{ t('noData') }}</p>
            <div v-for="(w, i) in leaveOptimizers" :key="i" class="optimize-card">
              <div class="opt-title">{{ w.name }}</div>
              <div class="opt-break">
                {{ t('takeDays').replace('{n}', w.leaveNeeded) }} → {{ t('getDays').replace('{n}', w.days) }}
              </div>
              <div class="opt-detail">{{ w.date }} ({{ w.type }})</div>
              <div class="opt-days">
                <span v-for="(d, j) in leaveDates(w)" :key="j" class="opt-tag">{{ d }}</span>
              </div>
            </div>
          </template>
        </div>
      </section>

      <!-- 全部假期列表 -->
      <section class="holiday-section">
        <div class="section-head">
          <h2>{{ t('allHolidays') }}</h2>
        </div>
        <div class="holiday-list">
          <template v-if="!loading && !hasError">
            <div v-for="(g, i) in holidayGroups" :key="i" class="holiday-row">
              <div class="holiday-left">
                <div class="holiday-range">{{ formatRange(g) }}</div>
                <div class="day-strip">
                  <span
                    v-for="ds in g.dates"
                    :key="ds"
                    class="day-chip"
                    :class="{ 'day-we': isWeekendDate(ds) }"
                  >{{ dayChipLabel(ds) }} {{ dayChipDow(ds) }}</span>
                </div>
              </div>
              <div class="holiday-mid">
                <div class="holiday-name">{{ g.localName }}</div>
                <div v-if="g.localName !== g.name" class="holiday-local">{{ g.name }}</div>
              </div>
              <span class="holiday-badge" :class="{ 'weekend-badge': g.days > 1 }">{{ g.days }}d</span>
            </div>
          </template>
        </div>
      </section>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Offday Planner — 暖色调纸质主题
   原 :root 变量迁移到组件根类 .offday-app 上，
   --ok-* 令牌在此覆盖，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.offday-app {
  --bg: #f7f4ee;
  --panel: #fffdf9;
  --line: #ddd4c6;
  --text: #221f1a;
  --muted: #6b6459;
  --accent: #8b5a2b;
  --accent-soft: #f2e6d6;
  --holiday: #c0392b;
  --holiday-bg: #fdecea;
  --weekend: #d4c5a9;
  --leave: #2e7d32;
  --leave-bg: #e8f5e9;
  --today-ring: #8b5a2b;

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

  /* 原 body 样式迁移到根元素 */
  margin: 0;
  font-family: "IBM Plex Sans", system-ui, sans-serif;
  color: var(--text);
  background: var(--bg);
}

* { box-sizing: border-box; }

h1, h2, p, strong, span, small { margin: 0; }

.shell {
  width: min(1100px, calc(100% - 1.25rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

.masthead {
  display: flex;
  justify-content: space-between;
  align-items: end;
  padding: 0.3rem 0 1.2rem;
  border-bottom: 1px solid var(--line);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent);
}

.masthead h1 {
  margin-top: 0.25rem;
  font-size: clamp(2rem, 5vw, 3rem);
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
  align-items: end;
  gap: 0.6rem;
}

.control-form {
  display: flex;
  gap: 0.4rem;
}

.control-form select {
  font: inherit;
  height: 2.2rem;
  padding: 0 0.6rem;
  border: 1px solid var(--line);
  background: var(--panel);
  font-size: 0.82rem;
  cursor: pointer;
}

/* Summary */
.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.6rem;
  margin-top: 1rem;
}

.summary-card {
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 0.8rem;
}

.summary-card .label {
  font-size: 0.72rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.summary-card .value {
  font-size: 1.6rem;
  font-weight: 700;
  margin-top: 0.15rem;
}

.summary-card .sub {
  font-size: 0.76rem;
  color: var(--muted);
  margin-top: 0.15rem;
}

/* Countdown */
.countdown-card {
  margin-top: 0.8rem;
  background: var(--accent-soft);
  border: 1px solid var(--line);
  padding: 0.8rem 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.countdown-days {
  font-size: 2rem;
  font-weight: 800;
  color: var(--accent);
  font-family: "IBM Plex Mono", monospace;
  letter-spacing: -0.03em;
}

.countdown-info {
  font-size: 0.85rem;
  color: var(--muted);
}

.countdown-info strong {
  color: var(--text);
}

/* Year grid */
.year-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.6rem;
  margin-top: 1.2rem;
}

.month-card {
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 0.6rem;
}

.month-name {
  font-weight: 700;
  font-size: 0.88rem;
  margin-bottom: 0.4rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.month-count {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.68rem;
  color: var(--muted);
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.cal-head {
  font-size: 0.6rem;
  text-align: center;
  color: var(--muted);
  padding: 0.2rem 0;
  font-weight: 600;
}

.cal-day {
  text-align: center;
  padding: 0.2rem;
  font-size: 0.72rem;
  font-family: "IBM Plex Mono", monospace;
  border-radius: 3px;
  line-height: 1.5;
  cursor: default;
  position: relative;
}

.cal-day.empty { visibility: hidden; }

.cal-day.weekend {
  background: rgba(0, 0, 0, 0.03);
  color: var(--muted);
}

.cal-day.holiday {
  background: var(--holiday);
  color: white;
  font-weight: 700;
}

.cal-day.holiday-start { border-radius: 4px 0 0 4px; }
.cal-day.holiday-end { border-radius: 0 4px 4px 0; }
.cal-day.holiday-single { border-radius: 4px; }

.cal-day.today {
  outline: 2px solid var(--today-ring);
  outline-offset: -1px;
}

.cal-day.leave {
  background: var(--leave-bg);
  color: var(--leave);
  font-weight: 600;
}

.cal-day[title]:hover::after {
  content: attr(title);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: var(--text);
  color: white;
  padding: 0.2rem 0.4rem;
  font-size: 0.65rem;
  white-space: nowrap;
  border-radius: 3px;
  z-index: 10;
  font-family: "IBM Plex Sans", sans-serif;
}

/* Optimizer & Holiday sections */
.optimizer-section,
.holiday-section {
  margin-top: 1.5rem;
}

.section-head {
  margin-bottom: 0.6rem;
}

.section-head h2 {
  font-size: 1.05rem;
}

.section-desc {
  font-size: 0.76rem;
  color: var(--muted);
  margin-top: 0.15rem;
}

.optimizer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0.6rem;
}

.optimize-card {
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 0.8rem;
}

.optimize-card .opt-title {
  font-weight: 700;
  font-size: 0.92rem;
  margin-bottom: 0.3rem;
}

.optimize-card .opt-break {
  font-size: 0.85rem;
  color: var(--leave);
  font-weight: 600;
}

.optimize-card .opt-detail {
  font-size: 0.78rem;
  color: var(--muted);
  margin-top: 0.3rem;
  line-height: 1.5;
}

.optimize-card .opt-days {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-top: 0.4rem;
}

.optimize-card .opt-tag {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.68rem;
  padding: 0.15rem 0.4rem;
  border: 1px solid var(--leave);
  color: var(--leave);
  background: var(--leave-bg);
}

.no-data {
  color: var(--muted);
  padding: 1rem;
}

.error-box {
  color: #a33;
  padding: 1rem;
}

/* Holiday list */
.holiday-list {
  display: grid;
  gap: 0;
}

.holiday-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.6rem;
  align-items: start;
  padding: 0.7rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.holiday-left {
  display: flex;
  flex-direction: column;
}

.holiday-mid {
  display: flex;
  flex-direction: column;
}

.holiday-range {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.78rem;
  font-weight: 600;
}

.day-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.3rem;
}

.day-chip {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.62rem;
  padding: 0.12rem 0.35rem;
  border: 1px solid var(--line);
  color: var(--muted);
  border-radius: 2px;
}

.day-chip.day-we {
  border-color: var(--holiday);
  color: var(--holiday);
  background: var(--holiday-bg);
}

.holiday-name {
  font-size: 0.88rem;
}

.holiday-local {
  font-size: 0.76rem;
  color: var(--muted);
}

.holiday-badge {
  font-size: 0.66rem;
  padding: 0.15rem 0.4rem;
  border: 1px solid var(--line);
  color: var(--muted);
  font-family: "IBM Plex Mono", monospace;
  text-transform: uppercase;
}

.holiday-badge.weekend-badge {
  border-color: var(--holiday);
  color: var(--holiday);
}

/* Loading */
.loading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--muted);
  padding: 1.5rem;
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

/* Responsive */
@media (max-width: 720px) {
  .masthead { flex-direction: column; align-items: start; gap: 0.6rem; }
  .header-right { align-self: start; }
  .year-grid { grid-template-columns: 1fr 1fr; }
  .holiday-row { grid-template-columns: 80px 1fr; }
  .holiday-badge { display: none; }
}
</style>
