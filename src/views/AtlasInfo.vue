<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ============================================================
   Atlas Info — 国家百科
   数据来源：world-countries（jsDelivr CDN）+ World Bank API
   ============================================================ */

/* ---------- 文案字典（中英双语） ---------- */
const copy = {
  en: {
    eyebrow: 'Country encyclopedia',
    title: 'Atlas Info',
    lead: 'Search any country. Flag, population, languages, currencies, borders — via World Bank + jsDelivr.',
    search: 'Search',
    capital: 'Capital',
    population: 'Population',
    region: 'Region',
    subregion: 'Subregion',
    languages: 'Languages',
    currencies: 'Currencies',
    borders: 'Borders',
    openMaps: 'Google Maps',
    openOSM: 'OpenStreetMap',
    none: 'None',
    countries: 'countries'
  },
  zh: {
    eyebrow: '国家百科',
    title: '国家百科',
    lead: '搜索任意国家。国旗、人口、语言、货币、边境 — 通过 World Bank + jsDelivr。',
    search: '搜索',
    capital: '首都',
    population: '人口',
    region: '地区',
    subregion: '子地区',
    languages: '语言',
    currencies: '货币',
    borders: '边境',
    openMaps: 'Google 地图',
    openOSM: 'OpenStreetMap',
    none: '无',
    countries: '个国家'
  }
}

const t = useT(copy)

/* ---------- 地区筛选常量 ---------- */
const REGIONS = [
  { k: '', l: { en: 'All', zh: '全部' } },
  { k: 'africa', l: { en: 'Africa', zh: '非洲' } },
  { k: 'americas', l: { en: 'Americas', zh: '美洲' } },
  { k: 'asia', l: { en: 'Asia', zh: '亚洲' } },
  { k: 'europe', l: { en: 'Europe', zh: '欧洲' } },
  { k: 'oceania', l: { en: 'Oceania', zh: '大洋洲' } }
]

/* ---------- 响应式状态 ---------- */
const allCountries = ref([])      // 全部国家数据
const activeRegion = ref('')      // 当前选中地区
const searchQuery = ref('')       // 搜索输入
const selectedCode = ref(null)    // 当前查看详情的国家 cca3
const errorMsg = ref('')          // 加载错误信息
const detailRef = ref(null)       // 详情卡片引用，用于滚动定位

/* ---------- 工具函数：数字千分位格式化 ---------- */
function num(n) { return new Intl.NumberFormat().format(n) }

/* ---------- 派生：搜索框占位符（随语言切换） ---------- */
const searchPlaceholder = computed(() =>
  i18nState.lang === 'en' ? 'Search country…' : '搜索国家…'
)

/* ---------- 派生：按地区 + 关键词过滤后的国家列表 ---------- */
const filteredCountries = computed(() => {
  const q = searchQuery.value.toLowerCase()
  let list = allCountries.value
  if (activeRegion.value) {
    list = list.filter(c => c.region?.toLowerCase() === activeRegion.value)
  }
  if (q) {
    list = list.filter(c =>
      (c.name?.common || '').toLowerCase().includes(q) ||
      (c.name?.official || '').toLowerCase().includes(q)
    )
  }
  return list
})

/* ---------- 派生：当前选中的国家对象 ---------- */
const selectedCountry = computed(() =>
  allCountries.value.find(x => x.cca3 === selectedCode.value) || null
)

/* ---------- 派生：详情卡片数据（语言、货币、地图链接等） ---------- */
const detail = computed(() => {
  const c = selectedCountry.value
  if (!c) return null
  // 语言列表
  const langs = c.languages ? Object.values(c.languages).join(', ') : '—'
  // 货币列表
  const currs = c.currencies
    ? Object.values(c.currencies).map(x => x.name + ' (' + (x.symbol || '') + ')').join(', ')
    : '—'
  // 经纬度用于地图链接
  const lat = c.latlng?.[0]
  const lng = c.latlng?.[1]
  const hasCoords = lat != null && lng != null
  return {
    flag: c.flag || '',
    name: c.name?.common || '',
    official: c.name?.official || '',
    items: [
      { label: t.value('capital'), value: c.capital?.[0] || '—' },
      { label: t.value('population'), value: num(c.population || 0) },
      { label: t.value('region'), value: c.region || '—' },
      { label: t.value('subregion'), value: c.subregion || '—' },
      { label: t.value('languages'), value: langs },
      { label: t.value('currencies'), value: currs }
    ],
    gMap: hasCoords ? 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng : '#',
    osm: hasCoords ? 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lng + '#map=5/' + lat + '/' + lng : '#'
  }
})

/* ---------- 派生：邻国列表（带国旗与名称，找不到时回退为代码） ---------- */
const borders = computed(() => {
  const c = selectedCountry.value
  if (!c || !c.borders || !c.borders.length) return []
  return c.borders.map(code => {
    const bc = allCountries.value.find(x => x.cca3 === code)
    return { code, flag: bc?.flag || '', name: bc?.name?.common || code }
  })
})

