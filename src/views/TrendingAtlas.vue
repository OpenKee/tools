<script setup>
/* ============================================================
   Trending Atlas — GitHub 热门仓库浏览器（Vue 3 SFC）
   数据源：GitHub Search API（按创建时间 + 星标筛选）
   - 支持日/周/月范围切换、语言筛选、分页
   - 中英文 i18n，共享 i18n.js / ok.js
   ============================================================ */

import { ref, computed, watch, onMounted } from 'vue'
import { useT } from '../i18n.js'
import { fetchJSON, lsGet, locale, githubLangColors } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

// ---------- i18n 文案字典 ----------
const copy = {
  en: {
    eyebrow: 'GitHub trending explorer',
    title: 'Trending Atlas',
    lead: 'Discover what the open-source world is building right now.',
    daily: 'Today',
    weekly: 'This week',
    monthly: 'This month',
    allLanguages: 'All languages',
    loading: 'Loading trending repos\u2026',
    error: 'Failed to load. GitHub search API may be rate-limited. Try again later.',
    empty: 'No repos found for this filter.',
    stars: 'stars',
    forks: 'forks',
    created: 'created',
    hot: 'hot',
    page: 'Page',
    of: 'of',
    results: 'repos found',
    openRepo: 'Open repo',
  },
  zh: {
    eyebrow: 'GitHub 热门探索',
    title: '热门趋势',
    lead: '发现开源世界正在构建什么。',
    daily: '今天',
    weekly: '本周',
    monthly: '本月',
    allLanguages: '全部语言',
    loading: '正在加载热门仓库\u2026',
    error: '加载失败，GitHub 搜索 API 可能限流了，稍后再试。',
    empty: '这个筛选条件下没找到仓库。',
    stars: '星标',
    forks: 'Fork',
    created: '创建于',
    hot: '热门',
    page: '第',
    of: '/',
    results: '个仓库',
    openRepo: '打开仓库',
  },
}

const t = useT(copy)

// ---------- 常量 ----------
const PER_PAGE = 24

// 时间范围选项
const ranges = [
  { key: 'daily' },
  { key: 'weekly' },
  { key: 'monthly' },
]

// ---------- 状态 ----------
const currentRange = ref('daily')       // 当前时间范围
const currentPage = ref(1)              // 当前页码
const totalPages = ref(1)               // 总页数
const totalCount = ref(0)               // 总结果数
const langFilter = ref('')              // 语言筛选值（v-model 绑定 select）
const languages = ref([])               // 可选语言列表
const repos = ref([])                   // 当前页仓库数组
const loading = ref(false)              // 加载中
const error = ref(false)                // 加载失败

// ---------- 工具函数 ----------

// 计算时间范围的起始日期（ISO yyyy-mm-dd）
function getDateRange(range) {
  const now = new Date()
  let days
  if (range === 'daily') days = 1
  else if (range === 'weekly') days = 7
  else days = 30
  const d = new Date(now.getTime() - days * 86400000)
  return d.toISOString().slice(0, 10)
}

// 数字本地化格式化
function number(v) {
  return new Intl.NumberFormat(locale()).format(v || 0)
}

// 取语言对应的颜色，缺失则返回灰色
function langColor(name) {
  return githubLangColors[name] || '#8b8b8b'
}

