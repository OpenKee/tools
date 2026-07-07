<script setup>
/* ============================================================
   Repo Deep Dive — GitHub 仓库深挖（Vue 3 SFC）
   - 多 GitHub REST API 协作：基本信息 + 语言字节 + 贡献者 + 提交活动 + topics
   - Promise.allSettled 并发，各卡片独立 loading/error
   - 可选 GitHub Token，规避未认证限流（60/小时）
   - 深色 GitHub 主题
   ============================================================ */

import { ref, computed, onMounted } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, lsGet, lsSet, githubLangColors, locale } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- i18n 文案字典 ---------- */
const copy = {
  en: {
    eyebrow: 'GitHub repo deep dive',
    title: 'Repo Deep Dive',
    lead: 'Enter an owner/repo to deep-dive: basic info, language bytes, contributors, 52-week commit activity, and topics.',
    searchPlaceholder: 'vuejs/core',
    dive: 'Deep dive',
    quickLinks: 'Try:',
    tokenToggle: 'Optional: GitHub token',
    tokenSave: 'Save',
    tokenClear: 'Clear',
    tokenConfigured: 'Configured',
    tokenNotConfigured: 'Not configured',
    errorNotFound: 'Repository not found.',
    errorRateLimit: 'GitHub API rate limit reached.',
    errorRateLimitHint: 'Unauthenticated requests are capped at 60/hr and shared by IP. Add a personal access token to raise to 5000/hr.',
    errorRateLimitReset: 'Resets at {time}.',
    errorForbidden: 'Access forbidden.',
    errorGeneric: 'Error: {msg}',
    errorStatsPending: 'Statistics are being computed by GitHub. Please retry in a moment.',
    stars: 'Stars',
    forks: 'Forks',
    issues: 'Open issues',
    watchers: 'Watchers',
    size: 'Size',
    defaultBranch: 'Default branch',
    license: 'License',
    created: 'Created',
    pushed: 'Last push',
    homepage: 'Homepage',
    openRepo: 'Open on GitHub',
    topics: 'Topics',
    languages: 'Language distribution',
    contributors: 'Contributors',
    commits: 'Commit activity',
    commits52: 'Past 52 weeks · {n} commits',
    noCommits: 'No commit activity data.',
    loading: 'Loading…',
    anonymous: 'anonymous',
    legend: 'Top languages',
    contributions: 'contributions',
    bytes: 'bytes',
    noLanguages: 'No language data.',
    noContributors: 'No contributor data.',
    noTopics: 'No topics.',
    hoverHint: 'Hover a node for details.',
  },
  zh: {
    eyebrow: 'GitHub 仓库深挖',
    title: '仓库深挖',
    lead: '输入 owner/repo 全名，深度透视一个仓库：基本信息、语言字节分布、贡献者、52 周提交活动、话题标签。',
    searchPlaceholder: 'vuejs/core',
    dive: '深挖',
    quickLinks: '试试：',
    tokenToggle: '可选：GitHub token',
    tokenSave: '保存',
    tokenClear: '清除',
    tokenConfigured: '已配置',
    tokenNotConfigured: '未配置',
    errorNotFound: '仓库不存在。',
    errorRateLimit: 'GitHub API 请求次数已达上限。',
    errorRateLimitHint: '未认证配额为 60 次/小时且按 IP 共享（与他人共用网络时易耗尽）。添加 Personal Access Token 可提升到 5000 次/小时。',
    errorRateLimitReset: '重置时间：{time}',
    errorForbidden: '访问被拒绝。',
    errorGeneric: '出错：{msg}',
    errorStatsPending: 'GitHub 正在统计中，请稍后重试。',
    stars: '星标',
    forks: 'Fork',
    issues: 'Open issues',
    watchers: '关注',
    size: '大小',
    defaultBranch: '默认分支',
    license: '许可证',
    created: '创建于',
    pushed: '最近推送',
    homepage: '主页',
    openRepo: '在 GitHub 打开',
    topics: '话题',
    languages: '语言分布',
    contributors: '贡献者',
    commits: '提交活动',
    commits52: '过去 52 周 · {n} 次提交',
    noCommits: '无提交活动数据。',
    loading: '加载中…',
    anonymous: '匿名',
    legend: '主要语言',
    contributions: '次贡献',
    bytes: '字节',
    noLanguages: '无语言数据。',
    noContributors: '无贡献者数据。',
    noTopics: '无话题。',
    hoverHint: '悬停节点查看详情。',
  },
}

