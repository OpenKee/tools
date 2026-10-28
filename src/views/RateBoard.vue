<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ArrowLeftRight, RefreshCw } from '@lucide/vue'
import { i18nState, useT } from '../i18n.js'
import { locale, cryptoMarkets } from '../ok.js'
import { getUsdRates } from '../lib/markets.js'
import {
  UiCard,
  UiEmptyState,
  UiErrorState,
  UiField,
  UiIconButton,
  UiInput,
  UiLoading,
  UiPage,
  UiPageHead,
  UiSectionHead,
  UiSelect,
  UiTabs,
} from '../components/ui/index.js'
import { useUrlTab } from '../lib/use-url-tab.js'
import CryptoPulse from './CryptoPulse.vue'
import copy from '../copy/rate-board.js'

const { tab, setTab } = useUrlTab(['fx', 'crypto', 'asset'], 'fx')

const t = useT(copy)

const tabDesc = computed(() => {
  if (tab.value === 'crypto') return t.value('cryptoDesc')
  if (tab.value === 'asset') return t.value('assetLead')
  return t.value('lead')
})

const tabItems = computed(() => [
  { key: 'fx', label: t.value('tabFx') },
  { key: 'crypto', label: t.value('tabCrypto') },
  { key: 'asset', label: t.value('tabAsset') },
])

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
  {
    key: 'asia',
    label: { en: 'Asia Pacific', zh: '亚太地区' },
    codes: ['CNY', 'JPY', 'KRW', 'HKD', 'SGD', 'TWD', 'THB', 'MYR', 'PHP', 'IDR', 'VND', 'INR'],
  },
  {
    key: 'west',
    label: { en: 'Americas & Europe', zh: '欧美地区' },
    codes: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'TRY'],
  },
  {
    key: 'other',
    label: { en: 'Middle East & Others', zh: '中东及其他' },
    codes: ['AED', 'SAR', 'RUB', 'BRL', 'MXN', 'ZAR'],
  },
]

const MATRIX_CODES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'KRW', 'SGD', 'AUD', 'CAD']
const ASSET_FIAT_CODES = ['USD', 'EUR', 'CNY', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'HKD', 'SGD']
const allCodes = Object.keys(CURRENCIES)
const currencyOptions = computed(() => allCodes.map((code) => ({ value: code, label: `${code} — ${cname(code)}` })))
const assetFiatOptions = computed(() =>
  ASSET_FIAT_CODES.map((code) => ({ value: code, label: `${code} — ${cname(code)}` })),
)

const ratesCache = ref(null)
const ratesLoading = ref(true)
const ratesError = ref(false)
const updatedAt = ref(null)

const cryptoCoins = ref([])
const cryptoLoading = ref(false)
const cryptoError = ref(false)

const fromCurrency = ref('USD')
const toCurrency = ref('CNY')
const fromAmount = ref('1000')

const tableBase = ref('USD')
const tableAmount = ref('100')

const assetAmount = ref('1000')
const assetSource = ref('USD')

function cname(code) {
  return CURRENCIES[code]?.[i18nState.lang] || code
}

function crossRate(rates, from, to) {
  if (from === to) return 1
  const rFrom = rates[from]
  const rTo = rates[to]
  if (!rFrom || !rTo) return null
  return rTo / rFrom
}

function fmtRate(n) {
  if (n === null || n === undefined) return '—'
  if (n >= 100) return n.toFixed(2)
  if (n >= 1) return n.toFixed(4)
  return n.toFixed(6)
}

