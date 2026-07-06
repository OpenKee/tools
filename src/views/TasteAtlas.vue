<script setup>
/* ============================================================
   Taste Atlas — 美食地图 / 全球食谱探索（Vue 3 SFC）
   数据来源：TheMealDB（免费公开 API，无需 key）
   ============================================================ */

import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useT } from '../i18n.js'
import { fetchJSON } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- 国际化文案（中英双语） ---------- */
const copy = {
  en: {
    eyebrow: 'TheMealDB · Global recipes',
    title: 'Taste Atlas',
    lead: 'Discover recipes from around the world. Search by name, filter by category or cuisine, or roll the dice for a random dish.',
    searchPlaceholder: 'Search recipes…',
    search: 'Search',
    random: 'Random',
    allCategories: 'All categories',
    allAreas: 'All cuisines',
    loading: 'Loading…',
    empty: 'No recipes found.',
    ingredients: 'Ingredients',
    instructions: 'Instructions',
    tags: 'Tags',
    source: 'Source',
    youtube: 'Watch on YouTube',
    dataSource: 'Data: TheMealDB',
    allProjects: 'All projects ↗',
    category: 'Category',
    cuisine: 'Cuisine',
    fetchError: 'Failed to load recipes.',
  },
  zh: {
    eyebrow: 'TheMealDB · 全球食谱',
    title: '美食图谱',
    lead: '探索来自世界各地的食谱。按名称搜索、按分类或菜系筛选，或者随机来一道菜。',
    searchPlaceholder: '搜索食谱…',
    search: '搜索',
    random: '随机',
    allCategories: '全部分类',
    allAreas: '全部菜系',
    loading: '加载中…',
    empty: '没有找到食谱。',
    ingredients: '食材',
    instructions: '做法',
    tags: '标签',
    source: '来源',
    youtube: '在 YouTube 观看',
    dataSource: '数据：TheMealDB',
    allProjects: '全部项目 ↗',
    category: '分类',
    cuisine: '菜系',
    fetchError: '食谱加载失败。',
  },
}

// useT 返回 computed，模板中 t('key') 取翻译，语言切换自动响应
const t = useT(copy)

/* ---------- API 地址 ---------- */
const API_BASE = 'https://www.themealdb.com/api/json/v1/1'

/* ---------- 响应式状态 ---------- */
const searchQuery = ref('')        // 搜索框文本
const selectedCategory = ref('')   // 选中的分类
const selectedArea = ref('')       // 选中的菜系
const categories = ref([])         // 分类下拉选项
const areas = ref([])              // 菜系下拉选项
const currentRecipes = ref([])     // 当前展示的食谱列表
const loading = ref(false)         // 加载中标记
const statusMsg = ref('')          // 状态提示文案
const loadError = ref(false)       // 加载失败标记（控制空状态显示）
const modalMeal = ref(null)        // 弹窗中展示的食谱详情
const modalOpen = ref(false)       // 弹窗是否打开

/* ---------- 工具：调用 TheMealDB ---------- */
function api(path) {
  return fetchJSON(API_BASE + path, { timeout: 15000 })
}

/* ---------- 规范化：原始 meal -> 内部结构 ---------- */
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
    category: m.strCategory,
    area: m.strArea,
    instructions: m.strInstructions,
    tags: (m.strTags || '').split(',').filter(Boolean),
    youtube: m.strYoutube,
    source: m.strSource,
    ingredients,
  }
}

function normalizeList(data, key) {
  if (!data || !data.meals) return []
  return data.meals.map((m) => m[key]).filter(Boolean).sort()
}

/* ---------- 初始化分类 / 菜系筛选器 ---------- */
async function initFilters() {
  try {
    const [catRes, areaRes] = await Promise.all([
      api('/list.php?c=list'),
      api('/list.php?a=list'),
    ])
    categories.value = normalizeList(catRes, 'strCategory')
    areas.value = normalizeList(areaRes, 'strArea')
  } catch (err) {
    console.warn('Failed to load filters:', err)
  }
}

/* ---------- 加载食谱列表 ---------- */
async function loadRecipes(path) {
  loading.value = true
  loadError.value = false
  // 原版在此处清空网格（recipeGrid.innerHTML = ''），此处同步清空列表
  currentRecipes.value = []
  try {
    const data = await api(path)
    const meals = (data && data.meals) || []
    currentRecipes.value = meals.map(normalizeMeal).filter(Boolean)
    statusMsg.value = currentRecipes.value.length ? currentRecipes.value.length + ' recipes' : ''
  } catch (err) {
    loadError.value = true
    statusMsg.value = t.value('fetchError')
    console.warn('Recipe load failed:', err)
  } finally {
    loading.value = false
  }
}

