<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { X } from '@lucide/vue'
import { useT } from '../i18n.js'
import { lsGet, lsSet, locale, githubLangColors, githubAPI, shortText } from '../ok.js'
import { useGithubToken } from '../lib/github-auth.js'
import { safeExternalUrl } from '../lib/format.js'
import {
  UiBadge,
  UiButton,
  UiCard,
  UiEmptyState,
  UiErrorState,
  UiIconButton,
  UiInput,
  UiLoading,
  UiSearch,
  UiSectionHead,
  UiSelect,
  UiStat,
} from '../components/ui/index.js'
import copy from '../copy/repo-scope.js'

const t = useT(copy)

const PER_PAGE = 20
const CACHE_TTL = 10 * 60 * 1000

const username = ref('')
const { token: ghToken, panelOpen: tokenPanelOpen } = useGithubToken()

const profile = ref(null)
const repos = ref([])

const search = ref('')
const sort = ref('stars')
const page = ref(1)

const loading = ref(false)
const errorMsg = ref('')
let userRequestId = 0

const detailFullName = ref('')
const detail = ref(null)
const detailLoading = ref(false)
const detailError = ref('')
let detailRequestId = 0

const sortOptions = computed(() => [
  { value: 'stars', label: t.value('byStars') },
  { value: 'updated', label: t.value('byUpdated') },
  { value: 'forks', label: t.value('byForks') },
  { value: 'name', label: t.value('byName') },
])

function num(v) {
  return new Intl.NumberFormat(locale()).format(v || 0)
}

function langColor(n) {
  return githubLangColors[n] || '#8b8b8b'
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString(locale())
}

function blogUrl(blog) {
  const value = String(blog || '').trim()
  if (!value) return ''
  return safeExternalUrl(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : 'https://' + value)
}

function cacheKey(u) {
  return 'repo-scope-cache-' + u.toLowerCase()
}

function getCache(u) {
  try {
    const raw = lsGet(cacheKey(u))
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Date.now() - data.ts > CACHE_TTL) return null
    return data
  } catch (e) {
    return null
  }
}

function setCache(u, p, rs) {
  lsSet(cacheKey(u), JSON.stringify({ ts: Date.now(), profile: p, repos: rs }))
}

async function ghFetch(url) {
  return githubAPI(url, { token: ghToken.value })
}

const totalStars = computed(() => repos.value.reduce((s, r) => s + (r.stargazers_count || 0), 0))

const langCount = computed(() => new Set(repos.value.map((r) => r.language).filter(Boolean)).size)

const statItems = computed(() => {
  if (!profile.value) return []
  return [
    { label: t.value('followers'), value: num(profile.value.followers) },
    { label: t.value('publicRepos'), value: num(profile.value.public_repos) },
    {
      label: t.value('stars'),
      value: num(totalStars.value),
      sub: profile.value.public_repos > 100 ? t.value('starsSample') : '',
    },
    { label: t.value('languages'), value: langCount.value },
  ]
})

const profileMeta = computed(() => {
  if (!profile.value) return []
  const p = profile.value
  const items = []
  if (p.company) items.push({ label: t.value('company'), text: p.company })
  if (p.location) items.push({ label: t.value('location'), text: p.location })
  if (p.blog) items.push({ label: t.value('blog'), url: blogUrl(p.blog), text: p.blog })
  items.push({ label: t.value('joined'), text: fmtDate(p.created_at) })
  return items
})

const languageStats = computed(() => {
  const counts = {}
  repos.value.forEach((r) => {
    if (r.language) counts[r.language] = (counts[r.language] || 0) + 1
  })
  const ranked = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  const max = ranked[0]?.[1] || 1
  return ranked.map(([name, count]) => ({
    name,
    count,
    pct: ((count / max) * 100).toFixed(1),
    color: langColor(name),
  }))
})

const filteredRepos = computed(() => {
  const s = search.value.toLowerCase()
  if (!s) return repos.value
  return repos.value.filter((r) => r.name.toLowerCase().includes(s) || (r.description || '').toLowerCase().includes(s))
})

