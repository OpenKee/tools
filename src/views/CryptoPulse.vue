<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { RefreshCw, Search } from '@lucide/vue'
import { useT } from '../i18n.js'
import { lsGet, lsSet, locale, cryptoMarkets } from '../ok.js'
import {
  UiDialog,
  UiEmptyState,
  UiErrorState,
  UiIconButton,
  UiInput,
  UiLoading,
  UiStat,
} from '../components/ui/index.js'
import copy from '../copy/crypto-pulse.js'

const t = useT(copy)

const CACHE_KEY = 'crypto-pulse-markets'
const FAV_KEY = 'crypto-pulse-favorites'
const SORT_KEY = 'crypto-pulse-sort'
const CACHE_TTL = 60 * 1000
const REFRESH_INTERVAL = 60 * 1000

const coins = ref([])
const favorites = reactive(loadFavorites())
const sortKey = ref('rank')
const sortDir = ref('asc')
const query = ref('')
const refreshing = ref(false)
const hasError = ref(false)
const refreshFailed = ref(false)
const updatedAt = ref(null)
const showModal = ref(false)
const selectedCoinId = ref(null)

let refreshTimer = null

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

function readCache() {
  const raw = lsGet(CACHE_KEY)
  if (!raw) return null
  try {
    const obj = JSON.parse(raw)
    if (
      Array.isArray(obj?.data) &&
      Number.isFinite(obj.ts) &&
      Date.now() - obj.ts >= 0 &&
      Date.now() - obj.ts < CACHE_TTL
    ) {
      return { data: obj.data, fetchedAt: obj.ts }
    }
  } catch (e) {}
  return null
}

function writeCache(data, fetchedAt) {
  lsSet(CACHE_KEY, JSON.stringify({ ts: fetchedAt, data: data }))
}

function formatPrice(n) {
  if (n == null || isNaN(n)) return '—'
  if (n >= 1) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n >= 0.01) return '$' + n.toFixed(4)
  return '$' + n.toPrecision(4)
}

function formatCompactUSD(n) {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'
  if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (abs >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K'
  return '$' + n.toFixed(2)
}

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

function sortValue(key, c) {
  switch (key) {
    case 'rank':
      return c.market_cap_rank != null ? c.market_cap_rank : 9999
    case 'price':
      return c.current_price || 0
    case 'change24h':
      return c.price_change_percentage_24h != null ? c.price_change_percentage_24h : 0
    case 'change7d':
      return c.price_change_percentage_7d_in_currency != null ? c.price_change_percentage_7d_in_currency : 0
    case 'mcap':
      return c.market_cap || 0
    case 'volume':
      return c.total_volume || 0
    default:
      return 0
  }
}

const visibleCoins = computed(() => {
  const q = query.value.trim().toLowerCase()
  let list = coins.value
  if (q) {
    list = list.filter(
      (c) =>
        (c.name && c.name.toLowerCase().indexOf(q) !== -1) || (c.symbol && c.symbol.toLowerCase().indexOf(q) !== -1),
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

  const favs = sorted.filter((c) => favorites[c.id])
  const rest = sorted.filter((c) => !favorites[c.id])
  return favs.concat(rest)
})

const stats = computed(() => {
  const list = coins.value
  if (!list.length) return null
  let totalMcap = 0,
    hasMcap = false,
    gainers = 0,
    losers = 0
  for (const c of list) {
    if (typeof c.market_cap === 'number') {
      totalMcap += c.market_cap
      hasMcap = true
    }
    const ch = c.price_change_percentage_24h
    if (ch != null) {
      if (ch >= 0) gainers++
      else losers++
    }
  }
  return { totalMcap, hasMcap, gainers, losers, count: list.length }
})

const statCells = computed(() => {
  const s = stats.value
  if (!s) return []
  return [
    { label: t.value('statCoins'), val: String(s.count), tone: 'neutral' },
    { label: t.value('statTotalMcap'), val: s.hasMcap ? formatCompactUSD(s.totalMcap) : '—', tone: 'neutral' },
    { label: t.value('statGainers'), val: String(s.gainers), tone: 'up' },
    { label: t.value('statLosers'), val: String(s.losers), tone: 'down' },
  ]
})

const visibleCount = computed(() => visibleCoins.value.length)

const updatedAtText = computed(() => {
  if (!updatedAt.value) return ''
  return t.value('updated') + ': ' + updatedAt.value.toLocaleTimeString(locale())
})

function setSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'rank' ? 'asc' : 'desc'
  }
}

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

async function fetchMarkets(force) {
  if (refreshing.value) return
  refreshing.value = true

  const cached = force === true ? null : readCache()
  if (cached) {
    refreshing.value = false
    coins.value = cached.data
    updatedAt.value = new Date(cached.fetchedAt)
    hasError.value = false
    refreshFailed.value = false
    return
  }

  try {
    const data = await cryptoMarkets({ perPage: 50, sparkline: true })
    if (!Array.isArray(data)) throw new Error('Bad response')
    const fetchedAt = Date.now()
    coins.value = data
    writeCache(data, fetchedAt)
    hasError.value = false
    refreshFailed.value = false
    updatedAt.value = new Date(fetchedAt)
  } catch (err) {
    refreshFailed.value = coins.value.length > 0
    if (coins.value.length === 0) hasError.value = true
  } finally {
    refreshing.value = false
  }
}

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

const detailSub = computed(() => {
  const c = selectedCoin.value
  if (!c) return ''
  const rank = c.market_cap_rank != null ? c.market_cap_rank : '—'
  return `${(c.symbol || '').toUpperCase()} · ${t.value('rank')} #${rank}`
})

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
    {
      label: t.value('detailAthChange'),
      val: formatPct(c.ath_change_percentage),
      cls: pctClass(c.ath_change_percentage),
    },
    { label: t.value('detailCirculating'), val: formatSupply(c.circulating_supply, c.symbol), cls: '' },
    { label: t.value('detailTotalSupply'), val: formatSupply(c.total_supply, c.symbol), cls: '' },
  ]
})

