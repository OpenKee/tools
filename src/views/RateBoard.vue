<script setup>
/* ============================================================
   Rate Board — 汇率与加密货币看板（Vue 3 SFC）
   数据源：open.er-api.com（汇率）/ CoinGecko（加密货币）
   - 汇率换算、区域分组、交叉汇率矩阵、全量汇率表
   - 中英文 i18n，共享 i18n.js / ok.js
   ============================================================ */

import { ref, computed, onMounted } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

// ---------- i18n 文案字典（合并汇率与加密货币两套文案） ----------
const copy = {
  en: {
    eyebrow: 'Exchange rate utility',
    title: 'Rate Board',
    lead: 'Convert currencies, compare rates, plan budgets. No sign-up, no tracking.',
    crossRates: 'Cross Rates',
    crossDesc: 'Direct rates between currencies (no base needed).',
    allRates: 'All Rates',
    updated: 'Updated',
    loading: 'Loading rates\u2026',
    error: 'Failed to load rates. The free API may be temporarily unavailable.',
    rate: 'Rate',
    conv: 'Converted',
    cryptoTitle: 'Crypto',
    cryptoDesc: 'Top cryptocurrencies by market cap. Powered by CoinGecko.',
    cryptoTracked: 'Coins',
    cryptoTotalMcap: 'Total Market Cap',
    cryptoGainers: '24h Gainers',
    cryptoLosers: '24h Losers',
    cryptoLoading: 'Loading crypto\u2026',
    cryptoError: 'CoinGecko API may be rate-limited.',
    cryptoRank: '#',
    cryptoName: 'Name',
    cryptoPrice: 'Price',
    crypto24h: '24h',
    crypto7d: '7d',
    cryptoMcap: 'Mkt Cap',
  },
  zh: {
    eyebrow: '汇率工具',
    title: '汇率看板',
    lead: '换算汇率、对比币种、规划预算。无需注册，不追踪。',
    crossRates: '交叉汇率',
    crossDesc: '货币之间的直接汇率（无需基准货币）。',
    allRates: '全部汇率',
    updated: '更新于',
    loading: '正在加载汇率\u2026',
    error: '加载失败，免费 API 可能暂时不可用。',
    rate: '汇率',
    conv: '换算结果',
    cryptoTitle: '加密货币',
    cryptoDesc: '市值排名前列的加密货币。由 CoinGecko 提供。',
    cryptoTracked: '币种',
    cryptoTotalMcap: '总市值',
    cryptoGainers: '24h 涨幅',
    cryptoLosers: '24h 跌',
    cryptoLoading: '加载中\u2026',
    cryptoError: 'CoinGecko API 可能限流。',
    cryptoRank: '#',
    cryptoName: '名称',
    cryptoPrice: '价格',
    crypto24h: '24h',
    crypto7d: '7天',
    cryptoMcap: '市值',
  },
}

const t = useT(copy)

