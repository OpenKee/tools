<script setup>
import { ref, computed, onMounted, onActivated, onDeactivated, onBeforeUnmount } from 'vue'
import { useT } from '../i18n.js'
import { fetchJSON } from '../ok.js'
import {
  UiBadge,
  UiButton,
  UiCard,
  UiDialog,
  UiEmptyState,
  UiErrorState,
  UiLoading,
  UiPageHead,
  UiSearch,
  UiSelect,
} from '../components/ui/index.js'
import copy from '../copy/taste-atlas.js'

const t = useT(copy)

const API_BASE = 'https://www.themealdb.com/api/json/v1/1'

const searchQuery = ref('')
const selectedCategory = ref('')
const selectedArea = ref('')
const categories = ref([])
const areas = ref([])
const currentRecipes = ref([])
const loading = ref(false)
const statusMsg = ref('')
const loadError = ref(false)
const modalMeal = ref(null)
const modalOpen = ref(false)

let retryAction = null
let listSeq = 0
let pageActive = true
let modalSeq = 0

const categoryOptions = computed(() => [
  { value: '', label: t.value('allCategories') },
  ...categories.value.map((c) => ({ value: c, label: c })),
])

const areaOptions = computed(() => [
  { value: '', label: t.value('allAreas') },
  ...areas.value.map((a) => ({ value: a, label: a })),
])

function api(path) {
  return fetchJSON(API_BASE + path, { timeout: 15000 })
}

function normalizeMeal(m, fallbackCategory = '', fallbackArea = '') {
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
    category: m.strCategory || fallbackCategory || '',
    area: m.strArea || fallbackArea || '',
    instructions: m.strInstructions,
    tags: (m.strTags || '').split(',').filter(Boolean),
    youtube: m.strYoutube,
    source: m.strSource,
    ingredients,
  }
}

function normalizeList(data, key) {
  if (!data || !data.meals) return []
  return data.meals
    .map((m) => m[key])
    .filter(Boolean)
    .sort()
}

async function initFilters() {
  try {
    const [catRes, areaRes] = await Promise.all([api('/list.php?c=list'), api('/list.php?a=list')])
    categories.value = normalizeList(catRes, 'strCategory')
    areas.value = normalizeList(areaRes, 'strArea')
  } catch (err) {
    console.warn('Failed to load filters:', err)
  }
}

async function loadRecipes(path, fallbackCategory = '', fallbackArea = '') {
  const seq = ++listSeq
  loading.value = true
  loadError.value = false
  retryAction = () => loadRecipes(path, fallbackCategory, fallbackArea)

  currentRecipes.value = []
  try {
    const data = await api(path)
    if (seq !== listSeq) return
    const meals = (data && data.meals) || []
    currentRecipes.value = meals.map((m) => normalizeMeal(m, fallbackCategory, fallbackArea)).filter(Boolean)
    statusMsg.value = currentRecipes.value.length
      ? t.value('countRecipes').replace('{n}', currentRecipes.value.length)
      : ''
  } catch (err) {
    if (seq !== listSeq) return
    loadError.value = true
    statusMsg.value = ''
    console.warn('Recipe load failed:', err)
  } finally {
    if (seq === listSeq) loading.value = false
  }
}

function retry() {
  if (retryAction) retryAction()
}

function searchByName(q) {
  if (!q) return loadRecipes('/search.php?s=')
  loadRecipes('/search.php?s=' + encodeURIComponent(q))
}

function filterByCategory(c) {
  loadRecipes('/filter.php?c=' + encodeURIComponent(c), c, '')
}

function filterByArea(a) {
  loadRecipes('/filter.php?a=' + encodeURIComponent(a), '', a)
}