const sparkData = computed(() => {
  const c = selectedCoin.value
  if (!c) return null
  const prices = c.sparkline_in_7d && c.sparkline_in_7d.price
  if (!prices || prices.length < 2) return null
  const w = 560,
    h = 64
  let min = Infinity,
    max = -Infinity
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
  const color = change != null && change >= 0 ? '#22c55e' : '#ef4444'
  return { points: pts.join(' '), color, w, h }
})

function onVisibilityChange() {
  if (!document.hidden) fetchMarkets(true)
}

onMounted(() => {
  loadSortPref()
  fetchMarkets(false)

  refreshTimer = setInterval(() => {
    if (!document.hidden) fetchMarkets(true)
  }, REFRESH_INTERVAL)

  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <div class="crypto-pulse-app">
    <section class="stats" aria-live="polite">
      <UiStat v-for="s in statCells" :key="s.label" :label="s.label" :value="s.val" :tone="s.tone" />
    </section>

    <section class="controls">
      <UiInput
        v-model="query"
        class="search-input"
        type="search"
        :placeholder="t('searchPlaceholder')"
        aria-label="Search coins"
        clearable
      >
        <template #prefix>
          <span class="search-icon" aria-hidden="true"><Search :size="14" /></span>
        </template>
      </UiInput>
      <div class="controls-meta">
        <span v-if="coins.length > 0" class="count-info">{{ visibleCount }} {{ t('results') }}</span>
        <span class="update-time">{{ updatedAtText }}</span>
        <UiIconButton
          class="refresh-btn"
          :class="{ spinning: refreshing }"
          variant="ghost"
          size="sm"
          :label="t('refresh')"
          :disabled="refreshing"
          @click="fetchMarkets(true)"
        >
          <RefreshCw :size="14" aria-hidden="true" />
        </UiIconButton>
      </div>
    </section>

    <p v-if="coins.length > 0 && refreshFailed" class="stale-warning" role="status">
      {{ t('stale') }}
    </p>

    <section class="table-wrap">
      <div class="thead" role="row">
        <span class="th th-star" aria-hidden="true"></span>
        <span
          class="th th-rank sortable"
          :class="{
            sorted: sortKey === 'rank',
            asc: sortKey === 'rank' && sortDir === 'asc',
            desc: sortKey === 'rank' && sortDir === 'desc',
          }"
          role="columnheader"
          tabindex="0"
          @click="setSort('rank')"
          @keydown.enter.prevent="setSort('rank')"
          @keydown.space.prevent="setSort('rank')"
          >#</span
        >
        <span class="th th-name" role="columnheader">{{ t('colName') }}</span>
        <span
          class="th th-price sortable"
          :class="{
            sorted: sortKey === 'price',
            asc: sortKey === 'price' && sortDir === 'asc',
            desc: sortKey === 'price' && sortDir === 'desc',
          }"
          role="columnheader"
          tabindex="0"
          @click="setSort('price')"
          @keydown.enter.prevent="setSort('price')"
          @keydown.space.prevent="setSort('price')"
          >{{ t('colPrice') }}</span
        >
        <span
          class="th th-24h sortable"
          :class="{
            sorted: sortKey === 'change24h',
            asc: sortKey === 'change24h' && sortDir === 'asc',
            desc: sortKey === 'change24h' && sortDir === 'desc',
          }"
          role="columnheader"
          tabindex="0"
          @click="setSort('change24h')"
          @keydown.enter.prevent="setSort('change24h')"
          @keydown.space.prevent="setSort('change24h')"
          >{{ t('col24h') }}</span
        >
        <span
          class="th th-7d sortable"
          :class="{
            sorted: sortKey === 'change7d',
            asc: sortKey === 'change7d' && sortDir === 'asc',
            desc: sortKey === 'change7d' && sortDir === 'desc',
          }"
          role="columnheader"
          tabindex="0"
          @click="setSort('change7d')"
          @keydown.enter.prevent="setSort('change7d')"
          @keydown.space.prevent="setSort('change7d')"
          >{{ t('col7d') }}</span
        >
        <span
          class="th th-mcap sortable"
          :class="{
            sorted: sortKey === 'mcap',
            asc: sortKey === 'mcap' && sortDir === 'asc',
            desc: sortKey === 'mcap' && sortDir === 'desc',
          }"
          role="columnheader"
          tabindex="0"
          @click="setSort('mcap')"
          @keydown.enter.prevent="setSort('mcap')"
          @keydown.space.prevent="setSort('mcap')"
          >{{ t('colMcap') }}</span
        >
        <span
          class="th th-vol sortable"
          :class="{
            sorted: sortKey === 'volume',
            asc: sortKey === 'volume' && sortDir === 'asc',
            desc: sortKey === 'volume' && sortDir === 'desc',
          }"
          role="columnheader"
          tabindex="0"
          @click="setSort('volume')"
          @keydown.enter.prevent="setSort('volume')"
          @keydown.space.prevent="setSort('volume')"
          >{{ t('colVol') }}</span
        >
      </div>

      <div class="tbody" aria-live="polite">
        <UiLoading v-if="coins.length === 0 && !hasError" :label="t('loading')" />

        <UiErrorState
          v-else-if="coins.length === 0 && hasError"
          class="table-error"
          variant="block"
          :message="t('error')"
          retry-label=""
        />

        <UiEmptyState v-else-if="visibleCoins.length === 0" class="table-empty" :title="t('noResults')" compact />

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
              <UiIconButton
                class="star-btn"
                :class="{ on: isFav(c.id) }"
                size="sm"
                label="Favorite"
                toggle
                :active="isFav(c.id)"
                @keydown.enter.stop
                @keydown.space.stop
                @click.stop="toggleFavorite(c.id)"
              >
                {{ isFav(c.id) ? '★' : '☆' }}
              </UiIconButton>
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
            <span class="tcell tc-price"
              ><span class="num">{{ formatPrice(c.current_price) }}</span></span
            >
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
            <span class="tcell tc-mcap"
              ><span class="num">{{ formatCompactUSD(c.market_cap) }}</span></span
            >
            <span class="tcell tc-vol"
              ><span class="num">{{ formatCompactUSD(c.total_volume) }}</span></span
            >
          </div>
        </template>
      </div>
    </section>

    <UiDialog
      :open="showModal"
      :title="selectedCoin ? selectedCoin.name : ''"
      :description="detailSub"
      width="640px"
      close-label="Close"
      @update:open="(open) => !open && closeModal()"
    >
      <div v-if="selectedCoin" class="detail-body">
        <div class="detail-head">
          <img class="detail-icon" :src="selectedCoin.image" alt="" />
          <div class="detail-price-block">
            <div class="detail-price num">{{ formatPrice(selectedCoin.current_price) }}</div>
            <div class="detail-change" :class="pctClass(selectedCoin.price_change_percentage_24h)">
              {{ pctArrow(selectedCoin.price_change_percentage_24h) }}
              {{ formatPct(selectedCoin.price_change_percentage_24h) }}
            </div>
          </div>
        </div>

        <div class="detail-grid">
          <div v-for="(cell, i) in detailCells" :key="i" class="dcell">
            <span class="dc-label">{{ cell.label }}</span>
            <span class="dc-val" :class="cell.cls">{{ cell.val }}</span>
          </div>
        </div>

        <div v-if="sparkData" class="detail-spark-wrap">
          <div class="detail-spark-label">{{ t('detailSparkline') }}</div>
          <svg class="spark" :viewBox="`0 0 ${sparkData.w} ${sparkData.h}`" preserveAspectRatio="none">
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
    </UiDialog>
  </div>
