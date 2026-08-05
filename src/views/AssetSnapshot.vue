<script setup>
/* ============================================================
   Asset Snapshot — 资产快照：一键换算所有主要法币与顶级加密货币
   数据源：open.er-api.com（汇率）/ CoinGecko（加密货币价格）
   - 金额输入 + 源币种选择，实时换算
   - 法币网格 + 加密货币网格，7d 涨跌指示
   - 中英文 i18n，共享 i18n.js / ok.js
   ============================================================ */

import { ref, computed, watch, onMounted } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

// ---------- i18n 文案字典 ----------
const copy = {
  en: {
    eyebrow: 'Multi-asset converter',
    title: 'Asset Snapshot',
    lead: 'Convert any amount across all major fiat currencies and top cryptocurrencies in one view.',
    fiatTitle: 'Fiat Currencies',
    cryptoTitle: 'Cryptocurrencies',
    amountLabel: 'Amount',
    sourceLabel: 'Currency',
    convert: 'Convert',
    loading: 'Loading exchange rates\u2026',
    error: 'Failed to load exchange rates. The free API may be temporarily unavailable.',
    cryptoLoading: 'Loading crypto prices\u2026',
    cryptoError: 'Failed to load crypto prices. CoinGecko may be rate-limited.',
    amountPlaceholder: 'Enter amount',
    updated: 'Updated',
    days7: '7d',
    noData: 'No data available.',
  },
  zh: {
    eyebrow: '多资产换算',
    title: '资产快照',
    lead: '一键换算所有主要法定货币与顶级加密货币。',
    fiatTitle: '法定货币',
    cryptoTitle: '加密货币',
    amountLabel: '金额',
    sourceLabel: '币种',
    convert: '换算',
    loading: '正在加载汇率\u2026',
    error: '加载汇率失败，免费 API 可能暂时不可用。',
    cryptoLoading: '正在加载加密货币价格\u2026',
    cryptoError: '加载加密货币价格失败，CoinGecko 可能限流。',
    amountPlaceholder: '输入金额',
    updated: '更新于',
    days7: '7天',
    noData: '暂无数据。',
  },
}

const t = useT(copy)

// ---------- 常量 ----------
const FIAT_CODES = ['USD', 'EUR', 'CNY', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'HKD', 'SGD']

const CURRENCY_NAMES = {
  USD: { en: 'US Dollar', zh: '美元' },
  EUR: { en: 'Euro', zh: '欧元' },
  CNY: { en: 'Chinese Yuan', zh: '人民币' },
  GBP: { en: 'British Pound', zh: '英镑' },
  JPY: { en: 'Japanese Yen', zh: '日元' },
  CAD: { en: 'Canadian Dollar', zh: '加元' },
  AUD: { en: 'Australian Dollar', zh: '澳元' },
  CHF: { en: 'Swiss Franc', zh: '瑞士法郎' },
  HKD: { en: 'Hong Kong Dollar', zh: '港币' },
  SGD: { en: 'Singapore Dollar', zh: '新加坡元' },
}

// ---------- 状态 ----------
const amountRaw = ref('1000')
const amount = ref(1000)
const sourceCurrency = ref('USD')
const ratesCache = ref(null)
const ratesLoading = ref(true)
const ratesError = ref(false)
const updatedAt = ref(null)
const cryptoCoins = ref([])
const cryptoLoading = ref(true)
const cryptoError = ref(false)

// ---------- debounce ----------
let debounceTimer = null
watch(amountRaw, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    const parsed = parseFloat(val)
    amount.value = isNaN(parsed) || parsed < 0 ? 0 : parsed
  }, 300)
})

// 币种切换时立即生效
watch(sourceCurrency, () => {
  // 重新计算已在 computed 中自动完成
})

// ---------- 工具函数 ----------
function cname(code) {
  return CURRENCY_NAMES[code]?.[i18nState.lang] || code
}

function fmtAmount(n) {
  if (n == null || isNaN(n)) return '—'
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtCryptoAmount(n) {
  if (n == null || isNaN(n)) return '—'
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n >= 0.01) return n.toFixed(4)
  if (n >= 0.0001) return n.toFixed(6)
  return n.toPrecision(4)
}

function fmtCryptoPrice(n) {
  if (n == null || isNaN(n)) return '—'
  if (n >= 1) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n >= 0.01) return '$' + n.toFixed(4)
  if (n >= 0.0001) return '$' + n.toFixed(6)
  return '$' + n.toPrecision(4)
}

