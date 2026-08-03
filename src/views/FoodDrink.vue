<script setup>
/* ============================================================
   Food & Drink — 美食与饮品（Taste Atlas + Cocktail Bar 合并）
   数据来源：TheMealDB（食谱） + TheCocktailDB（鸡尾酒）
   Tab 切换，独立状态，共享卡片网格与弹窗详情。
   ============================================================ */

import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useT } from '../i18n.js'
import { fetchJSON } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- 国际化文案 ---------- */
const copy = {
  en: {
    eyebrow: 'TheMealDB · TheCocktailDB',
    title: 'Food & Drink',
    lead: 'Discover recipes and cocktails from around the world. Search, browse by category, or roll the dice for a random pick.',
    tabFood: 'Food',
    tabDrink: 'Drinks',
    searchPlaceholderFood: 'Search recipes…',
    searchPlaceholderDrink: 'Search cocktails…',
    search: 'Search',
    random: 'Random',
    allCategories: 'All categories',
    loading: 'Loading…',
    emptyFood: 'No recipes found.',
    emptyDrink: 'No cocktails found.',
    ingredients: 'Ingredients',
    instructions: 'Instructions',
    tags: 'Tags',
    category: 'Category',
    cuisine: 'Cuisine',
    glass: 'Glass',
    type: 'Type',
    source: 'Source',
    youtube: 'Watch on YouTube',
    fetchError: 'Failed to load. Please try again.',
    countUnit: 'items',
  },
  zh: {
    eyebrow: 'TheMealDB · TheCocktailDB',
    title: '美食与饮品',
    lead: '探索来自世界各地的食谱和鸡尾酒配方。搜索、按分类浏览，或者随机来一道。',
    tabFood: '美食',
    tabDrink: '饮品',
    searchPlaceholderFood: '搜索食谱…',
    searchPlaceholderDrink: '搜索鸡尾酒…',
    search: '搜索',
    random: '随机',
    allCategories: '全部分类',
    loading: '加载中…',
    emptyFood: '没有找到食谱。',
    emptyDrink: '没有找到鸡尾酒。',
    ingredients: '食材',
    instructions: '做法',
    tags: '标签',
    category: '分类',
    cuisine: '菜系',
    glass: '酒杯',
    type: '类型',
    source: '来源',
    youtube: '在 YouTube 观看',
    fetchError: '加载失败，请重试。',
    countUnit: '个',
  },
}

const t = useT(copy)

/* ---------- API 地址 ---------- */
const MEAL_API = 'https://www.themealdb.com/api/json/v1/1'
const DRINK_API = 'https://www.thecocktaildb.com/api/json/v1/1'

/* ---------- Tab 配置 ---------- */
const TABS = ['food', 'drink']
const activeTab = ref('food')

/* ---------- 每个 Tab 的独立状态 ---------- */
function makeTabState() {
  return {
    query: '',
    category: '',
    categories: [],
    items: [],
    statusMsg: '',
  }
}

const tabState = reactive({
  food: makeTabState(),
  drink: makeTabState(),
})

/* ---------- 共享状态 ---------- */
const loading = ref(false)
const loadError = ref(false)
const modalOpen = ref(false)
const modalItem = ref(null)
const modalCloseRef = ref(null)

/* ---------- 当前 tab 的快捷引用 ---------- */
const current = computed(() => tabState[activeTab.value])

/* ---------- 工具函数 ---------- */

// 规范化食谱（TheMealDB）
function normalizeMeal(m) {
  if (!m) return null
  const ingredients = []
  for (let i = 1; i <= 20; i++) {
    const ing = m['strIngredient' + i]
    const meas = m['strMeasure' + i]
    if (ing && ing.trim()) {
      ingredients.push({ name: ing.trim(), measure: (meas || '').trim() })
    }
  }
  return {
    id: m.idMeal,
    name: m.strMeal,
    thumb: m.strMealThumb,
    category: m.strCategory || '',
    area: m.strArea || '',
    tags: (m.strTags || '').split(',').filter(Boolean),
    instructions: m.strInstructions || '',
    youtube: m.strYoutube || '',
    source: m.strSource || '',
    ingredients,
    _type: 'food',
  }
}

