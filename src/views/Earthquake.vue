<script setup>
/* ============================================================
   Global Earthquake Monitor — 全球地震实时监控（Vue 3 SFC）
   数据来源：USGS FDSN Event API
   板块边界：fraxen/tectonicplates GeoJSON
   ============================================================ */

import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, escapeHtml } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/* ---------- i18n 文案字典（中英双语） ---------- */
const copy = {
  en: {
    params: 'Search Parameters',
    day: 'Past 24 Hours',
    week: 'Past 7 Days',
    month: 'Past 30 Days',
    all: 'All',
    plates: '🗺️ Plate Boundaries',
    total: 'Total',
    maxMag: 'Max Mag',
    avgDepth: 'Avg Depth',
    m5: 'M5+',
    events: 'events',
    updating: 'Updating...',
    location: 'Location',
    depth: 'Depth',
    radius: 'Radius',
    time: 'Time',
    popImpact: 'Pop. Impact',
    felt: 'Felt',
    people: 'people',
    tsunami: '🌊 Tsunami',
    mago: 'm ago',
    hago: 'h ago',
    dago: 'd ago',
    error: 'Error',
    unknown: 'Unknown'
  },
  zh: {
    params: '搜索参数',
    day: '过去 24 小时',
    week: '过去 7 天',
    month: '过去 30 天',
    all: '全部',
    plates: '🗺️ 板块边界',
    total: '总数',
    maxMag: '最大震级',
    avgDepth: '平均深度',
    m5: 'M5+',
    events: '事件',
    updating: '更新中...',
    location: '位置',
    depth: '深度',
    radius: '半径',
    time: '时间',
    popImpact: '人口影响',
    felt: '有感',
    people: '人',
    tsunami: '🌊 海啸',
    mago: '分钟前',
    hago: '小时前',
    dago: '天前',
    error: '错误',
    unknown: '未知'
  }
}

const t = useT(copy)

/* ---------- 常量 ---------- */
const API_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query'
const PLATES_URL = 'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json'

// alert 颜色映射（用于列表徽章和弹窗）
const ALERT_COLORS = { green: '#4ade80', yellow: '#facc15', orange: '#fb923c', red: '#ef4444' }

/* ---------- 过滤选项 ---------- */
const timeFilters = [
  { key: 'day', tKey: 'day' },
  { key: 'week', tKey: 'week' },
  { key: 'month', tKey: 'month' }
]
const magFilters = [
  { mag: 0, tKey: 'all' },
  { mag: 2.5, label: 'M2.5+' },
  { mag: 4.5, label: 'M4.5+' },
  { mag: 5.5, label: 'M5.5+' }
]

/* ---------- 响应式状态 ---------- */
const period = ref('day')           // 时间范围：day / week / month
const minMag = ref(0)               // 最小震级
const data = ref([])                // USGS 返回的地震数组
const loading = ref(false)          // 加载中遮罩
const hasError = ref(false)         // 加载失败标记
const updateTime = ref('')          // 顶栏显示的最近更新时间
const showPlates = ref(false)       // 是否显示板块边界

/* ---------- 地图相关（非响应式，避免 Leaflet 实例被 Vue 代理） ---------- */
const mapEl = ref(null)             // 地图容器引用
let map = null                      // Leaflet 地图实例
let layerGroup = null               // 地震圆圈图层
let platesLayer = null              // 板块边界图层
let platesData = null               // 板块边界 GeoJSON 缓存

/* ---------- 工具函数 ---------- */

// 震级 -> 列表徽章颜色类
function magClass(m) {
  if (m == null) return 'g'
  if (m < 3) return 'g'
  if (m < 5) return 'y'
  if (m < 6) return 'o'
  return 'r'
}

// 震级 -> 圆圈填充色
function magColor(m) {
  if (m == null) return '#4ade80'
  if (m < 3) return '#4ade80'
  if (m < 5) return '#facc15'
  if (m < 6) return '#fb923c'
  return '#ef4444'
}

// 时间戳 -> "X 分钟前 / X 小时前 / X 天前"
function timeAgo(ts) {
  const d = Math.max(0, Math.round((Date.now() - ts) / 60000))
  if (d < 60) return d + t.value('mago')
  if (d < 1440) return Math.round(d / 60) + t.value('hago')
  return Math.round(d / 1440) + t.value('dago')
}

