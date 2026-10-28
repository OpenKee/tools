<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { UiBadge, UiButton, UiEmptyState, UiPage, UiPageHead, UiSectionHead, UiStat } from '../components/ui/index.js'
import { i18nState, useT } from '../i18n.js'
import { lsGet, lsSet } from '../ok.js'
import copy from '../copy/api-probe.js'

const t = useT(copy)

const ENDPOINTS = [
  {
    key: 'om-forecast',
    group: 'wx',
    name: 'Open-Meteo · 天气预报',
    nameEn: 'Open-Meteo · Weather forecast',
    url: 'https://api.open-meteo.com/v1/forecast?latitude=39.9&longitude=116.4&current=temperature_2m',
    apps: '旅行准备台 · 城市天气台 · 城市仪表盘',
    appsEn: 'Trip Prep · City Weather · City Dashboard',
    validate: (d) => !!(d && d.current),
  },
  {
    key: 'om-air',
    group: 'wx',
    name: 'Open-Meteo · 空气质量',
    nameEn: 'Open-Meteo · Air quality',
    url: 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=39.9&longitude=116.4&current=us_aqi',
    apps: '城市天气台 · 城市仪表盘 · 旅行准备台',
    appsEn: 'City Weather · City Dashboard · Trip Prep',
    validate: (d) => !!(d && d.current),
  },
  {
    key: 'om-archive',
    group: 'wx',
    name: 'Open-Meteo · 历史气候',
    nameEn: 'Open-Meteo · Historical climate',
    url: 'https://archive-api.open-meteo.com/v1/archive?latitude=39.9&longitude=116.4&start_date=2025-01-01&end_date=2025-01-02&daily=temperature_2m_max',
    apps: '旅行准备台（往年同期）',
    appsEn: 'Trip Prep (historical comparison)',
    validate: (d) => !!(d && d.daily),
  },
  {
    key: 'om-marine',
    group: 'wx',
    name: 'Open-Meteo · 海况',
    nameEn: 'Open-Meteo · Marine conditions',
    url: 'https://marine-api.open-meteo.com/v1/marine?latitude=22.3&longitude=114.1&current=wave_height',
    apps: '旅行准备台（海况）',
    appsEn: 'Trip Prep (marine conditions)',
    validate: (d) => !!(d && d.current),
  },

  {
    key: 'om-geo',
    group: 'geo',
    name: 'Open-Meteo · 地理编码',
    nameEn: 'Open-Meteo · Geocoding',
    url: 'https://geocoding-api.open-meteo.com/v1/search?name=Beijing&count=1',
    apps: '7+ 个页面的城市搜索',
    appsEn: 'City search on 7+ pages',
    validate: (d) => Array.isArray(d.results),
  },
  {
    key: 'ipquery',
    group: 'geo',
    name: 'ipquery.io · IP 定位兜底',
    nameEn: 'ipquery.io · IP geolocation fallback',
    url: 'https://api.ipquery.io/?format=json',
    apps: '所有"使用我的位置"按钮的降级方案',
    appsEn: 'Fallback for every "Use my location" button',
    validate: (d) => !!(d && d.location),
  },

  {
    key: 'noaa-kp',
    group: 'space',
    name: 'NOAA SWPC · Kp 指数',
    nameEn: 'NOAA SWPC · Kp index',
    url: 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
    apps: '此刻太空（今晚 / 极光）',
    appsEn: 'Space Now (Tonight / Aurora)',
    validate: (d) => Array.isArray(d),
  },
  {
    key: 'll2',
    group: 'space',
    name: 'LL2 · 火箭发射',
    nameEn: 'LL2 · Rocket launches',
    url: 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=1',
    apps: '此刻太空（发射 / 概览 / 今晚）',
    appsEn: 'Space Now (Launches / Overview / Tonight)',
    validate: (d) => Array.isArray(d.results),
  },
  {
    key: 'll2-astros',
    group: 'space',
    name: 'LL2 · 在轨宇航员',
    nameEn: 'LL2 · Astronauts in orbit',
    url: 'https://ll.thespacedevs.com/2.2.0/astronaut/?in_space=true&limit=1',
    apps: '此刻太空（空间站 / 在轨人数）',
    appsEn: 'Space Now (Space station / People in orbit)',
    validate: (d) => Array.isArray(d.results),
  },
  {
    key: 'wheretheiss',
    group: 'space',
    name: 'WhereTheISS.at · ISS 位置',
    nameEn: 'WhereTheISS.at · ISS position',
    url: 'https://api.wheretheiss.at/v1/satellites/25544',
    apps: '此刻太空（空间站 / 概览）',
    appsEn: 'Space Now (Space station / Overview)',
    validate: (d) => !!(d && d.latitude != null),
  },
  {
    key: 'tle',
    group: 'space',
    name: 'TLE API · ISS 轨道根数',
    nameEn: 'TLE API · ISS orbital elements',
    url: 'https://tle.ivanstanojevic.me/api/tle/25544',
    apps: '此刻太空（空间站 / 今晚过境）',
    appsEn: 'Space Now (Space station / Tonight passes)',
    validate: (d) => !!(d && d.line1),
  },

  {
    key: 'erapi',
    group: 'fin',
    name: 'ExchangeRate-API · 汇率',
    nameEn: 'ExchangeRate-API · Exchange rates',
    url: 'https://open.er-api.com/v6/latest/USD',
    apps: '汇率看板 · 资产快照 · 旅行准备台',
    appsEn: 'Rate Board · Asset Snapshot · Trip Prep',
    validate: (d) => !!(d && d.rates),
  },
  {
    key: 'coingecko',
    group: 'fin',
    name: 'CoinGecko · 加密行情（主源）',
    nameEn: 'CoinGecko · Crypto markets (primary)',
    url: 'https://api.coingecko.com/api/v3/ping',
    apps: '汇率看板 · 加密行情 · 资产快照（海外主源）',
    appsEn: 'Rate Board · Crypto Pulse · Asset Snapshot (international primary)',
    validate: (d) => !!(d && d.gecko_says),
  },
  {
    key: 'gateio',
    group: 'fin',
    name: 'Gate.io · 加密行情（兜底）',
    nameEn: 'Gate.io · Crypto markets (fallback)',
    url: 'https://api.gateio.ws/api/v4/spot/tickers?currency_pair=BTC_USDT',
    apps: '汇率看板 · 加密行情 · 资产快照（国内兜底）',
    appsEn: 'Rate Board · Crypto Pulse · Asset Snapshot (regional fallback)',
    validate: (d) => Array.isArray(d),
  },

  {
    key: 'nager',
    group: 'life',
    name: 'Nager.Date · 节假日',
    nameEn: 'Nager.Date · Public holidays',
    url: 'https://date.nager.at/api/v3/NextPublicHolidays/JP',
    apps: '时间与假期',
    appsEn: 'Time & Leave',
    validate: (d) => Array.isArray(d),
  },
  {
    key: 'mymemory',
    group: 'life',
    name: 'MyMemory · 翻译',
    nameEn: 'MyMemory · Translation',
    url: 'https://api.mymemory.translated.net/get?q=hi&langpair=en|zh',
    apps: '旅行准备台（常用语）',
    appsEn: 'Trip Prep (common phrases)',
    validate: (d) => !!(d && d.responseData),
  },

  {
    key: 'hn',
    group: 'content',
    name: 'Hacker News · Firebase',
    nameEn: 'Hacker News · Firebase',
    url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    apps: 'HN 阅读器',
    appsEn: 'HN Reader',
    validate: (d) => Array.isArray(d),
  },
  {
    key: 'cocktaildb',
    group: 'content',
    name: 'TheCocktailDB · 鸡尾酒',
    nameEn: 'TheCocktailDB · Cocktails',
    url: 'https://www.thecocktaildb.com/api/json/v1/1/random.php',
    apps: '鸡尾酒吧',
    appsEn: 'Cocktail Bar',
    validate: (d) => !!(d && d.drinks),
  },
  {
    key: 'mealdb',
    group: 'content',
    name: 'TheMealDB · 食谱',
    nameEn: 'TheMealDB · Recipes',
    url: 'https://www.themealdb.com/api/json/v1/1/random.php',
    apps: '美食与调酒',
    appsEn: 'Food & Drinks',
    validate: (d) => !!(d && d.meals),
  },
  {
    key: 'radiobrowser',
    group: 'content',
    name: 'Radio Browser · 电台',
    nameEn: 'Radio Browser · Radio stations',
    url: 'https://de1.api.radio-browser.info/json/stations/topclick?limit=1',
    apps: '全球电台',
    appsEn: 'Radio Atlas',
    validate: (d) => Array.isArray(d),
  },
  {
    key: 'meme',
    group: 'content',
    name: 'meme-api · 梗图',
    nameEn: 'meme-api · Memes',
    url: 'https://meme-api.com/gimme',
    apps: '梗图工坊',
    appsEn: 'Meme Forge',
    validate: (d) => !!(d && d.url),
  },

  {
    key: 'github',
    group: 'infra',
    name: 'GitHub REST',
    nameEn: 'GitHub REST',
    url: 'https://api.github.com/rate_limit',
    apps: '仓库分析台',
    appsEn: 'Repository tools',
    validate: (d) => !!(d && d.resources),
  },
  {
    key: 'jsdelivr',
    group: 'infra',
    name: 'jsDelivr CDN',
    nameEn: 'jsDelivr CDN',
    url: 'https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/package.json',
    apps: '国家百科 · 旅行准备台（静态数据集）',
    appsEn: 'Atlas Info · Trip Prep (static datasets)',
    validate: (d) => !!(d && d.name),
  },
  {
    key: 'worldbank',
    group: 'infra',
    name: 'World Bank · 人口',
    nameEn: 'World Bank · Population',
    url: 'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=1',
    apps: '国家百科',
    appsEn: 'Atlas Info',
    validate: (d) => Array.isArray(d),
  },
  {
    key: 'rawgh',
    group: 'infra',
    name: 'jsDelivr GH · 板块边界',
    nameEn: 'jsDelivr GH · Plate boundaries',
    url: 'https://cdn.jsdelivr.net/gh/fraxen/tectonicplates@master/GeoJSON/PB2002_boundaries.json',
    apps: '地震监测（板块数据）',
    appsEn: 'Earthquake monitor (plate data)',
    validate: (d) => Array.isArray(d.features),
  },
  {
    key: 'pwned',
    group: 'infra',
    name: 'Pwned Passwords · 泄露查询',
    nameEn: 'Pwned Passwords · Breach lookup',
    url: 'https://api.pwnedpasswords.com/range/AAAAA',
    apps: '开发者工具 · 密码保险箱（泄露查询）',
    appsEn: 'Dev Tools · Password Vault (breach lookup)',
    raw: true,
    validate: (d) => typeof d === 'string' && d.length > 0,
  },
  {
    key: 'qrserver',
    group: 'infra',
    name: 'qrserver · 二维码生成',
    nameEn: 'qrserver · QR code generation',
    url: 'https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=probe',
    apps: '开发者工具 · 二维码工坊（图片导出）',
    appsEn: 'Dev Tools · QR Forge (image export)',
    raw: true,
    validate: (d) => !!d,
  },
  {
    key: 'dnsgoogle',
    group: 'infra',
    name: 'AliDNS · DNS 解析（兜底）',
    nameEn: 'AliDNS · DNS lookup (fallback)',
    url: 'https://dns.alidns.com/resolve?name=example.com&type=1',
    apps: '节点情报（DNS 记录）',
    appsEn: 'Node Atlas (DNS records)',
    validate: (d) => Array.isArray(d.Answer),
  },
  {
    key: 'crtsh',
    group: 'infra',
    name: 'crt.sh · 证书透明度',
    nameEn: 'crt.sh · Certificate transparency',
    url: 'https://crt.sh/?q=example.com&output=json',
    apps: '节点情报（SSL 证书）',
    appsEn: 'Node Atlas (SSL certificates)',
    validate: (d) => Array.isArray(d),
    timeout: 15000,
  },
  {
    key: 'msl',
    group: 'infra',
    name: 'NASA MSL · 火星天气',
    nameEn: 'NASA MSL · Mars weather',
    url: 'https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json',
    apps: '此刻太空（火星 / 概览）',
    appsEn: 'Space Now (Mars / Overview)',
    timeout: 20000,
    validate: (d) => !!(d && d.soles),
  },
  {
    key: 'esri-tiles',
    group: 'infra',
    name: 'Esri · 地图瓦片',
    nameEn: 'Esri · Map tiles',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/3/4/2',
    apps: '此刻太空（空间站 / 地震底图）',
    appsEn: 'Space Now (Space station / Earthquake basemap)',
    noCors: true,
  },
]

