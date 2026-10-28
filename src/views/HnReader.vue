<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useT } from '../i18n.js'
import { fetchJSON } from '../ok.js'
import { escapeHtml } from '../lib/format.js'
import { useUrlTab } from '../lib/use-url-tab.js'
import { safeExternalUrl } from '../lib/format.js'
import {
  UiBadge,
  UiButton,
  UiEmptyState,
  UiErrorState,
  UiLoading,
  UiPage,
  UiPageHead,
  UiTabs,
} from '../components/ui/index.js'
import copy from '../copy/hn-reader.js'

const t = useT(copy)

const API = 'https://hacker-news.firebaseio.com/v0'

const ENDPOINTS = {
  top: '/topstories.json',
  best: '/beststories.json',
  new: '/newstories.json',
  ask: '/askstories.json',
  show: '/showstories.json',
  job: '/jobstories.json',
}

const PAGE_SIZE = 20

const TABS = [
  { key: 'top', label: 'top' },
  { key: 'best', label: 'best' },
  { key: 'new', label: 'new' },
  { key: 'ask', label: 'ask' },
  { key: 'show', label: 'show' },
  { key: 'job', label: 'jobs' },
]

const tabItems = computed(() => TABS.map((item) => ({ key: item.key, label: t.value(item.label) })))

const { tab: currentTab, setTab: selectTab } = useUrlTab(
  TABS.map((t) => t.key),
  'top',
)
const idsCache = reactive({})
const loadedItems = ref([])
const loading = ref(false)
const finished = ref(false)
const error = ref(false)
const expanded = ref(new Set())
const now = ref(Math.floor(Date.now() / 1000))

const sentinelEl = ref(null)
let observer = null
let clockTimer = null
let loadRequestId = 0
let disposed = false

function hnUrl(id) {
  return 'https://news.ycombinator.com/item?id=' + id
}

function relativeTime(time) {
  const diff = Math.max(0, now.value - (time || 0))
  if (diff < 60) return t.value('justNow')
  if (diff < 3600) return Math.floor(diff / 60) + t.value('minuteAgo')
  if (diff < 86400) return Math.floor(diff / 3600) + t.value('hourAgo')
  if (diff < 2592000) return Math.floor(diff / 86400) + t.value('dayAgo')
  return Math.floor(diff / 2592000) + t.value('monthAgo')
}

function domainFrom(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch (e) {
    return ''
  }
}

function commentsLabel(c) {
  if (!c) return t.value('noComments')
  return c + ' ' + (c === 1 ? t.value('comment') : t.value('comments'))
}

