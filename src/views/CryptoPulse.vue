<script setup>
/* ============================================================
   Crypto Pulse — 加密货币实时行情看板（Vue 3 SFC）
   数据源：CoinGecko 免费 API（支持 CORS，有限速约 10-30 次/分）
   - 市场数据缓存到 localStorage，60 秒过期，避免频繁请求
   - 收藏列表持久化到 localStorage，置顶显示
   - 中英文 i18n，共享 i18n.js / ok.js
   ============================================================ */

import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useT } from '../i18n.js'
import { fetchJSON, lsGet, lsSet, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

// ---------- i18n 文案字典 ----------
const copy = {
  en: {
    eyebrow: 'Live crypto markets',
    title: 'Crypto Pulse',
    lead: 'Track top cryptocurrencies by market cap — real-time prices, 24h/7d changes, favorites, and detailed stats. Powered by CoinGecko.',
    updated: 'Updated',
    refreshing: 'Refreshing…',
    loading: 'Loading markets…',
    error: 'Failed to load market data. CoinGecko free API may be rate-limited — please wait a moment and retry.',
    searchPlaceholder: 'Search by name or symbol…',
    colName: 'Name',
    colPrice: 'Price',
    col24h: '24h %',
    col7d: '7d %',
    colMcap: 'Market Cap',
    colVol: '24h Volume',
    results: 'coins',
    statCoins: 'Coins Tracked',
    statTotalMcap: 'Total Market Cap',
    statGainers: '24h Gainers',
    statLosers: '24h Losers',
    noResults: 'No coins match your search.',
    rank: 'Rank',
    detailMcap: 'Market Cap',
    detailVol24h: '24h Volume',
    detailHigh24h: '24h High',
    detailLow24h: '24h Low',
    detailChange24h: '24h Change',
    detailChange7d: '7d Change',
    detailAth: 'All-Time High',
    detailAthChange: 'ATH Distance',
    detailAtl: 'All-Time Low',
    detailCirculating: 'Circulating Supply',
    detailTotalSupply: 'Total Supply',
    detailSparkline: '7d Price Trend'
  },
  zh: {
    eyebrow: '实时加密货币行情',
    title: 'Crypto Pulse',
    lead: '追踪市值前列的加密货币：实时价格、24h/7d 涨跌、收藏与详细数据。数据由 CoinGecko 提供。',
    updated: '更新于',
    refreshing: '刷新中…',
    loading: '正在加载行情…',
    error: '加载行情数据失败。CoinGecko 免费 API 可能限流，请稍候再试。',
    searchPlaceholder: '按名称或代号搜索…',
    colName: '名称',
    colPrice: '价格',
    col24h: '24h %',
    col7d: '7d %',
    colMcap: '市值',
    colVol: '24h 成交量',
    results: '个币种',
    statCoins: '追踪币种',
    statTotalMcap: '总市值',
    statGainers: '24h 上涨',
    statLosers: '24h 下跌',
    noResults: '没有匹配的币种。',
    rank: '排名',
    detailMcap: '市值',
    detailVol24h: '24h 成交量',
    detailHigh24h: '24h 最高',
    detailLow24h: '24h 最低',
    detailChange24h: '24h 涨跌',
    detailChange7d: '7d 涨跌',
    detailAth: '历史最高',
    detailAthChange: '距历史最高',
    detailAtl: '历史最低',
    detailCirculating: '流通量',
    detailTotalSupply: '总供应量',
    detailSparkline: '7d 价格走势'
  }
}

const t = useT(copy)

// ---------- 常量 ----------
const MARKETS_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=24h,7d'
const CACHE_KEY = 'crypto-pulse-markets'
const FAV_KEY = 'crypto-pulse-favorites'
const SORT_KEY = 'crypto-pulse-sort'
const CACHE_TTL = 60 * 1000           // 60 秒缓存
const REFRESH_INTERVAL = 60 * 1000    // 60 秒自动刷新

// ---------- 状态 ----------
const coins = ref([])                 // 原始币种数组
const favorites = reactive(loadFavorites())
const sortKey = ref('rank')           // 默认按市值排名
const sortDir = ref('asc')
const query = ref('')
const refreshing = ref(false)
const hasError = ref(false)           // 仅在初始无数据时为 true
const updatedAt = ref(null)           // 最近一次更新时间
const showModal = ref(false)
const selectedCoinId = ref(null)

let refreshTimer = null

// ---------- 收藏（localStorage 持久化） ----------
function loadFavorites() {
  const raw = lsGet(FAV_KEY)
  if (!raw) return {}
  try {
    const arr = JSON.parse(raw)
    const obj = {}
    for (const id of arr) obj[id] = true
    return obj
  } catch (e) {
    return {}
  }
}

function saveFavorites() {
  lsSet(FAV_KEY, JSON.stringify(Object.keys(favorites)))
}

function toggleFavorite(id) {
  if (favorites[id]) delete favorites[id]
  else favorites[id] = true
  saveFavorites()
}

function isFav(id) {
  return !!favorites[id]
}

// ---------- 缓存读写（60 秒 TTL） ----------
function readCache() {
  const raw = lsGet(CACHE_KEY)
  if (!raw) return null
  try {
    const obj = JSON.parse(raw)
    if (obj && obj.ts && Date.now() - obj.ts < CACHE_TTL) return obj.data
  } catch (e) {}
  return null
}

function writeCache(data) {
  lsSet(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }))
}

