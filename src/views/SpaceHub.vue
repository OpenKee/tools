<script setup>
/* ============================================================
   Space Hub — 太空中心
   聚合 4 个太空类应用：ISS 追踪 / 火星天气 / 极光预报 / 发射日程
   通过 URL query 参数 ?tab=iss|mars|aurora|launch 持久化当前 Tab
   ============================================================ */

import { computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useT } from '../i18n.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'
import IssTracker from './IssTracker.vue'
import MarsWeather from './MarsWeather.vue'
import AuroraForecast from './AuroraForecast.vue'
import LaunchBoard from './LaunchBoard.vue'

/* ---------- 国际化文案 ---------- */
const copy = {
  en: {
    title: 'Space Hub',
    lead: 'ISS tracking, Mars weather, aurora forecast, and rocket launches — all in one place.',
    tabIss: 'ISS Tracker',
    tabMars: 'Mars Weather',
    tabAurora: 'Aurora Forecast',
    tabLaunch: 'Launch Board',
  },
  zh: {
    title: '太空中心',
    lead: '空间站追踪、火星天气、极光预报、火箭发射日程，一站式查看。',
    tabIss: '空间站追踪',
    tabMars: '火星天气',
    tabAurora: '极光预报',
    tabLaunch: '发射日程',
  },
}

const t = useT(copy)
const route = useRoute()
const router = useRouter()

/* ---------- Tab 配置 ---------- */
const tabs = [
  { key: 'iss', label: 'tabIss', comp: IssTracker },
  { key: 'mars', label: 'tabMars', comp: MarsWeather },
  { key: 'aurora', label: 'tabAurora', comp: AuroraForecast },
  { key: 'launch', label: 'tabLaunch', comp: LaunchBoard },
]

/* ---------- 当前激活 Tab（从 URL query 读取，默认 iss） ---------- */
const activeTab = computed(() => {
  const q = route.query.tab
  return tabs.some((tb) => tb.key === q) ? q : 'iss'
})

/* ---------- 切换 Tab：更新 URL + 滚动顶部 ---------- */
function switchTab(key) {
  if (key === activeTab.value) return
  router.replace({ query: { tab: key } })
  nextTick(() => window.scrollTo(0, 0))
}
</script>

<template>
  <div class="space-hub">
    <AppHeader :title="{ en: 'Space Hub', zh: '太空中心' }" :show-lang-toggle="true" />

    <main class="shell">
      <header class="masthead">
        <h1>{{ t('title') }}</h1>
        <p class="lead">{{ t('lead') }}</p>
      </header>

      <!-- Tab 栏 -->
      <div class="tab-bar" role="tablist" aria-label="Space tools">
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
        <IssTracker v-show="activeTab === 'iss'" />
        <MarsWeather v-show="activeTab === 'mars'" />
        <AuroraForecast v-show="activeTab === 'aurora'" />
        <LaunchBoard v-show="activeTab === 'launch'" />
      </div>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* 深色太空主题，与子应用一致 */
.space-hub {
  --bg: #0a0e1a;
  --panel: #0f1626;
  --line: rgba(255, 255, 255, 0.07);
  --text: #e6edf6;
  --muted: #7d8aa3;
  --accent: #38bdf8;
  --accent-soft: rgba(56, 189, 248, 0.12);

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
  background-image:
    radial-gradient(circle at 12% 0%, rgba(56, 189, 248, 0.10), transparent 40%),
    radial-gradient(circle at 88% 8%, rgba(99, 102, 241, 0.08), transparent 42%);
  background-attachment: fixed;
  color: var(--text);
}

/* 隐藏子应用自带的顶栏与页脚（避免重复） */
:deep(.iss-app .ok-topbar),
:deep(.mars-weather-app .ok-topbar),
:deep(.aurora-app .ok-topbar),
:deep(.launch-board-app .ok-topbar) { display: none !important; }

:deep(.iss-app .ok-footer),
:deep(.mars-weather-app .ok-footer),
:deep(.aurora-app .ok-footer),
:deep(.launch-board-app .ok-footer) { display: none !important; }

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

/* 响应式：移动端 Tab 栏可横向滚动 */
@media (max-width: 600px) {
  .tab-btn { padding: 0.6rem 0.75rem; font-size: 0.82rem; }
}
</style>
