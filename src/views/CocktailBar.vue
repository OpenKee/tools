<script setup>
/* ============================================================
   Cocktail Bar — 鸡尾酒配方搜索（Vue 3 SFC）
   数据来源：TheCocktailDB（免费公开 API，无需 key，支持 CORS）
   ============================================================ */

import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useT } from '../i18n.js'
import { fetchJSON } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- 国际化文案（中英双语） ---------- */
const copy = {
  en: {
    eyebrow: 'TheCocktailDB · Mixology',
    title: 'Cocktail Bar',
    lead: 'Search hundreds of cocktail recipes. Browse by category, look up a name, or shake things up with a random pick.',
    searchPlaceholder: 'Search cocktails…',
    search: 'Search',
    random: 'Random',
    allCategories: 'All categories',
    loading: 'Loading…',
    empty: 'No cocktails found.',
    ingredients: 'Ingredients',
    instructions: 'Instructions',
    category: 'Category',
    glass: 'Glass',
    type: 'Type',
    dataSource: 'Data: TheCocktailDB',
    allProjects: 'All projects ↗',
    fetchError: 'Failed to load cocktails.',
    countUnit: 'drinks',
  },
  zh: {
    eyebrow: 'TheCocktailDB · 调酒配方',
    title: '鸡尾酒酒吧',
    lead: '搜索数百款鸡尾酒配方。按分类浏览、按名称查找，或者随机来一杯。',
    searchPlaceholder: '搜索鸡尾酒…',
    search: '搜索',
    random: '随机',
    allCategories: '全部分类',
    loading: '加载中…',
    empty: '没有找到鸡尾酒。',
    ingredients: '材料',
    instructions: '做法',
    category: '分类',
    glass: '酒杯',
    type: '类型',
    dataSource: '数据：TheCocktailDB',
    allProjects: '全部项目 ↗',
    fetchError: '鸡尾酒加载失败。',
    countUnit: '款',
  },
}

// useT 返回 computed，模板中 t('key') 取翻译，语言切换自动响应
const t = useT(copy)

/* ---------- API 地址 ---------- */
const API_BASE = 'https://www.thecocktaildb.com/api/json/v1/1'

/* ---------- 响应式状态 ---------- */
const searchQuery = ref('')        // 搜索框文本
const selectedCategory = ref('')   // 选中的分类（兼作 activeCategory，用作 filter.php 结果的 fallback 分类）
const categories = ref([])         // 分类下拉选项（来自 list.php?c=list）
const currentDrinks = ref([])      // 当前网格中的鸡尾酒列表
const loading = ref(false)         // 加载中标记
const statusMsg = ref('')          // 状态提示文案（数量 / 错误信息）
const modalDrink = ref(null)       // 弹窗中展示的鸡尾酒详情
const modalOpen = ref(false)       // 弹窗是否打开
const modalCloseRef = ref(null)    // 弹窗关闭按钮引用（用于无障碍聚焦）

/* ---------- 派生状态 ---------- */
// 空状态：非加载中且当前无鸡尾酒时显示
const showEmptyState = computed(() => !loading.value && !currentDrinks.value.length)

/* ---------- 副作用：弹窗打开/关闭时切换 body 滚动锁 ---------- */
watch(modalOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

/* ---------- 工具：调用 TheCocktailDB ---------- */
function api(path) {
  return fetchJSON(API_BASE + path, { timeout: 15000 })
}

/* ---------- 规范化：原始 drink -> 内部结构 ----------
   fallbackCategory 用于 filter.php 结果补全分类（该接口不返回 strCategory） */
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
  }
}

function normalizeCategories(data) {
  if (!data || !data.drinks) return []
  return data.drinks.map((c) => c.strCategory).filter(Boolean).sort()
}

/* ---------- 初始化分类下拉 ---------- */
async function initCategories() {
  try {
    const data = await api('/list.php?c=list')
    categories.value = normalizeCategories(data)
  } catch (err) {
    console.warn('Failed to load categories:', err)
  }
}