// ---------- 格式化 ----------
function formatPrice(n) {
  if (n == null || isNaN(n)) return '—'
  if (n >= 1) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n >= 0.01) return '$' + n.toFixed(4)
  return '$' + n.toPrecision(4)
}

// 大数字缩写（带 $ 前缀，用于市值/成交量）
function formatCompactUSD(n) {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'
  if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (abs >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K'
  return '$' + n.toFixed(2)
}

// 供应量缩写（无 $ 前缀，附带 symbol）
function formatSupply(n, symbol) {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(n)
  let str
  if (abs >= 1e12) str = (n / 1e12).toFixed(2) + 'T'
  else if (abs >= 1e9) str = (n / 1e9).toFixed(2) + 'B'
  else if (abs >= 1e6) str = (n / 1e6).toFixed(2) + 'M'
  else if (abs >= 1e3) str = (n / 1e3).toFixed(2) + 'K'
  else str = n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return str + (symbol ? ' ' + symbol.toUpperCase() : '')
}

function formatPct(n) {
  if (n == null || isNaN(n)) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

function pctClass(n) {
  if (n == null) return ''
  return n >= 0 ? 'up' : 'down'
}

function pctArrow(n) {
  if (n == null) return ''
  return n >= 0 ? '▲' : '▼'
}

// ---------- 排序取值 ----------
function sortValue(key, c) {
  switch (key) {
    case 'rank': return c.market_cap_rank != null ? c.market_cap_rank : 9999
    case 'price': return c.current_price || 0
    case 'change24h': return c.price_change_percentage_24h != null ? c.price_change_percentage_24h : 0
    case 'change7d': return c.price_change_percentage_7d_in_currency != null ? c.price_change_percentage_7d_in_currency : 0
    case 'mcap': return c.market_cap || 0
    case 'volume': return c.total_volume || 0
    default: return 0
  }
}

// ---------- computed：排序+过滤后的列表（收藏置顶） ----------
const visibleCoins = computed(() => {
  const q = query.value.trim().toLowerCase()
  let list = coins.value
  if (q) {
    list = list.filter((c) =>
      (c.name && c.name.toLowerCase().indexOf(q) !== -1) ||
      (c.symbol && c.symbol.toLowerCase().indexOf(q) !== -1)
    )
  }
  const sorted = list.slice().sort((a, b) => {
    const va = sortValue(sortKey.value, a)
    const vb = sortValue(sortKey.value, b)
    if (va < vb) return -1
    if (va > vb) return 1
    return 0
  })
  if (sortDir.value === 'desc') sorted.reverse()
  // 收藏置顶：收藏组在前，每组内部保持当前排序
  const favs = sorted.filter((c) => favorites[c.id])
  const rest = sorted.filter((c) => !favorites[c.id])
  return favs.concat(rest)
})

// ---------- computed：汇总统计 ----------
const stats = computed(() => {
  const list = coins.value
  if (!list.length) return null
  let totalMcap = 0, gainers = 0, losers = 0
  for (const c of list) {
    totalMcap += c.market_cap || 0
    const ch = c.price_change_percentage_24h
    if (ch != null) { if (ch >= 0) gainers++; else losers++ }
  }
  return { totalMcap, gainers, losers, count: list.length }
})

// ---------- computed：统计单元格 ----------
const statCells = computed(() => {
  const s = stats.value
  if (!s) return []
  return [
    { label: t.value('statCoins'), val: String(s.count), cls: '' },
    { label: t.value('statTotalMcap'), val: formatCompactUSD(s.totalMcap), cls: '' },
    { label: t.value('statGainers'), val: String(s.gainers), cls: 'up' },
    { label: t.value('statLosers'), val: String(s.losers), cls: 'down' }
  ]
})

// ---------- computed：可见币种数 ----------
const visibleCount = computed(() => visibleCoins.value.length)

// ---------- computed：更新时间文本 ----------
const updatedAtText = computed(() => {
  if (!updatedAt.value) return ''
  return t.value('updated') + ': ' + updatedAt.value.toLocaleTimeString(locale())
})

// ---------- 排序操作 ----------
function setSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = (key === 'rank') ? 'asc' : 'desc'
  }
}

