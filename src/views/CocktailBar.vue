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
import copy from '../copy/cocktail-bar.js'

const t = useT(copy)

const API_BASE = 'https://www.thecocktaildb.com/api/json/v1/1'

const searchQuery = ref('')
const selectedCategory = ref('')
const categories = ref([])
const currentDrinks = ref([])
const loading = ref(false)
const statusMsg = ref('')
const modalDrink = ref(null)
const modalOpen = ref(false)
const loadError = ref(false)

let retryAction = null
let listSeq = 0
let pageActive = true
let modalSeq = 0

const showEmptyState = computed(() => !loading.value && !loadError.value && !currentDrinks.value.length)

const categoryOptions = computed(() => [
  { value: '', label: t.value('allCategories') },
  ...categories.value.map((c) => ({ value: c, label: c })),
])

function api(path) {
  return fetchJSON(API_BASE + path, { timeout: 15000 })
}

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
  return data.drinks
    .map((c) => c.strCategory)
    .filter(Boolean)
    .sort()
}

async function initCategories() {
  try {
    const data = await api('/list.php?c=list')
    categories.value = normalizeCategories(data)
  } catch (err) {
    console.warn('Failed to load categories:', err)
  }
}

async function loadDrinks(path, fallbackCategory) {
  const seq = ++listSeq
  loading.value = true
  loadError.value = false
  retryAction = () => loadDrinks(path, fallbackCategory)

  currentDrinks.value = []
  try {
    const data = await api(path)
    if (seq !== listSeq) return
    const drinks = (data && data.drinks) || []
    currentDrinks.value = drinks.map((d) => normalizeDrink(d, fallbackCategory)).filter(Boolean)
    statusMsg.value = currentDrinks.value.length
      ? t.value('countDrinks').replace('{n}', currentDrinks.value.length)
      : ''
  } catch (err) {
    if (seq !== listSeq) return
    loadError.value = true
    currentDrinks.value = []
    statusMsg.value = ''
    console.warn('Cocktail load failed:', err)
  } finally {
    if (seq === listSeq) loading.value = false
  }
}

function retry() {
  if (retryAction) retryAction()
}

function searchByName(q) {
  if (!q) return loadDrinks('/search.php?f=a')
  loadDrinks('/search.php?s=' + encodeURIComponent(q))
}

function filterByCategory(c) {
  loadDrinks('/filter.php?c=' + encodeURIComponent(c), c)
}

async function randomDrink() {
  const seq = ++listSeq
  const detailSeq = ++modalSeq
  loading.value = true
  loadError.value = false
  retryAction = randomDrink

  try {
    const data = await api('/random.php')
    if (seq !== listSeq) return
    const drinks = (data && data.drinks) || []
    const drink = drinks.map((d) => normalizeDrink(d)).filter(Boolean)[0]
    if (drink) {
      currentDrinks.value = [drink]
      statusMsg.value = t.value('countDrinks').replace('{n}', 1)
      if (detailSeq === modalSeq) openModal(drink)
    }
  } catch (err) {
    if (seq !== listSeq) return
    loadError.value = true
    statusMsg.value = ''
    console.warn('Random drink failed:', err)
  } finally {
    if (seq === listSeq) loading.value = false
  }
}

async function loadDetail(id) {
  const detailSeq = ++modalSeq
  loading.value = true
  try {
    const data = await api('/lookup.php?i=' + encodeURIComponent(id))
    const drinks = (data && data.drinks) || []
    const drink = drinks.map((d) => normalizeDrink(d, selectedCategory.value)).filter(Boolean)[0]
    if (drink && detailSeq === modalSeq) openModal(drink)
  } catch (err) {
    console.warn('Drink detail failed:', err)
  } finally {
    loading.value = false
  }
}

function openModal(drink) {
  if (!pageActive) return
  modalDrink.value = drink
  modalOpen.value = true
}

function closeModal() {
  ++modalSeq
  modalOpen.value = false
  modalDrink.value = null
}

function onSearchSubmit() {
  selectedCategory.value = ''
  searchByName(searchQuery.value.trim())
}