const GROUP_ORDER = ['wx', 'geo', 'space', 'fin', 'life', 'content', 'infra']
const GROUP_NAMES = {
  wx: { en: 'Weather & air', zh: '天气与空气' },
  geo: { en: 'Location & geo', zh: '定位与地理' },
  space: { en: 'Space', zh: '太空' },
  fin: { en: 'Finance', zh: '金融' },
  life: { en: 'Travel & life', zh: '出行与生活' },
  content: { en: 'Content & media', zh: '内容与媒体' },
  infra: { en: 'Infrastructure', zh: '基础设施' },
}

const STORAGE_KEY = 'api-probe-results'
const AUTO_INTERVAL = 60000
const STALE = 30 * 60 * 1000

const results = ref({})
const probedAt = ref(0)
const probing = ref(false)
const autoOn = ref(false)
let autoTimer = null

function loadSaved() {
  const raw = lsGet(STORAGE_KEY)
  if (!raw) return false
  try {
    const saved = JSON.parse(raw)
    results.value = saved.results || {}
    const age = Date.now() - saved.time
    const validTime = Number.isFinite(saved.time) && age >= 0
    probedAt.value = validTime ? saved.time : 0
    return validTime && age < STALE
  } catch (e) {
    return false
  }
}

function saveResults() {
  lsSet(STORAGE_KEY, JSON.stringify({ time: probedAt.value, results: results.value }))
}