// ---------- 货币 / 区域 / 矩阵常量 ----------
const CURRENCIES = {
  USD: { en: 'US Dollar', zh: '美元', flag: '🇺🇸' },
  EUR: { en: 'Euro', zh: '欧元', flag: '🇪🇺' },
  GBP: { en: 'British Pound', zh: '英镑', flag: '🇬🇧' },
  JPY: { en: 'Japanese Yen', zh: '日元', flag: '🇯🇵' },
  CNY: { en: 'Chinese Yuan', zh: '人民币', flag: '🇨🇳' },
  KRW: { en: 'Korean Won', zh: '韩元', flag: '🇰🇷' },
  HKD: { en: 'Hong Kong Dollar', zh: '港币', flag: '🇭🇰' },
  SGD: { en: 'Singapore Dollar', zh: '新加坡元', flag: '🇸🇬' },
  TWD: { en: 'Taiwan Dollar', zh: '新台币', flag: '🇹🇼' },
  AUD: { en: 'Australian Dollar', zh: '澳元', flag: '🇦🇺' },
  CAD: { en: 'Canadian Dollar', zh: '加元', flag: '🇨🇦' },
  CHF: { en: 'Swiss Franc', zh: '瑞士法郎', flag: '🇨🇭' },
  NZD: { en: 'New Zealand Dollar', zh: '新西兰元', flag: '🇳🇿' },
  SEK: { en: 'Swedish Krona', zh: '瑞典克朗', flag: '🇸🇪' },
  NOK: { en: 'Norwegian Krone', zh: '挪威克朗', flag: '🇳🇴' },
  DKK: { en: 'Danish Krone', zh: '丹麦克朗', flag: '🇩🇰' },
  INR: { en: 'Indian Rupee', zh: '印度卢比', flag: '🇮🇳' },
  THB: { en: 'Thai Baht', zh: '泰铢', flag: '🇹🇭' },
  MYR: { en: 'Malaysian Ringgit', zh: '马来西亚林吉特', flag: '🇲🇾' },
  PHP: { en: 'Philippine Peso', zh: '菲律宾比索', flag: '🇵🇭' },
  IDR: { en: 'Indonesian Rupiah', zh: '印尼盾', flag: '🇮🇩' },
  VND: { en: 'Vietnamese Dong', zh: '越南盾', flag: '🇻🇳' },
  RUB: { en: 'Russian Ruble', zh: '俄罗斯卢布', flag: '🇷🇺' },
  BRL: { en: 'Brazilian Real', zh: '巴西雷亚尔', flag: '🇧🇷' },
  MXN: { en: 'Mexican Peso', zh: '墨西哥比索', flag: '🇲🇽' },
  AED: { en: 'UAE Dirham', zh: '阿联酋迪拉姆', flag: '🇦🇪' },
  SAR: { en: 'Saudi Riyal', zh: '沙特里亚尔', flag: '🇸🇦' },
  ZAR: { en: 'South African Rand', zh: '南非兰特', flag: '🇿🇦' },
  TRY: { en: 'Turkish Lira', zh: '土耳其里拉', flag: '🇹🇷' },
  PLN: { en: 'Polish Zloty', zh: '波兰兹罗提', flag: '🇵🇱' },
}

const REGIONS = [
  { key: 'asia', label: { en: 'Asia Pacific', zh: '亚太地区' }, codes: ['CNY', 'JPY', 'KRW', 'HKD', 'SGD', 'TWD', 'THB', 'MYR', 'PHP', 'IDR', 'VND', 'INR'] },
  { key: 'west', label: { en: 'Americas & Europe', zh: '欧美地区' }, codes: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'TRY'] },
  { key: 'other', label: { en: 'Middle East & Others', zh: '中东及其他' }, codes: ['AED', 'SAR', 'RUB', 'BRL', 'MXN', 'ZAR'] },
]

const MATRIX_CODES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'KRW', 'SGD', 'AUD', 'CAD']
const allCodes = Object.keys(CURRENCIES)

// ---------- 状态 ----------
const ratesCache = ref(null)        // 汇率 API 原始数据
const ratesLoading = ref(true)      // 汇率加载中
const ratesError = ref(false)       // 汇率加载失败
const updatedAt = ref(null)         // 汇率更新时间

const cryptoCoins = ref([])         // 加密货币数组
const cryptoLoading = ref(true)     // 加密货币加载中
const cryptoError = ref(false)      // 加密货币加载失败

// 换算器状态
const fromCurrency = ref('USD')
const toCurrency = ref('CNY')
const fromAmount = ref('1000')

// 全量汇率表状态
const tableBase = ref('USD')
const tableAmount = ref('100')

// ---------- 工具函数 ----------
// 货币名称（响应式依赖 i18nState.lang）
function cname(code) {
  return CURRENCIES[code]?.[i18nState.lang] || code
}