</template>

<style scoped>
.crypto-pulse-app {
  --star: #d97706;

  min-height: 0;
  color: var(--ok-text);
  font-family: var(--ok-font);
  -webkit-font-smoothing: antialiased;
}

.crypto-pulse-app a {
  color: var(--ok-accent);
  text-decoration: none;
}

.update-time {
  font-family: var(--ok-mono);
  font-size: 0.66rem;
  color: var(--ok-muted);
  white-space: nowrap;
}

.refresh-btn.spinning {
  color: var(--ok-accent);
}

.refresh-btn.spinning :deep(svg) {
  animation: ui-spin 0.8s linear infinite;
}

.stale-warning {
  margin: 0 0 0.6rem;
  color: var(--ok-muted);
  font-size: 0.75rem;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  margin-bottom: 0.8rem;
  background: var(--ok-panel);
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius);
  overflow: hidden;
}

.stats :deep(.ui-stat) {
  padding: 0.7rem 0.85rem;
}

.stats :deep(.ui-stat + .ui-stat) {
  border-left: 1px solid var(--ok-line);
}

.stats :deep(.ui-stat-value) {
  font-family: var(--ok-mono);
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.controls {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
  margin-bottom: 0.6rem;
}

.search-input {
  flex: 1 1 220px;
  max-width: 420px;
}

.search-icon {
  display: inline-grid;
  place-items: center;
  color: var(--ok-muted);
}

.controls-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-left: auto;
}