async function randomRecipe() {
  const seq = ++listSeq
  const detailSeq = ++modalSeq
  loading.value = true
  loadError.value = false
  retryAction = randomRecipe
  try {
    const data = await api('/random.php')
    if (seq !== listSeq) return
    const meals = (data && data.meals) || []
    currentRecipes.value = meals.map((m) => normalizeMeal(m)).filter(Boolean)
    statusMsg.value = currentRecipes.value.length
      ? t.value('countRecipes').replace('{n}', currentRecipes.value.length)
      : ''
    if (currentRecipes.value.length && detailSeq === modalSeq) openModal(currentRecipes.value[0])
  } catch (err) {
    if (seq !== listSeq) return
    loadError.value = true
    statusMsg.value = ''
    console.warn('Random recipe failed:', err)
  } finally {
    if (seq === listSeq) loading.value = false
  }
}

async function loadDetail(id) {
  const detailSeq = ++modalSeq
  loading.value = true
  try {
    const data = await api('/lookup.php?i=' + encodeURIComponent(id))
    const meals = (data && data.meals) || []
    const meal = meals.map((m) => normalizeMeal(m)).filter(Boolean)[0]
    if (meal && detailSeq === modalSeq) openModal(meal)
  } catch (err) {
    console.warn('Recipe detail failed:', err)
  } finally {
    loading.value = false
  }
}

function openModal(meal) {
  if (!pageActive) return
  modalMeal.value = meal
  modalOpen.value = true
}

function closeModal() {
  ++modalSeq
  modalOpen.value = false
  modalMeal.value = null
}

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

function onCategoryChange(c) {
  searchQuery.value = ''
  selectedArea.value = ''
  if (c) filterByCategory(c)
  else searchByName('')
}

function onAreaChange(a) {
  searchQuery.value = ''
  selectedCategory.value = ''
  if (a) filterByArea(a)
  else searchByName('')
}

function onCardClick(meal) {
  loadDetail(meal.id)
}

function onCardKeydown(e, meal) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    loadDetail(meal.id)
  }
}

onMounted(() => {
  initFilters()
  loadRecipes('/search.php?s=')
})

onActivated(() => {
  pageActive = true
})

onDeactivated(() => {
  pageActive = false
  closeModal()
})

onBeforeUnmount(() => {
  pageActive = false
  closeModal()
})
</script>

<template>
  <div class="taste-atlas">
    <div class="page-body">
      <UiPageHead :description="t('lead')" />

      <section class="controls">
        <UiSearch
          v-model="searchQuery"
          :placeholder="t('searchPlaceholder')"
          :aria-label="t('searchAria')"
          :submit-label="t('search')"
          @submit="onSearchSubmit"
        >
          <template #actions>
            <UiButton variant="secondary" @click="onRandomClick">{{ t('random') }}</UiButton>
          </template>
        </UiSearch>

        <div class="filter-row">
          <UiSelect
            v-model="selectedCategory"
            class="filter-select"
            :options="categoryOptions"
            :aria-label="t('category')"
            @update:model-value="onCategoryChange"
          />
          <UiSelect
            v-model="selectedArea"
            class="filter-select"
            :options="areaOptions"
            :aria-label="t('cuisine')"
            @update:model-value="onAreaChange"
          />
          <span class="status-note">{{ statusMsg }}</span>
        </div>
      </section>

      <UiLoading v-if="loading" :label="t('loading')" />

      <UiErrorState
        v-if="loadError"
        class="load-error"
        :message="t('fetchError')"
        :retry-label="t('retry')"
        @retry="retry"
      />

      <UiEmptyState v-if="!currentRecipes.length && !loading && !loadError" :title="t('empty')" />

      <div class="recipe-grid">
        <UiCard
          v-for="m in currentRecipes"
          :key="m.id"
          as="article"
          padding="none"
          interactive
          class="recipe-card"
          role="button"
          tabindex="0"
          @click="onCardClick(m)"
          @keydown="onCardKeydown($event, m)"
        >
          <img :src="m.thumb" :alt="m.name" loading="lazy" />
          <div class="recipe-card-body">
            <div class="recipe-card-title">{{ m.name }}</div>
            <div class="recipe-card-meta">
              <UiBadge v-if="m.category" variant="accent" size="sm">{{ m.category }}</UiBadge>
              <span v-if="m.area">{{ m.area }}</span>
            </div>
          </div>
        </UiCard>
      </div>
    </div>

    <UiDialog
      :open="modalOpen"
      :title="modalMeal ? modalMeal.name : ''"
      :close-label="t('closeAria')"
      width="720px"
      @update:open="(open) => !open && closeModal()"
    >
      <div v-if="modalMeal" class="detail-body">
        <div class="detail-hero">
          <img :src="modalMeal.thumb" :alt="modalMeal.name" />
        </div>
        <div class="detail-meta">
          <UiBadge v-if="modalMeal.category" variant="accent" size="sm">
            {{ t('category') }}: {{ modalMeal.category }}
          </UiBadge>
          <UiBadge v-if="modalMeal.area" size="sm">{{ t('cuisine') }}: {{ modalMeal.area }}</UiBadge>
        </div>
        <div class="detail-section">
          <h3>{{ t('ingredients') }}</h3>
          <ul class="ingredient-list">
            <li v-for="(ing, i) in modalMeal.ingredients" :key="i">
              <span>{{ ing.name }}</span
              ><template v-if="ing.measure"> — {{ ing.measure }}</template>
            </li>
          </ul>
        </div>
        <div class="detail-section">
          <h3>{{ t('instructions') }}</h3>
          <p class="instructions">{{ modalMeal.instructions || '' }}</p>
        </div>
        <div v-if="modalMeal.tags.length" class="detail-section">
          <h3>{{ t('tags') }}</h3>
          <div class="detail-tags">
            <UiBadge v-for="(tag, i) in modalMeal.tags" :key="i" size="sm">{{ tag }}</UiBadge>
          </div>
        </div>
        <div v-if="modalMeal.youtube || modalMeal.source" class="detail-section">
          <a v-if="modalMeal.youtube" class="detail-link" :href="modalMeal.youtube" target="_blank" rel="noreferrer"
            >{{ t('youtube') }} ↗</a
          >
          <span v-if="modalMeal.youtube && modalMeal.source"> · </span>
          <a v-if="modalMeal.source" class="detail-link" :href="modalMeal.source" target="_blank" rel="noreferrer"
            >{{ t('source') }} ↗</a
          >
        </div>
      </div>
    </UiDialog>
  </div>