async function probeOne(ep) {
  const t0 = performance.now()
  try {
    const res = await fetch(ep.url, {
      signal: AbortSignal.timeout(ep.timeout || 8000),
      ...(ep.noCors ? { mode: 'no-cors' } : {}),
    })
    const ms = Math.round(performance.now() - t0)
    if (ep.noCors) return { ok: true, ms, status: 'opaque', note: 'opaque' }
    const data = ep.raw ? await res.text().catch(() => null) : await res.json().catch(() => null)
    const valid = res.ok && (!ep.validate || ep.validate(data))
    return { ok: valid, ms, status: res.status, note: res.ok && !valid ? 'bad' : '' }
  } catch (e) {
    const ms = Math.round(performance.now() - t0)
    if (/time.?out|abort/i.test(String(e))) return { ok: false, ms, status: 0, note: 'timeout' }
    return { ok: false, ms, status: 0, note: 'fail' }
  }
}

async function probeAll() {
  if (probing.value) return
  probing.value = true
  const entries = await Promise.all(ENDPOINTS.map(async (ep) => [ep.key, await probeOne(ep)]))
  const map = {}
  entries.forEach(([k, v]) => {
    map[k] = v
  })
  results.value = map
  probedAt.value = Date.now()
  probing.value = false
  saveResults()
}

