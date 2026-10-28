<script setup>
import { ref, computed, onMounted } from 'vue'
import { useT } from '../i18n.js'
import { githubLangColors, locale, githubAPI, shortText } from '../ok.js'
import { useGithubToken } from '../lib/github-auth.js'
import { safeExternalUrl } from '../lib/format.js'
import {
  UiBadge,
  UiButton,
  UiCard,
  UiChip,
  UiEmptyState,
  UiErrorState,
  UiLoading,
  UiSearch,
  UiStat,
} from '../components/ui/index.js'
import copy from '../copy/repo-deep-dive.js'

const t = useT(copy)

const quickPicks = ['vuejs/core', 'facebook/react', 'microsoft/vscode', 'torvalds/linux']

const { token: ghToken, panelOpen: tokenPanelOpen } = useGithubToken()

const repoInput = ref('')
const currentRepo = ref('')
let diveRequestId = 0

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

function num(v) {
  return new Intl.NumberFormat(locale()).format(v || 0)
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(locale())
}

function langColor(name) {
  return githubLangColors[name] || '#8b949e'
}

function shortLang(name) {
  const value = String(name || '')
  return value.length > 14 ? value.slice(0, 12) + '…' : value
}

function contributorUrl(contributor) {
  const fallback = contributor.login ? `https://github.com/${encodeURIComponent(contributor.login)}` : ''
  return safeExternalUrl(contributor.html_url || fallback)
}

async function ghFetch(url) {
  return githubAPI(url, { token: ghToken.value })
}

function formatError(e) {
  if (e.message === 'not_found') return t.value('errorNotFound')
  if (e.message === 'rate_limit') {
    tokenPanelOpen.value = true
    let msg = t.value('errorRateLimit')

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
    return msg
  }
  if (e.message === 'forbidden') return t.value('errorForbidden')
  return t.value('errorGeneric').replace('{msg}', e.message)
}

async function dive() {
  const q = repoInput.value.trim()
  if (!q) return

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(q)) {
    errorInfo.value = t.value('errorGeneric').replace('{msg}', 'owner/repo')
    return
  }
  const requestId = ++diveRequestId
  currentRepo.value = q

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
  if (requestId !== diveRequestId) return

  if (results[0].status === 'fulfilled') {
    repoInfo.value = results[0].value
  } else {
    errorInfo.value = formatError(results[0].reason)
  }
  loadingInfo.value = false

  if (results[1].status === 'fulfilled') {
    languages.value = results[1].value
  } else {
    errorLangs.value = formatError(results[1].reason)
  }
  loadingLangs.value = false

  if (results[2].status === 'fulfilled') {
    contributors.value = results[2].value
  } else {
    errorContribs.value = formatError(results[2].reason)
  }
  loadingContribs.value = false

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

function quickPick(name) {
  repoInput.value = name
  dive()
}

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

const LANG_PIE_R = 56
const LANG_PIE_C = 2 * Math.PI * LANG_PIE_R

const langSegments = computed(() => {
  if (!languages.value) return []
  const entries = Object.entries(languages.value)
  if (!entries.length) return []
  const total = entries.reduce((s, [, b]) => s + b, 0) || 1
  const sorted = entries.sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, 8)
  const rest = sorted.slice(8)
  const segments = top.map(([name, bytes]) => ({ name, bytes, color: langColor(name) }))
  if (rest.length) {
    segments.push({
      name: t.value('otherLanguages'),
      bytes: rest.reduce((s, [, b]) => s + b, 0),
      color: '#8b949e',
    })
  }
  let cumulative = 0
  return segments.map((seg) => {
    const share = (seg.bytes / total) * 100
    const dash = (share / 100) * LANG_PIE_C
    const item = {
      ...seg,
      share,
      pct: share.toFixed(1),
      dash,
      gap: LANG_PIE_C - dash,
      offset: -(cumulative / 100) * LANG_PIE_C,
    }
    cumulative += share
    return item
  })
})

const topContributors = computed(() => {
  if (!Array.isArray(contributors.value)) return []
  return [...contributors.value].sort((a, b) => (b.contributions || 0) - (a.contributions || 0)).slice(0, 12)
})

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

onMounted(() => {
  let hash = ''
  try {
    hash = decodeURIComponent(location.hash.slice(1))
  } catch (e) {}
  if (hash) {
    repoInput.value = hash
    dive()
  }
})
</script>