/* ---------- 加载鸡尾酒列表 ---------- */
async function loadDrinks(path, fallbackCategory) {
  loading.value = true
  // 清空网格（原版 drinkGrid.innerHTML = ''）
  currentDrinks.value = []
  try {
    const data = await api(path)
    const drinks = (data && data.drinks) || []
    currentDrinks.value = drinks.map((d) => normalizeDrink(d, fallbackCategory)).filter(Boolean)
    statusMsg.value = currentDrinks.value.length
      ? currentDrinks.value.length + ' ' + t.value('countUnit')
      : ''
  } catch (err) {
    currentDrinks.value = []
    statusMsg.value = t.value('fetchError')
    console.warn('Cocktail load failed:', err)
  } finally {
    loading.value = false
  }
}

/* 按名称搜索：空查询时按首字母 a 展示一批，避免空白初始页 */
function searchByName(q) {
  if (!q) return loadDrinks('/search.php?f=a')
  loadDrinks('/search.php?s=' + encodeURIComponent(q))
}

/* 按分类筛选：filter.php 仅返回摘要，用 c 作为 fallback 分类 */
function filterByCategory(c) {
  loadDrinks('/filter.php?c=' + encodeURIComponent(c), c)
}

/* ---------- 随机鸡尾酒 ---------- */
async function randomDrink() {
  loading.value = true
  // 原版不在此处清空列表，保留旧卡片直到新数据到达
  try {
    const data = await api('/random.php')
    const drinks = (data && data.drinks) || []
    const drink = drinks.map((d) => normalizeDrink(d)).filter(Boolean)[0]
    if (drink) {
      currentDrinks.value = [drink]
      statusMsg.value = '1 ' + t.value('countUnit')
      openModal(drink)
    }
  } catch (err) {
    statusMsg.value = t.value('fetchError')
    console.warn('Random drink failed:', err)
  } finally {
    loading.value = false
  }
}

/* 加载详情：类别筛选结果只有摘要，点击卡片时用 lookup 取完整配方。
   用 selectedCategory 作为 fallback 分类补全。 */
async function loadDetail(id) {
  loading.value = true
  try {
    const data = await api('/lookup.php?i=' + encodeURIComponent(id))
    const drinks = (data && data.drinks) || []
    const drink = drinks.map((d) => normalizeDrink(d, selectedCategory.value)).filter(Boolean)[0]
    if (drink) openModal(drink)
  } catch (err) {
    console.warn('Drink detail failed:', err)
  } finally {
    loading.value = false
  }
}

/* ---------- 弹窗控制 ---------- */
function openModal(drink) {
  modalDrink.value = drink
  modalOpen.value = true
  // 聚焦关闭按钮（无障碍）
  nextTick(() => {
    modalCloseRef.value?.focus()
  })
}

function closeModal() {
  modalOpen.value = false
}

/* ---------- 事件处理 ---------- */
function onSearchSubmit() {
  selectedCategory.value = ''
  searchByName(searchQuery.value.trim())
}

function onRandomClick() {
  searchQuery.value = ''
  selectedCategory.value = ''
  randomDrink()
}

function onCategoryChange() {
  searchQuery.value = ''
  if (selectedCategory.value) filterByCategory(selectedCategory.value)
  else searchByName('')
}

function onCardClick(d) {
  loadDetail(d.id)
}

// 卡片键盘操作（Enter / Space 触发详情）
function onCardKeydown(e, d) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    loadDetail(d.id)
  }
}

// Esc 关闭弹窗
function onKeydown(e) {
  if (e.key === 'Escape' && modalOpen.value) closeModal()
}