const t = useT(copy)

/* ---------- 推荐快捷仓库 ---------- */
const quickPicks = ['vuejs/core', 'facebook/react', 'microsoft/vscode', 'torvalds/linux']

/* ---------- token 状态 ---------- */
const ghToken = ref(lsGet('repo-scope-token') || '')
const tokenInput = ref(ghToken.value)
const tokenToggleOpen = ref(false)
const tokenSaved = ref(false)

function saveToken() {
  const v = tokenInput.value.trim()
  if (!v) return
  ghToken.value = v
  lsSet('repo-scope-token', v)
  tokenSaved.value = true
  setTimeout(() => { tokenSaved.value = false }, 1500)
}

function clearToken() {
  ghToken.value = ''
  tokenInput.value = ''
  try { localStorage.removeItem('repo-scope-token') } catch (e) {}
}

/* ---------- 搜索状态 ---------- */
const repoInput = ref('')
const currentRepo = ref('')

/* ---------- 各 API 独立状态 ---------- */
const repoInfo = ref(null)
const languages = ref(null)
const contributors = ref(null)
const participation = ref(null)

const loadingInfo = ref(false)
const loadingLangs = ref(false)
const loadingContribs = ref(false)
const loadingCommits = ref(false)

const errorInfo = ref('')
const errorLangs = ref('')
const errorContribs = ref('')
const errorCommits = ref('')

const hoveredLang = ref(null)

/* ---------- 工具函数 ---------- */
function num(v) {
  return new Intl.NumberFormat(locale()).format(v || 0)
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(locale())
}

function langColor(name) {
  return githubLangColors[name] || '#999'
}

/* ---------- ghFetch：GitHub REST 封装 ---------- */
// 404 抛 not_found；真限流（响应体 message 含 "rate limit"）抛 rate_limit；
// 其他 403 抛 forbidden；202（stats 计算中）返回 null；其余非 ok 抛原始 message。
// 注意：不能用 remaining===0 判断——响应缺失该头时默认值也是 0，会误判。
async function ghFetch(url) {
  const headers = { Accept: 'application/vnd.github+json' }
  if (ghToken.value) headers.Authorization = `Bearer ${ghToken.value}`
  const r = await fetch(url, { headers })
  const reset = parseInt(r.headers.get('x-ratelimit-reset') || '0', 10)
  if (r.status === 404) throw new Error('not_found')
  if (r.status === 403 || r.status === 429) {
    // 读响应体，用 message 文本判断是否真限流（GitHub 真限流 message 一定含 "rate limit"）
    const body = await r.json().catch(() => ({}))
    const msg = (body && body.message) || ''
    if (/rate limit/i.test(msg)) {
      const err = new Error('rate_limit')
      err.resetAt = reset ? new Date(reset * 1000) : null
      throw err
    }
    throw new Error('forbidden')
  }
  if (r.status === 202) return null
  if (!r.ok) {
    let msg = `${r.status}`
    try { const b = await r.json(); msg = b.message || msg } catch (e) {}
    throw new Error(msg)
  }
  return r.json()
}

// 统一的错误信息格式化；rate_limit 时自动展开 token 配置区
function formatError(e) {
  if (e.message === 'not_found') return t.value('errorNotFound')
  if (e.message === 'rate_limit') {
    tokenToggleOpen.value = true
    let msg = t.value('errorRateLimit')
    // 未配 token 时给出 IP 共享配额的解释，避免用户误以为是自己的请求导致的
    if (!ghToken.value) {
      msg += ' ' + t.value('errorRateLimitHint')
    }
    if (e.resetAt) {
      const timeStr = e.resetAt.toLocaleString(locale(), {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
      })
      msg += ' ' + t.value('errorRateLimitReset').replace('{time}', timeStr)
    }
    return msg
  }
  if (e.message === 'forbidden') return t.value('errorForbidden')
  return t.value('errorGeneric').replace('{msg}', e.message)
}

