<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { i18nState, toggleLang, useT } from '../i18n.js'
import { fetchJSON, lsGet, lsSet, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ============================================================
   Sky Brief — 天气与城市对比
   数据源：
     · Open-Meteo Geocoding（城市搜索）
     · Open-Meteo Forecast（当前天气、逐小时、逐日预报）
     · Open-Meteo Air Quality（US AQI 空气质量）
   ============================================================ */

/* ---------- 文案字典（中英双语） ---------- */
const copy = {
  en: {
    eyebrow: 'Weather & air quality', title: 'Sky Brief',
    search: 'Search', locate: '📍 My location', compare: '⇄ Compare', airQuality: 'Air quality',
    hourly: 'Next 12 hours', daily: '7-day forecast',
    feelsLike: 'Feels like', wind: 'Wind', humidity: 'Humidity',
    sunrise: 'Sunrise', sunset: 'Sunset', rain: 'Rain',
    uv: 'UV index', pressure: 'Pressure',
    aqiGood: 'Good', aqiFair: 'Fair', aqiModerate: 'Moderate', aqiPoor: 'Poor', aqiVpoor: 'Very poor',
  },
  zh: {
    eyebrow: '天气 & 空气质量', title: '天气简报',
    search: '搜索', locate: '📍 我的位置', compare: '⇄ 对比', airQuality: '空气质量',
    hourly: '未来 12 小时', daily: '7 天预报',
    feelsLike: '体感', wind: '风速', humidity: '湿度',
    sunrise: '日出', sunset: '日落', rain: '降雨',
    uv: '紫外线', pressure: '气压',
    aqiGood: '优', aqiFair: '良', aqiModerate: '中', aqiPoor: '差', aqiVpoor: '极差',
  },
}

const t = useT(copy)

/* ---------- WMO 天气代码映射（图标 + 文案） ---------- */
const WMO_ICONS = {
  0: '☀️', 1: '🌤', 2: '⛅', 3: '☁️', 45: '🌫', 48: '🌫',
  51: '🌦', 53: '🌦', 55: '🌦', 56: '🌧', 57: '🌧',
  61: '🌧', 63: '🌧', 65: '🌧', 66: '🌧', 67: '🌧',
  71: '🌨', 73: '🌨', 75: '🌨', 77: '🌨',
  80: '🌦', 81: '🌧', 82: '⛈',
  85: '🌨', 86: '🌨',
  95: '⛈', 96: '⛈', 99: '⛈',
}

const WMO_TEXT = {
  en: {
    0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Freezing fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
    80: 'Rain showers', 81: 'Showers', 82: 'Heavy showers',
    95: 'Thunderstorm', 96: 'Thunderstorm + hail',
  },
  zh: {
    0: '晴', 1: '大部晴朗', 2: '多云', 3: '阴天',
    45: '雾', 48: '冻雾',
    51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨',
    61: '小雨', 63: '中雨', 65: '大雨',
    71: '小雪', 73: '中雪', 75: '大雪',
    80: '阵雨', 81: '中阵雨', 82: '大阵雨',
    95: '雷暴', 96: '雷暴+冰雹',
  },
}

const SAVED_KEY = 'sky-brief-saved'

/* ---------- 响应式状态 ---------- */
const query = ref('Shanghai')        // 搜索框输入
const unit = ref('C')                // 温度单位 C / F
const lastData = ref(null)           // 最近一次成功加载的数据 { label, forecast, air }
const heroError = ref(null)          // 搜索失败时的错误 { message, query }
const saved = ref([])                // 收藏的城市列表
const compareVisible = ref(false)    // 对比面板是否展开
const compareQuery = ref('')         // 对比城市输入
const compareResult = ref(null)      // 对比结果
const compareError = ref(null)       // 对比错误信息
const currentCityData = ref(null)    // 当前城市温度（供对比计算温差）
const compareInputRef = ref(null)    // 对比输入框引用

/* ---------- 工具函数 ---------- */
function weatherIcon(code) { return WMO_ICONS[code] || '🌡' }
function weatherText(code) { return (WMO_TEXT[i18nState.lang] || WMO_TEXT.en)[code] || `WMO ${code}` }
function toF(c) { return c * 9 / 5 + 32 }
function tempV(v) { return unit.value === 'C' ? `${Math.round(v)}°` : `${Math.round(toF(v))}°` }
function speedV(kmh) { return unit.value === 'C' ? `${Math.round(kmh)} km/h` : `${Math.round(kmh * 0.621)} mph` }
function fmtTime(iso) { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }

function aqiLabel(v) {
  if (v <= 50) return t.value('aqiGood')
  if (v <= 100) return t.value('aqiFair')
  if (v <= 150) return t.value('aqiModerate')
  if (v <= 200) return t.value('aqiPoor')
  return t.value('aqiVpoor')
}
function aqiColor(v) {
  if (v <= 50) return 'var(--good)'
  if (v <= 100) return '#8bc34a'
  if (v <= 150) return 'var(--warn)'
  return 'var(--bad)'
}

/* ---------- 收藏管理（localStorage） ---------- */
function getSaved() {
  try { return JSON.parse(lsGet(SAVED_KEY) || '[]') } catch { return [] }
}
function setSavedItems(items) { lsSet(SAVED_KEY, JSON.stringify(items.slice(0, 6))) }
function refreshSaved() { saved.value = getSaved() }

/* ---------- 地理编码与天气加载 ---------- */
async function geocode(q) {
  const d = await fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`)
  if (!d.results?.length) throw new Error('No place found')
  return d.results[0]
}

async function loadForecast(lat, lon, label) {
  const fUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,surface_pressure&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max&timezone=auto&forecast_days=7`
  const aUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi&timezone=auto`
  const [f, air] = await Promise.all([fetchJSON(fUrl), fetchJSON(aUrl)])
  heroError.value = null
  lastData.value = { label, forecast: f, air }
  // 记录当前城市温度（摄氏度），供对比功能计算温差
  currentCityData.value = { temp: f.current.temperature_2m }
}

async function search(q) {
  const trimmed = (q ?? query.value).trim()
  if (!trimmed) return
  // 清空旧数据，隐藏各面板
  lastData.value = null
  heroError.value = null
  try {
    const place = await geocode(trimmed)
    const label = [place.name, place.admin1, place.country].filter(Boolean).join(', ')
    await loadForecast(place.latitude, place.longitude, label)
    // 自动收藏（去重后置顶，最多 6 条）
    const items = getSaved().filter(i => i.query.toLowerCase() !== trimmed.toLowerCase())
    items.unshift({ label, query: trimmed })
    setSavedItems(items)
    refreshSaved()
  } catch (e) {
    heroError.value = { message: e.message, query: trimmed }
  }
}

/* ---------- 定位 ---------- */
function locate() {
  if (!navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(
    pos => loadForecast(pos.coords.latitude, pos.coords.longitude, i18nState.lang === 'zh' ? '当前位置' : 'Your location'),
    () => {}
  )
}

/* ---------- 单位切换 ---------- */
function toggleUnit() {
  unit.value = unit.value === 'C' ? 'F' : 'C'
}

/* ---------- 城市对比 ---------- */
function toggleCompare() {
  compareVisible.value = !compareVisible.value
}

async function loadCompare() {
  const city = compareQuery.value.trim()
  if (!city || !currentCityData.value) return
  compareError.value = null
  compareResult.value = null
  try {
    const geoData = await fetchJSON('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=1&language=en&format=json')
    const place = geoData.results?.[0]
    if (!place) {
      compareError.value = i18nState.lang === 'zh' ? '未找到城市' : 'City not found'
      return
    }
    const wxData = await fetchJSON('https://api.open-meteo.com/v1/forecast?latitude=' + place.latitude + '&longitude=' + place.longitude + '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1')
    const c = wxData.current
    const d = wxData.daily
    const tempDiff = Math.round(c.temperature_2m - (currentCityData.value.temp || 0))
    compareResult.value = {
      icon: weatherIcon(c.weather_code),
      cityName: place.name,
      temp: Math.round(c.temperature_2m),
      humidity: c.relative_humidity_2m,
      wind: Math.round(c.wind_speed_10m),
      minTemp: Math.round(d.temperature_2m_min[0]),
      maxTemp: Math.round(d.temperature_2m_max[0]),
      tempDiff,
    }
  } catch (e) {
    compareError.value = 'Error: ' + e.message
  }
}

/* ---------- 派生：Hero 区 ---------- */
const hero = computed(() => {
  if (heroError.value) {
    return {
      isError: true,
      icon: '❌',
      temp: '—',
      condition: heroError.value.message,
      place: heroError.value.query,
      meta: '',
    }
  }
  const d = lastData.value
  if (!d) return null
  const c = d.forecast.current
  return {
    isError: false,
    icon: weatherIcon(c.weather_code),
    temp: tempV(c.temperature_2m),
    condition: weatherText(c.weather_code),
    place: d.label,
    meta: d.forecast.timezone,
  }
})

const heroStats = computed(() => {
  const d = lastData.value
  if (!d) return []
  const c = d.forecast.current
  const daily = d.forecast.daily
  return [
    { label: t.value('feelsLike'), value: tempV(c.apparent_temperature) },
    { label: t.value('wind'), value: speedV(c.wind_speed_10m) },
    { label: t.value('humidity'), value: `${Math.round(c.relative_humidity_2m)}%` },
    { label: t.value('rain'), value: `${Math.round(daily.precipitation_probability_max?.[0] ?? 0)}%` },
    { label: t.value('sunrise'), value: fmtTime(daily.sunrise[0]) },
    { label: t.value('sunset'), value: fmtTime(daily.sunset[0]) },
    { label: t.value('uv'), value: daily.uv_index_max?.[0]?.toFixed(1) ?? '—' },
    { label: t.value('pressure'), value: `${Math.round(c.surface_pressure)} hPa` },
  ]
})

/* ---------- 派生：AQI ---------- */
const aqi = computed(() => {
  const d = lastData.value
  if (!d) return null
  const v = d.air.current.us_aqi ?? 0
  return {
    value: v,
    label: aqiLabel(v),
    color: aqiColor(v),
    left: `${Math.min(100, (v / 200) * 100)}%`,
  }
})

/* ---------- 派生：逐小时预报 ---------- */
const hourlyCards = computed(() => {
  const d = lastData.value
  if (!d) return []
  const h = d.forecast.hourly
  const now = new Date()
  let startIdx = h.time.findIndex(time => new Date(time) >= new Date(now.getTime() - 3600000))
  if (startIdx < 0) startIdx = 0
  const cards = []
  for (let i = 0; i < 12; i++) {
    const idx = startIdx + i
    if (idx >= h.time.length) break
    const prob = h.precipitation_probability[idx]
    cards.push({
      time: fmtTime(h.time[idx]),
      icon: weatherIcon(h.weather_code[idx]),
      temp: tempV(h.temperature_2m[idx]),
      rain: prob > 20 ? `${Math.round(prob)}%` : '',
    })
  }
  return cards
})

/* ---------- 派生：逐日预报 ---------- */
const dailyRows = computed(() => {
  const d = lastData.value
  if (!d) return []
  const daily = d.forecast.daily
  const allMin = Math.min(...daily.temperature_2m_min)
  const allMax = Math.max(...daily.temperature_2m_max)
  const range = allMax - allMin || 1
  return daily.time.map((day, i) => {
    const lo = daily.temperature_2m_min[i]
    const hi = daily.temperature_2m_max[i]
    const left = ((lo - allMin) / range * 100).toFixed(1)
    const width = ((hi - lo) / range * 100).toFixed(1)
    const date = new Date(day)
    const isToday = date.toDateString() === new Date().toDateString()
    const label = isToday
      ? (i18nState.lang === 'zh' ? '今天' : 'Today')
      : date.toLocaleDateString(locale(), { weekday: 'short', month: 'short', day: 'numeric' })
    return {
      label,
      icon: weatherIcon(daily.weather_code[i]),
      left,
      width,
      loTemp: tempV(lo),
      hiTemp: tempV(hi),
    }
  })
})

/* ---------- 派生：单位标签 ---------- */
const unitLabel = computed(() => unit.value === 'C' ? '°C' : '°F')

/* ---------- 副作用：对比面板展开时聚焦输入框 ---------- */
watch(compareVisible, (v) => {
  if (v) nextTick(() => compareInputRef.value?.focus())
})

/* ---------- 生命周期 ---------- */
onMounted(() => {
  refreshSaved()
  search('Shanghai')
})
</script>

<template>
  <div class="sky-brief-app">
    <!-- 顶部导航栏（含语言切换） -->
    <AppHeader :show-lang-toggle="true" />

    <main class="shell">
      <!-- 页头：标题 + 工具按钮 -->
      <header class="masthead">
        <div>
          <p class="eyebrow">{{ t('eyebrow') }}</p>
          <h1>{{ t('title') }}</h1>
        </div>
        <div class="header-right">
          <button class="btn-ghost" type="button" aria-label="Toggle temperature unit" @click="toggleUnit">{{ unitLabel }}</button>
          <button class="btn-ghost" type="button" aria-label="Use my location" @click="locate">{{ t('locate') }}</button>
          <button class="btn-ghost" type="button" aria-label="Compare cities" @click="toggleCompare">{{ t('compare') }}</button>
        </div>
      </header>

      <!-- 搜索栏 -->
      <section class="search-bar">
        <form @submit.prevent="search()">
          <input v-model="query" type="text" placeholder="Search city…" autocomplete="off" aria-label="Search city" />
          <button type="submit">{{ t('search') }}</button>
        </form>
        <div class="saved-strip">
          <button
            v-for="(item, i) in saved"
            :key="i"
            class="saved-chip"
            type="button"
            @click="search(item.query)"
          >{{ item.label }}</button>
        </div>
      </section>

      <!-- 当前天气 Hero -->
      <section v-if="hero" class="hero-section">
        <div class="hero-main">
          <span class="hero-icon">{{ hero.icon }}</span>
          <div class="hero-temp">
            <span class="hero-temp-val">{{ hero.temp }}</span>
            <span class="hero-condition">{{ hero.condition }}</span>
          </div>
        </div>
        <div class="hero-place">
          <h2>{{ hero.place }}</h2>
          <p v-if="hero.meta" class="hero-meta">{{ hero.meta }}</p>
        </div>
        <div v-if="heroStats.length" class="hero-stats">
          <div v-for="(s, i) in heroStats" :key="i" class="stat-item">
            <div class="s-label">{{ s.label }}</div>
            <div class="s-value">{{ s.value }}</div>
          </div>
        </div>
      </section>

      <!-- 空气质量 -->
      <section v-if="aqi" class="aqi-section">
        <div class="aqi-header">
          <span class="aqi-label">{{ t('airQuality') }}</span>
          <span class="aqi-value" :style="{ color: aqi.color }">{{ aqi.value }}</span>
          <span class="aqi-text">{{ aqi.label }}</span>
        </div>
        <div class="aqi-bar-track">
          <div class="aqi-bar-fill" :style="{ left: aqi.left, borderColor: aqi.color }"></div>
        </div>
        <div class="aqi-scale">
          <span>0</span><span>50</span><span>100</span><span>150</span><span>200+</span>
        </div>
      </section>

      <!-- 逐小时预报 -->
      <section v-if="hourlyCards.length" class="hourly-section">
        <h3>{{ t('hourly') }}</h3>
        <div class="hourly-strip">
          <div v-for="(h, i) in hourlyCards" :key="i" class="hour-card">
            <div class="h-time">{{ h.time }}</div>
            <div class="h-icon">{{ h.icon }}</div>
            <div class="h-temp">{{ h.temp }}</div>
            <div v-if="h.rain" class="h-rain">{{ h.rain }}</div>
          </div>
        </div>
      </section>

      <!-- 逐日预报 -->
      <section v-if="dailyRows.length" class="daily-section">
        <h3>{{ t('daily') }}</h3>
        <div class="daily-list">
          <div v-for="(row, i) in dailyRows" :key="i" class="day-row">
            <span class="day-date">{{ row.label }}</span>
            <span class="day-icon">{{ row.icon }}</span>
            <div class="day-bar">
              <div class="day-bar-fill" :style="{ left: row.left + '%', width: row.width + '%' }"></div>
            </div>
            <span class="day-temps"><span class="t-low">{{ row.loTemp }}</span> / {{ row.hiTemp }}</span>
          </div>
        </div>
      </section>

      <!-- 城市对比 -->
      <section v-if="compareVisible" class="compare-section">
        <div class="compare-bar">
          <form @submit.prevent="loadCompare">
            <input ref="compareInputRef" v-model="compareQuery" type="text" placeholder="Compare city..." autocomplete="off" aria-label="Compare city" />
            <button type="submit">{{ t('search') }}</button>
          </form>
        </div>
        <div class="compare-result">
          <div v-if="compareResult" class="compare-cards">
            <div class="compare-card">
              <div class="compare-icon">{{ compareResult.icon }}</div>
              <div class="compare-city">{{ compareResult.cityName }}</div>
              <div class="compare-temp">{{ compareResult.temp }}°C</div>
              <div class="compare-detail">
                {{ i18nState.lang === 'zh' ? '湿度' : 'Humidity' }}: {{ compareResult.humidity }}% &middot;
                {{ i18nState.lang === 'zh' ? '风速' : 'Wind' }}: {{ compareResult.wind }} km/h
              </div>
              <div class="compare-range">{{ compareResult.minTemp }}° ~ {{ compareResult.maxTemp }}°</div>
            </div>
            <div class="compare-diff">
              <div class="diff-value" :class="compareResult.tempDiff > 0 ? 'up' : 'down'">
                {{ compareResult.tempDiff > 0 ? '+' : '' }}{{ compareResult.tempDiff }}°C
              </div>
              <div class="diff-label">{{ i18nState.lang === 'zh' ? '温差' : 'Temp diff' }}</div>
            </div>
          </div>
          <p v-if="compareError" class="error-msg">{{ compareError }}</p>
        </div>
      </section>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Sky Brief — 样式
   原版 :root 变量映射到组件根类 .sky-brief-app 上。
   ============================================================ */

.sky-brief-app {
  /* 主题变量 */
  --bg: #f3f6fb;
  --panel: #ffffff;
  --line: #d8e0ec;
  --text: #132033;
  --muted: #5c6b80;
  --accent: #1b74e4;
  --accent-soft: #e8f1ff;
  --good: #0f9d74;
  --good-bg: #e6f7f1;
  --warn: #c78012;
  --warn-bg: #fef6e6;
  --bad: #c03d3d;
  --bad-bg: #fce8e8;

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

  /* 等效于原版 body 样式 */
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

/* ---------- 页头 ---------- */
.masthead {
  display: flex;
  justify-content: space-between;
  align-items: end;
  padding: 0.3rem 0 1rem;
  border-bottom: 1px solid var(--line);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent);
}

h1 {
  margin-top: 0.2rem;
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
}

.header-right { display: flex; gap: 0.5rem; align-items: center; }

.btn-ghost {
  font: inherit;
  height: 2.2rem;
  padding: 0 0.7rem;
  border: 1px solid var(--line);
  background: transparent;
  cursor: pointer;
  font-size: 0.78rem;
}

/* ---------- 搜索栏 ---------- */
.search-bar {
  margin-top: 0.8rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--line);
}

.search-bar form {
  display: flex;
  gap: 0.5rem;
}

.search-bar input {
  flex: 1;
  font: inherit;
  height: 2.6rem;
  padding: 0 0.75rem;
  border: 1px solid var(--line);
  background: rgba(255,255,255,0.6);
  font-size: 0.95rem;
}

.search-bar button {
  font: inherit;
  height: 2.6rem;
  padding: 0 1rem;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: white;
  cursor: pointer;
  font-weight: 600;
}

.saved-strip {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.saved-chip {
  font: inherit;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--line);
  background: var(--panel);
  cursor: pointer;
  font-size: 0.76rem;
  border-radius: 12px;
}

.saved-chip:hover { border-color: var(--accent); color: var(--accent); }

/* ---------- Hero ---------- */
.hero-section {
  margin-top: 1rem;
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 1.5rem;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 1.5rem;
  align-items: center;
}

.hero-main {
  grid-row: 1 / 3;
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.hero-icon {
  font-size: 3.5rem;
  line-height: 1;
}

.hero-temp-val {
  font-size: 3.5rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
}

.hero-condition {
  display: block;
  font-size: 0.92rem;
  color: var(--muted);
  margin-top: 0.2rem;
}

.hero-place h2 {
  font-size: 1.2rem;
}

.hero-meta {
  font-size: 0.76rem;
  color: var(--muted);
  margin-top: 0.15rem;
}

.hero-stats {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 0.5rem;
  margin-top: 0.8rem;
  padding-top: 0.8rem;
  border-top: 1px solid var(--line);
}

.stat-item {
  text-align: center;
}

.stat-item .s-label {
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.stat-item .s-value {
  font-weight: 600;
  font-size: 0.95rem;
  margin-top: 0.1rem;
}

/* ---------- AQI ---------- */
.aqi-section {
  margin-top: 0.8rem;
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 0.8rem 1rem;
}

.aqi-header {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  margin-bottom: 0.5rem;
}

.aqi-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-weight: 600;
}

.aqi-value {
  font-size: 1.4rem;
  font-weight: 800;
}

.aqi-text {
  font-size: 0.82rem;
  color: var(--muted);
}

.aqi-bar-track {
  height: 8px;
  background: linear-gradient(90deg, #0f9d74, #8bc34a, #ffc107, #ff9800, #f44336, #9c27b0);
  border-radius: 4px;
  position: relative;
}

.aqi-bar-fill {
  position: absolute;
  top: -3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: white;
  border: 3px solid var(--text);
  transform: translateX(-50%);
  transition: left 0.5s ease;
}

.aqi-scale {
  display: flex;
  justify-content: space-between;
  font-size: 0.62rem;
  color: var(--muted);
  margin-top: 0.3rem;
}

/* ---------- 逐小时 ---------- */
.hourly-section {
  margin-top: 0.8rem;
}

.hourly-section h3 {
  font-size: 0.92rem;
  margin-bottom: 0.5rem;
}

.hourly-strip {
  display: flex;
  gap: 0;
  overflow-x: auto;
  background: var(--panel);
  border: 1px solid var(--line);
}

.hour-card {
  flex: 0 0 70px;
  padding: 0.6rem 0.3rem;
  text-align: center;
  border-right: 1px solid rgba(0,0,0,0.04);
  font-size: 0.76rem;
}

.hour-card .h-time {
  font-weight: 600;
  font-size: 0.72rem;
  color: var(--muted);
}

.hour-card .h-icon {
  font-size: 1.3rem;
  margin: 0.25rem 0;
}

.hour-card .h-temp {
  font-weight: 700;
  font-size: 0.85rem;
}

.hour-card .h-rain {
  font-size: 0.66rem;
  color: var(--accent);
}

/* ---------- 逐日 ---------- */
.daily-section {
  margin-top: 0.8rem;
}

.daily-section h3 {
  font-size: 0.92rem;
  margin-bottom: 0.5rem;
}

.daily-list {
  background: var(--panel);
  border: 1px solid var(--line);
}

.day-row {
  display: grid;
  grid-template-columns: 90px 30px 1fr 80px;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid rgba(0,0,0,0.04);
  font-size: 0.85rem;
}

.day-row:last-child { border-bottom: none; }

.day-date {
  font-weight: 600;
}

.day-icon {
  font-size: 1.2rem;
  text-align: center;
}

.day-bar {
  height: 6px;
  background: var(--line);
  border-radius: 3px;
  position: relative;
  overflow: hidden;
}

.day-bar-fill {
  position: absolute;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #64b5f6, #ff7043);
}

.day-temps {
  font-family: "Inter", monospace;
  font-size: 0.78rem;
  text-align: right;
  white-space: nowrap;
}

.day-temps .t-low { color: var(--muted); }

/* ---------- 加载状态（保留原版样式） ---------- */
.loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--muted);
  padding: 1rem;
}

.spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ---------- 响应式 ---------- */
@media (max-width: 720px) {
  .masthead { flex-direction: column; gap: 0.5rem; align-items: start; }
  .hero-section { grid-template-columns: 1fr; }
  .hero-main { grid-row: auto; }
  .day-row { grid-template-columns: 70px 24px 1fr 65px; }
}

/* ---------- 城市对比 ---------- */
.compare-section {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #d8e0ec;
}
.compare-bar {
  margin-bottom: 1rem;
}
.compare-bar form {
  display: flex;
  gap: 0.5rem;
}
.compare-bar input {
  flex: 1;
  height: 2.4rem;
  padding: 0 0.8rem;
  border: 1px solid #d8e0ec;
  border-radius: 8px;
  font: inherit;
  font-size: 0.88rem;
  outline: none;
}
.compare-bar input:focus {
  border-color: #1b74e4;
}
.compare-bar button {
  height: 2.4rem;
  padding: 0 1rem;
  background: #1b74e4;
  color: #fff;
  border: none;
  border-radius: 8px;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.compare-cards {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1.5rem;
  align-items: center;
}
.compare-card {
  background: #f0f3f8;
  border-radius: 12px;
  padding: 1.2rem;
  text-align: center;
}
.compare-icon {
  font-size: 2rem;
  margin-bottom: 0.3rem;
}
.compare-city {
  font-weight: 700;
  font-size: 1rem;
}
.compare-temp {
  font-size: 1.8rem;
  font-weight: 800;
  margin: 0.3rem 0;
}
.compare-detail {
  font-size: 0.78rem;
  color: #5c6b80;
}
.compare-range {
  font-size: 0.82rem;
  color: #8892a4;
  margin-top: 0.3rem;
}
.compare-diff {
  text-align: center;
}
.diff-value {
  font-size: 1.6rem;
  font-weight: 800;
}
.diff-value.up {
  color: #ef4444;
}
.diff-value.down {
  color: #3b82f6;
}
.diff-label {
  font-size: 0.72rem;
  color: #5c6b80;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.error-msg {
  color: #c03d3d;
  font-size: 0.85rem;
  margin: 0;
}
@media (max-width: 768px) {
  .compare-cards {
    grid-template-columns: 1fr;
    gap: 0.8rem;
  }
}
</style>