/* ---------- 生命周期 ---------- */
onMounted(() => {
  initCategories()
  loadDrinks('/search.php?f=a')
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="cocktail-bar">
    <!-- 顶栏：标题 + 语言切换（语言切换由 AppHeader 内部处理） -->
    <AppHeader :title="t('title')" :show-lang-toggle="true" />

    <main class="shell">
      <header class="masthead">
        <p class="eyebrow">{{ t('eyebrow') }}</p>
        <h1>{{ t('title') }}</h1>
        <p class="lead">{{ t('lead') }}</p>
      </header>

      <section class="controls">
        <!-- 搜索表单 -->
        <form class="search-row" @submit.prevent="onSearchSubmit">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('searchPlaceholder')"
            autocomplete="off"
            aria-label="Search cocktails"
          />
          <button type="submit">{{ t('search') }}</button>
          <button type="button" class="ok-btn-ghost" @click="onRandomClick">{{ t('random') }}</button>
        </form>
        <!-- 筛选行 -->
        <div class="filter-row">
          <select
            v-model="selectedCategory"
            class="filter-select"
            aria-label="Filter by category"
            @change="onCategoryChange"
          >
            <option value="">{{ t('allCategories') }}</option>
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
          <span class="status-note">{{ statusMsg }}</span>
        </div>
      </section>

      <!-- 加载中 -->
      <div v-if="loading" class="ok-loading">
        <span class="ok-spinner"></span>
        <span>{{ t('loading') }}</span>
      </div>

      <!-- 鸡尾酒卡片网格 -->
      <div class="drink-grid">
        <article
          v-for="d in currentDrinks"
          :key="d.id"
          class="drink-card"
          tabindex="0"
          @click="onCardClick(d)"
          @keydown="onCardKeydown($event, d)"
        >
          <img :src="d.thumb" :alt="d.name" loading="lazy" />
          <div class="drink-card-body">
            <div class="drink-card-title">{{ d.name }}</div>
            <div class="drink-card-meta">
              <span v-if="d.category" class="drink-card-tag">{{ d.category }}</span>
              <span v-if="d.alcoholic" class="drink-card-alcoholic">{{ d.alcoholic }}</span>
            </div>
          </div>
        </article>
      </div>

      <!-- 空状态 -->
      <div v-if="showEmptyState" class="empty-state">{{ t('empty') }}</div>

      <!-- 数据来源标注 -->
      <div class="data-source">{{ t('dataSource') }}</div>
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
        <div v-if="modalDrink" class="modal-body">
          <div class="modal-hero">
            <img :src="modalDrink.thumb" :alt="modalDrink.name" />
          </div>
          <h2 class="modal-title">{{ modalDrink.name }}</h2>
          <div class="modal-meta">
            <span v-if="modalDrink.category"><strong>{{ t('category') }}:</strong>{{ modalDrink.category }}</span>
            <span v-if="modalDrink.glass"><strong>{{ t('glass') }}:</strong>{{ modalDrink.glass }}</span>
            <span v-if="modalDrink.alcoholic"><strong>{{ t('type') }}:</strong>{{ modalDrink.alcoholic }}</span>
          </div>
          <div class="modal-section">
            <h3>{{ t('ingredients') }}</h3>
            <ul v-if="modalDrink.ingredients.length" class="ingredient-list">
              <li v-for="(ing, i) in modalDrink.ingredients" :key="i">
                <span class="ing-name">{{ ing.name }}</span>
                <span v-if="ing.measure" class="measure"> — {{ ing.measure }}</span>
              </li>
            </ul>
            <p v-else class="instructions">—</p>
          </div>
          <div class="modal-section">
            <h3>{{ t('instructions') }}</h3>
            <p class="instructions">{{ modalDrink.instructions || '' }}</p>
          </div>
        </div>
      </div>
    </div>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Cocktail Bar — 鸡尾酒配方搜索样式
   深色威士忌主题，color-scheme: dark
   原 :root 变量迁移到组件根类 .cocktail-bar 上，
   --ok-* 令牌在此覆盖，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.cocktail-bar {
  /* 表面与文字 */
  --bg: #15110d;
  --surface: #221a13;
  --surface-2: #2f2318;
  --text: #fff5e6;
  --text-muted: #c2a98c;
  --border: #4a3a2a;
  --accent: #f59e0b;
  --accent-2: #d97706;
  --accent-contrast: #15110d;
  color-scheme: dark;

  /* 映射到 --ok-* 共享 token */
  --ok-bg: var(--bg);
  --ok-surface: var(--surface);
  --ok-text: var(--text);
  --ok-text-muted: var(--text-muted);
  --ok-border: var(--border);
  --ok-accent: var(--accent);
  --ok-accent-contrast: var(--accent-contrast);
  --ok-radius: 14px;
  --ok-shadow: 0 10px 32px rgba(0, 0, 0, 0.45);
  --ok-topbar-h: 3.4rem;

  --ok-line: var(--border);
  --ok-panel: var(--surface);
  --ok-muted: var(--text-muted);
  --ok-accent-soft: rgba(245, 158, 11, 0.14);
  --ok-topbar-line: var(--border);
  --ok-footer-line: var(--border);
  --ok-footer-text: var(--text-muted);
  --ok-footer-link: var(--accent);

  --ok-font: "Outfit", system-ui, -apple-system, sans-serif;
  --ok-mono: "IBM Plex Mono", "SFMono-Regular", Menlo, monospace;

  /* 原 body 样式迁移到根元素 */
  margin: 0;
  font-family: var(--ok-font);
  color: var(--text);
  background:
    radial-gradient(1200px 700px at 88% -12%, rgba(245, 158, 11, 0.14), transparent 60%),
    radial-gradient(900px 600px at 0% -5%, rgba(217, 119, 6, 0.12), transparent 55%),
    var(--bg);
  background-attachment: fixed;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, p, strong, span, small { margin: 0; }

/* ---------- 顶栏补充样式（穿透到 AppHeader 的 .ok-topbar） ---------- */
.cocktail-bar :deep(.ok-topbar) {
  justify-content: space-between;
  background: rgba(21, 17, 13, 0.78);
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

.masthead { padding: 1.5rem 0 1.2rem; }
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

.controls {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1rem 0 1.5rem;
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
  color: var(--accent-contrast);
  font-weight: 600;
  cursor: pointer;
  transition: background 150ms;
}
.search-row button:hover { background: var(--accent-2); }
.search-row button.ok-btn-ghost {
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--accent);
}
.search-row button.ok-btn-ghost:hover {
  background: var(--ok-accent-soft);
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

.drink-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.drink-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--ok-radius);
  overflow: hidden;
  cursor: pointer;
  transition: transform 150ms, box-shadow 150ms, border-color 150ms;
}
.drink-card:hover,
.drink-card:focus-visible {
  transform: translateY(-3px);
  box-shadow: var(--ok-shadow);
  border-color: var(--accent);
  outline: none;
}
.drink-card img {
  width: 100%;
  height: 160px;
  object-fit: cover;
  display: block;
}
.drink-card-body {
  padding: 0.85rem;
}
.drink-card-title {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.25;
}
.drink-card-meta {
  margin-top: 0.4rem;
  font-size: 0.74rem;
  color: var(--text-muted);
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  align-items: center;
}
.drink-card-tag {
  font-size: 0.65rem;
  padding: 0.15rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--accent);
}
.drink-card-alcoholic {
  font-size: 0.62rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: var(--ok-accent-soft);
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

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

/* ---------- Modal 弹窗 ---------- */
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
  -webkit-backdrop-filter: blur(4px);
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
  height: 230px;
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
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.4rem 1rem;
  font-size: 0.88rem;
}
.ingredient-list li { color: var(--text-muted); }
.ingredient-list .ing-name { color: var(--text); }
.ingredient-list .measure {
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

@media (max-width: 640px) {
  .drink-grid { grid-template-columns: repeat(2, 1fr); gap: 0.7rem; }
  .drink-card img { height: 120px; }
  .modal-hero { height: 170px; }
  .modal-title { font-size: 1.3rem; }
}
</style>
