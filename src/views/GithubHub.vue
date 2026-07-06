<script setup>
/* ============================================================
   GitHub Hub — GitHub 中心
   聚合 3 个 GitHub 类应用：热门趋势 / 仓库透视 / 节点地图
   通过 URL query 参数 ?tab=trending|repo|node 持久化当前 Tab
   ============================================================ */

import { computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useT } from '../i18n.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'
import TrendingAtlas from './TrendingAtlas.vue'
import RepoScope from './RepoScope.vue'
import NodeAtlas from './NodeAtlas.vue'

/* ---------- 国际化文案 ---------- */
const copy = {
  en: {
    title: 'GitHub Hub',
    lead: 'Discover trending repos, analyze any repository, and visualize language networks.',
    tabTrending: 'Trending',
    tabRepo: 'Repo Scope',
    tabNode: 'Node Atlas',
  },
  zh: {
    title: 'GitHub 中心',
    lead: '发现热门仓库、透视任意仓库、可视化语言节点网络。',
    tabTrending: '热门趋势',
    tabRepo: '仓库透视',
    tabNode: '节点地图',
  },
}

const t = useT(copy)
const route = useRoute()
const router = useRouter()

/* ---------- Tab 配置 ---------- */
const tabs = [
  { key: 'trending', label: 'tabTrending', comp: TrendingAtlas },
  { key: 'repo', label: 'tabRepo', comp: RepoScope },
  { key: 'node', label: 'tabNode', comp: NodeAtlas },
]

/* ---------- 当前激活 Tab（从 URL query 读取，默认 trending） ---------- */
const activeTab = computed(() => {
  const q = route.query.tab
  return tabs.some((tb) => tb.key === q) ? q : 'trending'
})

/* ---------- 切换 Tab ---------- */
function switchTab(key) {
  if (key === activeTab.value) return
  router.replace({ query: { tab: key } })
}

/* 切换 Tab 时滚动到顶部（覆盖点击与浏览器前进/后退） */
watch(activeTab, () => {
  nextTick(() => window.scrollTo(0, 0))
})
</script>

<template>
  <div class="github-hub">
    <AppHeader :title="{ en: 'GitHub Hub', zh: 'GitHub 中心' }" :show-lang-toggle="true" />

    <main class="shell">
      <header class="masthead">
        <h1>{{ t('title') }}</h1>
        <p class="lead">{{ t('lead') }}</p>
      </header>

      <!-- Tab 栏 -->
      <div class="tab-bar" role="tablist" aria-label="GitHub tools">
        <button
          v-for="tb in tabs"
          :key="tb.key"
          type="button"
          role="tab"
          class="tab-btn"
          :class="{ active: activeTab === tb.key }"
          :aria-selected="activeTab === tb.key"
          @click="switchTab(tb.key)"
        >
          {{ t(tb.label) }}
        </button>
      </div>

      <!-- 子应用面板：用 v-show 保持各应用内部状态 -->
      <div class="hub-panel">
        <TrendingAtlas v-show="activeTab === 'trending'" />
        <RepoScope v-show="activeTab === 'repo'" />
        <NodeAtlas v-show="activeTab === 'node'" />
      </div>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* 深色主题，与 GitHub 类子应用一致 */
.github-hub {
  --bg: #0d1117;
  --panel: #161b22;
  --line: rgba(255, 255, 255, 0.08);
  --text: #e6edf6;
  --muted: #7d8590;
  --accent: #58a6ff;
  --accent-soft: rgba(88, 166, 255, 0.12);

  /* 映射共享 token，影响 AppHeader / AppFooter */
  --ok-bg: var(--bg);
  --ok-panel: var(--panel);
  --ok-line: var(--line);
  --ok-text: var(--text);
  --ok-muted: var(--muted);
  --ok-accent: var(--accent);
  --ok-accent-soft: var(--accent-soft);
  --ok-footer-line: var(--line);
  --ok-footer-text: var(--muted);
  --ok-footer-link: var(--accent);
  --ok-topbar-line: var(--line);

  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
}

/* 隐藏子应用自带的顶栏与页脚（避免重复） */
:deep(.trending-atlas-app .ok-topbar),
:deep(.repo-scope-app .ok-topbar),
:deep(.node-atlas-app .ok-topbar) { display: none !important; }

:deep(.trending-atlas-app .ok-footer),
:deep(.repo-scope-app .ok-footer),
:deep(.node-atlas-app .ok-footer) { display: none !important; }

.shell {
  width: min(1180px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

.masthead {
  padding: 0.4rem 0 1.2rem;
  border-bottom: 1px solid var(--line);
}

.masthead h1 {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
  font-weight: 800;
}

.lead {
  margin-top: 0.55rem;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.6;
  max-width: 60ch;
}

/* ---------- Tab 栏 ---------- */
.tab-bar {
  display: flex;
  gap: 0.25rem;
  margin-top: 1.2rem;
  border-bottom: 1px solid var(--line);
  overflow-x: auto;
  scrollbar-width: thin;
}

.tab-btn {
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  padding: 0.7rem 1rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--muted);
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;
  margin-bottom: -1px;
}

.tab-btn:hover { color: var(--text); }

.tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 3px;
}

/* ---------- 子应用面板 ---------- */
.hub-panel {
  display: contents;
}

@media (max-width: 600px) {
  .tab-btn { padding: 0.6rem 0.75rem; font-size: 0.82rem; }
}
</style>
