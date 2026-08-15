<script setup lang="ts">
/* ============================================================
   Tech Stack Advisor — 技术选型助手（Vue 3 SFC）
   通过 GitHub Search API 搜索仓库，对比选中的仓库并给出推荐。
   ============================================================ */

import { ref, computed } from 'vue'
import { useT } from '../i18n.js'
import { fetchJSON, locale, githubLangColors } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- i18n 文案字典 ---------- */
const copy = {
  en: {
    eyebrow: 'GitHub tech stack analysis',
    title: 'Tech Stack Advisor',
    lead: 'Search and compare open-source libraries to find the best fit for your project.',
    searchPlaceholder: 'e.g. RAG framework, React form library, Rust web framework',
    search: 'Search',
    loading: 'Searching GitHub repos...',
    error: 'Failed to search. GitHub API may be rate-limited. Try again later.',
    empty: 'No repos found. Try a different query.',
    noDescription: 'No description',
    stars: 'stars',
    forks: 'forks',
    issues: 'issues',
    updated: 'Updated',
    compare: 'Compare',
    close: 'Close',
    selected: 'selected',
    selectAtLeastTwo: 'Select at least 2 repos to compare.',
    comparison: 'Comparison',
    metric: 'Metric',
    recommendation: 'Recommendation',
    recommended: 'Recommended',
    score: 'Score',
    bestChoice: 'Based on stars, forks, activity and issue health, the best choice is:',
    metricStars: 'Stars',
    metricForks: 'Forks',
    metricIssues: 'Open Issues',
    metricLanguage: 'Language',
    metricUpdated: 'Last Updated',
    daysAgo: 'days ago',
    today: 'today',
    repositories: 'Repositories',
    clearAll: 'Clear All',
  },
  zh: {
    eyebrow: 'GitHub 技术栈分析',
    title: '技术选型助手',
    lead: '搜索并对比开源库，为你的项目找到最佳选择。',
    searchPlaceholder: '例如：RAG 框架、React 表单库、Rust Web 框架',
    search: '搜索',
    loading: '正在搜索 GitHub 仓库...',
    error: '搜索失败，GitHub API 可能限流了，稍后再试。',
    empty: '没有找到仓库，试试其他关键词。',
    noDescription: '暂无描述',
    stars: '星标',
    forks: 'Fork',
    issues: '议题',
    updated: '更新于',
    compare: '对比',
    close: '关闭',
    selected: '已选',
    selectAtLeastTwo: '请至少选择 2 个仓库进行对比。',
    comparison: '对比分析',
    metric: '指标',
    recommendation: '推荐',
    recommended: '推荐',
    score: '评分',
    bestChoice: '综合星标、Fork、活跃度和议题健康度，最佳选择是：',
    metricStars: '星标',
    metricForks: 'Fork',
    metricIssues: '开放议题',
    metricLanguage: '语言',
    metricUpdated: '最近更新',
    daysAgo: '天前',
    today: '今天',
    repositories: '仓库',
    clearAll: '全部清除',
  },
}

const t = useT(copy)

/* ---------- 类型定义 ---------- */
interface Repo {
  id: number
  full_name: string
  name: string
  html_url: string
  description: string | null
  language: string | null
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  updated_at: string
  topics: string[]
}

interface RepoSearchResponse {
  items: Repo[]
}

/* ---------- 响应式状态 ---------- */
const query = ref('')
const repos = ref<Repo[]>([])
const loading = ref(false)
const error = ref(false)
const selected = ref(new Set<string>())

/* ---------- 工具函数 ---------- */

function number(v: number) {
  return new Intl.NumberFormat(locale()).format(v || 0)
}