// ---------- watch：监听排序变化并持久化偏好 ----------
watch([sortKey, sortDir], () => {
  lsSet(SORT_KEY, JSON.stringify({ key: sortKey.value, dir: sortDir.value }))
})

function loadSortPref() {
  const raw = lsGet(SORT_KEY)
  if (!raw) return
  try {
    const obj = JSON.parse(raw)
    if (obj && obj.key) {
      sortKey.value = obj.key
      sortDir.value = obj.dir || 'asc'
    }
  } catch (e) {}
}

// ---------- 数据加载 ----------
async function fetchMarkets(force) {
  if (refreshing.value) return
  refreshing.value = true

  // 先尝试命中缓存（非强制刷新时）
  const cached = force ? null : readCache()
  if (cached) {
    refreshing.value = false
    coins.value = cached
    updatedAt.value = new Date()
    return
  }

  try {
    const data = await fetchJSON(MARKETS_URL, { timeout: 15000 })
    if (!Array.isArray(data)) throw new Error('Bad response')
    coins.value = data
    writeCache(data)
    hasError.value = false
    updatedAt.value = new Date()
  } catch (err) {
    // 失败时若已有旧数据，保留旧数据继续展示，仅在没有数据时提示错误
    if (coins.value.length === 0) hasError.value = true
  } finally {
    refreshing.value = false
  }
}

// ---------- 详情弹窗 ----------
const selectedCoin = computed(() => {
  if (!selectedCoinId.value) return null
  return coins.value.find((c) => c.id === selectedCoinId.value) || null
})

function openDetail(id) {
  selectedCoinId.value = id
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  selectedCoinId.value = null
}

function onBackdropClick(e) {
  if (e.target === e.currentTarget) closeModal()
}

// ---------- computed：弹窗详情单元格 ----------
const detailCells = computed(() => {
  const c = selectedCoin.value
  if (!c) return []
  const ch24 = c.price_change_percentage_24h
  const ch7 = c.price_change_percentage_7d_in_currency
  return [
    { label: t.value('detailMcap'), val: formatCompactUSD(c.market_cap), cls: '' },
    { label: t.value('detailVol24h'), val: formatCompactUSD(c.total_volume), cls: '' },
    { label: t.value('detailChange24h'), val: formatPct(ch24), cls: pctClass(ch24) },
    { label: t.value('detailChange7d'), val: formatPct(ch7), cls: pctClass(ch7) },
    { label: t.value('detailHigh24h'), val: formatPrice(c.high_24h), cls: '' },
    { label: t.value('detailLow24h'), val: formatPrice(c.low_24h), cls: '' },
    { label: t.value('detailAth'), val: formatPrice(c.ath), cls: '' },
    { label: t.value('detailAtl'), val: formatPrice(c.atl), cls: '' },
    { label: t.value('detailAthChange'), val: formatPct(c.ath_change_percentage), cls: pctClass(c.ath_change_percentage) },
    { label: t.value('detailCirculating'), val: formatSupply(c.circulating_supply, c.symbol), cls: '' },
    { label: t.value('detailTotalSupply'), val: formatSupply(c.total_supply, c.symbol), cls: '' }
  ]
})

// ---------- computed：7d 价格走势 sparkline ----------
const sparkData = computed(() => {
  const c = selectedCoin.value
  if (!c) return null
  const prices = c.sparkline_in_currency && c.sparkline_in_currency.price
  if (!prices || prices.length < 2) return null
  const w = 560, h = 64
  let min = Infinity, max = -Infinity
  for (const p of prices) {
    if (p < min) min = p
    if (p > max) max = p
  }
  const range = max - min || 1
  const step = w / (prices.length - 1)
  const pts = []
  for (let j = 0; j < prices.length; j++) {
    const x = (j * step).toFixed(2)
    const y = (h - ((prices[j] - min) / range) * (h - 4) - 2).toFixed(2)
    pts.push(x + ',' + y)
  }
  const change = c.price_change_percentage_7d_in_currency
  const color = (change != null && change >= 0) ? '#22c55e' : '#ef4444'
  return { points: pts.join(' '), color, w, h }
})