.count-info {
  font-family: var(--ok-mono);
  font-size: 0.68rem;
  color: var(--ok-muted);
}

.table-wrap {
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius);
  overflow-x: auto;
  background: var(--ok-panel);
}

.thead,
.trow {
  display: grid;
  grid-template-columns: 32px 40px minmax(160px, 2fr) 1.1fr 0.9fr 0.9fr 1.1fr 1.1fr;
  align-items: center;
  gap: 0.5rem;
}

.thead {
  padding: 0.5rem 0.8rem;
  background: var(--ok-bg);
  border-bottom: 1px solid var(--ok-line);
  color: var(--ok-muted);
  font-size: 0.66rem;
  font-weight: 600;
}

.th {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}
.th-rank {
  justify-content: center;
}
.th-price,
.th-24h,
.th-7d,
.th-mcap,
.th-vol {
  justify-content: flex-end;
  text-align: right;
}

.th.sortable {
  cursor: pointer;
  user-select: none;
  transition: color 0.15s;
}

.th.sortable:hover {
  color: var(--ok-accent);
}
.th.sortable.sorted {
  color: var(--ok-accent);
}

.th.sortable::after {
  content: '';
  display: inline-block;
  width: 0.6rem;
  font-size: 0.7rem;
  color: inherit;
  opacity: 0.7;
}

.th.sortable.sorted.asc::after {
  content: '▲';
}
.th.sortable.sorted.desc::after {
  content: '▼';
}

.tbody {
  display: flex;
  flex-direction: column;
}

.trow {
  padding: 0.55rem 0.8rem;
  border-bottom: 1px solid var(--ok-line);
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.13s;
}

.trow:last-child {
  border-bottom: none;
}
.trow:hover {
  background: var(--ok-bg);
}
.trow.is-fav {
  background: rgba(217, 119, 6, 0.04);
}
.trow.is-fav:hover {
  background: rgba(217, 119, 6, 0.08);
}