/* ---------- 主流程：深挖 ---------- */
async function dive() {
  const q = repoInput.value.trim()
  if (!q) return
  // 简单校验 owner/repo 格式
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(q)) {
    errorInfo.value = t.value('errorGeneric').replace('{msg}', 'owner/repo')
    return
  }
  currentRepo.value = q
  // 重置所有
  repoInfo.value = null
  languages.value = null
  contributors.value = null
  participation.value = null
  errorInfo.value = ''
  errorLangs.value = ''
  errorContribs.value = ''
  errorCommits.value = ''
  loadingInfo.value = true
  loadingLangs.value = true
  loadingContribs.value = true
  loadingCommits.value = true

  const base = `https://api.github.com/repos/${q}`
  const results = await Promise.allSettled([
    ghFetch(base),
    ghFetch(base + '/languages'),
    ghFetch(base + '/contributors?per_page=30&anon=1'),
    ghFetch(base + '/stats/participation'),
  ])

  // 基本信息
  if (results[0].status === 'fulfilled') {
    repoInfo.value = results[0].value
  } else {
    errorInfo.value = formatError(results[0].reason)
  }
  loadingInfo.value = false

  // 语言分布
  if (results[1].status === 'fulfilled') {
    languages.value = results[1].value
  } else {
    errorLangs.value = formatError(results[1].reason)
  }
  loadingLangs.value = false

  // 贡献者
  if (results[2].status === 'fulfilled') {
    contributors.value = results[2].value
  } else {
    errorContribs.value = formatError(results[2].reason)
  }
  loadingContribs.value = false

  // 提交活动（202 时为 null）
  if (results[3].status === 'fulfilled') {
    participation.value = results[3].value
    if (results[3].value === null) {
      errorCommits.value = t.value('errorStatsPending')
    }
  } else {
    errorCommits.value = formatError(results[3].reason)
  }
  loadingCommits.value = false
}

function onSearchKey(e) {
  if (e.key === 'Enter') dive()
}

function quickPick(name) {
  repoInput.value = name
  dive()
}

/* ---------- 派生：基本指标网格 ---------- */
const metrics = computed(() => {
  if (!repoInfo.value) return []
  const r = repoInfo.value
  return [
    { label: t.value('stars'), value: num(r.stargazers_count) },
    { label: t.value('forks'), value: num(r.forks_count) },
    { label: t.value('issues'), value: num(r.open_issues_count) },
    { label: t.value('watchers'), value: num(r.subscribers_count ?? r.watchers_count) },
    { label: t.value('size'), value: num(r.size) + ' KB' },
    { label: t.value('defaultBranch'), value: r.default_branch || '—' },
  ]
})

const repoTopics = computed(() => repoInfo.value?.topics || [])

/* ---------- 派生：语言节点图 ---------- */
// 每个语言一个圆：圆周等角排列，半径按字节占比（min 8, max 40）
const SVG_W = 480
const SVG_H = 360

const langNodes = computed(() => {
  if (!languages.value) return []
  const entries = Object.entries(languages.value)
  if (!entries.length) return []
  const total = entries.reduce((s, [, b]) => s + b, 0) || 1
  const maxBytes = entries[0][1]
  // 取 top 12 防止节点过密
  const sorted = entries.sort((a, b) => b[1] - a[1]).slice(0, 12)
  const cx = SVG_W / 2
  const cy = SVG_H / 2
  const ringR = 120
  const n = sorted.length
  return sorted.map(([name, bytes], i) => {
    const ratio = bytes / maxBytes
    const r = 8 + ratio * (40 - 8)
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2
    return {
      name,
      bytes,
      pct: ((bytes / total) * 100).toFixed(2),
      color: langColor(name),
      r,
      x: cx + ringR * Math.cos(angle),
      y: cy + ringR * Math.sin(angle),
    }
  })
})

const langLegend = computed(() => {
  if (!languages.value) return []
  const entries = Object.entries(languages.value)
  if (!entries.length) return []
  const total = entries.reduce((s, [, b]) => s + b, 0) || 1
  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, bytes]) => ({
      name,
      bytes,
      pct: ((bytes / total) * 100).toFixed(1),
      color: langColor(name),
    }))
})