// ---------- watch：弹窗打开时锁定背景滚动 ----------
watch(showModal, (val) => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = val ? 'hidden' : ''
  }
})

// ---------- 键盘：Esc 关闭弹窗 ----------
function onKeydown(e) {
  if (e.key === 'Escape' && showModal.value) closeModal()
}

// ---------- 可见性变化：回到页面立即刷新 ----------
function onVisibilityChange() {
  if (!document.hidden) fetchMarkets(true)
}

// ---------- 生命周期 ----------
onMounted(() => {
  loadSortPref()
  fetchMarkets(false)
  // 每 60 秒自动刷新
  refreshTimer = setInterval(() => fetchMarkets(true), REFRESH_INTERVAL)
  // 页面隐藏时暂停轮询，可见时立即刷新（避免后台浪费配额）
  document.addEventListener('visibilitychange', onVisibilityChange)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  document.removeEventListener('keydown', onKeydown)
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
</script>

<template>
  <div class="crypto-pulse-app">
    <AppHeader :show-lang-toggle="true" />

    <main class="shell">
      <header class="masthead">
        <div class="masthead-left">
          <p class="eyebrow">{{ t('eyebrow') }}</p>
          <h1>{{ t('title') }}</h1>
          <p class="lead">{{ t('lead') }}</p>
        </div>
        <div class="header-right">
          <span class="update-time">{{ updatedAtText }}</span>
          <button
            class="ok-btn-ghost refresh-btn"
            :class="{ spinning: refreshing }"
            type="button"
            aria-label="Refresh"
            title="Refresh"
            @click="fetchMarkets(true)"
          >↻</button>
        </div>
      </header>

      <!-- 汇总统计 -->
      <section class="stats" aria-live="polite">
        <div
          v-for="(s, i) in statCells"
          :key="i"
          class="stat"
          :class="s.cls"
        >
          <div class="s-label">{{ s.label }}</div>
          <div class="s-val">{{ s.val }}</div>
        </div>
      </section>

      <!-- 搜索栏 -->
      <section class="controls">
        <div class="search-wrap">
          <span class="search-icon" aria-hidden="true">⌕</span>
          <input
            v-model="query"
            class="search-input"
            type="search"
            autocomplete="off"
            :placeholder="t('searchPlaceholder')"
            aria-label="Search coins"
          />
        </div>
        <span v-if="coins.length > 0" class="count-info">
          {{ visibleCount }} {{ t('results') }}
        </span>
      </section>

      <!-- 行情表格 -->
      <section class="table-wrap">
        <div class="thead" role="row">
          <span class="th th-star" aria-hidden="true"></span>
          <span
            class="th th-rank sortable"
            :class="{ sorted: sortKey === 'rank', asc: sortKey === 'rank' && sortDir === 'asc', desc: sortKey === 'rank' && sortDir === 'desc' }"
            role="columnheader"
            tabindex="0"
            @click="setSort('rank')"
            @keydown.enter.prevent="setSort('rank')"
            @keydown.space.prevent="setSort('rank')"
          >#</span>
          <span class="th th-name" role="columnheader">{{ t('colName') }}</span>
          <span
            class="th th-price sortable"
            :class="{ sorted: sortKey === 'price', asc: sortKey === 'price' && sortDir === 'asc', desc: sortKey === 'price' && sortDir === 'desc' }"
            role="columnheader"
            tabindex="0"
            @click="setSort('price')"
            @keydown.enter.prevent="setSort('price')"
            @keydown.space.prevent="setSort('price')"
          >{{ t('colPrice') }}</span>
          <span
            class="th th-24h sortable"
            :class="{ sorted: sortKey === 'change24h', asc: sortKey === 'change24h' && sortDir === 'asc', desc: sortKey === 'change24h' && sortDir === 'desc' }"
            role="columnheader"
            tabindex="0"
            @click="setSort('change24h')"
            @keydown.enter.prevent="setSort('change24h')"
            @keydown.space.prevent="setSort('change24h')"
          >{{ t('col24h') }}</span>
          <span
            class="th th-7d sortable"
            :class="{ sorted: sortKey === 'change7d', asc: sortKey === 'change7d' && sortDir === 'asc', desc: sortKey === 'change7d' && sortDir === 'desc' }"
            role="columnheader"
            tabindex="0"
            @click="setSort('change7d')"
            @keydown.enter.prevent="setSort('change7d')"
            @keydown.space.prevent="setSort('change7d')"
          >{{ t('col7d') }}</span>
          <span
            class="th th-mcap sortable"
            :class="{ sorted: sortKey === 'mcap', asc: sortKey === 'mcap' && sortDir === 'asc', desc: sortKey === 'mcap' && sortDir === 'desc' }"
            role="columnheader"
            tabindex="0"
            @click="setSort('mcap')"
            @keydown.enter.prevent="setSort('mcap')"
            @keydown.space.prevent="setSort('mcap')"
          >{{ t('colMcap') }}</span>
          <span
            class="th th-vol sortable"
            :class="{ sorted: sortKey === 'volume', asc: sortKey === 'volume' && sortDir === 'asc', desc: sortKey === 'volume' && sortDir === 'desc' }"
            role="columnheader"
            tabindex="0"
            @click="setSort('volume')"
            @keydown.enter.prevent="setSort('volume')"
            @keydown.space.prevent="setSort('volume')"
          >{{ t('colVol') }}</span>
        </div>

        <div class="tbody" aria-live="polite">
          <!-- 初始加载中 -->
          <div v-if="coins.length === 0 && !hasError" class="state">
            <span class="spinner"></span>
            <span>{{ t('loading') }}</span>
          </div>

          <!-- 加载失败（无数据） -->
          <div v-else-if="coins.length === 0 && hasError" class="error-box">
            {{ t('error') }}
          </div>

          <!-- 无匹配结果 -->
          <div v-else-if="visibleCoins.length === 0" class="state">
            {{ t('noResults') }}
          </div>

          <!-- 币种列表 -->
          <template v-else>
            <div
              v-for="c in visibleCoins"
              :key="c.id"
              class="trow"
              :class="{ 'is-fav': isFav(c.id) }"
              role="row"
              tabindex="0"
              @click="openDetail(c.id)"
              @keydown.enter.prevent="openDetail(c.id)"
              @keydown.space.prevent="openDetail(c.id)"
            >
              <span class="tcell">
                <button
                  class="star-btn"
                  :class="{ on: isFav(c.id) }"
                  type="button"
                  aria-label="Favorite"
                  tabindex="-1"
                  @click.stop="toggleFavorite(c.id)"
                >{{ isFav(c.id) ? '★' : '☆' }}</button>
              </span>
              <span class="tcell tc-rank num">
                {{ c.market_cap_rank != null ? c.market_cap_rank : '—' }}
              </span>
              <span class="tcell">
                <span class="coin-id">
                  <img class="coin-icon" :src="c.image" alt="" loading="lazy" />
                  <span class="coin-meta">
                    <span class="coin-name">{{ c.name }}</span>
                    <span class="coin-symbol">{{ c.symbol }}</span>
                  </span>
                </span>
              </span>
              <span class="tcell tc-price"><span class="num">{{ formatPrice(c.current_price) }}</span></span>
              <span class="tcell tc-24h">
                <span class="pct" :class="pctClass(c.price_change_percentage_24h)">
                  {{ formatPct(c.price_change_percentage_24h) }}
                </span>
              </span>
              <span class="tcell tc-7d">
                <span class="pct" :class="pctClass(c.price_change_percentage_7d_in_currency)">
                  {{ formatPct(c.price_change_percentage_7d_in_currency) }}
                </span>
              </span>
              <span class="tcell tc-mcap"><span class="num">{{ formatCompactUSD(c.market_cap) }}</span></span>
              <span class="tcell tc-vol"><span class="num">{{ formatCompactUSD(c.total_volume) }}</span></span>
            </div>
          </template>
        </div>
      </section>
    </main>

    <!-- 详情弹窗 -->
    <div
      v-if="showModal && selectedCoin"
      class="modal-backdrop"
      @click="onBackdropClick"
    >
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <button class="modal-close" type="button" aria-label="Close" @click="closeModal">×</button>

        <!-- 弹窗头部 -->
        <div class="detail-head">
          <img class="detail-icon" :src="selectedCoin.image" alt="" />
          <div class="detail-title">
            <div>
              <span id="modalTitle" class="detail-name">{{ selectedCoin.name }}</span>
              <span class="detail-symbol">{{ selectedCoin.symbol }}</span>
            </div>
            <div class="detail-rank">
              {{ t('rank') }} #{{ selectedCoin.market_cap_rank != null ? selectedCoin.market_cap_rank : '—' }}
            </div>
          </div>
          <div class="detail-price-block">
            <div class="detail-price num">{{ formatPrice(selectedCoin.current_price) }}</div>
            <div class="detail-change" :class="pctClass(selectedCoin.price_change_percentage_24h)">
              {{ pctArrow(selectedCoin.price_change_percentage_24h) }} {{ formatPct(selectedCoin.price_change_percentage_24h) }}
            </div>
          </div>
        </div>

        <!-- 详情网格 -->
        <div class="detail-grid">
          <div
            v-for="(cell, i) in detailCells"
            :key="i"
            class="dcell"
          >
            <span class="dc-label">{{ cell.label }}</span>
            <span class="dc-val" :class="cell.cls">{{ cell.val }}</span>
          </div>
        </div>

        <!-- 7d 价格走势 sparkline -->
        <div v-if="sparkData" class="detail-spark-wrap">
          <div class="detail-spark-label">{{ t('detailSparkline') }}</div>
          <svg
            class="spark"
            :viewBox="`0 0 ${sparkData.w} ${sparkData.h}`"
            preserveAspectRatio="none"
          >
            <polyline
              :points="sparkData.points"
              fill="none"
              :stroke="sparkData.color"
              stroke-width="1.6"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          </svg>
        </div>
      </div>
    </div>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Crypto Pulse — 深色加密货币主题
   accent 用加密风格青绿色 (#14b8a6)，数字用 IBM Plex Mono。
   原 :root 变量映射到组件根类 .crypto-pulse-app 上，
   --ok-* 令牌在此覆盖，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.crypto-pulse-app {
  /* 表面与文字 */
  --bg: #0a0f1a;
  --panel: #0f1626;
  --panel-2: #131c30;
  --line: rgba(255, 255, 255, 0.07);
  --line-strong: rgba(255, 255, 255, 0.14);
  --text: #e6edf6;
  --muted: #7d8aa3;
  --muted-2: #5a6778;

  /* 强调色：青绿色 */
  --accent: #14b8a6;
  --accent-2: #06b6d4;
  --accent-soft: rgba(20, 184, 166, 0.12);
  --glow: rgba(20, 184, 166, 0.28);

  /* 涨跌语义色 */
  --up: #22c55e;
  --up-bg: rgba(34, 197, 94, 0.12);
  --down: #ef4444;
  --down-bg: rgba(239, 68, 68, 0.12);

  /* 收藏星标 */
  --star: #facc15;

  /* 映射共享 token（供 AppHeader / AppFooter / ok-* 类继承） */
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
  --ok-font: "Outfit", system-ui, sans-serif;
  --ok-mono: "IBM Plex Mono", "SFMono-Regular", Menlo, monospace;
  --ok-radius: 12px;
  --ok-radius-sm: 6px;

  color-scheme: dark;

  /* 整页背景：青绿辉光层（原 body 背景迁移到根元素） */
  min-height: 100vh;
  color: var(--text);
  background: var(--bg);
  background-image:
    radial-gradient(circle at 12% 0%, rgba(20, 184, 166, 0.10), transparent 40%),
    radial-gradient(circle at 88% 8%, rgba(6, 182, 212, 0.08), transparent 42%);
  background-attachment: fixed;
  font-family: var(--ok-font);
  -webkit-font-smoothing: antialiased;
}

.crypto-pulse-app a { color: var(--accent); text-decoration: none; }

/* ---------- 主容器 ---------- */
.shell {
  width: min(1180px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

/* ---------- 页头 ---------- */
.masthead {
  display: flex;
  justify-content: space-between;
  align-items: end;
  padding: 0.4rem 0 1.2rem;
  border-bottom: 1px solid var(--line);
  gap: 1rem;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
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
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.6;
  max-width: 56ch;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.update-time {
  font-size: 0.72rem;
  color: var(--muted);
  font-family: var(--ok-mono);
}

.refresh-btn {
  font-size: 1rem;
  line-height: 1;
  padding: 0 0.6rem;
}

.refresh-btn.spinning {
  pointer-events: none;
  color: var(--accent);
  animation: ok-spin 0.8s linear infinite;
}

/* ---------- 汇总统计 ---------- */
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
  margin-top: 1.2rem;
  border-radius: var(--ok-radius);
  overflow: hidden;
}

.stat {
  background: var(--panel);
  padding: 1rem 1.1rem;
}

.stat .s-label {
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-weight: 600;
}

.stat .s-val {
  font-family: var(--ok-mono);
  font-size: 1.35rem;
  font-weight: 600;
  margin-top: 0.25rem;
  letter-spacing: -0.02em;
}

.stat .s-sub {
  font-size: 0.72rem;
  color: var(--muted-2);
  margin-top: 0.15rem;
}

.stat.up .s-val { color: var(--up); }
.stat.down .s-val { color: var(--down); }

/* ---------- 搜索栏 ---------- */
.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1.3rem;
  flex-wrap: wrap;
}

.search-wrap {
  position: relative;
  flex: 1;
  min-width: 220px;
  max-width: 420px;
}

.search-icon {
  position: absolute;
  left: 0.8rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
  font-size: 1rem;
  pointer-events: none;
}

.search-input {
  font: inherit;
  width: 100%;
  height: 2.5rem;
  padding: 0 0.9rem 0 2.2rem;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--text);
  font-size: 0.9rem;
  border-radius: var(--ok-radius-sm);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.search-input::placeholder { color: var(--muted-2); }

.search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.count-info {
  font-size: 0.78rem;
  color: var(--muted);
  font-family: var(--ok-mono);
}

/* ---------- 表格 ---------- */
.table-wrap {
  margin-top: 1rem;
  border: 1px solid var(--line);
  border-radius: var(--ok-radius);
  overflow: hidden;
  background: var(--panel);
}

.thead,
.trow {
  display: grid;
  grid-template-columns: 36px 44px minmax(180px, 2fr) 1.1fr 0.9fr 0.9fr 1.1fr 1.1fr;
  align-items: center;
  gap: 0.5rem;
}

.thead {
  padding: 0.7rem 1rem;
  background: var(--panel-2);
  border-bottom: 1px solid var(--line);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-weight: 600;
}

.th { display: flex; align-items: center; gap: 0.2rem; }
.th-rank { justify-content: center; }
.th-price, .th-24h, .th-7d, .th-mcap, .th-vol { justify-content: flex-end; text-align: right; }

.th.sortable {
  cursor: pointer;
  user-select: none;
  transition: color 0.15s;
}

.th.sortable:hover { color: var(--accent); }
.th.sortable.sorted { color: var(--accent); }

.th.sortable::after {
  content: "";
  display: inline-block;
  width: 0.6rem;
  font-size: 0.7rem;
  color: inherit;
  opacity: 0.7;
}

.th.sortable.sorted.asc::after { content: "▲"; }
.th.sortable.sorted.desc::after { content: "▼"; }

.tbody { display: flex; flex-direction: column; }

.trow {
  padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--line);
  font-size: 0.86rem;
  cursor: pointer;
  transition: background 0.13s;
}

.trow:last-child { border-bottom: none; }
.trow:hover { background: var(--panel-2); }
.trow.is-fav { background: rgba(250, 204, 21, 0.04); }
.trow.is-fav:hover { background: rgba(250, 204, 21, 0.08); }

.tcell { display: flex; align-items: center; min-width: 0; }
.tc-rank { justify-content: center; color: var(--muted); font-family: var(--ok-mono); font-size: 0.8rem; }
.tc-price, .tc-24h, .tc-7d, .tc-mcap, .tc-vol { justify-content: flex-end; text-align: right; }

/* 星标按钮 */
.star-btn {
  background: none;
  border: none;
  color: var(--muted-2);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0.2rem;
  transition: color 0.15s, transform 0.1s;
}

.star-btn:hover { color: var(--star); transform: scale(1.15); }
.star-btn.on { color: var(--star); }
.star-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

/* 币种信息 */
.coin-id { display: flex; align-items: center; gap: 0.6rem; min-width: 0; }
.coin-icon { width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0; background: var(--panel-2); }
.coin-meta { display: flex; flex-direction: column; min-width: 0; }
.coin-name {
  font-weight: 600;
  font-size: 0.86rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.coin-symbol {
  font-family: var(--ok-mono);
  font-size: 0.72rem;
  color: var(--muted);
  text-transform: uppercase;
}

/* 数字单元格 */
.num { font-family: var(--ok-mono); font-variant-numeric: tabular-nums; }
.tc-price .num { font-weight: 600; font-size: 0.88rem; }

.pct { font-family: var(--ok-mono); font-weight: 600; font-size: 0.84rem; font-variant-numeric: tabular-nums; }
.pct.up { color: var(--up); }
.pct.down { color: var(--down); }

.tc-mcap .num, .tc-vol .num { color: var(--muted); font-size: 0.82rem; }

/* ---------- 状态 ---------- */
.state {
  padding: 2.5rem 1rem;
  text-align: center;
  color: var(--muted);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
}

.spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--line-strong);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: ok-spin 0.6s linear infinite;
}

.error-box {
  margin: 1.2rem 0 0;
  color: var(--down);
  background: var(--down-bg);
  border: 1px solid rgba(239, 68, 68, 0.25);
  padding: 0.85rem 1rem;
  border-radius: var(--ok-radius-sm);
  font-size: 0.85rem;
}

/* ---------- 详情弹窗 ---------- */
/* Vue 中用 v-if 控制渲染，天然避免原 display:flex 覆盖 hidden 的 bug */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(5, 8, 16, 0.72);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  animation: fade-in 0.15s ease;
}

@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

.modal {
  position: relative;
  width: min(640px, 100%);
  max-height: 88vh;
  overflow-y: auto;
  background: var(--panel);
  border: 1px solid var(--line-strong);
  border-radius: var(--ok-radius);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  padding: 1.6rem;
  animation: pop-in 0.18s ease;
}

@keyframes pop-in {
  from { transform: translateY(8px) scale(0.98); opacity: 0; }
  to { transform: none; opacity: 1; }
}

.modal::-webkit-scrollbar { width: 8px; }
.modal::-webkit-scrollbar-track { background: transparent; }
.modal::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 8px; }