.tcell {
  display: flex;
  align-items: center;
  min-width: 0;
}
.tc-rank {
  justify-content: center;
  color: var(--ok-muted);
  font-family: var(--ok-mono);
  font-size: 0.76rem;
}
.tc-price,
.tc-24h,
.tc-7d,
.tc-mcap,
.tc-vol {
  justify-content: flex-end;
  text-align: right;
}

.tcell .star-btn {
  width: 1.5rem;
  height: 1.5rem;
  font-size: 1rem;
  padding: 0;
  transition:
    color 0.15s,
    transform 0.1s;
}

.tcell .star-btn:hover:not(:disabled) {
  color: var(--star);
  transform: scale(1.15);
}
.tcell .star-btn.on {
  color: var(--star);
}
.tcell .star-btn:focus-visible {
  outline: 2px solid var(--ok-accent);
  outline-offset: 1px;
}

.coin-id {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
.coin-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--ok-bg);
}
.coin-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.coin-name {
  font-weight: 600;
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.coin-symbol {
  font-family: var(--ok-mono);
  font-size: 0.68rem;
  color: var(--ok-muted);
  text-transform: uppercase;
}

.num {
  font-family: var(--ok-mono);
  font-variant-numeric: tabular-nums;
}
.tc-price .num {
  font-weight: 600;
  font-size: 0.82rem;
}

.pct {
  font-family: var(--ok-mono);
  font-weight: 600;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}
.pct.up {
  color: var(--ok-up);
}
.pct.down {
  color: var(--ok-down);
}

.tc-mcap .num,
.tc-vol .num {
  color: var(--ok-muted);
  font-size: 0.76rem;
}

.table-error {
  margin: 0.9rem 1rem;
}

.table-empty {
  margin: 0.9rem;
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1.1rem;
  border-bottom: 1px solid var(--ok-line);
}

.detail-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--ok-bg);
}

.detail-price-block {
  text-align: right;
}
.detail-price {
  font-family: var(--ok-mono);
  font-size: 1.6rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.detail-change {
  font-family: var(--ok-mono);
  font-size: 0.85rem;
  font-weight: 600;
  margin-top: 0.2rem;
}
.detail-change.up {
  color: var(--ok-up);
}
.detail-change.down {
  color: var(--ok-down);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  background: var(--ok-line);
  margin-top: 1.1rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-sm);
  overflow: hidden;
}

.dcell {
  background: var(--ok-panel);
  padding: 0.75rem 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.dcell .dc-label {
  font-size: 0.66rem;
  color: var(--ok-muted);
}
.dcell .dc-val {
  font-family: var(--ok-mono);
  font-size: 0.92rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.dcell .dc-val.up {
  color: var(--ok-up);
}
.dcell .dc-val.down {
  color: var(--ok-down);
}
.dcell .dc-val.muted {
  color: var(--ok-muted);
}

.detail-spark-wrap {
  margin-top: 1.2rem;
  padding: 1rem 0.95rem 0.6rem;
  background: var(--ok-bg);
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-sm);
}

.detail-spark-label {
  font-size: 0.66rem;
  color: var(--ok-muted);
  margin-bottom: 0.5rem;
}

.spark {
  width: 100%;
  height: 64px;
  display: block;
}

@media (max-width: 860px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .stats :deep(.ui-stat:nth-child(3)) {
    border-left: none;
    border-top: 1px solid var(--ok-line);
  }
  .stats :deep(.ui-stat:nth-child(4)) {
    border-top: 1px solid var(--ok-line);
  }

  .thead,
  .trow {
    grid-template-columns: 32px 38px minmax(140px, 2fr) 1fr 0.8fr 1fr;
    min-width: 460px;
  }

  .th-7d,
  .tc-7d {
    display: none;
  }
}

@media (max-width: 600px) {
  .stats :deep(.ui-stat-value) {
    font-size: 1rem;
  }

  .controls {
    flex-direction: column;
    align-items: stretch;
  }
  .search-input {
    max-width: none;
  }
  .controls-meta {
    margin-left: 0;
    justify-content: space-between;
  }

  .thead,
  .trow {
    grid-template-columns: 30px 34px minmax(120px, 2fr) 1fr 1fr;
    min-width: 420px;
  }

  .th-vol,
  .tc-vol {
    display: none;
  }

  .detail-head {
    flex-direction: column;
    align-items: start;
    text-align: left;
  }
  .detail-price-block {
    text-align: left;
  }
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
