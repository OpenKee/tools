<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useT } from '../i18n.js'
import { githubCachedAPI, locale, githubLangColors, shortText } from '../ok.js'
import { useGithubToken } from '../lib/github-auth.js'
import {
  TRENDING_DEFAULT_RANGE,
  TRENDING_MAX_RESULTS,
  TRENDING_RANGES,
  POPULAR_LANGUAGES,
  trendingPageCount,
  trendingQuery,
} from '../lib/github-trending.js'
import {
  UiBadge,
  UiButton,
  UiCard,
  UiEmptyState,
  UiErrorState,
  UiLoading,
  UiSegmented,
  UiSelect,
} from '../components/ui/index.js'
import copy from '../copy/trending-atlas.js'

const t = useT(copy)

const PER_PAGE = 24

const rangeOptions = computed(() => TRENDING_RANGES.map((key) => ({ value: key, label: t.value(key) })))
const languageOptions = computed(() => [
  { value: '', label: t.value('allLanguages') },
  ...POPULAR_LANGUAGES.map((name) => ({ value: name, label: name })),
])

const currentRange = ref(TRENDING_DEFAULT_RANGE)
const currentPage = ref(1)
const totalPages = ref(1)
const totalCount = ref(0)
const langFilter = ref('')
const repos = ref([])
const loading = ref(false)
const error = ref(false)
const errorText = ref('')
let reposRequestId = 0
const { token: ghToken, panelOpen: tokenPanelOpen } = useGithubToken()

function number(v) {
  return new Intl.NumberFormat(locale()).format(v || 0)
}