/* ---------- 派生：top 12 贡献者 ---------- */
const topContributors = computed(() => {
  if (!Array.isArray(contributors.value)) return []
  return [...contributors.value]
    .sort((a, b) => (b.contributions || 0) - (a.contributions || 0))
    .slice(0, 12)
})

/* ---------- 派生：52 周提交柱状图 ---------- */
const COMMIT_W = 520
const COMMIT_H = 140
const commitBars = computed(() => {
  const all = participation.value && Array.isArray(participation.value.all) ? participation.value.all : []
  if (!all.length) return []
  const max = Math.max(1, ...all)
  const pad = 4
  const barW = (COMMIT_W - pad * 2) / all.length
  const innerH = COMMIT_H - 16
  const currentIdx = all.length - 1
  return all.map((v, i) => {
    const h = (v / max) * innerH
    return {
      x: pad + i * barW,
      w: Math.max(1, barW - 1),
      h,
      y: COMMIT_H - h - 2,
      v,
      isCurrent: i === currentIdx,
    }
  })
})

const totalCommits = computed(() => {
  const all = participation.value && Array.isArray(participation.value.all) ? participation.value.all : []
  return all.reduce((s, v) => s + (v || 0), 0)
})

/* ---------- 生命周期 ---------- */
onMounted(() => {
  const hash = decodeURIComponent(location.hash.slice(1))
  if (hash) {
    repoInput.value = hash
    dive()
  }
})
</script>