const sortedRepos = computed(() => {
  const arr = [...filteredRepos.value]
  if (sort.value === 'stars') arr.sort((a, b) => b.stargazers_count - a.stargazers_count)
  else if (sort.value === 'updated') arr.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  else if (sort.value === 'forks') arr.sort((a, b) => b.forks_count - a.forks_count)
  else arr.sort((a, b) => a.name.localeCompare(b.name))
  return arr
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRepos.value.length / PER_PAGE)))

const pageButtons = computed(() => {
  const pages = []
  for (let i = 1; i <= Math.min(totalPages.value, 8); i++) pages.push(i)
  return pages
})

const pagedRepos = computed(() => {
  const start = (page.value - 1) * PER_PAGE
  return sortedRepos.value.slice(start, start + PER_PAGE)
})

const pagedReposView = computed(() => pagedRepos.value.map((r) => ({ repo: r, pushed: fmtDate(r.pushed_at) })))

function onSubmit() {
  analyzeUser(username.value.trim())
}

function analyzeExample(name) {
  username.value = name
  analyzeUser(name)
}

function changePage(p) {
  page.value = p
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function closeDetail() {
  detailRequestId++
  detailFullName.value = ''
  detail.value = null
  detailError.value = ''
  detailLoading.value = false
}

async function analyzeUser(u) {
  if (!u) return
  const requestId = ++userRequestId

  profile.value = null
  repos.value = []
  errorMsg.value = ''
  closeDetail()
  loading.value = true

  const cached = getCache(u)
  if (cached) {
    applyData(cached.profile, cached.repos)

    refreshInBackground(u, requestId)
    return
  }

  try {
    const [p, rs] = await Promise.all([
      ghFetch(`https://api.github.com/users/${u}`),
      ghFetch(`https://api.github.com/users/${u}/repos?per_page=100&sort=updated`),
    ])
    if (requestId !== userRequestId) return
    const nonForks = rs.filter((r) => !r.fork).sort((a, b) => b.stargazers_count - a.stargazers_count)
    setCache(u, p, nonForks)
    applyData(p, nonForks)
  } catch (e) {
    if (requestId !== userRequestId) return
    loading.value = false
    let msg
    if (e.message === 'rate_limit') {
      msg = t.value('errorRateLimit')

      if (!ghToken.value) {
        msg += ' ' + t.value('errorRateLimitHint')
      }
      if (e.resetAt) {
        const timeStr = e.resetAt.toLocaleString(locale(), {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
        msg += ' ' + t.value('errorRateLimitReset').replace('{time}', timeStr)
      }

      tokenPanelOpen.value = true
    } else if (e.message === 'forbidden') {
      msg = t.value('errorForbidden')
    } else if (e.message === 'not_found') {
      msg = t.value('errorNotFound')
    } else {
      msg = t.value('errorGeneric').replace('{msg}', e.message)
    }
    errorMsg.value = msg
  }
}

function applyData(p, rs) {
  profile.value = p
  repos.value = rs
  page.value = 1
  loading.value = false
  errorMsg.value = ''
}

async function refreshInBackground(u, requestId) {
  try {
    const [p, rs] = await Promise.all([
      githubAPI(`https://api.github.com/users/${u}`, { token: ghToken.value }),
      githubAPI(`https://api.github.com/users/${u}/repos?per_page=100&sort=updated`, { token: ghToken.value }),
    ])
    const nonForks = rs.filter((r) => !r.fork).sort((a, b) => b.stargazers_count - a.stargazers_count)
    setCache(u, p, nonForks)

    if (requestId === userRequestId && username.value.trim().toLowerCase() === u.toLowerCase()) {
      applyData(p, nonForks)
    }
  } catch (e) {}
}

async function loadDetail(fullName) {
  const requestId = ++detailRequestId
  detailFullName.value = fullName
  detail.value = null
  detailError.value = ''
  detailLoading.value = true
  try {
    const data = await ghFetch(`https://api.github.com/repos/${fullName}`)
    if (requestId === detailRequestId) detail.value = data
  } catch (e) {
    if (requestId === detailRequestId) detailError.value = e.message
  } finally {
    if (requestId === detailRequestId) detailLoading.value = false
  }
}

watch([search, sort], () => {
  page.value = 1
})

onMounted(() => {
  let hashUser = ''
  try {
    hashUser = decodeURIComponent(location.hash.slice(1))
  } catch (e) {}
  if (hashUser) {
    username.value = hashUser
    analyzeUser(hashUser)
  }
})

onUnmounted(() => {
  userRequestId++
  detailRequestId++
})
</script>

<template>
  <div class="repo-scope-app">
    <div class="shell">
      <section class="search-bar">
        <UiSearch
          v-model="username"
          placeholder="torvalds"
          input-type="text"
          aria-label="GitHub username"
          :submit-label="t('analyze')"
          @submit="onSubmit"
        />
      </section>

      <UiLoading v-if="loading" :label="t('loading')" />

      <UiErrorState v-else-if="errorMsg" class="error-msg" :message="errorMsg" retry-label="" />

      <UiEmptyState v-else-if="!profile" class="start-state" :title="t('startTitle')" :description="t('startHint')">
        <template #actions>
          <UiButton
            v-for="name in ['torvalds', 'gaearon', 'sindresorhus']"
            :key="name"
            variant="secondary"
            size="sm"
            @click="analyzeExample(name)"
          >
            {{ name }}
          </UiButton>
        </template>
      </UiEmptyState>

      <template v-else-if="profile">
        <section class="profile-section">
          <UiCard class="profile-card">
            <div class="profile-row">
              <img
                v-if="safeExternalUrl(profile.avatar_url)"
                class="avatar"
                :src="safeExternalUrl(profile.avatar_url)"
                alt="avatar"
              />
              <div class="profile-info">
                <h2>{{ profile.name || profile.login }}</h2>
                <p class="profile-bio">{{ shortText(profile.bio, 300) }}</p>
                <div class="profile-meta">
                  <span v-for="(m, i) in profileMeta" :key="i" class="meta-item">
                    <span class="meta-label">{{ m.label }}</span>
                    <a v-if="m.url" :href="m.url" target="_blank" rel="noreferrer">{{ m.text }}</a>
                    <template v-else>{{ m.text }}</template>
                  </span>
                </div>
                <UiButton
                  v-if="safeExternalUrl(profile.html_url)"
                  variant="link"
                  size="sm"
                  class="profile-link"
                  :href="safeExternalUrl(profile.html_url)"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ t('openProfile') }}
                </UiButton>
              </div>
            </div>
          </UiCard>
          <div class="stat-strip">
            <UiStat v-for="(s, i) in statItems" :key="i" :label="s.label" :value="s.value" :sub="s.sub" card />
          </div>
          <p v-if="profile.public_repos > 100" class="sample-note">{{ t('sampleNote') }}</p>
        </section>

        <section class="lang-section">
          <UiSectionHead :title="t('languages')" />
          <div v-if="languageStats.length" class="lang-bars">
            <div v-for="l in languageStats" :key="l.name" class="lang-bar-row">
              <span class="lang-bar-name"
                ><span class="lang-dot" :style="{ background: l.color }"></span> {{ l.name }}</span
              >
              <div class="lang-bar-track">
                <div class="lang-bar-fill" :style="{ width: l.pct + '%', background: l.color }"></div>
              </div>
              <span class="lang-bar-pct">{{ num(l.count) }}</span>
            </div>
          </div>
          <UiEmptyState v-else compact :description="t('noLang')" />
        </section>

        <div class="repo-layout">
          <section class="repo-section">
            <UiSectionHead :title="t('repositories')">
              <template #actions>
                <div class="repo-controls">
                  <UiSelect
                    v-model="sort"
                    class="sort-select"
                    size="sm"
                    :options="sortOptions"
                    aria-label="Sort repositories"
                  />
                  <UiInput
                    v-model="search"
                    class="repo-filter"
                    size="sm"
                    :placeholder="t('filterPlaceholder')"
                    aria-label="Filter repositories"
                  />
                </div>
              </template>
            </UiSectionHead>
            <div class="repo-grid">
              <UiEmptyState v-if="!pagedReposView.length" compact :description="t('noRepos')" />
              <UiCard
                v-for="item in pagedReposView"
                :key="item.repo.full_name"
                as="button"
                type="button"
                class="repo-card"
                density="compact"
                interactive
                @click="loadDetail(item.repo.full_name)"
              >
                <span class="repo-card-name">{{ item.repo.name }}</span>
                <span class="repo-card-stats">
                  {{ num(item.repo.stargazers_count) }} {{ t('stars') }} · {{ num(item.repo.forks_count) }}
                  {{ t('forks') }}
                  <template v-if="item.repo.language">
                    · <span class="lang-dot" :style="{ background: langColor(item.repo.language) }"></span>
                    {{ item.repo.language }}</template
                  >
                </span>
                <p v-if="item.repo.description" class="repo-card-desc">{{ shortText(item.repo.description) }}</p>
                <div class="repo-card-updated">{{ t('pushed') }} {{ item.pushed }}</div>
              </UiCard>
            </div>
            <div v-if="pageButtons.length > 1" class="pagination">
              <UiButton variant="ghost" size="sm" :disabled="page <= 1" @click="changePage(page - 1)">←</UiButton>
              <UiButton
                v-for="p in pageButtons"
                :key="p"
                :variant="p === page ? 'primary' : 'secondary'"
                size="sm"
                @click="changePage(p)"
              >
                {{ p }}
              </UiButton>
              <UiButton variant="ghost" size="sm" :disabled="page >= totalPages" @click="changePage(page + 1)">
                →
              </UiButton>
            </div>
          </section>

          <UiCard v-if="detailFullName" as="aside" class="detail-section" :title="detailFullName">
            <template #actions>
              <UiIconButton label="Close" size="sm" @click="closeDetail">
                <X :size="14" aria-hidden="true" />
              </UiIconButton>
            </template>
            <div class="detail-body">
              <UiLoading v-if="detailLoading" inline compact :label="t('loading')" />
              <UiErrorState v-else-if="detailError" :message="detailError" retry-label="" />
              <template v-else-if="detail">
                <UiStat compact :label="t('stars')" :value="num(detail.stargazers_count)" />
                <UiStat compact :label="t('forks')" :value="num(detail.forks_count)" />
                <UiStat compact :label="t('issues')" :value="num(detail.open_issues_count)" />
                <UiStat
                  compact
                  :label="t('watchers')"
                  :value="num(detail.subscribers_count ?? detail.watchers_count)"
                />
                <UiStat compact :label="t('language')" :value="detail.language || '—'" />
                <UiStat compact :label="t('license')" :value="detail.license?.spdx_id || '—'" />
                <UiStat compact :label="t('size')" :value="num(detail.size) + ' KB'" />
                <UiStat compact :label="t('defaultBranch')" :value="detail.default_branch" />
                <UiStat compact :label="t('created')" :value="fmtDate(detail.created_at)" />
                <UiStat compact :label="t('pushed')" :value="fmtDate(detail.pushed_at)" />
                <div v-if="detail.homepage" class="detail-item">
                  <div class="d-label">{{ t('homepage') }}</div>
                  <div class="d-value">
                    <a
                      v-if="safeExternalUrl(detail.homepage)"
                      :href="safeExternalUrl(detail.homepage)"
                      target="_blank"
                      rel="noreferrer"
                      >{{ detail.homepage }}</a
                    >
                    <template v-else>{{ detail.homepage }}</template>
                  </div>
                </div>
                <div v-if="detail.topics?.length" class="detail-item detail-item-full">
                  <div class="d-label">{{ t('topics') }}</div>
                  <div class="d-value detail-tag-list">
                    <UiBadge v-for="tp in detail.topics" :key="tp" size="sm" mono>{{ tp }}</UiBadge>
                  </div>
                </div>
                <div v-if="safeExternalUrl(detail.html_url)" class="detail-item detail-item-full detail-tags-row">
                  <UiButton
                    variant="link"
                    size="sm"
                    :href="safeExternalUrl(detail.html_url)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub →
                  </UiButton>
                </div>
              </template>
            </div>
          </UiCard>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.repo-scope-app {
  --bg: var(--ok-bg);
  --paper: var(--ok-panel);
  --paper-2: var(--ok-bg);
  --ink: var(--ok-text);
  --muted: var(--ok-muted);
  --line: var(--ok-line);
  --accent: var(--ok-accent);
  --accent-soft: var(--ok-accent-soft);

  font-family: var(--ok-font);
  color: var(--ink);
}

.repo-scope-app a:hover {
  text-decoration: underline;
}

.shell {
  width: 100%;
  margin: 0;
  padding: 0 0 3rem;
}

.search-bar {
  margin-top: 0;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--line);
}