<template>
  <div class="repo-deep-dive">
    <div class="shell">
      <section class="search-bar">
        <UiSearch
          v-model="repoInput"
          :placeholder="t('searchPlaceholder')"
          input-type="text"
          aria-label="owner/repo"
          :submit-label="t('dive')"
          @submit="dive"
        />
        <div class="quick-row">
          <span class="quick-label">{{ t('quickLinks') }}</span>
          <UiChip v-for="name in quickPicks" :key="name" class="quick-pick" size="sm" @click="quickPick(name)">
            {{ name }}
          </UiChip>
        </div>
      </section>

      <section v-if="currentRepo" class="result-grid">
        <UiCard class="card-overview">
          <UiLoading v-if="loadingInfo" inline compact :label="t('loading')" />
          <UiErrorState v-else-if="errorInfo" :message="errorInfo" retry-label="" />
          <template v-else-if="repoInfo">
            <div class="overview-head">
              <h2>
                <a
                  v-if="safeExternalUrl(repoInfo.html_url)"
                  :href="safeExternalUrl(repoInfo.html_url)"
                  target="_blank"
                  rel="noreferrer"
                  >{{ repoInfo.full_name }}</a
                >
                <template v-else>{{ repoInfo.full_name }}</template>
              </h2>
              <UiButton
                v-if="safeExternalUrl(repoInfo.html_url)"
                variant="secondary"
                size="sm"
                :href="safeExternalUrl(repoInfo.html_url)"
                target="_blank"
                rel="noreferrer"
              >
                {{ t('openRepo') }}
              </UiButton>
            </div>
            <p v-if="repoInfo.description" class="overview-desc">{{ shortText(repoInfo.description, 500) }}</p>
            <div class="metrics-grid">
              <UiStat v-for="(m, i) in metrics" :key="i" :label="m.label" :value="m.value" card compact />
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
                <a
                  v-if="safeExternalUrl(repoInfo.homepage)"
                  :href="safeExternalUrl(repoInfo.homepage)"
                  target="_blank"
                  rel="noreferrer"
                  >{{ repoInfo.homepage }}</a
                >
                <template v-else>{{ repoInfo.homepage }}</template>
              </span>
            </div>
          </template>
        </UiCard>

        <UiCard class="card-langs" :title="t('languages')">
          <UiLoading v-if="loadingLangs" inline compact :label="t('loading')" />
          <UiErrorState v-else-if="errorLangs" :message="errorLangs" retry-label="" />
          <div v-else-if="langSegments.length" class="lang-visual-wrap">
            <div class="lang-visual">
              <div class="lang-pie">
                <svg viewBox="0 0 160 160" role="img" :aria-label="t('languages')">
                  <circle cx="80" cy="80" :r="LANG_PIE_R" fill="none" stroke="var(--ok-line)" stroke-width="20" />
                  <circle
                    v-for="seg in langSegments"
                    :key="seg.name"
                    cx="80"
                    cy="80"
                    :r="LANG_PIE_R"
                    fill="none"
                    :stroke="seg.color"
                    stroke-width="20"
                    :stroke-dasharray="`${seg.dash} ${seg.gap}`"
                    :stroke-dashoffset="seg.offset"
                    transform="rotate(-90 80 80)"
                  >
                    <title>{{ seg.name }} {{ seg.pct }}%</title>
                  </circle>
                  <text x="80" y="76" text-anchor="middle" class="lang-pie-pct">{{ langSegments[0].pct }}%</text>
                  <text x="80" y="94" text-anchor="middle" class="lang-pie-name">
                    {{ shortLang(langSegments[0].name) }}
                  </text>
                </svg>
              </div>
              <ul class="lang-legend">
                <li
                  v-for="seg in langSegments"
                  :key="seg.name"
                  class="lang-legend-row"
                  :title="`${seg.name} · ${num(seg.bytes)} ${t('bytes')}`"
                >
                  <span class="legend-dot" :style="{ background: seg.color }"></span>
                  <span class="lang-legend-name">{{ seg.name }}</span>
                  <span class="lang-legend-pct">{{ seg.pct }}%</span>
                  <span class="lang-legend-bytes">{{ num(seg.bytes) }} {{ t('bytes') }}</span>
                </li>
              </ul>
            </div>
            <div class="lang-stack" role="img" :aria-label="t('languages')">
              <span
                v-for="seg in langSegments"
                :key="seg.name"
                class="lang-stack-seg"
                :style="{ width: seg.share + '%', background: seg.color }"
                :title="`${seg.name} ${seg.pct}%`"
              ></span>
            </div>
          </div>
          <UiEmptyState v-else compact :description="t('noLanguages')" />
        </UiCard>

        <UiCard class="card-contribs" :title="t('contributors')">
          <UiLoading v-if="loadingContribs" inline compact :label="t('loading')" />
          <UiErrorState v-else-if="errorContribs" :message="errorContribs" retry-label="" />
          <template v-else>
            <div v-if="topContributors.length" class="contrib-grid">
              <component
                :is="contributorUrl(c) ? 'a' : 'div'"
                v-for="c in topContributors"
                :key="(c.login || c.name) + (c.id || '')"
                :href="contributorUrl(c) || undefined"
                :target="contributorUrl(c) ? '_blank' : undefined"
                :rel="contributorUrl(c) ? 'noreferrer' : undefined"
                class="contrib-card"
              >
                <img
                  v-if="safeExternalUrl(c.avatar_url)"
                  :src="safeExternalUrl(c.avatar_url)"
                  :alt="c.login || c.name || t('anonymous')"
                  class="contrib-avatar"
                  loading="lazy"
                />
                <span v-else class="contrib-avatar contrib-avatar-fallback"></span>
                <span class="contrib-name">{{ c.login || c.name || t('anonymous') }}</span>
                <span class="contrib-count">{{ num(c.contributions) }}</span>
              </component>
            </div>
            <UiEmptyState v-else compact :description="t('noContributors')" />
          </template>
        </UiCard>

        <UiCard class="card-commits" :title="t('commits')">
          <UiLoading v-if="loadingCommits" inline compact :label="t('loading')" />
          <UiErrorState v-else-if="errorCommits" :message="errorCommits" retry-label="" />
          <template v-else>
            <div v-if="commitBars.length" class="commit-wrap">
              <p class="commit-summary">{{ t('commits52').replace('{n}', num(totalCommits)) }}</p>
              <svg :viewBox="`0 0 ${COMMIT_W} ${COMMIT_H}`" class="commit-svg" preserveAspectRatio="none">
                <rect
                  v-for="(bar, i) in commitBars"
                  :key="i"
                  :x="bar.x"
                  :y="bar.y"
                  :width="bar.w"
                  :height="bar.h"
                  :class="['commit-bar', { current: bar.isCurrent }]"
                />
              </svg>
            </div>
            <UiEmptyState v-else compact :description="t('noCommits')" />
          </template>
        </UiCard>

        <UiCard class="card-topics" :title="t('topics')">
          <div v-if="repoTopics.length" class="topics-cloud">
            <a
              v-for="tp in repoTopics"
              :key="tp"
              :href="`https://github.com/topics/${tp}`"
              target="_blank"
              rel="noreferrer"
              class="topic-link"
            >
              <UiBadge variant="accent" size="sm">{{ tp }}</UiBadge>
            </a>
          </div>
          <UiEmptyState v-else compact :description="t('noTopics')" />
        </UiCard>
      </section>

      <UiEmptyState v-else class="start-state" :title="t('startTitle')" :description="t('startHint')" />
    </div>
  </div>