<template>
  <div class="repo-deep-dive">
    <AppHeader :title="{ en: 'Repo Deep Dive', zh: '仓库深挖' }" :show-lang-toggle="true" />

    <main class="shell">
      <!-- masthead -->
      <header class="masthead">
        <p class="eyebrow">{{ t('eyebrow') }}</p>
        <h1>{{ t('title') }}</h1>
        <p class="lead">{{ t('lead') }}</p>
      </header>

      <!-- 搜索区 -->
      <section class="search-bar">
        <div class="search-row">
          <input
            v-model="repoInput"
            type="text"
            :placeholder="t('searchPlaceholder')"
            autocomplete="off"
            aria-label="owner/repo"
            @keydown="onSearchKey"
          />
          <button type="button" @click="dive">{{ t('dive') }}</button>
        </div>
        <div class="quick-row">
          <span class="quick-label">{{ t('quickLinks') }}</span>
          <button
            v-for="name in quickPicks"
            :key="name"
            type="button"
            class="quick-pill"
            @click="quickPick(name)"
          >{{ name }}</button>
        </div>

        <!-- token 配置折叠区 -->
        <details class="token-toggle" :open="tokenToggleOpen">
          <summary @click.prevent="tokenToggleOpen = !tokenToggleOpen">
            <span>{{ t('tokenToggle') }}</span>
            <span class="token-badge" :class="{ on: ghToken }">
              {{ ghToken ? t('tokenConfigured') : t('tokenNotConfigured') }}
            </span>
          </summary>
          <div class="token-row">
            <input
              v-model="tokenInput"
              type="password"
              placeholder="ghp_xxxx"
              autocomplete="off"
              aria-label="GitHub personal access token"
              :class="{ 'token-ok': tokenSaved }"
            />
            <button type="button" @click="saveToken">{{ t('tokenSave') }}</button>
            <button type="button" class="btn-ghost" @click="clearToken">{{ t('tokenClear') }}</button>
          </div>
        </details>
      </section>

      <!-- 结果区 -->
      <section v-if="currentRepo" class="result-grid">
        <!-- 1. 仓库概览大卡 -->
        <article class="card card-overview">
          <div v-if="loadingInfo" class="loading"><span class="spinner"></span>{{ t('loading') }}</div>
          <p v-else-if="errorInfo" class="error-msg">{{ errorInfo }}</p>
          <template v-else-if="repoInfo">
            <div class="overview-head">
              <h2>
                <a :href="repoInfo.html_url" target="_blank" rel="noreferrer">{{ repoInfo.full_name }}</a>
              </h2>
              <a :href="repoInfo.html_url" target="_blank" rel="noreferrer" class="open-gh">{{ t('openRepo') }}</a>
            </div>
            <p v-if="repoInfo.description" class="overview-desc">{{ repoInfo.description }}</p>
            <div class="metrics-grid">
              <div v-for="(m, i) in metrics" :key="i" class="metric">
                <div class="metric-label">{{ m.label }}</div>
                <div class="metric-value">{{ m.value }}</div>
              </div>
            </div>
            <div class="overview-meta">
              <span v-if="repoInfo.license && repoInfo.license.spdx_id">
                <span class="meta-label">{{ t('license') }}</span>
                {{ repoInfo.license.spdx_id }}
              </span>
              <span>
                <span class="meta-label">{{ t('created') }}</span>
                {{ fmtDate(repoInfo.created_at) }}
              </span>
              <span>
                <span class="meta-label">{{ t('pushed') }}</span>
                {{ fmtDate(repoInfo.pushed_at) }}
              </span>
              <span v-if="repoInfo.homepage">
                <span class="meta-label">{{ t('homepage') }}</span>
                <a :href="repoInfo.homepage" target="_blank" rel="noreferrer">{{ repoInfo.homepage }}</a>
              </span>
            </div>
          </template>
        </article>

        <!-- 2. 语言节点图 -->
        <article class="card card-langs">
          <h3 class="card-title">{{ t('languages') }}</h3>
          <div v-if="loadingLangs" class="loading"><span class="spinner"></span>{{ t('loading') }}</div>
          <p v-else-if="errorLangs" class="error-msg">{{ errorLangs }}</p>
          <template v-else>
            <div v-if="langNodes.length" class="lang-graph">
              <div class="lang-svg-wrap">
                <svg :viewBox="`0 0 ${SVG_W} ${SVG_H}`" class="lang-svg" preserveAspectRatio="xMidYMid meet">
                  <g v-for="node in langNodes" :key="node.name">
                    <circle
                      :cx="node.x" :cy="node.y" :r="node.r"
                      :fill="node.color"
                      stroke="rgba(255,255,255,0.35)" stroke-width="1.5"
                      :class="['lang-circle', { dim: hoveredLang && hoveredLang.name !== node.name }]"
                      @mouseenter="hoveredLang = node"
                      @mouseleave="hoveredLang = null"
                    />
                    <text
                      :x="node.x" :y="node.y + node.r + 12"
                      text-anchor="middle" class="lang-label"
                    >{{ node.name }}</text>
                  </g>
                </svg>
                <div class="lang-tooltip" :class="{ show: hoveredLang }">
                  <template v-if="hoveredLang">
                    <span class="tt-name" :style="{ color: hoveredLang.color }">{{ hoveredLang.name }}</span>
                    <span class="tt-row">{{ num(hoveredLang.bytes) }} {{ t('bytes') }}</span>
                    <span class="tt-row">{{ hoveredLang.pct }}%</span>
                  </template>
                  <template v-else>{{ t('hoverHint') }}</template>
                </div>
              </div>
              <ul class="lang-legend">
                <li v-for="l in langLegend" :key="l.name" class="legend-row">
                  <span class="legend-dot" :style="{ background: l.color }"></span>
                  <span class="legend-name">{{ l.name }}</span>
                  <span class="legend-pct">{{ l.pct }}%</span>
                </li>
              </ul>
            </div>
            <div v-else class="loading">{{ t('noLanguages') }}</div>
          </template>
        </article>

        <!-- 3. 贡献者 -->
        <article class="card card-contribs">
          <h3 class="card-title">{{ t('contributors') }}</h3>
          <div v-if="loadingContribs" class="loading"><span class="spinner"></span>{{ t('loading') }}</div>
          <p v-else-if="errorContribs" class="error-msg">{{ errorContribs }}</p>
          <template v-else>
            <div v-if="topContributors.length" class="contrib-grid">
              <a
                v-for="c in topContributors"
                :key="(c.login || c.name) + (c.id || '')"
                :href="c.html_url || (c.login ? `https://github.com/${c.login}` : null)"
                target="_blank"
                rel="noreferrer"
                class="contrib-card"
              >
                <img
                  v-if="c.avatar_url"
                  :src="c.avatar_url"
                  :alt="c.login || c.name || t('anonymous')"
                  class="contrib-avatar"
                  loading="lazy"
                />
                <span v-else class="contrib-avatar contrib-avatar-fallback"></span>
                <span class="contrib-name">{{ c.login || c.name || t('anonymous') }}</span>
                <span class="contrib-count">{{ num(c.contributions) }}</span>
              </a>
            </div>
            <div v-else class="loading">{{ t('noContributors') }}</div>
          </template>
        </article>

        <!-- 4. 提交活动柱状图 -->
        <article class="card card-commits">
          <h3 class="card-title">{{ t('commits') }}</h3>
          <div v-if="loadingCommits" class="loading"><span class="spinner"></span>{{ t('loading') }}</div>
          <p v-else-if="errorCommits" class="error-msg">{{ errorCommits }}</p>
          <template v-else>
            <div v-if="commitBars.length" class="commit-wrap">
              <p class="commit-summary">{{ t('commits52').replace('{n}', num(totalCommits)) }}</p>
              <svg :viewBox="`0 0 ${COMMIT_W} ${COMMIT_H}`" class="commit-svg" preserveAspectRatio="none">
                <rect
                  v-for="(bar, i) in commitBars"
                  :key="i"
                  :x="bar.x" :y="bar.y" :width="bar.w" :height="bar.h"
                  :class="['commit-bar', { current: bar.isCurrent }]"
                />
              </svg>
            </div>
            <div v-else class="loading">{{ t('noCommits') }}</div>
          </template>
        </article>

        <!-- 5. Topics -->
        <article class="card card-topics">
          <h3 class="card-title">{{ t('topics') }}</h3>
          <div v-if="repoTopics.length" class="topics-cloud">
            <a
              v-for="tp in repoTopics"
              :key="tp"
              :href="`https://github.com/topics/${tp}`"
              target="_blank"
              rel="noreferrer"
              class="topic-pill"
            >{{ tp }}</a>
          </div>
          <div v-else class="loading">{{ t('noTopics') }}</div>
        </article>
      </section>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Repo Deep Dive — 深色 GitHub 主题
   在组件根类上覆盖 --ok-* 令牌，影响 AppHeader / AppFooter 等共享组件。
   ============================================================ */