// 日期本地化格式化
function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString(locale(), {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

// 判断是否为"热门"仓库（按范围与星标阈值）
function isHot(repo) {
  const stars = repo.stargazers_count || 0
  if (currentRange.value === 'daily' && stars >= 200) return true
  if (currentRange.value === 'weekly' && stars >= 1000) return true
  if (currentRange.value === 'monthly' && stars >= 3000) return true
  return false
}

// ---------- computed ----------

// 排名起始序号（用于卡片 #rank 显示）
const rankStart = computed(() => (currentPage.value - 1) * PER_PAGE)

// 分页页码列表（最多显示 7 个，超出则滑动窗口）
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

// ---------- 数据加载 ----------

// 加载可选语言列表（取 GitHub 语言榜前 30）
async function loadLanguages() {
  try {
    const langs = await fetchJSON('https://api.github.com/languages', { timeout: 12000 })
    if (!Array.isArray(langs)) return
    languages.value = langs.slice(0, 30).map(l => l.name).sort()
  } catch (e) {
    console.warn('Language list fetch failed:', e)
  }
}

// 加载当前筛选条件下的仓库列表
async function loadRepos() {
  const since = getDateRange(currentRange.value)
  let query = `created:>${since} stars:>10`
  if (langFilter.value) query += ` language:${langFilter.value}`

  loading.value = true
  error.value = false
  repos.value = []

  try {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${PER_PAGE}&page=${currentPage.value}`
    const headers = {}
    const token = lsGet('repo-scope-token')
    if (token) headers.Authorization = `Bearer ${token}`

    const data = await fetchJSON(url, { headers, timeout: 15000 })
    totalCount.value = data.total_count
    let tp = Math.ceil(totalCount.value / PER_PAGE)
    if (tp > 1000) tp = Math.ceil(1000 / PER_PAGE)
    totalPages.value = tp
    repos.value = data.items || []
  } catch (e) {
    // 403/429 限流或其他错误统一提示
    error.value = true
  } finally {
    loading.value = false
  }
}

// ---------- 交互处理 ----------

// 切换时间范围
function setRange(range) {
  currentRange.value = range
}

// 跳转分页
function goToPage(p) {
  if (p < 1 || p > totalPages.value) return
  currentPage.value = p
  loadRepos()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ---------- watch：范围/语言筛选变化时重置页码并重新加载 ----------
watch([currentRange, langFilter], () => {
  currentPage.value = 1
  loadRepos()
})

// ---------- 生命周期 ----------
onMounted(() => {
  loadLanguages()
  loadRepos()
})
</script>

<template>
  <div class="trending-atlas-app">
    <AppHeader :show-lang-toggle="true" />

    <main class="shell">
      <header class="masthead">
        <div class="masthead-copy">
          <p class="kicker">{{ t('eyebrow') }}</p>
          <h1>{{ t('title') }}</h1>
          <p class="lead">{{ t('lead') }}</p>
        </div>
      </header>

      <section class="controls">
        <div class="range-tabs">
          <button
            v-for="r in ranges"
            :key="r.key"
            class="range-btn"
            :class="{ active: currentRange === r.key }"
            type="button"
            @click="setRange(r.key)"
          >{{ t(r.key) }}</button>
        </div>
        <div class="lang-filter">
          <select v-model="langFilter">
            <option value="">{{ t('allLanguages') }}</option>
            <option v-for="name in languages" :key="name" :value="name">{{ name }}</option>
          </select>
        </div>
      </section>

      <section class="status-bar">
        <div v-if="loading" class="loading">
          <span class="spinner"></span>
          <span>{{ t('loading') }}</span>
        </div>
        <p v-else-if="error" class="error-msg">{{ t('error') }}</p>
        <template v-else>
          {{ number(totalCount) }} {{ t('results') }} · {{ t('page') }} {{ currentPage }} {{ t('of') }} {{ totalPages }}
        </template>
      </section>

      <section class="repo-grid">
        <p v-if="!loading && !error && repos.length === 0" class="empty-state">{{ t('empty') }}</p>
        <article
          v-for="(repo, i) in repos"
          :key="repo.id"
          class="repo-card"
        >
          <div class="card-head">
            <a class="card-name" :href="repo.html_url" target="_blank" rel="noreferrer">{{ repo.full_name }}</a>
            <span class="card-rank">#{{ rankStart + i + 1 }}</span>
          </div>
          <p class="card-desc">{{ repo.description || '' }}</p>
          <div class="card-meta">
            <span class="meta-item">★ {{ number(repo.stargazers_count) }}</span>
            <span class="meta-item">ƒ {{ number(repo.forks_count) }}</span>
            <span v-if="repo.language" class="meta-item">
              <span class="lang-dot" :style="{ background: langColor(repo.language) }"></span>{{ repo.language }}
            </span>
          </div>
          <div class="card-tags">
            <span v-if="isHot(repo)" class="tag hot">{{ t('hot') }}</span>
            <span v-if="repo.open_issues_count > 0" class="tag">{{ number(repo.open_issues_count) }} issues</span>
          </div>
          <div class="card-footer">
            <a class="card-link" :href="repo.html_url" target="_blank" rel="noreferrer">{{ t('openRepo') }} →</a>
            <span class="card-created">{{ t('created') }} {{ formatDate(repo.created_at) }}</span>
          </div>
        </article>
      </section>

      <section v-if="paginationPages" class="pagination">
        <button
          class="page-btn"
          type="button"
          :disabled="currentPage <= 1"
          @click="goToPage(currentPage - 1)"
        >←</button>
        <button
          v-for="p in paginationPages"
          :key="p"
          class="page-btn"
          :class="{ active: p === currentPage }"
          type="button"
          @click="goToPage(p)"
        >{{ p }}</button>
        <button
          class="page-btn"
          type="button"
          :disabled="currentPage >= totalPages"
          @click="goToPage(currentPage + 1)"
        >→</button>
      </section>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Trending Atlas — 暖色纸质主题
   accent 用深蓝 (#1f4a88)，配合米色背景与等宽字体。
   原 :root 变量迁移到组件根类 .trending-atlas-app 上，
   --ok-* 令牌在此覆盖，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.trending-atlas-app {
  --bg: #f2efe7;
  --paper: #f8f5ee;
  --paper-2: #efe8dc;
  --ink: #181512;
  --muted: #6a6258;
  --line: #cdc2b3;
  --accent: #1f4a88;
  --accent-soft: #dde5f1;
  --hot: #c0392b;
  --hot-soft: #fdecea;

  /* 共享组件主题映射 */
  --ok-bg: var(--bg);
  --ok-text: var(--ink);
  --ok-line: var(--line);
  --ok-muted: var(--muted);
  --ok-accent: var(--accent);
  --ok-accent-soft: var(--accent-soft);
  --ok-footer-line: var(--line);
  --ok-footer-text: var(--muted);
  --ok-footer-link: var(--accent);
  --ok-topbar-line: rgba(128, 128, 128, 0.1);

  min-height: 100vh;
  margin: 0;
  font-family: "IBM Plex Sans", system-ui, sans-serif;
  color: var(--ink);
  background: linear-gradient(180deg, #ece7dc 0%, #f4f1ea 100%);
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
h1, h2, p, strong, span, small { margin: 0; }

/* ---------- 主容器 ---------- */
.shell {
  width: min(1200px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

/* ---------- 页头 ---------- */
.masthead {
  display: flex;
  justify-content: space-between;
  align-items: start;
  padding: 0.35rem 0 1.2rem;
  border-bottom: 1px solid var(--line);
}

.kicker {
  font-family: "IBM Plex Mono", monospace;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
  color: var(--muted);
}

h1 {
  margin-top: 0.3rem;
  font-size: clamp(2.2rem, 6vw, 4rem);
  line-height: 0.92;
  letter-spacing: -0.06em;
}

.lead {
  margin-top: 0.75rem;
  color: var(--muted);
  line-height: 1.6;
  max-width: 48rem;
}

/* ---------- 控件栏 ---------- */
button,
select {
  font: inherit;
}

.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-top: 1rem;
  padding: 0.9rem 0;
  border-bottom: 1px solid var(--line);
}

.range-tabs {
  display: flex;
  gap: 0;
}

.range-btn {
  min-height: 2.5rem;
  padding: 0 1rem;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.78rem;
  letter-spacing: 0.03em;
  transition: all 120ms ease;
}

.range-btn:first-child {
  border-radius: 3px 0 0 3px;
}

.range-btn:last-child {
  border-radius: 0 3px 3px 0;
}

.range-btn + .range-btn {
  border-left: none;
}

.range-btn:hover {
  color: var(--ink);
}

.range-btn.active {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}

.lang-filter select {
  min-height: 2.5rem;
  padding: 0 0.75rem;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.45);
  color: var(--ink);
  font-size: 0.85rem;
  cursor: pointer;
}

/* ---------- 状态栏 ---------- */
.status-bar {
  padding: 0.6rem 0;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.76rem;
  color: var(--muted);
  min-height: 1.6rem;
}

/* ---------- 仓库卡片网格 ---------- */
.repo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1rem;
  margin-top: 0.5rem;
}

.repo-card {
  border: 1px solid var(--line);
  background: var(--paper);
  padding: 1.1rem;
  transition: border-color 150ms ease, box-shadow 150ms ease;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.repo-card:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 12px rgba(31, 74, 136, 0.08);
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.6rem;
}

.card-name {
  font-weight: 600;
  font-size: 1rem;
  color: var(--accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-rank {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.7rem;
  color: var(--muted);
  flex-shrink: 0;
}

.card-desc {
  font-size: 0.88rem;
  color: var(--muted);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

.card-meta {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.meta-item {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.74rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.lang-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.card-tags {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.tag {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.45rem;
  border: 1px solid var(--line);
  color: var(--ink);
}

.tag.hot {
  border-color: var(--hot);
  color: var(--hot);
  background: var(--hot-soft);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.4rem;
  border-top: 1px dotted rgba(24, 21, 18, 0.12);
}

.card-link {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.74rem;
  color: var(--accent);
}

.card-created {
  font-size: 0.72rem;
  color: var(--muted);
}

/* ---------- 分页 ---------- */
.pagination {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1.5rem;
  padding: 1rem 0;
}

.page-btn {
  min-height: 2.4rem;
  min-width: 2.4rem;
  padding: 0 0.7rem;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.8rem;
}

.page-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.page-btn.active {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

/* ---------- 加载/错误/空状态 ---------- */
.loading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--muted);
  font-size: 0.88rem;
}

.spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-msg {
  color: #a33;
  background: rgba(170, 50, 50, 0.06);
  border: 1px solid rgba(170, 50, 50, 0.2);
  padding: 0.6rem 0.8rem;
  border-radius: 3px;
  font-size: 0.88rem;
  line-height: 1.5;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem 1rem;
  color: var(--muted);
  font-size: 0.95rem;
}

/* ---------- 响应式 ---------- */
@media (max-width: 720px) {
  .masthead {
    flex-direction: column;
    gap: 0.6rem;
  }

  h1 {
    font-size: 2rem;
  }

  .controls {
    flex-direction: column;
    align-items: stretch;
  }

  .repo-grid {
    grid-template-columns: 1fr;
  }

  .range-btn {
    flex: 1;
    text-align: center;
  }
}
</style>