// 震级 -> 圆圈半径（米），随地图缩放调整
function eqRadius(m) {
  const z = map.getZoom()
  const base = Math.sqrt(Math.pow(10, 1.02 * m - 4) / Math.PI) * 1000
  const scale = Math.pow(2, 10 - z) * 0.15
  return Math.max(3000, base * scale)
}

// alert 颜色取值
function alertColor(a) {
  return ALERT_COLORS[a] || ''
}

/* ---------- 派生：列表前 100 条 ---------- */
const listItems = computed(() => data.value.slice(0, 100))

/* ---------- 派生：汇总统计 ---------- */
const stats = computed(() => {
  const cd = data.value
  let mx = -Infinity, dp = 0, sg = 0, vd = 0
  cd.forEach((e) => {
    const m = e.properties.mag
    const d = e.geometry.coordinates[2]
    if (m != null && m > mx) mx = m
    if (m >= 5) sg++
    if (d != null) { dp += d; vd++ }
  })
  const av = vd ? Math.round(dp / vd) : 0
  return {
    total: cd.length,
    maxMag: mx > -Infinity ? mx.toFixed(1) : '-',
    avgDepth: av,
    m5: sg
  }
})

/* ---------- 加载地震数据 ---------- */
async function loadData() {
  loading.value = true
  hasError.value = false
  const e = new Date(), s = new Date()
  if (period.value === 'day') s.setDate(s.getDate() - 1)
  else if (period.value === 'week') s.setDate(s.getDate() - 7)
  else s.setMonth(s.getMonth() - 1)
  const url = API_URL + '?format=geojson&starttime=' + s.toISOString() +
    '&endtime=' + e.toISOString() + '&minmagnitude=' + minMag.value +
    '&limit=20000&orderby=time'
  try {
    const d = await fetchJSON(url)
    data.value = d.features || []
    updateTime.value = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit' })
  } catch (err) {
    data.value = []
    hasError.value = true
  } finally {
    loading.value = false
  }
}

/* ---------- 渲染地图圆圈标记 ---------- */
function renderMapMarkers() {
  if (!map || !layerGroup) return
  layerGroup.clearLayers()
  const cd = data.value
  cd.forEach((eq) => {
    const p = eq.properties, c = eq.geometry.coordinates
    const m = p.mag || 0
    const d = c[2] != null ? Math.round(c[2]) : '?'
    const col = magColor(m)
    const r = eqRadius(m)
    const place = escapeHtml(p.place || t.value('unknown'))
    // 弹窗内的可变 HTML：外部数据均经 escapeHtml 转义
    const ah = p.alert
      ? '<br><strong>' + t.value('popImpact') + ':</strong> <span style="text-transform:uppercase;font-weight:bold;color:' + ALERT_COLORS[p.alert] + '">' + escapeHtml(p.alert) + '</span>'
      : ''
    const fh = p.felt
      ? '<br><strong>' + t.value('felt') + ':</strong> ' + escapeHtml(p.felt) + ' ' + t.value('people')
      : ''
    const th = p.tsunami
      ? '<br><strong style="color:#3b82f6">' + t.value('tsunami') + '</strong>'
      : ''
    const pop =
      '<div class="popup-title" style="color:' + col + '">M ' + escapeHtml(m.toFixed(1)) + '</div>' +
      '<div class="popup-sub"><strong>' + t.value('location') + ':</strong> ' + place +
      '<br><strong>' + t.value('depth') + ':</strong> ' + escapeHtml(String(d)) + ' km' +
      '<br><strong>' + t.value('radius') + ':</strong> ' + (r / 1000).toFixed(0) + ' km' +
      '<br><strong>' + t.value('time') + ':</strong> ' + escapeHtml(new Date(p.time).toLocaleString()) +
      ah + fh + th + '</div>'
    // 在 -360/0/360 三个偏移处绘制圆圈，实现世界循环
    ;[-360, 0, 360].forEach((off) => {
      const k = L.circle([c[1], c[0] + off], {
        radius: r, fillColor: col, color: col, weight: 1, opacity: 0.5, fillOpacity: 0.2
      })
      k.bindPopup(pop)
      k.addTo(layerGroup)
    })
  })
}