.repo-deep-dive {
  --ok-bg: #0d1117;
  --ok-panel: #161b22;
  --ok-line: rgba(255, 255, 255, 0.1);
  --ok-text: #e6edf3;
  --ok-muted: #8b949e;
  --ok-accent: #58a6ff;
  --ok-radius: 8px;
  --ok-up: #3fb950;

  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  color: var(--ok-text);
  background: var(--ok-bg);
  min-height: 100vh;
}

.repo-deep-dive a {
  color: var(--ok-accent);
  text-decoration: none;
}
.repo-deep-dive a:hover {
  text-decoration: underline;
}

/* ---------- 主容器 ---------- */

.shell {
  width: min(1100px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

.masthead {
  padding: 0.5rem 0 1rem;
  border-bottom: 1px solid var(--ok-line);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
  color: var(--ok-muted);
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}

.masthead h1 {
  margin: 0.25rem 0 0;
  font-size: clamp(1.8rem, 4.5vw, 2.8rem);
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: var(--ok-text);
}

.lead {
  margin: 0.4rem 0 0;
  color: var(--ok-muted);
  font-size: 0.88rem;
  line-height: 1.5;
  max-width: 70ch;
}

/* ---------- 搜索区 ---------- */

.search-bar {
  margin-top: 0.8rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--ok-line);
}

.search-row {
  display: flex;
  gap: 0.5rem;
}

.search-row input[type="text"] {
  flex: 1;
  font: inherit;
  height: 2.6rem;
  padding: 0 0.75rem;
  border: 1px solid var(--ok-line);
  background: var(--ok-panel);
  color: var(--ok-text);
  font-size: 1rem;
  border-radius: var(--ok-radius);
}
.search-row input[type="text"]:focus {
  outline: none;
  border-color: var(--ok-accent);
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.25);
}

.search-row button {
  font: inherit;
  height: 2.6rem;
  padding: 0 1.2rem;
  border: 1px solid var(--ok-accent);
  background: var(--ok-accent);
  color: #0d1117;
  cursor: pointer;
  font-weight: 600;
  border-radius: var(--ok-radius);
}
.search-row button:hover {
  filter: brightness(1.08);
}

.quick-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