</template>

<style scoped>
.taste-atlas {
  --bg: var(--ok-bg);
  --text: var(--ok-text);
  --text-muted: var(--ok-muted);
  --border: var(--ok-line);
  --accent: var(--ok-accent);

  margin: 0;
  font-family: var(--ok-font);
  color: var(--text);
  background: var(--bg);
  min-height: 0;
  -webkit-font-smoothing: antialiased;
}

h1,
h2,
h3,
p,
strong,
span,
small {
  margin: 0;
}

.page-body {
  min-width: 0;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1rem 0 1.5rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1.2rem;
}

.filter-row {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  flex-wrap: wrap;
}
.filter-row .filter-select {
  flex: 0 1 190px;
  width: auto;
  max-width: 100%;
}
.status-note {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.load-error {
  margin-bottom: 1rem;
}

.recipe-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.recipe-card {
  overflow: hidden;
  cursor: pointer;
}
.recipe-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.recipe-card :deep(.ui-card-body) {
  gap: 0;
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
  align-items: center;
}

.detail-hero {
  position: relative;
  height: 220px;
  overflow: hidden;
  border-radius: var(--ok-radius-control);
  background: var(--ok-panel-subtle);
}
.detail-hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.detail-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.9rem;
}
.detail-section {
  padding: 0.95rem 0;
  border-top: 1px solid var(--ok-line);
  margin-top: 0.6rem;
}
.detail-meta + .detail-section {
  margin-top: 1rem;
}
.detail-section h3 {
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ok-accent);
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
.ingredient-list li {
  color: var(--ok-muted);
}
.ingredient-list li span {
  color: var(--ok-text);
}
.instructions {
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--ok-muted);
  white-space: pre-line;
}
.detail-tags {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.detail-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.82rem;
  color: var(--ok-accent);
  text-decoration: none;
}
.detail-link:hover {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .recipe-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.7rem;
  }
  .recipe-card img {
    height: 110px;
  }
  .detail-hero {
    height: 160px;
  }
}
</style>