/* ---------- 切换板块边界图层 ---------- */
async function togglePlates() {
  showPlates.value = !showPlates.value
  if (showPlates.value) {
    // 首次加载时拉取 GeoJSON 并构建图层
    if (!platesData) {
      try {
        platesData = await fetchJSON(PLATES_URL)
        platesLayer = L.layerGroup()
        L.geoJSON(platesData, { style: { color: '#ef4444', weight: 1.5, opacity: 0.7 } })
          .eachLayer((l) => platesLayer.addLayer(l))
      } catch (e) {
        console.warn('Plate boundaries load failed:', e)
      }
    }
    if (platesLayer && !map.hasLayer(platesLayer)) platesLayer.addTo(map)
  } else {
    if (platesLayer && map.hasLayer(platesLayer)) map.removeLayer(platesLayer)
  }
}

/* ---------- 列表项点击：飞往地震位置 ---------- */
function onItemClick(eq) {
  if (!map) return
  const c = eq.geometry.coordinates
  const m = eq.properties.mag || 0
  map.flyTo([c[1], c[0]], m >= 6 ? 5 : m >= 4 ? 6 : 8, { duration: 1.5 })
}

/* ---------- 过滤切换 ---------- */
function setPeriod(p) {
  period.value = p
  loadData()
}
function setMinMag(m) {
  minMag.value = m
  loadData()
}

/* ---------- watch：数据变化时重绘地图标记 ---------- */
watch(data, () => renderMapMarkers())

/* ---------- watch：语言切换时重绘标记（弹窗文案随语言更新） ---------- */
watch(() => i18nState.lang, () => renderMapMarkers())