/* ---------- 选择地区 ---------- */
function selectRegion(k) {
  activeRegion.value = k
}

/* ---------- 显示国家详情（邻国按钮点击复用同一函数） ---------- */
function showDetail(code) {
  selectedCode.value = code
  // 等待 DOM 更新后滚动到详情卡片
  nextTick(() => {
    detailRef.value?.scrollIntoView({ behavior: 'smooth' })
  })
}

/* ---------- 加载全部国家数据 ---------- */
async function loadAll() {
  try {
    // 使用共享 fetchJSON（带超时和状态检查）
    const [countries, popData] = await Promise.all([
      fetchJSON('https://cdn.jsdelivr.net/npm/world-countries@5.1.0/countries.json'),
      fetchJSON('https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=300&date=2023')
    ])
    if (!Array.isArray(countries)) throw new Error('countries not array')
    // 构建 cca3 -> 人口 的映射
    const popMap = {}
    if (Array.isArray(popData) && popData.length > 1) {
      popData[1].forEach(item => {
        if (item.countryiso3code && item.value) popMap[item.countryiso3code] = item.value
      })
    }
    // 合并人口数据并按常见名称排序
    const data = countries.map(c => ({ ...c, population: popMap[c.cca3] || 0 }))
    allCountries.value = data.sort((a, b) =>
      (a.name?.common || '').localeCompare(b.name?.common || '')
    )
  } catch (e) {
    errorMsg.value = e.message
  }
}

/* ---------- 生命周期：挂载时加载数据 ---------- */
onMounted(() => {
  loadAll()
})
</script>

<template>
  <div class="atlas-info">
    <!-- 顶部栏：标题 + 语言切换（语言切换由 AppHeader 内部处理） -->
    <AppHeader :title="t('title')" />

    <main class="shell">
      <!-- 页头说明 -->
      <header class="masthead">
        <p class="eyebrow">{{ t('eyebrow') }}</p>
        <p class="lead">{{ t('lead') }}</p>
      </header>

      <!-- 搜索框 -->
      <section class="search">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="searchPlaceholder"
          autocomplete="off"
          aria-label="Search country"
        />
        <button type="button">{{ t('search') }}</button>
      </section>

      <!-- 地区筛选栏 -->
      <div class="region-bar">
        <button
          v-for="r in REGIONS"
          :key="r.k"
          type="button"
          class="region-btn"
          :class="{ active: activeRegion === r.k }"
          @click="selectRegion(r.k)"
        >{{ r.l[i18nState.lang] }}</button>
      </div>

      <!-- 结果计数 -->
      <div class="result-count">{{ filteredCountries.length }} {{ t('countries') }}</div>

      <!-- 加载错误 -->
      <div v-if="errorMsg" class="grid-error">{{ errorMsg }}</div>

      <!-- 国家网格 -->
      <div v-else class="country-grid">
        <div
          v-for="c in filteredCountries"
          :key="c.cca3"
          class="country-mini"
          @click="showDetail(c.cca3)"
        >
          <span class="c-flag">{{ c.flag || '' }}</span>
          <div>
            <div class="c-name">{{ c.name?.common || '' }}</div>
            <div class="c-sub">{{ c.region || '' }} · {{ num(c.population || 0) }}</div>
          </div>
        </div>
      </div>

      <!-- 国家详情卡片 -->
      <div v-if="detail" ref="detailRef" class="detail-card">
        <div class="card">
          <div class="flag">{{ detail.flag }}</div>
          <div class="info">
            <h2>{{ detail.name }}</h2>
            <div class="native">{{ detail.official }}</div>
            <div class="grid">
              <div v-for="item in detail.items" :key="item.label" class="item">
                <div class="i-label">{{ item.label }}</div>
                <div class="i-val">{{ item.value }}</div>
              </div>
            </div>
            <div class="borders">
              <h3>{{ t('borders') }}</h3>
              <div class="border-chips">
                <span v-if="!borders.length" class="no-border">{{ t('none') }}</span>
                <button
                  v-for="b in borders"
                  :key="b.code"
                  type="button"
                  class="border-chip"
                  @click="showDetail(b.code)"
                >{{ b.flag }} {{ b.name }}</button>
              </div>
            </div>
            <div class="map-link">
              <a :href="detail.gMap" target="_blank" rel="noreferrer">{{ t('openMaps') }} ↗</a>
              ·
              <a :href="detail.osm" target="_blank" rel="noreferrer">{{ t('openOSM') }} ↗</a>
            </div>
          </div>
        </div>
      </div>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Atlas Info — 国家百科样式
   原版 :root 变量映射到组件根类 .atlas-info 上。
   ============================================================ */