function toggleAuto() {
  autoOn.value = !autoOn.value
  if (autoTimer) {
    clearInterval(autoTimer)
    autoTimer = null
  }
  if (autoOn.value) autoTimer = setInterval(probeAll, AUTO_INTERVAL)
}

const rows = computed(() => ENDPOINTS.map((ep) => ({ ep, r: results.value[ep.key] || null })))
const summary = computed(() => {
  const list = rows.value.filter((x) => x.r)
  const ok = list.filter((x) => x.r.ok).length
  const timeout = list.filter((x) => !x.r.ok && x.r.note === 'timeout').length
  return { ok, fail: list.length - ok - timeout, timeout, total: ENDPOINTS.length, done: list.length }
})
const grouped = computed(() =>
  GROUP_ORDER.map((g) => ({
    key: g,
    name: GROUP_NAMES[g][i18nState.lang === 'zh' ? 'zh' : 'en'],
    items: rows.value.filter((x) => x.ep.group === g),
  })).filter((grp) => grp.items.length),
)

function stateOf(x) {
  if (!x.r) return 'idle'
  if (x.r.ok) return 'ok'
  return x.r.note === 'timeout' ? 'warn' : 'bad'
}
function labelOf(x) {
  if (!x.r) return t.value('pending')
  if (x.r.ok) return t.value('ok')
  return x.r.note === 'timeout' ? t.value('timeout') : t.value('fail')
}
function badgeVariant(x) {
  const state = stateOf(x)
  if (state === 'ok') return 'up'
  if (state === 'warn') return 'warn'
  if (state === 'bad') return 'down'
  return 'neutral'
}
function latWidth(x) {
  if (!x.r) return '0%'
  return Math.min(100, Math.round(x.r.ms / 20)) + '%'
}

onMounted(() => {
  const fresh = loadSaved()
  if (!fresh) probeAll()
})

onBeforeUnmount(() => {
  if (autoTimer) {
    clearInterval(autoTimer)
    autoTimer = null
  }
})
</script>