function langColor(name) {
  return githubLangColors[name] || '#8b8b8b'
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString(locale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const rankStart = computed(() => (currentPage.value - 1) * PER_PAGE)

const paginationPages = computed(() => {
  if (totalPages.value <= 1) return null
  const maxShow = 7
  let start = Math.max(1, currentPage.value - 3)
  let end = Math.min(totalPages.value, start + maxShow - 1)
  if (end - start < maxShow - 1) start = Math.max(1, end - maxShow + 1)
  const arr = []
  for (let i = start; i <= end; i++) arr.push(i)
  return arr
})

async function loadRepos() {
  const requestId = ++reposRequestId
  const query = trendingQuery({ range: currentRange.value, language: langFilter.value })

  loading.value = true
  error.value = false
  errorText.value = ''
  repos.value = []

  try {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${PER_PAGE}&page=${currentPage.value}`
    const data = await githubCachedAPI(url, { token: ghToken.value })
    if (requestId !== reposRequestId) return
    totalCount.value = data.total_count
    totalPages.value = trendingPageCount(totalCount.value, PER_PAGE)
    repos.value = data.items || []
  } catch (e) {
    if (requestId !== reposRequestId) return
    error.value = true
    if (e.message === 'rate_limit') {
      errorText.value = t.value('rateLimited')
      tokenPanelOpen.value = true
    } else if (e.message === 'forbidden') {
      errorText.value = t.value('forbidden')
    } else {
      errorText.value = t.value('error')
    }
  } finally {
    if (requestId === reposRequestId) loading.value = false
  }
}

function setRange(range) {
  currentRange.value = range
}

function goToPage(p) {
  if (p < 1 || p > totalPages.value) return
  currentPage.value = p
  loadRepos()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch([currentRange, langFilter], () => {
  currentPage.value = 1
  loadRepos()
})

onMounted(() => {
  loadRepos()
})

onUnmounted(() => {
  reposRequestId++
})
</script>

<template>
  <div class="trending-atlas-app">
    <div class="shell">
      <section class="controls">
        <UiSegmented v-model="currentRange" :options="rangeOptions" aria-label="Time range" />
        <UiSelect v-model="langFilter" :options="languageOptions" class="lang-filter" />
      </section>

      <section class="status-bar">
        <UiLoading v-if="loading" class="status-loading" inline :label="t('loading')" />
        <UiErrorState
          v-else-if="error"
          :message="errorText || t('error')"
          :retry-label="t('retry')"
          @retry="loadRepos"
        />
        <template v-else-if="totalCount > 0">
          {{ number(totalCount) }} {{ t('results')
          }}<span v-if="totalCount > TRENDING_MAX_RESULTS" class="cap-note"> · {{ t('cappedResults') }}</span> ·
          {{ t('page') }} {{ currentPage }} {{ t('of') }} {{ totalPages }}
        </template>
        <template v-else>{{ t('zeroResults') }}</template>
      </section>

      <section class="repo-grid">
        <UiEmptyState
          v-if="!loading && !error && repos.length === 0"
          class="repo-empty"
          :title="t('empty')"
          :description="currentRange === 'daily' ? t('emptyDaily') : ''"
        >
          <template #actions>
            <UiButton v-if="currentRange === 'daily'" variant="secondary" size="sm" @click="setRange('weekly')">
              {{ t('tryWeekly') }}
            </UiButton>
            <UiButton v-if="langFilter" variant="ghost" size="sm" @click="langFilter = ''">
              {{ t('clearLanguage') }}
            </UiButton>
          </template>
        </UiEmptyState>
        <UiCard v-for="(repo, i) in repos" :key="repo.id" class="repo-card" interactive>
          <div class="card-head">
            <a class="card-name" :href="repo.html_url" target="_blank" rel="noreferrer">{{ repo.full_name }}</a>
            <span class="card-rank">#{{ rankStart + i + 1 }}</span>
          </div>
          <p class="card-desc">{{ shortText(repo.description) }}</p>
          <div class="card-meta">
            <UiBadge size="sm" mono>{{ number(repo.stargazers_count) }} {{ t('stars') }}</UiBadge>
            <UiBadge size="sm" mono>{{ number(repo.forks_count) }} {{ t('forks') }}</UiBadge>
            <UiBadge v-if="repo.open_issues_count" size="sm" mono>
              {{ number(repo.open_issues_count) }} {{ t('issues') }}
            </UiBadge>
            <UiBadge v-if="repo.language" size="sm" mono>
              <span class="lang-dot" :style="{ background: langColor(repo.language) }"></span>{{ repo.language }}
            </UiBadge>
          </div>
          <div class="card-footer">
            <span class="card-created">{{ t('updated') }} {{ formatDate(repo.updated_at) }}</span>
            <span class="card-created">{{ t('created') }} {{ formatDate(repo.created_at) }}</span>
          </div>
        </UiCard>
      </section>

      <section v-if="paginationPages" class="pagination">
        <UiButton variant="ghost" size="sm" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">
          ←
        </UiButton>
        <UiButton
          v-for="p in paginationPages"
          :key="p"
          :variant="p === currentPage ? 'primary' : 'secondary'"
          size="sm"
          @click="goToPage(p)"
        >
          {{ p }}
        </UiButton>
        <UiButton variant="ghost" size="sm" :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">
          →
        </UiButton>
      </section>
    </div>
  </div>
</template>

<style scoped>
.trending-atlas-app {
  --paper: var(--ok-panel);
  --paper-2: var(--ok-panel);
  --ink: var(--ok-text);
  --muted: var(--ok-muted);
  --line: var(--ok-line);
  --accent: var(--ok-accent);
  --accent-soft: var(--ok-accent-soft);

  margin: 0;
  font-family: var(--ok-font);
  color: var(--ink);
}

a {
  color: var(--accent);
  text-decoration: none;
}
a:hover {
  text-decoration: underline;
}
h1,
h2,
p,
strong,
span,
small {
  margin: 0;
}

.shell {
  width: 100%;
  margin: 0;
  padding: 0 0 3rem;
}

.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-top: 0;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--line);
}

.lang-filter {
  width: 12rem;
  max-width: 100%;
  flex: none;
}

.status-bar {
  padding: 0.6rem 0;
  font-family: var(--ok-mono);
  font-size: 0.76rem;
  color: var(--muted);
  min-height: 1.6rem;
}

.status-loading {
  padding: 0;
}

.repo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  align-items: start;
  gap: 1rem;
  margin-top: 0.5rem;
}

.repo-card {
  min-width: 0;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.6rem;
  min-width: 0;
}

.card-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 1rem;
  color: var(--accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-rank {
  font-family: var(--ok-mono);
  font-size: 0.7rem;
  color: var(--muted);
  flex-shrink: 0;
}

.card-desc {
  font-size: 0.88rem;
  color: var(--muted);
  line-height: 1.55;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

.card-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.lang-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.4rem;
  border-top: 1px solid var(--line);
}

.card-created {
  font-size: 0.72rem;
  color: var(--muted);
}

.pagination {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1.5rem;
  padding: 1rem 0;
}

.pagination :deep(.ui-btn) {
  min-width: 2.3rem;
  padding: 0 0.5rem;
}

.repo-empty {
  grid-column: 1 / -1;
}

@media (max-width: 720px) {
  .controls {
    flex-direction: column;
    align-items: stretch;
  }

  .repo-grid {
    grid-template-columns: 1fr;
  }

  .lang-filter {
    width: 100%;
  }

  .controls :deep(.ui-segmented) {
    justify-content: center;
  }
}
</style>