function fmtAmount(n) {
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function cryptoFmt(n) {
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (n >= 1) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return '$' + n.toPrecision(4)
}

function cryptoPctCls(n) {
  if (n == null) return ''
  return n >= 0 ? 'up' : 'down'
}
function cryptoPctText(n) {
  if (n == null) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

const toAmountValue = computed(() => {
  if (!ratesCache.value) return ''
  const from = fromCurrency.value
  const to = toCurrency.value
  const amount = parseFloat(fromAmount.value) || 0
  const rate = crossRate(ratesCache.value.rates, from, to)
  if (rate === null) return ''
  return (amount * rate).toFixed(2)
})

const converterRateText = computed(() => {
  if (!ratesCache.value) return ''
  const from = fromCurrency.value
  const to = toCurrency.value
  const rate = crossRate(ratesCache.value.rates, from, to)
  if (rate === null) return '—'
  return `1 ${from} = ${fmtRate(rate)} ${to}`
})

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

function fmtCoinAmount(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat(locale(), {
    maximumFractionDigits: n >= 1 ? 4 : 8,
  }).format(n)
}

const assetFiatRows = computed(() => {
  if (!ratesCache.value) return []
  const amount = parseFloat(assetAmount.value) || 0
  const from = assetSource.value
  return ASSET_FIAT_CODES.map((code) => {
    const rate = crossRate(ratesCache.value.rates, from, code)
    return {
      code,
      flag: CURRENCIES[code]?.flag || '',
      name: cname(code),
      display: rate != null ? fmtAmount(amount * rate) : '—',
    }
  })
})

const assetCryptoRows = computed(() => {
  const rates = ratesCache.value?.rates
  const sourceRate = rates?.[assetSource.value]
  const amount = parseFloat(assetAmount.value) || 0
  if (!rates || !sourceRate || amount <= 0) return []
  const usd = amount / sourceRate
  return cryptoCoins.value.slice(0, 10).map((coin) => {
    const price = coin.current_price
    const coinAmount = price ? usd / price : null
    const change = coin.price_change_percentage_7d_in_currency ?? coin.price_change_percentage_7d ?? null
    return {
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      image: coin.image,
      display: fmtCoinAmount(coinAmount),
      priceText: price != null ? cryptoFmt(price) : '—',
      changeText: cryptoPctText(change),
      changeCls: cryptoPctCls(change),
    }
  })
})

const updatedAtText = computed(() => {
  if (!updatedAt.value) return ''
  return t.value('updated') + ': ' + updatedAt.value.toLocaleString(locale())
})

function swap() {
  const tmp = fromCurrency.value
  fromCurrency.value = toCurrency.value
  toCurrency.value = tmp
}

let ratesToken = 0

async function loadRates(force = false) {
  const token = ++ratesToken
  ratesLoading.value = true
  ratesError.value = false
  try {
    const data = await getUsdRates({ force: force === true })
    if (!data || data.result !== 'success' || !data.rates) throw new Error('API error')
    if (token !== ratesToken) return
    ratesCache.value = data
    updatedAt.value = new Date(data.time_last_update_utc)
  } catch (err) {
    if (token !== ratesToken) return
    ratesError.value = true
  } finally {
    if (token === ratesToken) ratesLoading.value = false
  }
}

async function loadCrypto() {
  cryptoLoading.value = true
  cryptoError.value = false
  try {
    const coins = await cryptoMarkets({ perPage: 15 })
    cryptoCoins.value = Array.isArray(coins) ? coins : []
    cryptoLoading.value = false
  } catch (err) {
    cryptoLoading.value = false
    cryptoError.value = true
  }
}

onMounted(() => {
  loadRates()
  if (tab.value === 'asset') loadCrypto()
})

watch(tab, (next) => {
  if (next === 'asset' && !cryptoCoins.value.length && !cryptoLoading.value) {
    loadCrypto()
  }
})
</script>

<template>
  <UiPage
    class="rate-board-app"
    :title="t('title')"
    :sources="[
      { name: 'open.er-api.com', url: 'https://www.exchangerate-api.com/' },
      { name: 'CoinGecko', url: 'https://www.coingecko.com/' },
      { name: 'Gate.io', url: 'https://www.gate.io/' },
    ]"
    spacing="compact"
  >
    <UiTabs
      class="rb-tabs"
      :model-value="tab"
      :items="tabItems"
      panel-id="rate-board-panel"
      :aria-label="t('title')"
      @update:model-value="setTab"
    />

    <div id="rate-board-panel" role="tabpanel" :aria-labelledby="'ui-tab-' + tab" tabindex="0">
      <UiPageHead :description="tabDesc" />

      <div v-show="tab === 'fx'">
        <UiLoading v-if="ratesLoading && !ratesCache" :label="t('loading')" />
        <UiErrorState
          v-else-if="ratesError && !ratesCache"
          variant="block"
          :message="t('error')"
          :retry-label="t('retry')"
          @retry="loadRates(true)"
        />

        <template v-else>
          <UiErrorState
            v-if="ratesError"
            :message="t('error')"
            :retry-label="t('retry')"
            class="inline-alert"
            @retry="loadRates(true)"
          />
          <UiCard class="converter-card">
            <UiSectionHead :title="t('converter')">
              <template #actions>
                <span class="update-time">{{ updatedAtText }}</span>
                <UiIconButton
                  :label="t('refresh')"
                  variant="secondary"
                  size="sm"
                  :disabled="ratesLoading"
                  @click="loadRates(true)"
                >
                  <RefreshCw :class="{ spinning: ratesLoading }" aria-hidden="true" />
                </UiIconButton>
              </template>
            </UiSectionHead>
            <div class="converter-grid">
              <div class="converter-field">
                <UiField :label="t('fromCurrency')" label-for="rate-from-currency">
                  <UiSelect id="rate-from-currency" v-model="fromCurrency" :options="currencyOptions" />
                </UiField>
                <UiField :label="t('fromAmount')" label-for="rate-from-amount">
                  <UiInput
                    id="rate-from-amount"
                    v-model="fromAmount"
                    class="converter-amount"
                    type="number"
                    min="0"
                    step="any"
                  />
                </UiField>
              </div>
              <UiIconButton class="swap-btn" :label="t('swap')" variant="secondary" @click="swap">
                <ArrowLeftRight aria-hidden="true" />
              </UiIconButton>
              <div class="converter-field">
                <UiField :label="t('toCurrency')" label-for="rate-to-currency">
                  <UiSelect id="rate-to-currency" v-model="toCurrency" :options="currencyOptions" />
                </UiField>
                <UiField :label="t('conversionResult')" label-for="rate-result">
                  <UiInput
                    id="rate-result"
                    :model-value="toAmountValue"
                    class="converter-amount"
                    type="number"
                    readonly
                  />
                </UiField>
              </div>
            </div>
            <p class="converter-rate">{{ converterRateText }}</p>
          </UiCard>

          <section class="region-section">
            <UiSectionHead :title="t('regionRates')" />
            <div class="region-grid">
              <UiCard v-for="region in regionData" :key="region.key" padding="sm" class="region-card">
                <div class="region-title">{{ region.label }}</div>
                <div v-for="row in region.rows" :key="row.code" class="currency-row">
                  <div class="currency-main">
                    <span class="currency-code">{{ row.code }}</span>
                    <span class="currency-name">{{ row.name }}</span>
                  </div>
                  <span class="currency-rate">{{ row.rateText }}</span>
                </div>
              </UiCard>
            </div>
          </section>

          <UiCard class="matrix-section">
            <UiSectionHead :title="t('crossRates')" :description="t('crossDesc')" />
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
                    <td v-for="(cell, i) in row.cells" :key="i" :class="{ diag: cell.diag }">{{ cell.val }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UiCard>

          <UiCard class="table-section">
            <UiSectionHead :title="t('allRates')">
              <template #actions>
                <div class="table-controls">
                  <UiSelect
                    v-model="tableBase"
                    class="table-base"
                    :options="currencyOptions"
                    size="sm"
                    :aria-label="t('currency')"
                  />
                  <UiInput
                    v-model="tableAmount"
                    class="table-amount"
                    type="number"
                    size="sm"
                    min="0"
                    step="any"
                    :placeholder="t('assetAmount')"
                    :aria-label="t('assetAmount')"
                  />
                </div>
              </template>
            </UiSectionHead>
            <div class="rate-table">
              <div class="rate-head">
                <span>{{ t('currency') }}</span>
                <span>{{ t('rate') }}</span>
                <span>{{ t('conv') }}</span>
                <span>{{ t('name') }}</span>
              </div>
              <div v-for="row in rateTableRows" :key="row.code" class="rate-row">
                <span class="rate-code">{{ row.code }}</span>
                <span class="rate-val">{{ row.rateText }}</span>
                <span class="rate-converted">{{ row.convertedText }}</span>
                <span class="rate-name">{{ row.name }}</span>
              </div>
            </div>
          </UiCard>
        </template>
      </div>

      <CryptoPulse v-if="tab === 'crypto'" />

      <section v-if="tab === 'asset'" class="asset-tab">
        <UiLoading v-if="ratesLoading" :label="t('loading')" />
        <UiErrorState
          v-else-if="ratesError"
          variant="block"
          :message="t('assetRateError')"
          :retry-label="t('retry')"
          @retry="loadRates(true)"
        />

        <template v-else>
          <UiCard class="asset-controls-panel">
            <div class="asset-control-row">
              <UiField :label="t('assetAmount')" class="asset-field">
                <UiInput v-model="assetAmount" type="number" min="0" step="any" :aria-label="t('assetAmount')" />
              </UiField>
              <UiField :label="t('assetSource')" class="asset-field">
                <UiSelect v-model="assetSource" :options="assetFiatOptions" :aria-label="t('assetSource')" />
              </UiField>
              <span class="update-time asset-updated">{{ updatedAtText }}</span>
            </div>
          </UiCard>

          <section class="asset-block">
            <UiSectionHead :title="t('assetFiat')" />
            <div class="asset-grid">
              <UiCard v-for="row in assetFiatRows" :key="row.code" padding="sm" class="asset-card">
                <span class="asset-code">{{ row.code }}</span>
                <span class="asset-name">{{ row.name }}</span>
                <strong class="asset-value">{{ row.display }}</strong>
              </UiCard>
            </div>
          </section>

          <section class="asset-block">
            <UiSectionHead :title="t('assetCrypto')" />
            <UiLoading v-if="cryptoLoading" :label="t('cryptoLoading')" inline />
            <UiErrorState
              v-else-if="cryptoError"
              :message="t('assetCryptoError')"
              :retry-label="t('retry')"
              @retry="loadCrypto"
            />
            <UiEmptyState v-else-if="!assetCryptoRows.length" :description="t('assetNoData')" compact />
            <div v-else class="asset-grid asset-crypto-grid">
              <UiCard v-for="row in assetCryptoRows" :key="row.id" padding="sm" class="asset-card">
                <div class="asset-crypto-head">
                  <img v-if="row.image" class="asset-icon" :src="row.image" alt="" loading="lazy" />
                  <span class="asset-code">{{ row.symbol }}</span>
                  <span class="asset-name">{{ row.name }}</span>
                </div>
                <strong class="asset-value">{{ row.display }}</strong>
                <div class="asset-meta">
                  {{ t('assetPrice') }} {{ row.priceText }} · {{ t('asset7d') }}
                  <span :class="row.changeCls">{{ row.changeText }}</span>
                </div>
              </UiCard>
            </div>
          </section>
        </template>
      </section>
    </div>
  </UiPage>
</template>

<style scoped>
.rate-board-app {
  --ok-content-width: 1100px;
}

.rb-tabs {
  margin-bottom: 0.65rem;
}

.converter-card {
  margin-bottom: 0.8rem;
}

.converter-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 0.6rem;
  align-items: end;
}

.converter-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.converter-field :deep(.ui-field-control) {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.converter-amount :deep(input) {
  font-family: var(--ok-mono);
  font-size: 1.25rem;
  font-weight: 600;
}

.swap-btn {
  border-radius: var(--ok-radius-pill);
  margin-bottom: 0.15rem;
}

.spinning {
  animation: ui-spin 0.8s linear infinite;
}

.converter-rate {
  margin-top: 0.55rem;
  font-family: var(--ok-mono);
  font-size: 0.72rem;
  color: var(--ok-muted);
}

.region-section {
  margin-top: 0.8rem;
}

.region-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 0.6rem;
}

.region-title {
  margin-bottom: 0.35rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--ok-muted);
}