<template>
  <UiPage class="api-probe" :title="{ en: 'API Probe', zh: 'API 探针' }" width="1000px" spacing="compact">
    <UiPageHead :description="t('lead')" />

    <section class="summary-strip">
      <div class="sum-grid">
        <UiStat :label="t('ok')" :value="summary.ok" tone="up" />
        <UiStat :label="t('fail')" :value="summary.fail" tone="down" />
        <UiStat :label="t('timeout')" :value="summary.timeout" tone="warn" />
      </div>
      <div class="sum-meta">
        <div class="toolbar">
          <UiButton variant="primary" :loading="probing" @click="probeAll">
            {{ probing ? t('probing') : t('probeNow') }}
          </UiButton>
          <UiButton :variant="autoOn ? 'soft' : 'secondary'" @click="toggleAuto">
            {{ t('auto') }}
          </UiButton>
        </div>
        <span v-if="probedAt" class="last-run">
          {{ t('lastRun') }}: {{ new Date(probedAt).toLocaleTimeString() }}
        </span>
      </div>
    </section>

    <UiEmptyState v-if="!summary.done" :description="t('none')" compact class="empty" />

    <section v-for="grp in grouped" :key="grp.key" class="grp">
      <UiSectionHead :title="grp.name" />
      <div v-for="x in grp.items" :key="x.ep.key" class="row">
        <div class="row-head">
          <span class="dot" :class="stateOf(x)"></span>
          <span class="ep-name">{{ i18nState.lang === 'zh' ? x.ep.name : x.ep.nameEn }}</span>
          <UiBadge :variant="badgeVariant(x)" size="sm">{{ labelOf(x) }}</UiBadge>
          <span class="lat mono" :class="stateOf(x)">
            {{ x.r ? x.r.ms + ' ms' : '—' }}
          </span>
        </div>
        <div class="row-sub">
          <a class="ep-url mono" :href="x.ep.url" target="_blank" rel="noreferrer">{{ x.ep.url }}</a>
          <span class="ep-apps">{{ i18nState.lang === 'zh' ? x.ep.apps : x.ep.appsEn }}</span>
          <span v-if="x.r?.note === 'opaque'" class="muted">{{ t('reachable') }}</span>
        </div>
        <div class="lat-bar"><span :class="stateOf(x)" :style="{ width: latWidth(x) }"></span></div>
      </div>
    </section>
    <footer class="probe-note muted">{{ t('footer') }}</footer>
  </UiPage>
</template>

<style scoped>
.summary-strip {
  display: flex;
  align-items: flex-end;
  gap: 1rem 2rem;
  flex-wrap: wrap;
  padding: 1rem 0 1.1rem;
  border-bottom: 1px solid var(--ok-line);
}

.sum-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1.4rem;
}

.sum-grid :deep(.ui-stat-value) {
  font-family: var(--ok-mono);
  font-size: 1.8rem;
  font-weight: 800;
}

.sum-meta {
  margin-left: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.45rem;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.last-run {
  font-family: var(--ok-mono);
  font-size: 0.72rem;
  color: var(--ok-muted);
}

.empty {
  margin-top: 1.2rem;
}

.grp {
  margin-top: 0.4rem;
}

.grp :deep(.ui-section-head) {
  margin: 1.1rem 0 0.15rem;
}

.grp :deep(.ui-section-title) {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--ok-accent);
}

.row {
  display: grid;
  min-width: 0;
  grid-template-columns: 1fr auto;
  gap: 0.15rem 1.2rem;
  padding: 0.65rem 0;
  border-top: 1px solid var(--ok-line);
}

.row-head {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
}

.ep-name {
  min-width: 0;
  font-size: 0.9rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.ep-url,
.ep-apps {
  min-width: 0;
  font-size: 0.72rem;
  color: var(--ok-muted);
  overflow-wrap: anywhere;
}

.row-sub {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  grid-column: 1 / -1;
  gap: 0.2rem 0.9rem;
  padding-left: 1.05rem;
}

.lat {
  margin-left: auto;
  font-family: var(--ok-mono);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  color: var(--ok-text);
}

.lat.bad,
.lat.warn {
  color: var(--ok-muted);
}

.lat-bar {
  grid-column: 1 / -1;
  height: 2px;
  overflow: hidden;
  border-radius: 1px;
  background: var(--ok-line);
  opacity: 0.7;
}

.lat-bar span {
  display: block;
  height: 100%;
}

.lat-bar span.ok {
  background: var(--ok-up);
}

.lat-bar span.bad {
  background: var(--ok-down);
}

.lat-bar span.warn {
  background: #eab308;
}

.lat-bar span.idle {
  background: transparent;
}

.dot {
  display: inline-block;
  width: 0.55rem;
  height: 0.55rem;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--ok-muted);
}

.dot.ok {
  background: var(--ok-up);
}

.dot.bad {
  background: var(--ok-down);
}

.dot.warn {
  background: #eab308;
}

.dot.idle {
  background: var(--ok-line);
}

.muted {
  color: var(--ok-muted);
}

.mono {
  font-family: var(--ok-mono);
}

@media (max-width: 720px) {
  .sum-meta {
    margin-left: 0;
    align-items: flex-start;
  }

  .row {
    grid-template-columns: 1fr auto;
  }
}
</style>