// 规范化鸡尾酒（TheCocktailDB）
function normalizeDrink(d, fallbackCategory) {
  if (!d) return null
  const ingredients = []
  for (let i = 1; i <= 15; i++) {
    const ing = d['strIngredient' + i]
    const meas = d['strMeasure' + i]
    if (ing && String(ing).trim()) {
      ingredients.push({ name: String(ing).trim(), measure: (meas || '').trim() })
    }
  }
  return {
    id: d.idDrink,
    name: d.strDrink,
    thumb: d.strDrinkThumb,
    category: d.strCategory || fallbackCategory || '',
    alcoholic: d.strAlcoholic || '',
    glass: d.strGlass || '',
    instructions: d.strInstructions || '',
    ingredients,
    _type: 'drink',
  }
}

/* ---------- 初始化分类 ---------- */
async function initCategories(tab) {
  const api = tab === 'food' ? MEAL_API : DRINK_API
  const path = tab === 'food' ? '/list.php?c=list' : '/list.php?c=list'
  try {
    const data = await fetchJSON(api + path, { timeout: 10000 })
    const key = tab === 'food' ? 'meals' : 'drinks'
    const nameKey = tab === 'food' ? 'strCategory' : 'strCategory'
    const raw = (data && data[key]) || []
    tabState[tab].categories = raw.map((c) => c[nameKey]).filter(Boolean).sort()
  } catch (e) {
    console.warn('Failed to load categories for', tab, e)
  }
}

/* ---------- 加载列表 ---------- */
async function loadItems(tab, path, fallbackCategory) {
  loading.value = true
  loadError.value = false
  const state = tabState[tab]
  state.items = []
  const api = tab === 'food' ? MEAL_API : DRINK_API
  try {
    const data = await fetchJSON(api + path, { timeout: 15000 })
    const key = tab === 'food' ? 'meals' : 'drinks'
    const raw = (data && data[key]) || []
    const normalize = tab === 'food' ? normalizeMeal : (d) => normalizeDrink(d, fallbackCategory)
    state.items = raw.map(normalize).filter(Boolean)
    state.statusMsg = state.items.length ? state.items.length + ' ' + t.value('countUnit') : ''
  } catch (e) {
    loadError.value = true
    state.statusMsg = t.value('fetchError')
    console.warn('Load failed for', tab, e)
  } finally {
    loading.value = false
  }
}

function searchItems(tab, q) {
  const state = tabState[tab]
  state.category = ''
  if (!q) {
    loadItems(tab, tab === 'food' ? '/search.php?s=' : '/search.php?f=a')
  } else {
    loadItems(tab, '/search.php?s=' + encodeURIComponent(q))
  }
}

function filterByCategory(tab, cat) {
  const state = tabState[tab]
  state.query = ''
  if (cat) {
    const path = tab === 'food'
      ? '/filter.php?c=' + encodeURIComponent(cat)
      : '/filter.php?c=' + encodeURIComponent(cat)
    loadItems(tab, path, cat)
  } else {
    searchItems(tab, '')
  }
}

/* ---------- 随机 ---------- */
async function randomItem(tab) {
  loading.value = true
  const api = tab === 'food' ? MEAL_API : DRINK_API
  const path = tab === 'food' ? '/random.php' : '/random.php'
  try {
    const data = await fetchJSON(api + path, { timeout: 15000 })
    const key = tab === 'food' ? 'meals' : 'drinks'
    const raw = (data && data[key]) || []
    const normalize = tab === 'food' ? normalizeMeal : normalizeDrink
    const items = raw.map(normalize).filter(Boolean)
    if (items.length) {
      const state = tabState[tab]
      state.items = items
      state.statusMsg = '1 ' + t.value('countUnit')
      state.query = ''
      state.category = ''
      openModal(items[0])
    }
  } catch (e) {
    console.warn('Random failed for', tab, e)
  } finally {
    loading.value = false
  }
}

/* ---------- 加载详情 ---------- */
async function loadDetail(tab, id) {
  loading.value = true
  const api = tab === 'food' ? MEAL_API : DRINK_API
  const param = tab === 'food' ? 'i' : 'i'
  try {
    const data = await fetchJSON(api + '/lookup.php?' + param + '=' + encodeURIComponent(id), { timeout: 15000 })
    const key = tab === 'food' ? 'meals' : 'drinks'
    const raw = (data && data[key]) || []
    const normalize = tab === 'food' ? normalizeMeal : (d) => normalizeDrink(d, tabState[tab].category)
    const items = raw.map(normalize).filter(Boolean)
    if (items.length) openModal(items[0])
  } catch (e) {
    console.warn('Detail failed', e)
  } finally {
    loading.value = false
  }
}

/* ---------- 弹窗 ---------- */
function openModal(item) {
  modalItem.value = item
  modalOpen.value = true
  document.body.style.overflow = 'hidden'
  nextTick(() => modalCloseRef.value?.focus())
}