.atlas-info {
  /* 主题变量 */
  --bg: #0c1220;
  --panel: rgba(16, 28, 48, 0.6);
  --line: rgba(100, 160, 255, 0.1);
  --text: #d8e4f0;
  --muted: #6888b0;
  --accent: #4090ff;
  --green: #40d080;
  --gold: #f0c040;

  /* 映射到共享设计 token */
  --ok-bg: var(--bg);
  --ok-panel: var(--panel);
  --ok-line: var(--line);
  --ok-text: var(--text);
  --ok-muted: var(--muted);
  --ok-accent: var(--accent);
  --ok-footer-line: var(--line);
  --ok-footer-text: var(--muted);
  --ok-footer-link: var(--accent);
  --ok-topbar-line: rgba(100, 160, 255, 0.08);

  font-family: "Inter", system-ui, sans-serif;
  color: var(--text);
  background: var(--bg);
  color-scheme: dark;
}

.atlas-info h2,
.atlas-info h3,
.atlas-info p,
.atlas-info strong,
.atlas-info span {
  margin: 0;
}

.atlas-info a {
  color: var(--accent);
  text-decoration: none;
}

/* ---------- 主容器 ---------- */
.shell {
  width: min(1000px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1rem 0 4rem;
}

/* ---------- 页头 ---------- */
.masthead {
  padding: 0.3rem 0 1rem;
  border-bottom: 1px solid var(--line);
}

.eyebrow {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--accent);
  font-weight: 600;
}

.lead {
  margin-top: 0.5rem;
  color: var(--muted);
  font-size: 0.88rem;
}

/* ---------- 搜索框 ---------- */
.search {
  margin-top: 0.8rem;
  display: flex;
  gap: 0.5rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--line);
}

.search input {
  flex: 1;
  font: inherit;
  height: 2.4rem;
  padding: 0 0.7rem;
  border: 1px solid var(--line);
  background: rgba(16, 28, 48, 0.5);
  color: var(--text);
  font-size: 0.9rem;
}

.search button {
  font: inherit;
  height: 2.4rem;
  padding: 0 1rem;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: white;
  cursor: pointer;
  font-weight: 600;
}

/* ---------- 地区筛选栏 ---------- */
.region-bar {
  display: flex;
  gap: 0.3rem;
  margin-top: 0.4rem;
  flex-wrap: wrap;
}

.region-btn {
  font: inherit;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--line);
  background: transparent;
  cursor: pointer;
  font-size: 0.76rem;
  color: var(--muted);
  border-radius: 12px;
}

.region-btn.active {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(64, 144, 255, 0.1);
}

/* ---------- 国家网格 ---------- */
.result-count {
  font-size: 0.72rem;
  color: var(--muted);
  margin-top: 0.5rem;
}

.grid-error {
  padding: 2rem;
  text-align: center;
  color: var(--muted);
}

.country-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.5rem;
  margin-top: 0.8rem;
}

.country-mini {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem;
  border: 1px solid var(--line);
  cursor: pointer;
  border-radius: 6px;
  transition: all 150ms;
}

.country-mini:hover {
  border-color: var(--accent);
  background: var(--panel);
}

.country-mini .c-flag {
  font-size: 1.3rem;
}

.country-mini .c-name {
  font-size: 0.82rem;
  font-weight: 500;
}

.country-mini .c-sub {
  font-size: 0.68rem;
  color: var(--muted);
}

/* ---------- 详情卡片 ---------- */
.detail-card {
  margin-top: 1rem;
}

.card {
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 1.2rem;
  border-radius: 8px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1.2rem;
  align-items: start;
}

.flag {
  font-size: 3.5rem;
  line-height: 1;
}

.info h2 {
  font-size: 1.4rem;
  font-weight: 700;
}

.info .native {
  font-size: 0.82rem;
  color: var(--muted);
  margin-top: 0.15rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.6rem;
  margin-top: 1rem;
}

.item .i-label {
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.item .i-val {
  font-weight: 600;
  font-size: 0.9rem;
  margin-top: 0.1rem;
}

/* ---------- 邻国 ---------- */
.borders {
  margin-top: 1rem;
}

.borders h3 {
  font-size: 0.82rem;
  color: var(--muted);
  margin-bottom: 0.4rem;
}

.border-chips {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.no-border {
  font-size: 0.76rem;
  color: var(--muted);
}

.border-chip {
  font: inherit;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--line);
  background: transparent;
  cursor: pointer;
  font-size: 0.76rem;
  border-radius: 4px;
  color: var(--text);
}

.border-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ---------- 地图链接 ---------- */
.map-link {
  margin-top: 0.8rem;
  font-size: 0.78rem;
}

/* ---------- 响应式 ---------- */
@media (max-width: 700px) {
  .card {
    grid-template-columns: 1fr;
  }

  .flag {
    font-size: 2.5rem;
  }

  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