function sanitizeText(html) {
  if (!html) return ''
  let s = escapeHtml(html)

  s = s.replace(/&lt;p&gt;/g, '<p>').replace(/&lt;\/p&gt;/g, '</p>')

  s = s.replace(/&lt;(\/?)(i|b|em|strong|code|pre)&gt;/g, '<$1$2>')

  s = s.replace(/&lt;a\s+href=&quot;(.*?)&quot;&gt;/g, (m, raw) => {
    const url = safeExternalUrl(raw.replace(/&amp;/g, '&').replace(/&#39;/g, "'"))
    if (!url) return ''
    return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noreferrer noopener">'
  })
  s = s.replace(/&lt;\/a&gt;/g, '</a>')
  return s
}

function isExpanded(id) {
  return expanded.value.has(id)
}
function toggleExpand(id) {
  const s = new Set(expanded.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expanded.value = s
}

const currentIds = computed(() => idsCache[currentTab.value] || null)

const visibleItems = computed(() => {
  const result = []
  loadedItems.value.forEach((item, idx) => {
    if (item) result.push({ item, rank: idx + 1 })
  })
  return result
})

const statusText = computed(() => {
  if (loading.value) {
    return loadedItems.value.length === 0 ? t.value('loading') : t.value('loadingMore')
  }
  const ids = currentIds.value
  if (loadedItems.value.length && ids && ids.length) {
    return loadedItems.value.length + ' / ' + ids.length
  }
  return ''
})

const showEmpty = computed(
  () => !loading.value && !error.value && currentIds.value !== null && currentIds.value.length === 0,
)

const showEnd = computed(() => finished.value && visibleItems.value.length > 0)

async function getIds(tab, requestId) {
  if (idsCache[tab]) return idsCache[tab]
  const ids = (await fetchJSON(API + ENDPOINTS[tab])) || []
  if (requestId === loadRequestId) idsCache[tab] = ids
  return ids
}

async function fetchItems(ids, requestId) {
  const concurrency = 8
  const results = new Array(ids.length)
  let i = 0
  function next() {
    if (requestId !== loadRequestId || i >= ids.length) return Promise.resolve()
    const idx = i++
    return fetchJSON(API + '/item/' + ids[idx] + '.json')
      .then((item) => {
        results[idx] = item
      })
      .catch(() => {
        results[idx] = null
      })
      .then(next)
  }
  const workers = []
  for (let w = 0; w < concurrency; w++) workers.push(next())
  await Promise.all(workers)
  return results
}

async function loadNext() {
  if (disposed || loading.value || finished.value) return
  const requestId = ++loadRequestId
  const tab = currentTab.value
  loading.value = true
  error.value = false
  try {
    const ids = await getIds(tab, requestId)
    if (requestId !== loadRequestId || tab !== currentTab.value) return
    if (!ids.length) {
      finished.value = true
      return
    }
    const start = loadedItems.value.length
    const slice = ids.slice(start, start + PAGE_SIZE)
    if (!slice.length) {
      finished.value = true
      return
    }
    const items = await fetchItems(slice, requestId)
    if (requestId !== loadRequestId || tab !== currentTab.value) return
    for (const it of items) loadedItems.value.push(it)
    if (loadedItems.value.length >= ids.length) finished.value = true
  } catch (e) {
    if (requestId === loadRequestId && tab === currentTab.value) error.value = true
  } finally {
    if (requestId === loadRequestId) loading.value = false
  }
}

function switchTab(tab) {
  if (tab !== currentTab.value) selectTab(tab)
}

watch(
  currentTab,
  () => {
    loadRequestId++
    loadedItems.value = []
    finished.value = false
    loading.value = false
    error.value = false
    expanded.value = new Set()
    loadNext()
  },
  { flush: 'sync' },
)

onMounted(() => {
  loadNext()

  clockTimer = setInterval(() => {
    now.value = Math.floor(Date.now() / 1000)
  }, 60000)

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) loadNext()
    },
    { rootMargin: '400px' },
  )
  if (sentinelEl.value) observer.observe(sentinelEl.value)
})

onUnmounted(() => {
  disposed = true
  loadRequestId++
  if (clockTimer) clearInterval(clockTimer)
  if (observer) observer.disconnect()
})
</script>

<template>
  <UiPage
    class="hn-reader-app"
    :title="t('title')"
    :sources="[{ name: 'Hacker News', url: 'https://news.ycombinator.com/' }]"
    width="860px"
    gutter="1.5rem"
  >
    <UiPageHead :description="t('lead')" />

    <UiTabs
      class="hn-tabs"
      :model-value="currentTab"
      :items="tabItems"
      aria-label="Stories"
      panel-id="hn-panel"
      size="sm"
      @update:model-value="switchTab"
    />

    <div id="hn-panel" role="tabpanel" :aria-labelledby="'ui-tab-' + currentTab">
      <div class="status" aria-live="polite">
        <UiLoading v-if="loading" inline compact :label="statusText" />
        <UiErrorState v-else-if="error" :message="t('error')" retry-label="" />
        <span v-else class="status-count">{{ statusText }}</span>
      </div>

      <section class="list" :aria-busy="loading">
        <UiEmptyState v-if="showEmpty" compact :title="t('empty')" />
        <template v-else>
          <article v-for="row in visibleItems" :key="row.item.id" class="row">
            <span class="rank">{{ row.rank }}</span>
            <div class="main">
              <div class="title-line">
                <a
                  v-if="safeExternalUrl(row.item.url)"
                  class="title"
                  :href="safeExternalUrl(row.item.url)"
                  target="_blank"
                  rel="noreferrer noopener"
                  >{{ row.item.title }}</a
                >

                <UiButton
                  v-else-if="row.item.text"
                  variant="link"
                  class="title-toggle"
                  :aria-expanded="isExpanded(row.item.id)"
                  @click="toggleExpand(row.item.id)"
                >
                  <span class="caret">▸</span>{{ row.item.title }}
                </UiButton>

                <a v-else class="title" :href="hnUrl(row.item.id)" target="_blank" rel="noreferrer">{{
                  row.item.title
                }}</a>
                <UiBadge v-if="domainFrom(safeExternalUrl(row.item.url))" class="domain" size="sm" mono>{{
                  domainFrom(safeExternalUrl(row.item.url))
                }}</UiBadge>
              </div>
              <div class="meta">
                <UiBadge variant="accent" size="sm" mono>{{ row.item.score || 0 }} {{ t('points') }}</UiBadge>
                <span class="dot">·</span>
                <span class="by">{{ t('by') }} {{ row.item.by || '' }}</span>
                <span class="dot">·</span>
                <span class="time">{{ relativeTime(row.item.time) }}</span>
                <span class="dot">·</span>
                <a class="comments" :href="hnUrl(row.item.id)" target="_blank" rel="noreferrer">{{
                  commentsLabel(row.item.descendants)
                }}</a>
              </div>

              <div
                v-if="row.item.text"
                v-show="isExpanded(row.item.id)"
                class="content"
                v-html="sanitizeText(row.item.text)"
              ></div>
            </div>
          </article>
          <p v-if="showEnd" class="end-msg">{{ t('end') }}</p>
        </template>
      </section>

      <div ref="sentinelEl" class="sentinel" aria-hidden="true"></div>
    </div>
  </UiPage>