.modal-close {
  position: absolute;
  top: 0.8rem;
  right: 0.8rem;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--line);
  background: var(--panel-2);
  color: var(--muted);
  font-size: 1.2rem;
  line-height: 1;
  border-radius: 50%;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.modal-close:hover { color: var(--text); border-color: var(--accent); }

.detail-head {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-right: 2rem;
  padding-bottom: 1.1rem;
  border-bottom: 1px solid var(--line);
}

.detail-icon { width: 48px; height: 48px; border-radius: 50%; background: var(--panel-2); }
.detail-title { flex: 1; min-width: 0; }
.detail-name { font-size: 1.3rem; font-weight: 700; letter-spacing: -0.02em; }
.detail-symbol { font-family: var(--ok-mono); font-size: 0.85rem; color: var(--muted); text-transform: uppercase; margin-left: 0.4rem; }
.detail-rank { font-size: 0.74rem; color: var(--muted); margin-top: 0.2rem; }

.detail-price-block { text-align: right; }
.detail-price { font-family: var(--ok-mono); font-size: 1.6rem; font-weight: 600; letter-spacing: -0.02em; }
.detail-change { font-family: var(--ok-mono); font-size: 0.85rem; font-weight: 600; margin-top: 0.2rem; }
.detail-change.up { color: var(--up); }
.detail-change.down { color: var(--down); }

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  background: var(--line);
  margin-top: 1.1rem;
  border: 1px solid var(--line);
  border-radius: var(--ok-radius-sm);
  overflow: hidden;
}