function closeModal() {
  modalOpen.value = false
  document.body.style.overflow = ''
}

/* ---------- 事件处理 ---------- */
function onSearchSubmit() {
  searchItems(activeTab.value, current.value.query.trim())
}

function onRandomClick() {
  randomItem(activeTab.value)
}

function onCategoryChange() {
  filterByCategory(activeTab.value, current.value.category)
}

function onCardClick(item) {
  loadDetail(item._type, item.id)
}

function onCardKeydown(e, item) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    loadDetail(item._type, item.id)
  }
}

function onDocKeydown(e) {
  if (e.key === 'Escape' && modalOpen.value) closeModal()
}

/* ---------- Tab 切换：切换时自动初始化分类 ---------- */
function switchTab(tab) {
  activeTab.value = tab
  const state = tabState[tab]
  // 首次切换时初始化分类和加载数据
  if (!state.categories.length) {
    initCategories(tab)
  }
  if (!state.items.length) {
    searchItems(tab, '')
  }
}

/* ---------- 生命周期 ---------- */
onMounted(() => {
  initCategories('food')
  searchItems('food', '')
  document.addEventListener('keydown', onDocKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="fd-app">
    <AppHeader :title="t('title')" :show-lang-toggle="true" />

    <main class="shell">
      <!-- 页头 -->
      <header class="masthead">
        <p class="eyebrow">{{ t('eyebrow') }}</p>
        <h1>{{ t('title') }}</h1>
        <p class="lead">{{ t('lead') }}</p>
      </header>

      <!-- Tab 切换 -->
      <div class="tabs" role="tablist">
        <button
          v-for="tab in TABS"
          :key="tab"
          class="tab-btn"
          :class="{ active: activeTab === tab }"
          role="tab"
          :aria-selected="activeTab === tab"
          type="button"
          @click="switchTab(tab)"
        >{{ t('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)) }}</button>
      </div>

      <!-- 控制栏 -->
      <section class="controls">
        <form class="search-row" @submit.prevent="onSearchSubmit">
          <input
            v-model="current.query"
            type="text"
            :placeholder="activeTab === 'food' ? t('searchPlaceholderFood') : t('searchPlaceholderDrink')"
            autocomplete="off"
          />
          <button type="submit">{{ t('search') }}</button>
          <button type="button" class="btn-ghost" @click="onRandomClick">{{ t('random') }}</button>
        </form>
        <div class="filter-row">
          <select
            v-model="current.category"
            class="filter-select"
            @change="onCategoryChange"
          >
            <option value="">{{ t('allCategories') }}</option>
            <option v-for="c in current.categories" :key="c" :value="c">{{ c }}</option>
          </select>
          <span class="status-note">{{ current.statusMsg }}</span>
        </div>
      </section>

      <!-- 加载中 -->
      <div v-if="loading" class="ok-loading">
        <span class="ok-spinner"></span>
        <span>{{ t('loading') }}</span>
      </div>

      <!-- 卡片网格 -->
      <div class="item-grid">
        <article
          v-for="item in current.items"
          :key="item._type + '-' + item.id"
          class="item-card"
          tabindex="0"
          @click="onCardClick(item)"
          @keydown="onCardKeydown($event, item)"
        >
          <img :src="item.thumb" :alt="item.name" loading="lazy" />
          <div class="card-body">
            <div class="card-title">{{ item.name }}</div>
            <div class="card-meta">
              <span v-if="item.category" class="card-tag">{{ item.category }}</span>
              <span v-if="item.area" class="card-sub">{{ item.area }}</span>
              <span v-if="item.alcoholic" class="card-sub">{{ item.alcoholic }}</span>
            </div>
          </div>
        </article>
      </div>

      <!-- 空状态 -->
      <div v-if="!current.items.length && !loading && !loadError" class="empty-state">
        {{ activeTab === 'food' ? t('emptyFood') : t('emptyDrink') }}
      </div>

      <!-- 数据来源 -->
      <div class="data-source">
        {{ activeTab === 'food' ? 'Data: TheMealDB' : 'Data: TheCocktailDB' }}
      </div>
    </main>

    <!-- 详情弹窗 -->
    <div v-if="modalOpen" class="modal">
      <div class="modal-backdrop" @click="closeModal"></div>
      <div class="modal-panel" role="dialog" aria-modal="true">
        <button
          ref="modalCloseRef"
          class="modal-close"
          type="button"
          aria-label="Close"
          @click="closeModal"
        >×</button>
        <div v-if="modalItem" class="modal-body">
          <div class="modal-hero">
            <img :src="modalItem.thumb" :alt="modalItem.name" />
          </div>
          <h2 class="modal-title">{{ modalItem.name }}</h2>
          <div class="modal-meta">
            <span v-if="modalItem.category"><strong>{{ t('category') }}:</strong> {{ modalItem.category }}</span>
            <span v-if="modalItem.area"><strong>{{ t('cuisine') }}:</strong> {{ modalItem.area }}</span>
            <span v-if="modalItem.glass"><strong>{{ t('glass') }}:</strong> {{ modalItem.glass }}</span>
            <span v-if="modalItem.alcoholic"><strong>{{ t('type') }}:</strong> {{ modalItem.alcoholic }}</span>
          </div>
          <div class="modal-section">
            <h3>{{ t('ingredients') }}</h3>
            <ul class="ingredient-list">
              <li v-for="(ing, i) in modalItem.ingredients" :key="i">
                <span class="ing-name">{{ ing.name }}</span>
                <span v-if="ing.measure" class="ing-measure"> — {{ ing.measure }}</span>
              </li>
            </ul>
          </div>
          <div class="modal-section">
            <h3>{{ t('instructions') }}</h3>
            <p class="instructions">{{ modalItem.instructions || '' }}</p>
          </div>
          <div v-if="modalItem._type === 'food' && modalItem.tags && modalItem.tags.length" class="modal-section">
            <h3>{{ t('tags') }}</h3>
            <div class="modal-tags">
              <span v-for="(tag, i) in modalItem.tags" :key="i">{{ tag }}</span>
            </div>
          </div>
          <div v-if="modalItem._type === 'food' && (modalItem.youtube || modalItem.source)" class="modal-section">
            <a v-if="modalItem.youtube" class="modal-link" :href="modalItem.youtube" target="_blank" rel="noreferrer">{{ t('youtube') }} ↗</a>
            <span v-if="modalItem.youtube && modalItem.source"> · </span>
            <a v-if="modalItem.source" class="modal-link" :href="modalItem.source" target="_blank" rel="noreferrer">{{ t('source') }} ↗</a>
          </div>
        </div>
      </div>
    </div>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Food & Drink — 统一温暖深色主题
   ============================================================ */

.fd-app {
  --bg: #15100b;
  --surface: #201812;
  --surface-2: #2f2318;
  --text: #fff5e6;
  --text-muted: #c2a98c;
  --border: #4a3a2a;
  --accent: #f59e0b;
  --accent-soft: rgba(245, 158, 11, 0.14);
  color-scheme: dark;

  --ok-bg: var(--bg);
  --ok-panel: var(--surface);
  --ok-text: var(--text);
  --ok-muted: var(--text-muted);
  --ok-line: var(--border);
  --ok-accent: var(--accent);
  --ok-accent-soft: var(--accent-soft);
  --ok-radius: 14px;
  --ok-shadow: 0 10px 32px rgba(0, 0, 0, 0.45);
  --ok-topbar-line: var(--border);
  --ok-footer-line: var(--border);
  --ok-footer-text: var(--text-muted);
  --ok-footer-link: var(--accent);

  --ok-font: "Outfit", system-ui, -apple-system, sans-serif;
  --ok-mono: "IBM Plex Mono", "SFMono-Regular", Menlo, monospace;

  margin: 0;
  font-family: var(--ok-font);
  color: var(--text);
  background:
    radial-gradient(1200px 700px at 88% -12%, rgba(245, 158, 11, 0.12), transparent 60%),
    radial-gradient(900px 600px at 5% -5%, rgba(239, 68, 68, 0.08), transparent 55%),
    var(--bg);
  background-attachment: fixed;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, p, strong, span, small { margin: 0; }

.fd-app :deep(.ok-topbar) {
  justify-content: space-between;
  background: rgba(21, 16, 11, 0.78);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 20;
}

.shell {
  width: min(1100px, calc(100% - 2rem));
  margin: 0 auto;
  padding: 1.2rem 0 4rem;
}

/* ---------- 页头 ---------- */
.masthead { padding: 1.5rem 0 0.8rem; }
.eyebrow {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--accent);
  font-weight: 600;
}
h1 {
  margin-top: 0.45rem;
  font-size: clamp(2.2rem, 5vw, 3.2rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}
.lead {
  margin-top: 0.5rem;
  color: var(--text-muted);
  font-size: 0.95rem;
  max-width: 58ch;
  line-height: 1.55;
}

/* ---------- Tab 切换 ---------- */
.tabs {
  display: flex;
  gap: 0.25rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--border);
}
.tab-btn {
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.5rem 1.2rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.tab-btn:hover {
  color: var(--text);
  border-color: var(--accent);
}
.tab-btn.active {
  background: var(--accent);
  color: #15100b;
  border-color: var(--accent);
}

/* ---------- 控制栏 ---------- */
.controls {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1rem 0 1.2rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1.2rem;
}

.search-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.search-row input {
  flex: 1;
  min-width: 220px;
  font: inherit;
  height: 2.6rem;
  padding: 0 0.9rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  outline: none;
}
.search-row input::placeholder { color: var(--text-muted); }
.search-row input:focus { border-color: var(--accent); }
.search-row button {
  font: inherit;
  height: 2.6rem;
  padding: 0 1.1rem;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #15100b;
  font-weight: 600;
  cursor: pointer;
}
.search-row button.btn-ghost {
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--accent);
}
.search-row button.btn-ghost:hover {
  background: var(--accent-soft);
}

.filter-row {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  flex-wrap: wrap;
}
.filter-select {
  font: inherit;
  height: 2.2rem;
  padding: 0 0.7rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  max-width: 100%;
}
.filter-select:focus { border-color: var(--accent); outline: none; }
.status-note {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* ---------- 卡片网格 ---------- */
.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.item-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--ok-radius);
  overflow: hidden;
  cursor: pointer;
  transition: transform 150ms, box-shadow 150ms, border-color 150ms;
}
.item-card:hover,
.item-card:focus-visible {
  transform: translateY(-3px);
  box-shadow: var(--ok-shadow);
  border-color: var(--accent);
  outline: none;
}
.item-card img {
  width: 100%;
  height: 155px;
  object-fit: cover;
  display: block;
}
.card-body {
  padding: 0.85rem;
}
.card-title {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.25;
}
.card-meta {
  margin-top: 0.35rem;
  font-size: 0.74rem;
  color: var(--text-muted);
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  align-items: center;
}
.card-tag {
  font-size: 0.65rem;
  padding: 0.15rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--accent);
}
.card-sub {
  font-size: 0.72rem;
  color: var(--text-muted);
}

/* ---------- 空状态 ---------- */
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-muted);
  font-size: 0.95rem;
}

.data-source {
  margin-top: 1.5rem;
  font-size: 0.72rem;
  color: var(--text-muted);
  letter-spacing: 0.03em;
}

/* ---------- Modal ---------- */
.modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(4px);
}
.modal-panel {
  position: relative;
  width: min(720px, 100%);
  max-height: calc(100vh - 2rem);
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--ok-radius);
  box-shadow: var(--ok-shadow);
}
.modal-close {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--text);
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
  z-index: 5;
}
.modal-close:hover { border-color: var(--accent); color: var(--accent); }
.modal-body { padding: 0; }