.error-msg {
  margin-top: 1rem;
}

.profile-section {
  margin-top: 1rem;
  display: grid;
  gap: 0.8rem;
}

.profile-row {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 2px solid var(--line);
  flex-shrink: 0;
}

.profile-info {
  min-width: 0;
}

.profile-info h2 {
  font-size: 1.3rem;
}

.profile-bio {
  color: var(--muted);
  font-size: 0.88rem;
  margin-top: 0.25rem;
  line-height: 1.5;
}

.profile-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin-top: 0.5rem;
  font-size: 0.78rem;
  color: var(--muted);
}

.profile-meta .meta-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.profile-meta .meta-label {
  font-family: var(--ok-mono);
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.profile-link {
  margin-top: 0.4rem;
}

.stat-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.6rem;
}

.stat-strip :deep(.ui-stat) {
  text-align: center;
  align-items: center;
}

.sample-note {
  font-size: 0.72rem;
  color: var(--muted);
  line-height: 1.5;
}

.lang-section {
  margin-top: 0.8rem;
}

.lang-bars {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.lang-bar-row {
  display: grid;
  grid-template-columns: 100px 1fr 50px;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.82rem;
}

.lang-bar-name {
  font-weight: 500;
}

.lang-bar-track {
  height: 18px;
  background: var(--paper-2);
  border: 1px solid rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.lang-bar-fill {
  height: 100%;
  transition: width 0.6s ease;
}

.lang-bar-pct {
  font-family: var(--ok-mono);
  font-size: 0.72rem;
  text-align: right;
  color: var(--muted);
}

.repo-section {
  min-width: 0;
}

.repo-controls {
  display: flex;
  gap: 0.4rem;
}

.sort-select {
  width: 8.5rem;
}

.repo-filter {
  width: 130px;
}

.repo-grid {
  display: grid;
  gap: 0.45rem;
}

.repo-card {
  width: 100%;
  margin: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.repo-card:focus-visible {
  outline: 2px solid var(--ok-accent);
  outline-offset: 2px;
}

.repo-card :deep(.ui-card-body) {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.3rem;
}

.repo-card-name {
  font-weight: 600;
  font-size: 0.92rem;
  color: var(--accent);
}

.repo-card-desc {
  grid-column: 1 / -1;
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.4;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.repo-card-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: center;
  font-family: var(--ok-mono);
  font-size: 0.72rem;
  color: var(--muted);
}

.repo-card-updated {
  grid-column: 1 / -1;
  font-size: 0.72rem;
  color: var(--muted);
}

.lang-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.repo-layout {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 1rem;
  align-items: start;
}

.detail-section {
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
}

.detail-body {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.5rem;
}

.detail-body :deep(.ui-loading),
.detail-body :deep(.ui-error) {
  grid-column: 1 / -1;
}

.detail-item {
  padding: 0.4rem 0;
  border-bottom: 1px dotted rgba(0, 0, 0, 0.08);
}

.detail-item-full {
  grid-column: 1 / -1;
}

.detail-tags-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.3rem;
  border-bottom: none;
}

.detail-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.detail-item .d-label {
  font-size: 0.68rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.detail-item .d-value {
  font-weight: 600;
  font-size: 0.92rem;
  margin-top: 0.1rem;
}

.pagination {
  display: flex;
  justify-content: center;
  gap: 0.3rem;
  margin-top: 0.8rem;
}

.pagination :deep(.ui-btn) {
  min-width: 2rem;
  padding: 0 0.45rem;
}

@media (max-width: 720px) {
  .stat-strip {
    grid-template-columns: repeat(2, 1fr);
  }
  .lang-bar-row {
    grid-template-columns: 70px 1fr 40px;
  }
  .profile-row {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .profile-meta {
    justify-content: center;
  }
  .detail-body {
    grid-template-columns: repeat(2, 1fr);
  }
  .repo-filter {
    width: 100%;
  }
}

@media (max-width: 900px) {
  .repo-layout {
    grid-template-columns: 1fr;
  }
  .detail-section {
    position: static;
    max-height: none;
  }
}
</style>