/* ---------- 生命周期 ---------- */
onMounted(() => {
  // 初始化地图：禁用默认 zoomControl、世界循环、Canvas 渲染
  map = L.map(mapEl.value, {
    zoomControl: false,
    worldCopyJump: true,
    preferCanvas: true,
    minZoom: 2,
    maxZoom: 15
  }).setView([20, 0], 2)
  L.control.zoom({ position: 'topleft' }).addTo(map)
  // 暗色底图
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18,
    attribution: ''
  }).addTo(map)
  // 地震圆圈图层
  layerGroup = L.layerGroup().addTo(map)
  // 首次加载
  loadData()
})

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<template>
  <div class="earthquake-app">
    <!-- 顶栏：标题 + 语言切换（语言切换由 AppHeader 内部处理） -->
    <AppHeader :title="{ en: 'Earthquake', zh: '地震监测' }" :show-lang-toggle="true" />

    <div class="app-body">
      <!-- 地图容器 -->
      <div ref="mapEl" class="map"></div>

      <!-- 侧边栏：过滤器 + 统计 + 列表 -->
      <aside class="sidebar">
        <div class="filters-container">
          <!-- 更新时间行（含 live 指示灯） -->
          <div class="update-row">
            <span class="live"></span>
            <span class="update-time">{{ updateTime || t('updating') }}</span>
          </div>

          <!-- 时间范围过滤 -->
          <div class="filter-group">
            <span class="filter-label">{{ t('params') }}</span>
            <button
              v-for="f in timeFilters"
              :key="f.key"
              class="fb"
              :class="{ on: period === f.key }"
              type="button"
              @click="setPeriod(f.key)"
            >{{ t(f.tKey) }}</button>
          </div>

          <!-- 震级过滤 -->
          <div class="filter-group">
            <button
              v-for="f in magFilters"
              :key="f.mag"
              class="fb"
              :class="{ on: minMag === f.mag }"
              type="button"
              @click="setMinMag(f.mag)"
            >{{ f.label || t(f.tKey) }}</button>
          </div>

          <!-- 板块边界叠加层 -->
          <div class="filter-group overlay-group">
            <button
              class="fb overlay-btn"
              :class="{ on: showPlates }"
              type="button"
              @click="togglePlates"
            >{{ t('plates') }}</button>
          </div>

          <!-- 汇总统计 -->
          <div class="stats">
            <div class="st">
              <div class="v">{{ stats.total }}</div>
              <div class="l">{{ t('total') }}</div>
            </div>
            <div class="st">
              <div class="v">{{ stats.maxMag }}</div>
              <div class="l">{{ t('maxMag') }}</div>
            </div>
            <div class="st">
              <div class="v">{{ stats.avgDepth }} km</div>
              <div class="l">{{ t('avgDepth') }}</div>
            </div>
            <div class="st">
              <div class="v">{{ stats.m5 }}</div>
              <div class="l">{{ t('m5') }}</div>
            </div>
          </div>

          <!-- 列表 -->
          <div class="list-wrapper">
            <div class="loader-overlay" :class="{ active: loading }">
              <div class="spinner"></div>
            </div>
            <div class="list">
              <!-- 加载失败 -->
              <div v-if="hasError" class="error-box">{{ t('error') }}</div>

              <!-- 列表项 -->
              <div
                v-for="(eq, i) in listItems"
                :key="eq.id || i"
                class="it"
                @click="onItemClick(eq)"
              >
                <div class="mg" :class="magClass(eq.properties.mag)">
                  {{ eq.properties.mag ? eq.properties.mag.toFixed(1) : '?' }}
                </div>
                <div class="inf">
                  <div class="pl">{{ eq.properties.place || t('unknown') }}</div>
                  <div class="mt">
                    <span>{{ t('depth') }}: {{ Math.round(eq.geometry.coordinates[2]) }} km</span>
                    <span
                      v-if="eq.properties.alert"
                      class="alert-badge"
                      :style="{ borderColor: alertColor(eq.properties.alert), color: alertColor(eq.properties.alert) }"
                    >{{ eq.properties.alert.toUpperCase() }}</span>
                    <span v-if="eq.properties.tsunami" class="tsunami-icon">🌊</span>
                  </div>
                </div>
                <div class="ag">{{ timeAgo(eq.properties.time) }}</div>
              </div>
            </div>
          </div>

          <!-- 底部 footer -->
          <footer class="ok-footer">
            <span>USGS Data API</span>
            <span>{{ stats.total }} {{ t('events') }}</span>
          </footer>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* ============================================================
   Earthquake — 深色地图主题
   原 :root 变量迁移到组件根类 .earthquake-app 上，
   --ok-* 令牌在此覆盖，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.earthquake-app {
  /* 表面与文字 */
  --bg: #0f172a;
  --sf: #1e293b;
  --sf-hover: #334155;
  --bd: rgba(255, 255, 255, 0.08);
  --tx: #e2e8f0;
  --mt: #94a3b8;
  --gn: #4ade80;
  --yl: #facc15;
  --or: #fb923c;
  --rd: #ef4444;
  --bl: #3b82f6;

  /* 共享 token 映射 */
  --ok-bg: var(--bg);
  --ok-panel: var(--sf);
  --ok-line: var(--bd);
  --ok-text: var(--tx);
  --ok-muted: var(--mt);
  --ok-accent: var(--bl);
  --ok-footer-line: var(--bd);
  --ok-footer-text: var(--mt);
  --ok-footer-link: var(--bl);
  --ok-topbar-line: var(--bd);

  color-scheme: dark;

  /* 原 body 样式迁移到根元素 */
  font-family: 'Inter', system-ui, sans-serif;
  color: var(--tx);
  background: var(--bg);
  line-height: 1.5;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ---------- 顶栏补充样式（基于 AppHeader 的 .ok-topbar） ---------- */
.earthquake-app :deep(.ok-topbar) {
  padding: 0.8rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--sf);
  border-bottom: 1px solid var(--bd);
  flex-shrink: 0;
  z-index: 10;
}

.earthquake-app :deep(.topbar-title) {
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: -0.02em;
  opacity: 1;
  color: var(--tx);
}

/* ---------- 主容器 ---------- */
.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.map {
  flex: 1;
  background: var(--bg);
  z-index: 1;
}

/* ---------- 侧边栏 ---------- */
.sidebar {
  width: 380px;
  background: var(--bg);
  border-left: 1px solid var(--bd);
  display: flex;
  flex-direction: column;
  z-index: 5;
}

.filters-container {
  padding: 1rem;
  background: var(--sf);
  border-bottom: 1px solid var(--bd);
  flex-shrink: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  flex: 1;
}

/* ---------- 更新时间行（含 live 指示灯） ---------- */
.update-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-size: 0.8rem;
  color: var(--mt);
}