</template>

<style scoped>
.repo-deep-dive {
  font-family: var(--ok-font);
  color: var(--ok-text);
}

.repo-deep-dive a {
  color: var(--ok-accent);
  text-decoration: none;
}
.repo-deep-dive a:hover {
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
  border-bottom: 1px solid var(--ok-line);
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
  font-family: var(--ok-mono);
}

.quick-pick {
  font-family: var(--ok-mono);
  color: var(--ok-accent);
}

.result-grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  min-width: 0;
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

.overview-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  min-width: 0;
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

.overview-desc {
  margin: 0.5rem 0 0.8rem;
  color: var(--ok-text);
  line-height: 1.5;
  font-size: 0.92rem;
  overflow-wrap: anywhere;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: 0.5rem;
  margin-bottom: 0.8rem;
  min-width: 0;
}

.metrics-grid :deep(.ui-stat) {
  text-align: center;
  align-items: center;
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
  font-family: var(--ok-mono);
}

.lang-visual-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.lang-visual {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: 1rem;
  align-items: center;
  min-width: 0;
}

.lang-pie {
  width: 100%;
  max-width: 160px;
  margin: 0 auto;
}

.lang-pie svg {
  width: 100%;
  height: auto;
  display: block;
}

.lang-pie-pct {
  font-family: var(--ok-mono);
  font-size: 22px;
  font-weight: 700;
  fill: var(--ok-text);
}

.lang-pie-name {
  font-size: 10px;
  fill: var(--ok-muted);
}

.lang-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  min-width: 0;
}

.lang-legend-row {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto auto;
  gap: 0.4rem;
  align-items: center;
  font-size: 0.76rem;
}

.lang-legend-name {
  color: var(--ok-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lang-legend-pct {
  color: var(--ok-text);
  font-family: var(--ok-mono);
  font-size: 0.72rem;
}

.lang-legend-bytes {
  color: var(--ok-muted);
  font-family: var(--ok-mono);
  font-size: 0.68rem;
  white-space: nowrap;
}

.lang-stack {
  display: flex;
  height: 12px;
  background: var(--ok-bg);
  border: 1px solid var(--ok-line);
  overflow: hidden;
}

.lang-stack-seg {
  height: 100%;
  min-width: 1px;
}

.lang-stack-seg:hover {
  filter: brightness(1.15);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

@media (max-width: 560px) {
  .lang-visual {
    grid-template-columns: 1fr;
  }

  .lang-pie {
    max-width: 140px;
  }

  .lang-legend-bytes {
    display: none;
  }
}

.contrib-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 0.5rem;
  min-width: 0;
}

.contrib-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
  padding: 0.6rem 0.4rem;
  border: 1px solid var(--ok-line);
  border-radius: 6px;
  background: var(--ok-bg);
  text-align: center;
  text-decoration: none;
}
.contrib-card:hover {
  border-color: var(--ok-accent);
  background: var(--ok-accent-soft);
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
  font-family: var(--ok-mono);
}

.commit-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.commit-summary {
  margin: 0;
  font-size: 0.78rem;
  color: var(--ok-muted);
  font-family: var(--ok-mono);
}

.commit-svg {
  width: 100%;
  height: 140px;
  display: block;
  background: var(--ok-bg);
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
  fill: var(--ok-text);
}

.topics-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.topic-link {
  text-decoration: none;
}

.repo-deep-dive a.topic-link:hover {
  text-decoration: none;
}

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