function langColor(name: string) {
  return githubLangColors[name] || '#8b8b8b'
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric' })
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function agoText(dateStr: string) {
  const d = daysSince(dateStr)
  return d === 0 ? t.value('today') : d + ' ' + t.value('daysAgo')
}

/* ---------- 搜索 GitHub ---------- */

async function searchRepos() {
  const q = query.value.trim()
  if (!q) return
  loading.value = true
  error.value = false
  repos.value = []
  selected.value = new Set()

  try {
    const url = 'https://api.github.com/search/repositories?q=' +
      encodeURIComponent(q) + '&sort=stars&order=desc&per_page=8'
    const data = await fetchJSON<RepoSearchResponse>(url, { timeout: 15000 })
    repos.value = data.items || []
  } catch (e) {
    error.value = true
  } finally {
    loading.value = false
  }
}

/* ---------- 选中管理 ---------- */

function toggleCompare(fullName: string) {
  const s = new Set(selected.value)
  if (s.has(fullName)) {
    s.delete(fullName)
  } else {
    s.add(fullName)
  }
  selected.value = s
}

function isSelected(fullName: string) {
  return selected.value.has(fullName)
}

function clearSelection() {
  selected.value = new Set()
}

/* ---------- 派生数据 ---------- */

const selectedRepos = computed(() => {
  return repos.value.filter(r => selected.value.has(r.full_name))
})

const showComparison = computed(() => selectedRepos.value.length >= 2)

const comparisonMetrics = computed(() => {
  const repos = selectedRepos.value
  if (repos.length < 2) return []
  return [
    { key: 'metricStars', values: repos.map(r => number(r.stargazers_count)) },
    { key: 'metricForks', values: repos.map(r => number(r.forks_count)) },
    { key: 'metricIssues', values: repos.map(r => number(r.open_issues_count)) },
    { key: 'metricLanguage', values: repos.map(r => r.language || '—') },
    { key: 'metricUpdated', values: repos.map(r => agoText(r.updated_at)) },
  ]
})

/* 简单评分：stars * 0.4 + forks * 0.3 + max(0, 500 - issues) / 500 * 100 * 0.2 + 活跃度 * 0.1 */
function calcScore(repo: Repo) {
  const stars = repo.stargazers_count || 0
  const forks = repo.forks_count || 0
  const issues = repo.open_issues_count || 0
  const issueScore = Math.max(0, 500 - issues) / 500 * 100
  const activity = Math.min(100, Math.max(0, 90 - daysSince(repo.updated_at)))
  return stars * 0.4 + forks * 0.3 + issueScore * 0.2 + activity * 0.1
}

const recommendation = computed(() => {
  const repos = selectedRepos.value
  if (repos.length < 2) return null
  const scored = repos.map(r => ({ repo: r, score: calcScore(r) }))
  scored.sort((a, b) => b.score - a.score)
  return scored[0]
})
</script>

<template>
  <div class="tech-stack-advisor">
    <AppHeader :title="{ en: 'Tech Stack Advisor', zh: '技术选型助手' }" :show-lang-toggle="true" />

    <main class="shell">
      <header class="masthead">
        <div>
          <p class="ok-eyebrow">{{ t('eyebrow') }}</p>
          <h1>{{ t('title') }}</h1>
          <p class="lead">{{ t('lead') }}</p>
        </div>
      </header>

      <!-- 搜索栏 -->
      <section class="search-bar">
        <form @submit.prevent="searchRepos">
          <input
            v-model="query"
            type="text"
            :placeholder="t('searchPlaceholder')"
            autocomplete="off"
            aria-label="Search query"
          />
          <button type="submit">{{ t('search') }}</button>
        </form>
      </section>

      <!-- 加载中 -->
      <div v-if="loading" class="ok-loading">
        <span class="ok-spinner"></span>
        <span>{{ t('loading') }}</span>
      </div>

      <!-- 错误 -->
      <p v-else-if="error" class="error-msg">{{ t('error') }}</p>

      <!-- 空状态 -->
      <p v-else-if="!loading && repos.length === 0 && query" class="empty-state">{{ t('empty') }}</p>

      <!-- 结果 -->
      <template v-else-if="repos.length">
        <section class="results-section">
          <div class="results-header">
            <h2>{{ t('repositories') }} ({{ repos.length }})</h2>
            <span v-if="selected.size" class="selected-count">
              {{ selected.size }} {{ t('selected') }}
              <button type="button" class="clear-btn" @click="clearSelection">{{ t('clearAll') }}</button>
            </span>
          </div>

          <div class="repo-grid">
            <article
              v-for="repo in repos"
              :key="repo.id"
              class="repo-card"
            >
              <div class="card-top">
                <a
                  class="repo-name"
                  :href="repo.html_url"
                  target="_blank"
                  rel="noreferrer"
                >{{ repo.full_name }}</a>
                <label class="compare-checkbox">
                  <input
                    type="checkbox"
                    :checked="isSelected(repo.full_name)"
                    @change="toggleCompare(repo.full_name)"
                  />
                  <span class="checkbox-label">{{ t('compare') }}</span>
                </label>
              </div>

              <p class="repo-desc">{{ repo.description || t('noDescription') }}</p>

              <div class="repo-meta">
                <span class="meta-item">★ {{ number(repo.stargazers_count) }}</span>
                <span v-if="repo.language" class="meta-item">
                  <span class="lang-dot" :style="{ background: langColor(repo.language) }"></span>
                  {{ repo.language }}
                </span>
                <span class="meta-item muted">{{ fmtDate(repo.updated_at) }}</span>
              </div>

              <div v-if="repo.topics && repo.topics.length" class="repo-topics">
                <span v-for="topic in repo.topics.slice(0, 4)" :key="topic" class="topic-tag">{{ topic }}</span>
              </div>
            </article>
          </div>
        </section>

        <!-- 对比提示 -->
        <p v-if="selected.size >= 1 && selected.size < 2" class="hint-text">
          {{ t('selectAtLeastTwo') }}
        </p>

        <!-- 对比面板 -->
        <section v-if="showComparison" class="comparison-section">
          <h2>{{ t('comparison') }}</h2>

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

        <!-- 推荐 -->
        <section v-if="recommendation" class="recommendation-section">
          <h2>{{ t('recommendation') }}</h2>
          <div class="recommendation-card">
            <div class="rec-badge">{{ t('recommended') }}</div>
            <div class="rec-content">
              <p class="rec-lead">{{ t('bestChoice') }}</p>
              <div class="rec-repo">
                <a
                  class="rec-name"
                  :href="recommendation.repo.html_url"
                  target="_blank"
                  rel="noreferrer"
                >{{ recommendation.repo.full_name }}</a>
                <span class="rec-score">{{ t('score') }}: {{ number(Math.round(recommendation.score)) }}</span>
              </div>
              <p class="rec-desc">{{ recommendation.repo.description || '' }}</p>
              <div class="rec-meta">
                <span>★ {{ number(recommendation.repo.stargazers_count) }}</span>
                <span v-if="recommendation.repo.language">
                  <span class="lang-dot" :style="{ background: langColor(recommendation.repo.language) }"></span>
                  {{ recommendation.repo.language }}
                </span>
                <span>ƒ {{ number(recommendation.repo.forks_count) }}</span>
              </div>
            </div>
          </div>
        </section>
      </template>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Tech Stack Advisor — 深色主题
   ============================================================ */

.tech-stack-advisor {
  --bg: #000;
  --panel: #0a0a0a;
  --panel-2: #141414;
  --text: #f5f5f3;
  --muted: #9f9f99;
  --border: rgba(255, 255, 255, 0.08);
  --border-2: rgba(255, 255, 255, 0.15);
  --accent: #3b82f6;
  --accent-soft: rgba(59, 130, 246, 0.12);
  --green: #22c55e;
  --red: #ef4444;
  --yellow: #eab308;

  color-scheme: dark;

  /* 共享组件主题映射 */
  --ok-bg: var(--bg);
  --ok-panel: var(--panel);
  --ok-line: var(--border);
  --ok-text: var(--text);
  --ok-muted: var(--muted);
  --ok-accent: var(--accent);
  --ok-accent-soft: var(--accent-soft);
  --ok-topbar-line: var(--border);
  --ok-footer-line: var(--border);
  --ok-footer-text: var(--muted);
  --ok-footer-link: var(--accent);

  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: var(--text);
  background: var(--bg);
  min-height: 100vh;
}

.tech-stack-advisor a {
  color: var(--accent);
  text-decoration: none;
}

.tech-stack-advisor a:hover {
  text-decoration: underline;
}

h1, h2, h3, h4, p, strong, span, small {
  margin: 0;
}

/* ---------- 主容器 ---------- */

.shell {
  width: min(1100px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

/* ---------- 页头 ---------- */

.masthead {
  display: flex;
  justify-content: space-between;
  align-items: start;
  padding: 0.3rem 0 1rem;
  border-bottom: 1px solid var(--border);
}

.masthead h1 {
  margin-top: 0.25rem;
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
  font-weight: 800;
}

.lead {
  margin-top: 0.5rem;
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.6;
  max-width: 55ch;
}

/* ---------- 搜索栏 ---------- */

.search-bar {
  margin-top: 1rem;
}

.search-bar form {
  display: flex;
  gap: 0.5rem;
}

.search-bar input[type="text"] {
  flex: 1;
  font: inherit;
  height: 2.8rem;
  padding: 0 0.85rem;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  font-size: 0.95rem;
  border-radius: 6px;
  outline: none;
  transition: border-color 0.15s;
}

.search-bar input[type="text"]:focus {
  border-color: var(--accent);
}

.search-bar input::placeholder {
  color: var(--muted);
}

.search-bar button {
  font: inherit;
  height: 2.8rem;
  padding: 0 1.5rem;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  border-radius: 6px;
  transition: background 0.15s;
}

.search-bar button:hover {
  background: #2563eb;
}

/* ---------- 加载/错误/空状态 ---------- */

.error-msg {
  color: var(--red);
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  padding: 0.8rem;
  border-radius: 6px;
  font-size: 0.88rem;
  margin-top: 1rem;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--muted);
  font-size: 0.95rem;
  margin-top: 1rem;
}

/* ---------- 结果区 ---------- */

.results-section {
  margin-top: 1.5rem;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
}

.results-header h2 {
  font-size: 1rem;
  font-weight: 700;
}

.selected-count {
  font-size: 0.78rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.clear-btn {
  font: inherit;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--muted);
  cursor: pointer;
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  transition: border-color 0.15s, color 0.15s;
}

.clear-btn:hover {
  border-color: var(--red);
  color: var(--red);
}

/* ---------- 仓库卡片网格 ---------- */

.repo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 0.8rem;
}

.repo-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: border-color 0.15s;
}