.currency-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.35rem 0;
  border-top: 1px solid var(--ok-line);
}

.region-title + .currency-row {
  border-top: none;
}

.currency-main {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  min-width: 0;
}

.currency-code {
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.currency-name {
  overflow: hidden;
  color: var(--ok-muted);
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.currency-rate {
  font-family: var(--ok-mono);
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
}

.matrix-section,
.table-section {
  margin-top: 0.8rem;
}

.matrix-wrap {
  overflow-x: auto;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-control);
}

.matrix-table {
  width: 100%;
  min-width: 680px;
  border-collapse: collapse;
  font-size: 0.72rem;
}

.matrix-table th,
.matrix-table td {
  padding: 0.4rem 0.45rem;
  text-align: right;
  border-bottom: 1px solid var(--ok-line);
  white-space: nowrap;
}

.matrix-table thead th {
  background: var(--ok-bg);
  color: var(--ok-muted);
  font-weight: 600;
}

.matrix-table tbody th {
  position: sticky;
  left: 0;
  z-index: 1;
  background: var(--ok-panel);
  color: var(--ok-text);
  text-align: left;
  font-weight: 600;
  border-right: 1px solid var(--ok-line);
}

.matrix-table thead th:first-child {
  position: sticky;
  left: 0;
  z-index: 2;
}

.matrix-table tbody tr:last-child th,
.matrix-table tbody tr:last-child td {
  border-bottom: none;
}

.matrix-table td.diag {
  background: var(--ok-accent-soft);
  color: var(--ok-accent);
  font-weight: 600;
}

.table-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.table-base {
  width: 10rem;
}

.table-amount {
  width: 5.5rem;
}

.rate-table {
  max-height: 480px;
  overflow: auto;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-control);
}