function pctText(n) {
  if (n == null) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

function pctCls(n) {
  if (n == null) return ''
  return n >= 0 ? 'up' : 'down'
}

// ---------- computed：法币换算 ----------
const fiatConversions = computed(() => {
  if (!ratesCache.value) return []
  const source = sourceCurrency.value
  const srcRate = ratesCache.value.rates[source]
  if (!srcRate) return []
  const baseAmount = amount.value / srcRate
  return FIAT_CODES.map((code) => {
    const targetRate = ratesCache.value.rates[code]
    if (!targetRate) return { code, name: cname(code), value: null, display: '—' }
    const converted = baseAmount * targetRate
    return {
      code,
      name: cname(code),
      value: converted,
      display: fmtAmount(converted),
    }
  })
})

// ---------- computed：加密货币换算 ----------
const cryptoConversions = computed(() => {
  if (!ratesCache.value || cryptoCoins.value.length === 0) return []
  const source = sourceCurrency.value
  const srcRate = ratesCache.value.rates[source]
  if (!srcRate) return []
  const usdAmount = amount.value / srcRate
  return cryptoCoins.value.map((coin) => {
    const price = coin.current_price
    if (!price) return { ...coin, converted: null, display: '—', changeText: '—', changeCls: '' }
    const converted = usdAmount / price
    return {
      ...coin,
      converted,
      display: fmtCryptoAmount(converted),
      changeText: pctText(coin.price_change_percentage_7d_in_currency),
      changeCls: pctCls(coin.price_change_percentage_7d_in_currency),
    }
  })
})

// ---------- computed：更新时间文本 ----------
const updatedAtText = computed(() => {
  if (!updatedAt.value) return ''
  return t.value('updated') + ': ' + updatedAt.value.toLocaleString(locale())
})

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
    const coins = await fetchJSON('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=7d')
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
  <div class="asset-snapshot-app">
    <AppHeader :show-lang-toggle="true" :title="{ en: 'Asset Snapshot', zh: '资产快照' }" />

    <main class="shell">
      <header class="masthead">
        <div class="masthead-left">
          <p class="eyebrow">{{ t('eyebrow') }}</p>
          <h1>{{ t('title') }}</h1>
          <p class="lead">{{ t('lead') }}</p>
        </div>
        <div class="header-right">
          <span class="update-time">{{ updatedAtText }}</span>
        </div>
      </header>

      <!-- 输入区 -->
      <section class="input-section">
        <div class="input-card">
          <div class="input-row">
            <div class="input-group">
              <label class="input-label" for="asset-amount">{{ t('amountLabel') }}</label>
              <input
                id="asset-amount"
                v-model="amountRaw"
                type="number"
                min="0"
                step="any"
                class="amount-input"
                :placeholder="t('amountPlaceholder')"
                aria-label="Amount"
              />
            </div>
            <div class="input-group">
              <label class="input-label" for="asset-currency">{{ t('sourceLabel') }}</label>
              <select
                id="asset-currency"
                v-model="sourceCurrency"
                class="currency-select"
                aria-label="Source currency"
              >
                <option
                  v-for="c in FIAT_CODES"
                  :key="c"
                  :value="c"
                >{{ c }} — {{ cname(c) }}</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <!-- 法币换算结果 -->
      <section class="section-block">
        <div class="section-head">
          <h2>{{ t('fiatTitle') }}</h2>
        </div>
        <div v-if="ratesLoading" class="loading">
          <span class="spinner"></span>
          <span>{{ t('loading') }}</span>
        </div>
        <div v-else-if="ratesError" class="error-msg">{{ t('error') }}</div>
        <div v-else-if="amount <= 0" class="empty-state">{{ t('noData') }}</div>
        <div v-else class="card-grid fiat-grid">
          <div
            v-for="item in fiatConversions"
            :key="item.code"
            class="card"
          >
            <div class="card-code">{{ item.code }}</div>
            <div class="card-name">{{ item.name }}</div>
            <div class="card-amount">{{ item.display }}</div>
          </div>
        </div>
      </section>

      <!-- 加密货币换算结果 -->
      <section class="section-block">
        <div class="section-head">
          <h2>{{ t('cryptoTitle') }}</h2>
        </div>
        <div v-if="cryptoLoading" class="loading">
          <span class="spinner"></span>
          <span>{{ t('cryptoLoading') }}</span>
        </div>
        <div v-else-if="cryptoError" class="error-msg">{{ t('cryptoError') }}</div>
        <div v-else-if="amount <= 0" class="empty-state">{{ t('noData') }}</div>
        <div v-else class="card-grid crypto-grid">
          <div
            v-for="item in cryptoConversions"
            :key="item.id"
            class="card crypto-card"
          >
            <div class="crypto-header">
              <img
                class="crypto-icon"
                :src="item.image"
                alt=""
                loading="lazy"
              />
              <div class="crypto-meta">
                <div class="crypto-name">{{ item.name }}</div>
                <div class="crypto-symbol">{{ item.symbol.toUpperCase() }}</div>
              </div>
            </div>
            <div class="card-amount">{{ item.display }}</div>
            <div class="crypto-footer">
              <span class="crypto-price">{{ fmtCryptoPrice(item.current_price) }}</span>
              <span class="crypto-change" :class="item.changeCls">{{ item.changeText }}</span>
            </div>
          </div>
        </div>
      </section>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Asset Snapshot — 浅色资产快照主题
   --ok-* 令牌在此覆盖，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.asset-snapshot-app {
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

.asset-snapshot-app * { box-sizing: border-box; }

.asset-snapshot-app a { color: var(--accent); text-decoration: none; }
.asset-snapshot-app h1, .asset-snapshot-app h2, .asset-snapshot-app p,
.asset-snapshot-app strong, .asset-snapshot-app span, .asset-snapshot-app small { margin: 0; }

.shell {
  width: min(1100px, calc(100% - 1.25rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

/* Masthead */
.masthead {
  display: flex;
  justify-content: space-between;
  align-items: end;
  padding: 0.3rem 0 1.2rem;
  border-bottom: 1px solid var(--line);
}

.masthead-left { min-width: 0; }

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
  max-width: 56ch;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.update-time {
  font-size: 0.72rem;
  color: var(--muted);
  white-space: nowrap;
}

/* Input Section */
.input-section {
  margin-top: 1.2rem;
}

.input-card {
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 1.5rem;
}

.input-row {
  display: flex;
  gap: 1rem;
  align-items: end;
}

.input-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.input-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.amount-input,
.currency-select {
  font: inherit;
  width: 100%;
  height: 3rem;
  padding: 0 0.75rem;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  font-size: 1rem;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.amount-input:focus,
.currency-select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.amount-input {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.currency-select {
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

/* Section Blocks */
.section-block {
  margin-top: 1.5rem;
}

.section-head {
  margin-bottom: 0.75rem;
}

.section-head h2 {
  font-size: 1.1rem;
  font-weight: 700;
}

/* Card Grid */
.card-grid {
  display: grid;
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
  overflow: hidden;
}

.fiat-grid {
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.crypto-grid {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

/* Card */
.card {
  background: var(--panel);
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.card-code {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
}

.card-name {
  font-size: 0.8rem;
  color: var(--muted);
}

.card-amount {
  font-family: "JetBrains Mono", "Inter", monospace;
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
  margin-top: 0.2rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Crypto Card */
.crypto-card { gap: 0.5rem; }

.crypto-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.crypto-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--bg);
}

.crypto-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.crypto-name {
  font-weight: 600;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.crypto-symbol {
  font-size: 0.72rem;
  color: var(--muted);
  text-transform: uppercase;
  font-family: "JetBrains Mono", "Inter", monospace;
}

.crypto-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.2rem;
}

.crypto-price {
  font-family: "JetBrains Mono", "Inter", monospace;
  font-size: 0.78rem;
  color: var(--muted);
}

.crypto-change {
  font-family: "JetBrains Mono", "Inter", monospace;
  font-size: 0.82rem;
  font-weight: 600;
}

.crypto-change.up { color: var(--up); }
.crypto-change.down { color: var(--down); }

/* Loading / Error / Empty */
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

.empty-state {
  color: var(--muted);
  padding: 1.5rem;
  font-size: 0.88rem;
  text-align: center;
}

/* Responsive */
@media (max-width: 720px) {
  .masthead { flex-direction: column; align-items: start; gap: 0.6rem; }
  .input-row { flex-direction: column; }
  .fiat-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
  .crypto-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
  .card-amount { font-size: 1rem; }
}
</style>