// 交叉汇率：基于以 USD 为基准的 rates 表换算
function crossRate(rates, from, to) {
  if (from === to) return 1
  const rFrom = rates[from]
  const rTo = rates[to]
  if (!rFrom || !rTo) return null
  return rTo / rFrom
}

// 汇率展示格式（按量级选择小数位）
function fmtRate(n) {
  if (n === null || n === undefined) return '—'
  if (n >= 100) return n.toFixed(2)
  if (n >= 1) return n.toFixed(4)
  return n.toFixed(6)
}

// 金额格式（按语言区域）
function fmtAmount(n) {
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

// 加密货币金额缩写（$ 前缀）
function cryptoFmt(n) {
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (n >= 1) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return '$' + n.toPrecision(4)
}

// 加密货币涨跌百分比：class 与文本拆分，模板中分别绑定
function cryptoPctCls(n) {
  if (n == null) return ''
  return n >= 0 ? 'up' : 'down'
}
function cryptoPctText(n) {
  if (n == null) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

// ---------- computed：换算器 ----------
// 换算结果金额（只读输入框绑定）
const toAmountValue = computed(() => {
  if (!ratesCache.value) return ''
  const from = fromCurrency.value
  const to = toCurrency.value
  const amount = parseFloat(fromAmount.value) || 0
  const rate = crossRate(ratesCache.value.rates, from, to)
  if (rate === null) return ''
  return (amount * rate).toFixed(2)
})

// 换算比率说明文本
const converterRateText = computed(() => {
  if (!ratesCache.value) return ''
  const from = fromCurrency.value
  const to = toCurrency.value
  const rate = crossRate(ratesCache.value.rates, from, to)
  if (rate === null) return '—'
  return `1 ${from} = ${fmtRate(rate)} ${to}`
})

// ---------- computed：区域分组 ----------
const regionData = computed(() => {
  if (!ratesCache.value) return []
  const base = 'USD'
  return REGIONS.map((region) => ({
    key: region.key,
    label: region.label[i18nState.lang],
    rows: region.codes
      .filter((c) => c !== base && ratesCache.value.rates[c])
      .map((c) => ({
        code: c,
        flag: CURRENCIES[c]?.flag || '',
        name: cname(c),
        rateText: fmtRate(ratesCache.value.rates[c]),
      })),
  }))
})

// ---------- computed：交叉汇率矩阵 ----------
const matrixRows = computed(() => {
  if (!ratesCache.value) return []
  return MATRIX_CODES.map((from) => ({
    from,
    cells: MATRIX_CODES.map((to) => {
      if (from === to) return { diag: true, val: '1' }
      return { diag: false, val: fmtRate(crossRate(ratesCache.value.rates, from, to)) }
    }),
  }))
})

// ---------- computed：全量汇率表 ----------
const rateTableRows = computed(() => {
  if (!ratesCache.value) return []
  const base = tableBase.value
  const amount = parseFloat(tableAmount.value) || 0
  const codes = Object.keys(CURRENCIES).filter((c) => c !== base && ratesCache.value.rates[c])
  codes.sort((a, b) => (ratesCache.value.rates[b] || 0) - (ratesCache.value.rates[a] || 0))
  return codes.map((c) => {
    const rate = crossRate(ratesCache.value.rates, base, c)
    const converted = rate ? amount * rate : 0
    return {
      code: c,
      flag: CURRENCIES[c]?.flag || '',
      rateText: fmtRate(rate),
      convertedText: fmtAmount(converted),
      name: cname(c),
    }
  })
})

// ---------- computed：更新时间文本 ----------
const updatedAtText = computed(() => {
  if (!updatedAt.value) return ''
  return t.value('updated') + ': ' + updatedAt.value.toLocaleString(locale())
})

// ---------- computed：加密货币汇总统计 ----------
const cryptoStatCells = computed(() => {
  if (cryptoCoins.value.length === 0) return []
  let totalMcap = 0
  let gainers = 0
  for (const c of cryptoCoins.value) {
    totalMcap += c.market_cap || 0
    if ((c.price_change_percentage_24h || 0) > 0) gainers++
  }
  const losers = cryptoCoins.value.length - gainers
  return [
    { label: t.value('cryptoTracked'), val: String(cryptoCoins.value.length), style: '' },
    { label: t.value('cryptoTotalMcap'), val: cryptoFmt(totalMcap), style: 'font-size:1.1rem' },
    { label: t.value('cryptoGainers'), val: String(gainers), style: 'color:#22c55e' },
    { label: t.value('cryptoLosers'), val: String(losers), style: 'color:#ef4444' },
  ]
})

// ---------- 操作：换算器交换 ----------
function swap() {
  const tmp = fromCurrency.value
  fromCurrency.value = toCurrency.value
  toCurrency.value = tmp
}

// ---------- 数据加载 ----------
async function loadRates() {
  try {
    const data = await fetchJSON('https://open.er-api.com/v6/latest/USD')
    if (data.result !== 'success') throw new Error('API error')
    ratesCache.value = data
    updatedAt.value = new Date(data.time_last_update_utc)
    ratesLoading.value = false
  } catch (err) {
    ratesLoading.value = false
    ratesError.value = true
  }
}

async function loadCrypto() {
  try {
    const coins = await fetchJSON('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=15&page=1&sparkline=false&price_change_percentage=24h,7d')
    cryptoCoins.value = Array.isArray(coins) ? coins : []
    cryptoLoading.value = false
  } catch (err) {
    cryptoLoading.value = false
    cryptoError.value = true
  }
}

// ---------- 生命周期 ----------
onMounted(() => {
  loadRates()
  loadCrypto()
})
</script>

<template>
  <div class="rate-board-app">
    <AppHeader :show-lang-toggle="true" :title="t('title')" />

    <main class="shell">
      <header class="masthead">
        <div>
          <p class="eyebrow">{{ t('eyebrow') }}</p>
          <h1>{{ t('title') }}</h1>
          <p class="lead">{{ t('lead') }}</p>
        </div>
        <div class="header-actions">
          <span class="update-time">{{ updatedAtText }}</span>
        </div>
      </header>

      <!-- 换算器 -->
      <section class="converter-card">
        <div class="converter-row">
          <div class="converter-side">
            <select v-model="fromCurrency" aria-label="From currency">
              <option v-for="c in allCodes" :key="c" :value="c">
                {{ CURRENCIES[c]?.flag || '' }} {{ c }} — {{ cname(c) }}
              </option>
            </select>
            <input
              v-model="fromAmount"
              type="number"
              min="0"
              step="any"
              aria-label="Amount to convert"
            />
          </div>
          <button
            class="swap-btn"
            type="button"
            title="Swap"
            aria-label="Swap currencies"
            @click="swap"
          >⇄</button>
          <div class="converter-side">
            <select v-model="toCurrency" aria-label="To currency">
              <option v-for="c in allCodes" :key="c" :value="c">
                {{ CURRENCIES[c]?.flag || '' }} {{ c }} — {{ cname(c) }}
              </option>
            </select>
            <input
              :value="toAmountValue"
              type="number"
              readonly
              aria-label="Converted amount"
            />
          </div>
        </div>
        <p class="converter-rate">{{ converterRateText }}</p>
      </section>

      <!-- 区域分组 -->
      <section class="region-sections">
        <div v-if="ratesLoading" class="loading">
          <span class="spinner"></span>
          <span>{{ t('loading') }}</span>
        </div>
        <p v-else-if="ratesError" class="error-msg">{{ t('error') }}</p>
        <template v-else>
          <div v-for="region in regionData" :key="region.key" class="region-card">
            <div class="region-title">{{ region.label }}</div>
            <div
              v-for="row in region.rows"
              :key="row.code"
              class="currency-row"
            >
              <div>
                <span class="currency-code">{{ row.flag }} {{ row.code }}</span>
                <span class="currency-name">{{ row.name }}</span>
              </div>
              <span class="currency-rate">{{ row.rateText }}</span>
            </div>
          </div>
        </template>
      </section>

      <!-- 交叉汇率矩阵 -->
      <section class="matrix-section">
        <div class="section-head">
          <h2>{{ t('crossRates') }}</h2>
          <p class="section-desc">{{ t('crossDesc') }}</p>
        </div>
        <div class="matrix-wrap">
          <table class="matrix-table">
            <thead>
              <tr>
                <th></th>
                <th v-for="c in MATRIX_CODES" :key="c">{{ c }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in matrixRows" :key="row.from">
                <th>{{ row.from }}</th>
                <td
                  v-for="(cell, i) in row.cells"
                  :key="i"
                  :class="{ diag: cell.diag }"
                >{{ cell.val }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 全量汇率表 -->
      <section class="table-section">
        <div class="section-head">
          <h2>{{ t('allRates') }}</h2>
          <div class="table-controls">
            <select v-model="tableBase" aria-label="Base currency">
              <option v-for="c in allCodes" :key="c" :value="c">
                {{ CURRENCIES[c]?.flag || '' }} {{ c }} — {{ cname(c) }}
              </option>
            </select>
            <input
              v-model="tableAmount"
              type="number"
              min="0"
              step="any"
              placeholder="Amount"
              aria-label="Amount"
            />
          </div>
        </div>
        <div class="rate-table">
          <div v-for="row in rateTableRows" :key="row.code" class="rate-row">
            <span class="rate-code">{{ row.flag }} {{ row.code }}</span>
            <span class="rate-val">{{ row.rateText }}</span>
            <span class="rate-converted">{{ row.convertedText }}</span>
            <span class="rate-name">{{ row.name }}</span>
          </div>
        </div>
      </section>

      <!-- 加密货币 -->
      <section class="crypto-section">
        <div class="section-head">
          <h2>{{ t('cryptoTitle') }}</h2>
          <p class="section-desc">{{ t('cryptoDesc') }}</p>
        </div>
        <div class="crypto-stats">
          <div
            v-for="(s, i) in cryptoStatCells"
            :key="i"
            class="stat"
            :style="s.style"
          >
            <div class="s-label">{{ s.label }}</div>
            <div class="s-val">{{ s.val }}</div>
          </div>
        </div>
        <div class="crypto-list">
          <div v-if="cryptoLoading && cryptoCoins.length === 0" class="loading">
            {{ t('cryptoLoading') }}
          </div>
          <div v-else-if="cryptoError && cryptoCoins.length === 0" class="loading">
            {{ t('cryptoError') }}
          </div>
          <template v-else>
            <div class="crypto-thead">
              <span>{{ t('cryptoRank') }}</span>
              <span>{{ t('cryptoName') }}</span>
              <span>{{ t('cryptoPrice') }}</span>
              <span>{{ t('crypto24h') }}</span>
              <span>{{ t('crypto7d') }}</span>
              <span>{{ t('cryptoMcap') }}</span>
            </div>
            <div
              v-for="(c, i) in cryptoCoins"
              :key="c.id"
              class="crypto-row"
            >
              <span class="crypto-rank">{{ i + 1 }}</span>
              <div class="crypto-coin">
                <img class="crypto-icon" :src="c.image" alt="" />
                <div>
                  <div class="crypto-name">{{ c.name }}</div>
                  <div class="crypto-symbol">{{ c.symbol.toUpperCase() }}</div>
                </div>
              </div>
              <span class="crypto-price">{{ cryptoFmt(c.current_price) }}</span>
              <span class="crypto-change" :class="cryptoPctCls(c.price_change_percentage_24h)">
                {{ cryptoPctText(c.price_change_percentage_24h) }}
              </span>
              <span class="crypto-change" :class="cryptoPctCls(c.price_change_percentage_7d_in_currency)">
                {{ cryptoPctText(c.price_change_percentage_7d_in_currency) }}
              </span>
              <span class="crypto-mcap">{{ cryptoFmt(c.market_cap) }}</span>
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
   Rate Board — 浅色汇率主题
   原 :root 变量迁移到组件根类 .rate-board-app，
   --ok-* 令牌在此覆盖，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.rate-board-app {
  /* 表面与文字 */
  --bg: #f5f7fb;
  --panel: #ffffff;
  --line: #d9e0ea;
  --text: #122032;
  --muted: #5a6778;
  --accent: #1c63d5;
  --accent-soft: #eaf1ff;
  --up: #16a34a;
  --up-bg: #f0fdf4;
  --down: #dc2626;
  --down-bg: #fef2f2;

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

  min-height: 100vh;
  margin: 0;
  font-family: "Inter", system-ui, sans-serif;
  color: var(--text);
  background: var(--bg);
}

.rate-board-app * { box-sizing: border-box; }

.rate-board-app a { color: var(--accent); text-decoration: none; }
.rate-board-app h1, .rate-board-app h2, .rate-board-app p,
.rate-board-app strong, .rate-board-app span, .rate-board-app small { margin: 0; }

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
  font-size: clamp(2rem, 5vw, 3.2rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
}

.lead {
  margin-top: 0.5rem;
  color: var(--muted);
  font-size: 0.9rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.update-time {
  font-size: 0.72rem;
  color: var(--muted);
}

/* Converter */
.converter-card {
  margin-top: 1.2rem;
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 1.5rem;
}

.converter-row {
  display: flex;
  align-items: end;
  gap: 1rem;
}

.converter-side {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.converter-side select,
.converter-side input {
  font: inherit;
  width: 100%;
  height: 3rem;
  padding: 0 0.75rem;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  font-size: 1rem;
}

.converter-side input {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.converter-side select {
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}

.swap-btn {
  flex-shrink: 0;
  width: 2.8rem;
  height: 2.8rem;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--accent);
  font-size: 1.2rem;
  cursor: pointer;
  border-radius: 50%;
  transition: all 150ms ease;
  margin-bottom: 0.25rem;
}

.swap-btn:hover {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.converter-rate {
  margin-top: 0.75rem;
  font-size: 0.82rem;
  color: var(--muted);
  text-align: center;
}

/* Region sections */
.region-sections {
  margin-top: 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
}

.region-card {
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 1rem;
}

.region-title {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  margin-bottom: 0.75rem;
}

.currency-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.currency-row:last-child { border-bottom: none; }

.currency-code {
  font-weight: 600;
  font-size: 0.9rem;
}

.currency-name {
  font-size: 0.72rem;
  color: var(--muted);
  margin-left: 0.4rem;
}

.currency-rate {
  font-family: "Inter", monospace;
  font-weight: 600;
  font-size: 0.9rem;
  text-align: right;
}

.currency-rate.up { color: var(--up); }
.currency-rate.down { color: var(--down); }

/* Matrix */
.matrix-section, .table-section {
  margin-top: 1.5rem;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
}

.section-head h2 {
  font-size: 1.1rem;
}

.section-desc {
  font-size: 0.78rem;
  color: var(--muted);
}

.table-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.table-controls select,
.table-controls input {
  font: inherit;
  height: 2.2rem;
  padding: 0 0.6rem;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--text);
  font-size: 0.82rem;
}

.table-controls input { width: 80px; }

.matrix-wrap {
  overflow-x: auto;
  background: var(--panel);
  border: 1px solid var(--line);
}

.matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.matrix-table th,
.matrix-table td {
  padding: 0.5rem;
  text-align: center;
  border: 1px solid rgba(0, 0, 0, 0.05);
  white-space: nowrap;
}

.matrix-table th {
  background: var(--bg);
  font-weight: 600;
  font-size: 0.72rem;
  color: var(--accent);
  position: sticky;
  top: 0;
}

.matrix-table td.diag {
  background: var(--accent-soft);
  font-weight: 700;
  color: var(--accent);
}

.rate-table {
  display: grid;
  gap: 0;
}

.rate-row {
  display: grid;
  grid-template-columns: 80px 1fr 1fr 1fr;
  gap: 0.5rem;
  align-items: center;
  padding: 0.6rem 0.8rem;
  background: var(--panel);
  border: 1px solid var(--line);
  margin-top: -1px;
  font-size: 0.85rem;
}

.rate-row:first-child { margin-top: 0; }

.rate-row:hover { background: var(--accent-soft); }

.rate-code {
  font-weight: 700;
}

.rate-val {
  font-family: "Inter", monospace;
  font-weight: 500;
}

.rate-converted {
  font-family: "Inter", monospace;
  font-weight: 600;
  color: var(--accent);
}

.rate-name {
  color: var(--muted);
  font-size: 0.76rem;
}

/* Loading / error */
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

.error-msg {
  color: #a33;
  background: var(--down-bg);
  border: 1px solid rgba(170, 50, 50, 0.2);
  padding: 0.8rem;
  border-radius: 4px;
  font-size: 0.88rem;
}

@media (max-width: 720px) {
  .masthead { flex-direction: column; align-items: start; gap: 0.6rem; }
  .converter-row { flex-direction: column; }
  .swap-btn { align-self: center; transform: rotate(90deg); }
  .region-sections { grid-template-columns: 1fr; }
  .rate-row { grid-template-columns: 70px 1fr 1fr; }
  .rate-name { display: none; }
}

/* Crypto Section */
.crypto-section {
  margin-top: 2.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #d9e0ea;
}
.crypto-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  padding: 1rem 0;
  border-bottom: 1px solid #d9e0ea;
}
.crypto-stats .stat {
  padding: 0 1rem;
  border-right: 1px solid #e8ecf2;
}
.crypto-stats .stat:last-child {
  border-right: none;
}
.crypto-stats .s-label {
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #5a6778;
}
.crypto-stats .s-val {
  font-size: 1.4rem;
  font-weight: 800;
  margin-top: 0.1rem;
}
.crypto-thead {
  display: grid;
  grid-template-columns: 40px 1fr 100px 70px 70px 100px;
  gap: 0.5rem;
  padding: 0.5rem 0.8rem;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #5a6778;
  border-bottom: 1px solid #d9e0ea;
}
.crypto-row {
  display: grid;
  grid-template-columns: 40px 1fr 100px 70px 70px 100px;
  gap: 0.5rem;
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  align-items: center;
  font-size: 0.85rem;
  transition: background 0.15s;
}
.crypto-row:hover {
  background: #f0f3f8;
}
.crypto-rank {
  color: #8892a4;
  font-size: 0.78rem;
  text-align: center;
}
.crypto-coin {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.crypto-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
}
.crypto-name {
  font-weight: 600;
  font-size: 0.85rem;
}
.crypto-symbol {
  font-size: 0.72rem;
  color: #8892a4;
  text-transform: uppercase;
}
.crypto-price {
  font-family: "JetBrains Mono", "Inter", monospace;
  font-weight: 600;
  font-size: 0.85rem;
}
.crypto-change {
  font-family: "JetBrains Mono", "Inter", monospace;
  font-size: 0.82rem;
  font-weight: 600;
}
.crypto-change.up {
  color: #22c55e;
}
.crypto-change.down {
  color: #ef4444;
}
.crypto-mcap {
  font-size: 0.78rem;
  color: #5a6778;
}
@media (max-width: 768px) {
  .crypto-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .crypto-stats .stat {
    border-right: none;
    border-bottom: 1px solid #e8ecf2;
  }
  .crypto-thead,
  .crypto-row {
    grid-template-columns: 30px 1fr 90px 60px;
  }
  .crypto-thead > span:nth-child(5),
  .crypto-thead > span:nth-child(6),
  .crypto-row > span:nth-child(5),
  .crypto-row > span:last-child {
    display: none;
  }
}
</style>