.repo-card:hover {
  border-color: var(--border-2);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.repo-name {
  font-weight: 600;
  font-size: 0.92rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compare-checkbox {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
  flex-shrink: 0;
  user-select: none;
}

.compare-checkbox input[type="checkbox"] {
  accent-color: var(--accent);
  width: 15px;
  height: 15px;
  cursor: pointer;
}

.checkbox-label {
  font-size: 0.7rem;
  color: var(--muted);
  white-space: nowrap;
}

.repo-desc {
  font-size: 0.82rem;
  color: var(--muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.repo-meta {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.meta-item {
  font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, monospace;
  font-size: 0.74rem;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.meta-item.muted {
  color: var(--muted);
  font-family: inherit;
  font-size: 0.72rem;
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
}

.topic-tag {
  font-size: 0.64rem;
  padding: 0.15rem 0.4rem;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 4px;
  white-space: nowrap;
}

/* ---------- 提示文字 ---------- */

.hint-text {
  margin-top: 1rem;
  font-size: 0.82rem;
  color: var(--muted);
  text-align: center;
  padding: 0.5rem;
}

/* ---------- 对比面板 ---------- */

.comparison-section {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
}

.comparison-section h2 {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0.8rem;
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
  font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, monospace;
  font-size: 0.82rem;
}

/* ---------- 推荐 ---------- */

.recommendation-section {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
}

.recommendation-section h2 {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0.8rem;
}

.recommendation-card {
  display: flex;
  gap: 1rem;
  padding: 1.2rem;
  background: var(--panel);
  border: 1px solid var(--accent);
  border-radius: 8px;
  align-items: flex-start;
}

.rec-badge {
  flex-shrink: 0;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.25rem 0.6rem;
  background: var(--accent);
  color: #fff;
  border-radius: 4px;
}

.rec-content {
  flex: 1;
  min-width: 0;
}

.rec-lead {
  font-size: 0.82rem;
  color: var(--muted);
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.rec-repo {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 0.3rem;
}

.rec-name {
  font-weight: 700;
  font-size: 1.05rem;
}

.rec-score {
  font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, monospace;
  font-size: 0.78rem;
  color: var(--green);
}

.rec-desc {
  font-size: 0.82rem;
  color: var(--muted);
  line-height: 1.5;
  margin-bottom: 0.5rem;
}

.rec-meta {
  display: flex;
  gap: 1rem;
  align-items: center;
  font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, monospace;
  font-size: 0.78rem;
  color: var(--text);
}

/* ---------- 响应式 ---------- */

@media (max-width: 720px) {
  .masthead {
    flex-direction: column;
    gap: 0.5rem;
  }

  .repo-grid {
    grid-template-columns: 1fr;
  }

  .search-bar form {
    flex-direction: column;
  }

  .search-bar button {
    width: 100%;
  }

  .recommendation-card {
    flex-direction: column;
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