.modal-hero {
  position: relative;
  height: 220px;
}
.modal-hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.modal-hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, var(--surface) 0%, transparent 70%);
}
.modal-title {
  padding: 0 1.4rem;
  margin-top: -2.5rem;
  position: relative;
  z-index: 2;
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1.15;
}
.modal-meta {
  padding: 0.6rem 1.4rem 0;
  display: flex;
  gap: 0.5rem 1rem;
  flex-wrap: wrap;
  color: var(--text-muted);
  font-size: 0.78rem;
}
.modal-meta strong { color: var(--text); font-weight: 600; margin-right: 0.2rem; }
.modal-section {
  padding: 1rem 1.4rem;
  border-top: 1px solid var(--border);
  margin-top: 0.8rem;
}
.modal-section h3 {
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  margin-bottom: 0.6rem;
}
.ingredient-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.35rem 1rem;
  font-size: 0.88rem;
}
.ingredient-list li { color: var(--text-muted); }
.ingredient-list .ing-name { color: var(--text); }
.ingredient-list .ing-measure {
  color: var(--text-muted);
  font-family: var(--ok-mono);
  font-size: 0.82rem;
}
.instructions {
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--text-muted);
  white-space: pre-line;
}
.modal-tags {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.modal-tags span {
  font-size: 0.7rem;
  padding: 0.15rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
}
.modal-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.82rem;
  color: var(--accent);
  text-decoration: none;
}

/* ---------- 响应式 ---------- */
@media (max-width: 640px) {
  .item-grid { grid-template-columns: repeat(2, 1fr); gap: 0.7rem; }
  .item-card img { height: 115px; }
  .modal-hero { height: 170px; }
  .modal-title { font-size: 1.3rem; }
}
</style>