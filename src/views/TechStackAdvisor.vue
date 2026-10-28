<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useT } from '../i18n.js'
import { githubCachedAPI, locale, githubLangColors, shortText } from '../ok.js'
import { useGithubToken } from '../lib/github-auth.js'
import {
  UiBadge,
  UiButton,
  UiCard,
  UiCheckbox,
  UiChip,
  UiEmptyState,
  UiErrorState,
  UiLoading,
  UiSectionHead,
  UiSearch,
} from '../components/ui/index.js'
import copy from '../copy/tech-stack-advisor.js'

const t = useT(copy)

const query = ref('')
const repos = ref([])
const loading = ref(false)
const error = ref(false)
const errorText = ref('')
const selected = ref(new Set())
let searchRequestId = 0
const { token: ghToken, panelOpen: tokenPanelOpen } = useGithubToken()

function number(v) {
  return new Intl.NumberFormat(locale()).format(v || 0)
}

function langColor(name) {
  return githubLangColors[name] || '#8b8b8b'
}

function fmtDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric' })
}

function daysSince(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function agoText(dateStr) {
  const d = daysSince(dateStr)
  return d === 0 ? t.value('today') : d + ' ' + t.value('daysAgo')
}

async function searchRepos() {
  const requestId = ++searchRequestId
  const q = query.value.trim()
  error.value = false
  errorText.value = ''
  repos.value = []
  selected.value = new Set()
  loading.value = !!q
  if (!q) return

  try {
    const url =
      'https://api.github.com/search/repositories?q=' + encodeURIComponent(q) + '&sort=stars&order=desc&per_page=8'
    const data = await githubCachedAPI(url, { token: ghToken.value })
    if (requestId !== searchRequestId) return
    repos.value = data.items || []
  } catch (e) {
    if (requestId !== searchRequestId) return
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
    if (requestId === searchRequestId) loading.value = false
  }
}

function runExample(text) {
  query.value = text
  searchRepos()
}

function toggleCompare(fullName) {
  const s = new Set(selected.value)
  if (s.has(fullName)) {
    s.delete(fullName)
  } else {
    s.add(fullName)
  }
  selected.value = s
}

function isSelected(fullName) {
  return selected.value.has(fullName)
}

function clearSelection() {
  selected.value = new Set()
}

const selectedRepos = computed(() => {
  return repos.value.filter((r) => selected.value.has(r.full_name))
})

const showComparison = computed(() => selectedRepos.value.length >= 2)

onUnmounted(() => {
  searchRequestId++
})

const comparisonMetrics = computed(() => {
  const repos = selectedRepos.value
  if (repos.length < 2) return []
  return [
    { key: 'metricStars', values: repos.map((r) => number(r.stargazers_count)) },
    { key: 'metricForks', values: repos.map((r) => number(r.forks_count)) },
    { key: 'metricIssues', values: repos.map((r) => number(r.open_issues_count)) },
    { key: 'metricLanguage', values: repos.map((r) => r.language || '—') },
    { key: 'metricUpdated', values: repos.map((r) => agoText(r.updated_at)) },
  ]
})
</script>

<template>
  <div class="tech-stack-advisor">
    <div class="shell">
      <section class="search-bar">
        <UiSearch
          v-model="query"
          :placeholder="t('searchPlaceholder')"
          input-type="text"
          aria-label="Search query"
          :submit-label="t('search')"
          @submit="searchRepos"
        />
      </section>

      <UiLoading v-if="loading" :label="t('loading')" />

      <UiErrorState v-else-if="error" class="error-msg" :message="errorText || t('error')" retry-label="" />

      <UiEmptyState v-else-if="!loading && repos.length === 0 && query" class="empty-state" :description="t('empty')" />

      <UiEmptyState
        v-else-if="!repos.length"
        class="start-state"
        :title="t('startTitle')"
        :description="t('startHint')"
      >
        <template #actions>
          <UiChip
            v-for="text in ['react state management', 'rust web framework', 'go http router']"
            :key="text"
            variant="neutral"
            @click="runExample(text)"
          >
            {{ text }}
          </UiChip>
        </template>
      </UiEmptyState>

      <template v-else-if="repos.length">
        <section class="results-section">
          <UiSectionHead :title="`${t('repositories')} (${repos.length})`">
            <template #actions>
              <span v-if="selected.size" class="selected-count">
                {{ selected.size }} {{ t('selected') }}
                <UiButton variant="link" size="sm" @click="clearSelection">{{ t('clearAll') }}</UiButton>
              </span>
            </template>
          </UiSectionHead>

          <div class="repo-grid">
            <UiCard v-for="repo in repos" :key="repo.id" class="repo-card">
              <div class="card-top">
                <a class="repo-name" :href="repo.html_url" target="_blank" rel="noreferrer">{{ repo.full_name }}</a>
                <UiCheckbox
                  class="compare-check"
                  :model-value="isSelected(repo.full_name)"
                  :label="t('compare')"
                  @update:model-value="toggleCompare(repo.full_name)"
                />
              </div>

              <p class="repo-desc">{{ shortText(repo.description) || t('noDescription') }}</p>

              <div class="repo-meta">
                <UiBadge size="sm" mono>{{ number(repo.stargazers_count) }} {{ t('stars') }}</UiBadge>
                <UiBadge v-if="repo.language" size="sm" mono>
                  <span class="lang-dot" :style="{ background: langColor(repo.language) }"></span>
                  {{ repo.language }}
                </UiBadge>
                <UiBadge size="sm" mono variant="outline">{{ fmtDate(repo.updated_at) }}</UiBadge>
              </div>

              <div v-if="repo.topics && repo.topics.length" class="repo-topics">
                <UiBadge v-for="topic in repo.topics.slice(0, 4)" :key="topic" variant="accent" size="sm">
                  {{ topic }}
                </UiBadge>
              </div>
            </UiCard>
          </div>
        </section>

        <p v-if="selected.size >= 1 && selected.size < 2" class="hint-text">
          {{ t('selectAtLeastTwo') }}
        </p>

        <section v-if="showComparison" class="comparison-section">
          <UiSectionHead :title="t('comparison')" />

          <div class="comparison-table-wrap">
            <table class="comparison-table">
              <thead>
                <tr>
                  <th class="metric-cell">{{ t('metric') }}</th>
                  <th v-for="repo in selectedRepos" :key="repo.full_name" class="repo-cell">
                    <a :href="repo.html_url" target="_blank" rel="noreferrer">{{ repo.name }}</a>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="metric in comparisonMetrics" :key="metric.key">
                  <td class="metric-cell">{{ t(metric.key) }}</td>
                  <td v-for="(val, i) in metric.values" :key="i" class="value-cell">{{ val }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.tech-stack-advisor {
  --panel: var(--ok-panel);
  --panel-2: var(--ok-bg);
  --text: var(--ok-text);
  --muted: var(--ok-muted);
  --border: var(--ok-line);
  --border-2: var(--ok-line);
  --accent: var(--ok-accent);
  --accent-soft: var(--ok-accent-soft);
  --green: var(--ok-up);
  --red: var(--ok-down);
  --yellow: #ca8a04;

  font-family: var(--ok-font);
  color: var(--text);
}

.tech-stack-advisor a {
  color: var(--accent);
  text-decoration: none;
}

.tech-stack-advisor a:hover {
  text-decoration: underline;
}

h1,
h2,
h3,
h4,
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

.search-bar {
  margin-top: 0;
}

.error-msg,
.empty-state {
  margin-top: 1rem;
}

.results-section {
  margin-top: 1.5rem;
}

.selected-count {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: var(--muted);
}

.repo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  align-items: start;
  gap: 0.8rem;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.repo-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 0.92rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compare-check :deep(.ui-check-label) {
  font-size: 0.7rem;
  color: var(--muted);
  white-space: nowrap;
}

.repo-desc {
  font-size: 0.82rem;
  color: var(--muted);
  line-height: 1.5;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.repo-meta {
  display: flex;
  gap: 0.45rem;
  align-items: center;
  flex-wrap: wrap;
}

.lang-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.repo-topics {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  min-width: 0;
}

.hint-text {
  margin-top: 1rem;
  font-size: 0.82rem;
  color: var(--muted);
  text-align: center;
  padding: 0.5rem;
}

.comparison-section {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
}

.comparison-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.comparison-table th,
.comparison-table td {
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--border);
  text-align: left;
}

.comparison-table thead th {
  background: var(--panel-2);
  font-weight: 600;
  white-space: nowrap;
}

.comparison-table thead th a {
  color: var(--accent);
}

.metric-cell {
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
  background: var(--panel);
}

.value-cell {
  font-family: var(--ok-mono);
  font-size: 0.82rem;
}

@media (max-width: 720px) {
  .repo-grid {
    grid-template-columns: 1fr;
  }

  .comparison-table {
    font-size: 0.78rem;
  }

  .comparison-table th,
  .comparison-table td {
    padding: 0.4rem 0.5rem;
  }
}

@media (min-width: 721px) and (max-width: 1024px) {
  .repo-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1025px) {
  .repo-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