.update-row .live {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--gn);
  box-shadow: 0 0 10px var(--gn);
  animation: blink 2s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; box-shadow: none; }
}

/* ---------- 过滤器组 ---------- */
.filter-group {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.filter-group:last-child {
  margin-bottom: 0;
}

.filter-group.overlay-group {
  margin-top: 0.5rem;
}

.filter-label {
  font-size: 0.65rem;
  color: var(--mt);
  width: 100%;
  display: block;
  margin-bottom: 0.2rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

/* ---------- 过滤按钮 ---------- */
.fb {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--bd);
  color: var(--mt);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.fb:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--tx);
}

.fb.on {
  background: var(--bl);
  border-color: var(--bl);
  color: #fff;
}

/* ---------- 统计 ---------- */
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: var(--bd);
  gap: 1px;
  flex-shrink: 0;
}

.st {
  background: var(--sf);
  padding: 0.75rem 0.5rem;
  text-align: center;
}

.st .v {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--tx);
}

.st .l {
  font-size: 0.6rem;
  color: var(--mt);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 0.2rem;
}

/* ---------- 列表 ---------- */
.list-wrapper {
  position: relative;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.list {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 1rem;
}

.list::-webkit-scrollbar {
  width: 6px;
}

.list::-webkit-scrollbar-track {
  background: transparent;
}

.list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

/* ---------- 列表项 ---------- */
.it {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--bd);
  cursor: pointer;
  transition: background 0.15s;
}

.it:hover {
  background: var(--sf-hover);
}

.it .mg {
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  font-weight: 800;
  flex-shrink: 0;
}

.it .mg.g { background: rgba(74, 222, 128, 0.15); color: var(--gn); }
.it .mg.y { background: rgba(250, 204, 21, 0.15); color: var(--yl); }
.it .mg.o { background: rgba(251, 146, 60, 0.15); color: var(--or); }
.it .mg.r {
  background: rgba(239, 68, 68, 0.15);
  color: var(--rd);
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
}

.it .inf {
  flex: 1;
  min-width: 0;
}

.it .pl {
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 0.2rem;
}

.it .mt {
  font-size: 0.75rem;
  color: var(--mt);
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.it .ag {
  font-size: 0.75rem;
  color: var(--mt);
  flex-shrink: 0;
  text-align: right;
}

/* alert 徽章 */
.alert-badge {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid;
}

/* ---------- 加载遮罩 ---------- */
.loader-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

.loader-overlay.active {
  opacity: 1;
  pointer-events: all;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--bd);
  border-top-color: var(--bl);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ---------- 错误状态 ---------- */
.error-box {
  padding: 2rem;
  text-align: center;
  color: var(--rd);
}

/* ---------- 底部 footer ---------- */
.earthquake-app :deep(.ok-footer),
.ok-footer {
  padding: 0.6rem 1rem;
  background: var(--sf);
  border-top: 1px solid var(--bd);
  font-size: 0.7rem;
  color: var(--mt);
  display: flex;
  justify-content: space-between;
  flex-shrink: 0;
  margin-top: 0;
  text-align: left;
}

/* ---------- Leaflet 弹窗样式（动态注入 DOM，需 :deep 穿透） ---------- */
.earthquake-app :deep(.leaflet-popup-content-wrapper) {
  background: var(--sf) !important;
  color: var(--tx) !important;
  border-radius: 8px !important;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5) !important;
}

.earthquake-app :deep(.leaflet-popup-tip) {
  background: var(--sf) !important;
}

.earthquake-app :deep(.leaflet-popup-content) {
  margin: 12px !important;
  font-family: 'Inter', sans-serif;
}

.earthquake-app :deep(.popup-title) {
  font-weight: 800;
  font-size: 1.1rem;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.earthquake-app :deep(.popup-sub) {
  font-size: 0.8rem;
  color: var(--mt);
}

/* ---------- 响应式 ---------- */
@media (max-width: 768px) {
  .app-body {
    flex-direction: column;
  }
  .sidebar {
    width: 100%;
    height: 50vh;
    border-left: none;
    border-top: 1px solid var(--bd);
  }
  .map {
    height: 50vh;
    flex: none;
  }
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