.quick-label {
  font-size: 0.74rem;
  color: var(--ok-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.quick-pill {
  font: inherit;
  font-size: 0.76rem;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--ok-line);
  background: transparent;
  color: var(--ok-accent);
  cursor: pointer;
  border-radius: 999px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.quick-pill:hover {
  background: rgba(88, 166, 255, 0.12);
  border-color: var(--ok-accent);
}

/* token 配置折叠区 */
.token-toggle {
  margin-top: 0.6rem;
}

.token-toggle summary {
  cursor: pointer;
  color: var(--ok-muted);
  font-size: 0.78rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  list-style: none;
}
.token-toggle summary::-webkit-details-marker { display: none; }

.token-badge {
  font-size: 0.66rem;
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--ok-line);
  border-radius: 999px;
  color: var(--ok-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.token-badge.on {
  color: var(--ok-up);
  border-color: rgba(63, 185, 80, 0.5);
  background: rgba(63, 185, 80, 0.1);
}

.token-row {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.4rem;
  align-items: center;
}

.token-row input {
  flex: 1;
  font: inherit;
  height: 2rem;
  padding: 0 0.5rem;
  border: 1px solid var(--ok-line);
  background: var(--ok-panel);
  color: var(--ok-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.78rem;
  border-radius: 4px;
}
.token-row input:focus {
  outline: none;
  border-color: var(--ok-accent);
}
.token-row input.token-ok {
  border-color: var(--ok-up);
  background: rgba(63, 185, 80, 0.08);
}

.token-row button {
  font: inherit;
  height: 2rem;
  padding: 0 0.6rem;
  border: 1px solid var(--ok-line);
  background: transparent;
  color: var(--ok-text);
  cursor: pointer;
  font-size: 0.76rem;
  border-radius: 4px;
}
.token-row button:first-of-type:hover {
  border-color: var(--ok-accent);
  color: var(--ok-accent);
}

.btn-ghost {
  color: var(--ok-muted) !important;
}
.btn-ghost:hover {
  color: #f85149 !important;
  border-color: rgba(248, 81, 73, 0.5) !important;
}

/* ---------- 结果区栅格 ---------- */

.result-grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 880px) {
  .result-grid {
    grid-template-columns: 1fr 1fr;
  }
  .card-overview,
  .card-commits {
    grid-column: 1 / -1;
  }
}

/* ---------- 通用卡片 ---------- */

.card {
  background: var(--ok-panel);
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius);
  padding: 1rem 1.1rem;
  min-width: 0;
}

.card-title {
  margin: 0 0 0.6rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ok-text);
  border-bottom: 1px solid var(--ok-line);
  padding-bottom: 0.4rem;
}

/* ---------- 1. 概览卡 ---------- */

.overview-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.overview-head h2 {
  margin: 0;
  font-size: 1.4rem;
  letter-spacing: -0.02em;
}

.overview-head h2 a {
  color: var(--ok-text);
}
.overview-head h2 a:hover {
  color: var(--ok-accent);
}

.open-gh {
  font-size: 0.76rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  padding: 0.25rem 0.55rem;
  border: 1px solid var(--ok-line);
  border-radius: 4px;
}
.open-gh:hover {
  border-color: var(--ok-accent);
  background: rgba(88, 166, 255, 0.08);
}

.overview-desc {
  margin: 0.5rem 0 0.8rem;
  color: var(--ok-text);
  line-height: 1.5;
  font-size: 0.92rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.8rem;
}
@media (min-width: 560px) {
  .metrics-grid { grid-template-columns: repeat(6, 1fr); }
}

.metric {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--ok-line);
  border-radius: 6px;
  padding: 0.5rem 0.4rem;
  text-align: center;
}

.metric-label {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ok-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.metric-value {
  font-size: 1.05rem;
  font-weight: 700;
  margin-top: 0.15rem;
  letter-spacing: -0.02em;
}

.overview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.2rem;
  font-size: 0.8rem;
  color: var(--ok-text);
  border-top: 1px solid var(--ok-line);
  padding-top: 0.6rem;
}

.meta-label {
  color: var(--ok-muted);
  margin-right: 0.25rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

/* ---------- 2. 语言节点图 ---------- */

.lang-graph {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.8rem;
}
@media (min-width: 560px) {
  .lang-graph {
    grid-template-columns: 1.4fr 1fr;
    align-items: start;
  }
}

.lang-svg-wrap {
  position: relative;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--ok-line);
  border-radius: 6px;
  padding: 0.25rem;
}