.rate-head,
.rate-row {
  display: grid;
  grid-template-columns: minmax(90px, 1.1fr) 1fr 1fr 1.4fr;
  gap: 0.6rem;
  align-items: center;
  min-width: 520px;
  padding: 0.42rem 0.7rem;
}

.rate-head {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--ok-bg);
  border-bottom: 1px solid var(--ok-line);
  color: var(--ok-muted);
  font-size: 0.66rem;
  font-weight: 600;
}

.rate-row {
  border-bottom: 1px solid var(--ok-line);
  font-size: 0.78rem;
}

.rate-row:last-child {
  border-bottom: none;
}

.rate-row:hover {
  background: var(--ok-accent-soft);
}

.rate-code {
  font-weight: 600;
  white-space: nowrap;
}

.rate-val {
  font-family: var(--ok-mono);
}

.rate-converted {
  font-family: var(--ok-mono);
  font-weight: 600;
  color: var(--ok-accent);
}

.rate-name {
  overflow: hidden;
  color: var(--ok-muted);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-controls-panel {
  margin-bottom: 0.8rem;
}

.asset-control-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.6rem;
}

.asset-updated {
  margin-left: auto;
  align-self: center;
}

.asset-field {
  width: 10rem;
}

.asset-block {
  margin-top: 0.8rem;
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.5rem;
}