function searchByName(q) {
  if (!q) return loadRecipes('/search.php?s=')
  loadRecipes('/search.php?s=' + encodeURIComponent(q))
}

function filterByCategory(c) {
  loadRecipes('/filter.php?c=' + encodeURIComponent(c))
}

function filterByArea(a) {
  loadRecipes('/filter.php?a=' + encodeURIComponent(a))
}

/* ---------- 随机食谱 ---------- */
async function randomRecipe() {
  loading.value = true
  // 原版不在此处清空列表，保留旧卡片直到新数据到达
  try {
    const data = await api('/random.php')
    const meals = (data && data.meals) || []
    currentRecipes.value = meals.map(normalizeMeal).filter(Boolean)
    if (currentRecipes.value.length) openModal(currentRecipes.value[0])
  } catch (err) {
    statusMsg.value = t.value('fetchError')
    console.warn('Random recipe failed:', err)
  } finally {
    loading.value = false
  }
}

/* ---------- 加载详情 ---------- */
async function loadDetail(id) {
  loading.value = true
  try {
    const data = await api('/lookup.php?i=' + encodeURIComponent(id))
    const meals = (data && data.meals) || []
    const meal = meals.map(normalizeMeal).filter(Boolean)[0]
    if (meal) openModal(meal)
  } catch (err) {
    console.warn('Recipe detail failed:', err)
  } finally {
    loading.value = false
  }
}

/* ---------- 弹窗控制 ---------- */
function openModal(meal) {
  modalMeal.value = meal
  modalOpen.value = true
  document.body.style.overflow = 'hidden'
}

function closeModal() {
  modalOpen.value = false
  document.body.style.overflow = ''
}

/* ---------- 事件处理 ---------- */
function onSearchSubmit() {
  selectedCategory.value = ''
  selectedArea.value = ''
  searchByName(searchQuery.value.trim())
}

function onRandomClick() {
  selectedCategory.value = ''
  selectedArea.value = ''
  randomRecipe()
}

function onCategoryChange() {
  searchQuery.value = ''
  selectedArea.value = ''
  if (selectedCategory.value) filterByCategory(selectedCategory.value)
  else searchByName('')
}

function onAreaChange() {
  searchQuery.value = ''
  selectedCategory.value = ''
  if (selectedArea.value) filterByArea(selectedArea.value)
  else searchByName('')
}

function onCardClick(meal) {
  loadDetail(meal.id)
}

function onKeydown(e) {
  if (e.key === 'Escape' && modalOpen.value) closeModal()
}