function onRandomClick() {
  searchQuery.value = ''
  selectedCategory.value = ''
  randomDrink()
}

function onCategoryChange(c) {
  searchQuery.value = ''
  if (c) filterByCategory(c)
  else searchByName('')
}

function onCardClick(d) {
  loadDetail(d.id)
}

function onCardKeydown(e, d) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    loadDetail(d.id)
  }
}

onMounted(() => {
  initCategories()
  loadDrinks('/search.php?f=a')
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
  <div class="cocktail-bar">
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

      <UiEmptyState v-if="showEmptyState" :title="t('empty')" />

      <div class="drink-grid">
        <UiCard
          v-for="d in currentDrinks"
          :key="d.id"
          as="article"
          padding="none"
          interactive
          class="drink-card"
          role="button"
          tabindex="0"
          @click="onCardClick(d)"
          @keydown="onCardKeydown($event, d)"
        >
          <img :src="d.thumb" :alt="d.name" loading="lazy" />
          <div class="drink-card-body">
            <div class="drink-card-title">{{ d.name }}</div>
            <div class="drink-card-meta">
              <UiBadge v-if="d.category" variant="accent" size="sm">{{ d.category }}</UiBadge>
              <UiBadge v-if="d.alcoholic" size="sm">{{ d.alcoholic }}</UiBadge>
            </div>
          </div>
        </UiCard>
      </div>
    </div>

    <UiDialog
      :open="modalOpen"
      :title="modalDrink ? modalDrink.name : ''"
      :close-label="t('closeAria')"
      width="720px"
      @update:open="(open) => !open && closeModal()"
    >
      <div v-if="modalDrink" class="detail-body">
        <div class="detail-hero">
          <img :src="modalDrink.thumb" :alt="modalDrink.name" />
        </div>
        <div class="detail-meta">
          <span v-if="modalDrink.category"
            ><strong>{{ t('category') }}:</strong>{{ modalDrink.category }}</span
          >
          <span v-if="modalDrink.glass"
            ><strong>{{ t('glass') }}:</strong>{{ modalDrink.glass }}</span
          >
          <span v-if="modalDrink.alcoholic"
            ><strong>{{ t('type') }}:</strong>{{ modalDrink.alcoholic }}</span
          >
        </div>
        <div class="detail-section">
          <h3>{{ t('ingredients') }}</h3>
          <ul v-if="modalDrink.ingredients.length" class="ingredient-list">
            <li v-for="(ing, i) in modalDrink.ingredients" :key="i">
              <span class="ing-name">{{ ing.name }}</span>
              <span v-if="ing.measure" class="measure"> — {{ ing.measure }}</span>
            </li>
          </ul>
          <p v-else class="instructions">—</p>
        </div>
        <div class="detail-section">
          <h3>{{ t('instructions') }}</h3>
          <p class="instructions">{{ modalDrink.instructions || '' }}</p>
        </div>
      </div>
    </UiDialog>
  </div>
</template>

<style scoped>
.cocktail-bar {
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

.drink-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.drink-card {
  overflow: hidden;
  cursor: pointer;
}
.drink-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.drink-card :deep(.ui-card-body) {
  gap: 0;
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

.detail-hero {
  position: relative;
  height: 230px;
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
  gap: 0.5rem 1rem;
  flex-wrap: wrap;
  color: var(--ok-muted);
  font-size: 0.78rem;
  margin-top: 0.9rem;
}
.detail-meta strong {
  color: var(--ok-text);
  font-weight: 600;
  margin-right: 0.2rem;
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
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.4rem 1rem;
  font-size: 0.88rem;
}
.ingredient-list li {
  color: var(--ok-muted);
}
.ingredient-list .ing-name {
  color: var(--ok-text);
}
.ingredient-list .measure {
  color: var(--ok-muted);
  font-family: var(--ok-mono);
  font-size: 0.82rem;
}
.instructions {
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--ok-muted);
  white-space: pre-line;
}

@media (max-width: 640px) {
  .drink-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.7rem;
  }
  .drink-card img {
    height: 120px;
  }
  .detail-hero {
    height: 170px;
  }
}
</style>