.asset-crypto-grid {
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
}

.asset-card :deep(.ui-card-body) {
  gap: 0.2rem;
}

.asset-code {
  color: var(--ok-text);
  font-size: 0.78rem;
  font-weight: 600;
}

.asset-name {
  overflow: hidden;
  color: var(--ok-muted);
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-value {
  color: var(--ok-text);
  font-family: var(--ok-mono);
  font-size: 0.95rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.asset-meta {
  color: var(--ok-muted);
  font-size: 0.66rem;
}

.asset-meta .up {
  color: var(--ok-up);
}

.asset-meta .down {
  color: var(--ok-down);
}

.asset-crypto-head {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.asset-crypto-head .asset-name {
  min-width: 0;
}

.asset-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 50%;
}

@media (max-width: 720px) {
  .converter-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .swap-btn {
    justify-self: center;
    transform: rotate(90deg);
    margin: 0;
  }

  .region-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .table-controls {
    width: 100%;
  }

  .table-base {
    flex: 1;
    width: auto;
  }

  .asset-control-row {
    flex-direction: column;
    align-items: stretch;
  }

  .asset-field {
    width: 100%;
  }

  .asset-updated {
    margin-left: 0;
  }
}

@media (max-width: 600px) {
  .rate-head,
  .rate-row {
    grid-template-columns: minmax(80px, 1fr) 1fr 1fr;
    min-width: 0;
  }

  .rate-head span:last-child,
  .rate-name {
    display: none;
  }

  .asset-grid {
    grid-template-columns: repeat(auto-fill, minmax(135px, 1fr));
  }

  .asset-crypto-grid {
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  }

  .converter-amount :deep(input) {
    font-size: 1.15rem;
  }
}
</style>