.lang-svg {
  width: 100%;
  height: auto;
  display: block;
}

.lang-circle {
  transition: transform 120ms ease, opacity 120ms ease;
  transform-origin: center;
  transform-box: fill-box;
  cursor: pointer;
}
.lang-circle:hover {
  transform: scale(1.1);
}
.lang-circle.dim {
  opacity: 0.35;
}

.lang-label {
  font-size: 10px;
  fill: var(--ok-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  pointer-events: none;
}

.lang-tooltip {
  position: absolute;
  top: 0.4rem;
  left: 0.4rem;
  right: 0.4rem;
  background: rgba(13, 17, 23, 0.92);
  border: 1px solid var(--ok-line);
  border-radius: 4px;
  padding: 0.3rem 0.5rem;
  font-size: 0.72rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--ok-muted);
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  pointer-events: none;
  min-height: 1.2rem;
}
.lang-tooltip.show {
  color: var(--ok-text);
}
.tt-name {
  font-weight: 700;
  font-size: 0.8rem;
}
.tt-row {
  color: var(--ok-muted);
}

.lang-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.legend-row {
  display: grid;
  grid-template-columns: 12px 1fr auto;
  gap: 0.4rem;
  align-items: center;
  font-size: 0.78rem;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.legend-name {
  color: var(--ok-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-pct {
  color: var(--ok-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.74rem;
}

/* ---------- 3. 贡献者 ---------- */

.contrib-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}
@media (min-width: 480px) {
  .contrib-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 720px) {
  .contrib-grid { grid-template-columns: repeat(4, 1fr); }
}

.contrib-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.6rem 0.4rem;
  border: 1px solid var(--ok-line);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  text-align: center;
  text-decoration: none;
}
.contrib-card:hover {
  border-color: var(--ok-accent);
  background: rgba(88, 166, 255, 0.06);
  text-decoration: none;
}

.contrib-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid var(--ok-line);
  object-fit: cover;
}
.contrib-avatar-fallback {
  background: var(--ok-muted);
  display: inline-block;
}

.contrib-name {
  font-size: 0.78rem;
  color: var(--ok-accent);
  font-weight: 500;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contrib-count {
  font-size: 0.7rem;
  color: var(--ok-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

/* ---------- 4. 提交活动 ---------- */

.commit-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.commit-summary {
  margin: 0;
  font-size: 0.78rem;
  color: var(--ok-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.commit-svg {
  width: 100%;
  height: 140px;
  display: block;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--ok-line);
  border-radius: 6px;
}

.commit-bar {
  fill: var(--ok-accent);
  transition: fill 100ms;
}
.commit-bar.current {
  fill: var(--ok-up);
}
.commit-bar:hover {
  fill: #ffffff;
}

/* ---------- 5. Topics ---------- */

.topics-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.topic-pill {
  font-size: 0.78rem;
  padding: 0.25rem 0.65rem;
  border: 1px solid var(--ok-line);
  border-radius: 999px;
  color: var(--ok-accent);
  background: rgba(88, 166, 255, 0.06);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-decoration: none;
}
.topic-pill:hover {
  background: rgba(88, 166, 255, 0.16);
  border-color: var(--ok-accent);
  text-decoration: none;
}

/* ---------- 加载与错误 ---------- */

.loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ok-muted);
  padding: 0.5rem 0;
  font-size: 0.85rem;
}

.spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid var(--ok-line);
  border-top-color: var(--ok-accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  display: inline-block;
}

@keyframes spin { to { transform: rotate(360deg); } }

.error-msg {
  color: #f85149;
  background: rgba(248, 81, 73, 0.08);
  border: 1px solid rgba(248, 81, 73, 0.3);
  padding: 0.6rem 0.7rem;
  border-radius: 6px;
  font-size: 0.85rem;
  margin: 0;
  line-height: 1.5;
}

/* ---------- 响应式 ---------- */

@media (max-width: 560px) {
  .overview-head {
    flex-direction: column;
    align-items: flex-start;
  }
  .overview-meta {
    flex-direction: column;
    gap: 0.3rem;
  }
}
</style>