</template>

<style scoped>
.hn-reader-app {
  -webkit-font-smoothing: antialiased;
}

.hn-tabs {
  margin-bottom: 0.2rem;
}

.status {
  display: flex;
  min-height: 2rem;
  align-items: center;
  padding: 0.35rem 0;
  color: var(--ok-muted);
  font-family: var(--ok-mono);
  font-size: 0.75rem;
}

.list {
  display: flex;
  flex-direction: column;
}

.row {
  display: grid;
  grid-template-columns: 2.4rem 1fr;
  gap: 0.8rem;
  padding: 0.85rem 0.6rem;
  border-bottom: 1px solid var(--ok-line);
  position: relative;
  transition:
    background 0.15s,
    box-shadow 0.15s;
}

.row:hover {
  background: var(--ok-bg);
  box-shadow: inset 2px 0 0 var(--ok-accent);
}

.rank {
  padding-top: 0.15rem;
  color: var(--ok-muted);
  font-family: var(--ok-mono);
  font-size: 0.78rem;
  text-align: right;
}

.main {
  min-width: 0;
}

.title-line {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.title {
  color: var(--ok-text);
  font-size: 0.98rem;
  font-weight: 500;
  line-height: 1.35;
  text-decoration: none;
}
.title:hover {
  color: var(--ok-accent);
}

.title-toggle {
  max-width: 100%;
  color: var(--ok-text);
  font-size: 0.98rem;
  font-weight: 500;
  line-height: 1.35;
  text-align: left;
  white-space: normal;
}
.title-toggle:hover {
  color: var(--ok-accent);
}

.title-toggle .caret {
  display: inline-block;
  width: 0.8rem;
  margin-right: 0.15rem;
  color: var(--ok-muted);
  font-family: var(--ok-mono);
  transition: transform 0.2s ease;
}
.title-toggle[aria-expanded='true'] .caret {
  transform: rotate(90deg);
}

.meta {
  margin-top: 0.35rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  color: var(--ok-muted);
  font-family: var(--ok-mono);
  font-size: 0.74rem;
}

.meta .dot {
  color: var(--ok-muted);
}

.meta .by {
  color: var(--ok-muted);
}

.meta .comments {
  color: var(--ok-muted);
  text-decoration: none;
  cursor: pointer;
}

.meta .comments:hover {
  color: var(--ok-accent);
  text-decoration: underline;
}

.content {
  margin-top: 0.6rem;
  padding: 0.85rem 0.95rem;
  background: var(--ok-panel);
  border: 1px solid var(--ok-line);
  border-left: 2px solid var(--ok-accent);
  border-radius: 4px;
  color: var(--ok-text);
  font-size: 0.9rem;
  line-height: 1.65;
  overflow-x: auto;
}
.content :deep(p) {
  margin: 0 0 0.6rem;
}
.content :deep(p:last-child) {
  margin-bottom: 0;
}
.content :deep(a) {
  color: var(--ok-accent);
}
.content :deep(code) {
  font-family: var(--ok-mono);
  font-size: 0.82rem;
  background: var(--ok-bg);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
}
.content :deep(pre) {
  font-family: var(--ok-mono);
  font-size: 0.82rem;
  background: rgba(0, 0, 0, 0.3);
  padding: 0.6rem;
  border-radius: 4px;
  overflow-x: auto;
}

.sentinel {
  height: 1px;
}

.end-msg {
  padding: 1.4rem 0;
  color: var(--ok-muted);
  font-family: var(--ok-mono);
  font-size: 0.74rem;
  text-align: center;
}

@media (max-width: 640px) {
  .row {
    grid-template-columns: 1.9rem 1fr;
    gap: 0.6rem;
    padding: 0.8rem 0.3rem;
  }
  .title,
  .title-toggle {
    font-size: 0.94rem;
  }
}
</style>