/* ---------- 生命周期 ---------- */
onMounted(() => {
  initFilters()
  loadRecipes('/search.php?s=')
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="taste-atlas">
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
            aria-label="Search recipes"
          />
          <button type="submit">{{ t('search') }}</button>
          <button type="button" class="ok-btn-ghost" @click="onRandomClick">{{ t('random') }}</button>
        </form>
        <!-- 筛选行 -->
        <div class="filter-row">
          <select v-model="selectedCategory" class="filter-select" @change="onCategoryChange">
            <option value="">{{ t('allCategories') }}</option>
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
          <select v-model="selectedArea" class="filter-select" @change="onAreaChange">
            <option value="">{{ t('allAreas') }}</option>
            <option v-for="a in areas" :key="a" :value="a">{{ a }}</option>
          </select>
          <span class="status-note">{{ statusMsg }}</span>
        </div>
      </section>

      <!-- 加载中 -->
      <div v-if="loading" class="ok-loading">
        <span class="ok-spinner"></span>
        <span>{{ t('loading') }}</span>
      </div>

      <!-- 食谱网格 -->
      <div class="recipe-grid">
        <article
          v-for="m in currentRecipes"
          :key="m.id"
          class="recipe-card"
          @click="onCardClick(m)"
        >
          <img :src="m.thumb" alt="" loading="lazy" />
          <div class="recipe-card-body">
            <div class="recipe-card-title">{{ m.name }}</div>
            <div class="recipe-card-meta">
              <span v-if="m.category" class="recipe-card-tag">{{ m.category }}</span>
              <span v-if="m.area">{{ m.area }}</span>
            </div>
          </div>
        </article>
      </div>

      <!-- 空状态：仅在非加载、非出错、无食谱时显示 -->
      <div v-if="!currentRecipes.length && !loading && !loadError" class="empty-state">
        {{ t('empty') }}
      </div>

      <!-- 数据来源标注 -->
      <div class="data-source">{{ t('dataSource') }}</div>
    </main>

    <!-- 详情弹窗 -->
    <div v-if="modalOpen" class="modal">
      <div class="modal-backdrop" @click="closeModal"></div>
      <div class="modal-panel">
        <button class="modal-close" type="button" aria-label="Close" @click="closeModal">×</button>
        <div v-if="modalMeal" class="modal-body">
          <div class="modal-hero">
            <img :src="modalMeal.thumb" alt="" />
          </div>
          <h2 class="modal-title">{{ modalMeal.name }}</h2>
          <div class="modal-meta">
            <span v-if="modalMeal.category">{{ t('category') }}: {{ modalMeal.category }}</span>
            <span v-if="modalMeal.area">{{ t('cuisine') }}: {{ modalMeal.area }}</span>
          </div>
          <div class="modal-section">
            <h3>{{ t('ingredients') }}</h3>
            <ul class="ingredient-list">
              <li v-for="(ing, i) in modalMeal.ingredients" :key="i">
                <span>{{ ing.name }}</span><template v-if="ing.measure"> — {{ ing.measure }}</template>
              </li>
            </ul>
          </div>
          <div class="modal-section">
            <h3>{{ t('instructions') }}</h3>
            <p class="instructions">{{ modalMeal.instructions || '' }}</p>
          </div>
          <div v-if="modalMeal.tags.length" class="modal-section">
            <h3>{{ t('tags') }}</h3>
            <div class="modal-tags">
              <span v-for="(tag, i) in modalMeal.tags" :key="i">{{ tag }}</span>
            </div>
          </div>
          <div v-if="modalMeal.youtube || modalMeal.source" class="modal-section">
            <a v-if="modalMeal.youtube" class="modal-link" :href="modalMeal.youtube" target="_blank" rel="noreferrer">{{ t('youtube') }} ↗</a>
            <span v-if="modalMeal.youtube && modalMeal.source"> · </span>
            <a v-if="modalMeal.source" class="modal-link" :href="modalMeal.source" target="_blank" rel="noreferrer">{{ t('source') }} ↗</a>
          </div>
        </div>
      </div>
    </div>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Taste Atlas — 美食地图样式
   温暖的食物主题，color-scheme: dark
   原 :root 变量迁移到组件根类 .taste-atlas 上，
   --ok-* 令牌在此覆盖，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.taste-atlas {
  /* 表面与文字 */
  --bg: #1a120b;
  --surface: #2a1f16;
  --surface-2: #3b2b1f;
  --text: #fff8f0;
  --text-muted: #c7b299;
  --border: #5c4633;
  --accent: #f59e0b;
  --accent-2: #ef4444;
  --accent-contrast: #1a120b;
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
  --ok-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
  --ok-topbar-h: 3.4rem;

  --ok-line: var(--border);
  --ok-panel: var(--surface);
  --ok-muted: var(--text-muted);
  --ok-accent-soft: rgba(245, 158, 11, 0.12);
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
    radial-gradient(1200px 700px at 90% -10%, rgba(245, 158, 11, 0.12), transparent 60%),
    radial-gradient(900px 600px at 5% -5%, rgba(239, 68, 68, 0.1), transparent 55%),
    var(--bg);
  background-attachment: fixed;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, p, strong, span, small { margin: 0; }

/* ---------- 顶栏补充样式（穿透到 AppHeader 的 .ok-topbar） ---------- */
.taste-atlas :deep(.ok-topbar) {
  justify-content: space-between;
  background: rgba(26, 18, 11, 0.75);
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
}
.search-row button.ok-btn-ghost {
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--accent);
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
}
.status-note {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.recipe-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.recipe-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--ok-radius);
  overflow: hidden;
  cursor: pointer;
  transition: transform 150ms, box-shadow 150ms, border-color 150ms;
}
.recipe-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--ok-shadow);
  border-color: var(--accent);
}
.recipe-card img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  display: block;
}
.recipe-card-body {
  padding: 0.85rem;
}
.recipe-card-title {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.25;
}
.recipe-card-meta {
  margin-top: 0.35rem;
  font-size: 0.74rem;
  color: var(--text-muted);
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.recipe-card-tag {
  font-size: 0.65rem;
  padding: 0.15rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--accent);
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
}
.modal-meta {
  padding: 0.6rem 1.4rem 0;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  color: var(--text-muted);
  font-size: 0.78rem;
}
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
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.35rem 1rem;
  font-size: 0.88rem;
  list-style: none;
  padding: 0;
  margin: 0;
}
.ingredient-list li { color: var(--text-muted); }
.ingredient-list li span { color: var(--text); }
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

@media (max-width: 640px) {
  .recipe-grid { grid-template-columns: repeat(2, 1fr); gap: 0.7rem; }
  .recipe-card img { height: 110px; }
  .modal-hero { height: 160px; }
  .modal-title { font-size: 1.3rem; }
}
</style>