.dcell {
  background: var(--panel);
  padding: 0.75rem 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.dcell .dc-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.dcell .dc-val { font-family: var(--ok-mono); font-size: 0.92rem; font-weight: 500; font-variant-numeric: tabular-nums; }
.dcell .dc-val.up { color: var(--up); }
.dcell .dc-val.down { color: var(--down); }
.dcell .dc-val.muted { color: var(--muted); }

.detail-spark-wrap {
  margin-top: 1.2rem;
  padding: 1rem 0.95rem 0.6rem;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: var(--ok-radius-sm);
}

.detail-spark-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: 0.5rem;
}

.spark { width: 100%; height: 64px; display: block; }

/* ---------- 响应式 ---------- */
@media (max-width: 860px) {
  .stats { grid-template-columns: repeat(2, 1fr); }
  .thead, .trow {
    grid-template-columns: 32px 38px minmax(140px, 2fr) 1fr 0.8fr 1fr;
  }
  .th-7d, .tc-7d { display: none; }
}

@media (max-width: 600px) {
  .masthead { flex-direction: column; align-items: start; gap: 0.7rem; }
  .stats { grid-template-columns: 1fr 1fr; }
  .stat .s-val { font-size: 1.1rem; }
  .thead, .trow {
    grid-template-columns: 30px 34px minmax(120px, 2fr) 1fr 1fr;
  }
  .th-vol, .tc-vol { display: none; }
  .controls { flex-direction: column; align-items: stretch; }
  .count-info { text-align: right; }
  .detail-head { flex-direction: column; align-items: start; text-align: left; }
  .detail-price-block { text-align: left; }
  .detail-grid { grid-template-columns: 1fr; }
}
</style>
