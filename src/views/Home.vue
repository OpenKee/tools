<script setup>
import { computed, watchEffect } from 'vue'
import { RouterLink } from 'vue-router'
import { PROJECTS, slugify } from '../data/projects.js'
import { i18nState, toggleLang, useT } from '../i18n.js'

const copy = {
  en: {
    eyebrow: 'OpenKee · Tools',
    title: 'API-powered tools and utilities.',
    lead: 'Currency rates, weather briefs, crypto trackers, radio streams, geocoding, and more — all powered by public APIs.',
    allProjects: 'All projects ↗',
    github: 'GitHub ↗',
    tools: 'Tools',
    categories: 'Categories',
    status: 'Status',
    active: 'Live',
    data: 'Data',
    geo: 'Geo',
    finance: 'Finance',
    media: 'Media',
    travel: 'Travel',
    space: 'Space',
    food: 'Food',
    fun: 'Fun',
    open: 'Open ↗',
    back: '← All projects',
  },
  zh: {
    eyebrow: 'OpenKee · 工具集',
    title: 'API 驱动的工具集。',
    lead: '汇率、天气简报、加密行情、电台流、地理编码……全部由公共 API 驱动。',
    allProjects: '全部项目 ↗',
    github: 'GitHub ↗',
    tools: '工具',
    categories: '分类',
    status: '状态',
    active: '在线',
    data: '数据',
    geo: '地理',
    finance: '金融',
    media: '媒体',
    travel: '旅行',
    space: '太空',
    food: '美食',
    fun: '娱乐',
    open: '打开 ↗',
    back: '← 全部项目',
  },
}

const t = useT(copy)

// 分类数（去重统计）
const categoryCount = computed(() => {
  const set = new Set(PROJECTS.map((p) => p.typeClass))
  return set.size
})

// 为每个项目预计算 Vue 路由路径 + 按当前语言显示的名称
const projects = computed(() =>
  PROJECTS.map((p) => {
    const slug = p.slug || slugify(p.name)
    return {
      ...p,
      vuePath: `/apps/${slug}`,
      displayName: i18nState.lang === 'zh' && p.nameZh ? p.nameZh : p.name,
    }
  }),
)

// 文档标题随语言切换
watchEffect(() => {
  document.title = i18nState.lang === 'zh' ? 'OpenKee 工具集 — API 驱动的实用工具' : 'OpenKee Tools — API Utilities'
})
</script>

<template>
  <main class="shell">
    <header class="masthead">
      <div>
        <p class="eyebrow">{{ t('eyebrow') }}</p>
        <h1>{{ t('title') }}</h1>
        <p class="lead">{{ t('lead') }}</p>
      </div>
      <div class="header-right">
        <a href="https://github.com/OpenKee/tools" target="_blank" class="gh-link">{{ t('github') }}</a>
        <a href="https://openkee.github.io/" target="_blank" class="gh-link">{{ t('allProjects') }}</a>
        <button class="lang-toggle" type="button" @click="toggleLang">
          {{ i18nState.lang === 'en' ? '中文' : 'EN' }}
        </button>
      </div>
    </header>

    <section class="stats">
      <div class="stat-item">
        <div class="stat-label">{{ t('tools') }}</div>
        <div class="stat-value">{{ PROJECTS.length }}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">{{ t('categories') }}</div>
        <div class="stat-value">{{ categoryCount }}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">{{ t('status') }}</div>
        <div class="stat-value status-text">{{ t('active') }}</div>
      </div>
    </section>

    <section class="grid">
      <!-- 所有应用都已迁移到 Vue，用 RouterLink（SPA 导航） -->
      <div v-for="p in projects" :key="p.name" class="card">
        <span :class="['card-tag', p.typeClass]">{{ t(p.typeClass) }}</span>
        <div class="card-name">{{ p.displayName }}</div>
        <div class="card-desc">{{ p.desc[i18nState.lang] }}</div>
        <div class="card-links">
          <RouterLink class="card-link" :to="p.vuePath">{{ t('open') }}</RouterLink>
        </div>
      </div>
    </section>

    <footer class="footer">
      <span>Built by <a href="https://github.com/OpenKee" target="_blank">OpenKee</a></span>
      <span><a href="https://openkee.github.io/">{{ t('back') }}</a></span>
    </footer>
  </main>
</template>

<style scoped>
:root {
  --bg: #000;
  --panel: #0a0a0a;
  --text: #f5f5f3;
  --muted: #9f9f99;
  --border: rgba(255, 255, 255, 0.08);
}

.shell {
  width: min(1000px, calc(100% - 2rem));
  margin: 0 auto;
  padding: 2rem 0 4rem;
}

.masthead {
  padding: 0 0 2rem;
  border-bottom: 1px solid var(--border);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--muted);
}

h1 {
  margin-top: 0.5rem;
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 1.05;
  letter-spacing: -0.04em;
  max-width: 18ch;
  font-weight: 800;
}

.lead {
  margin-top: 0.6rem;
  color: var(--muted);
  font-size: 0.92rem;
  max-width: 55ch;
  line-height: 1.6;
}

.header-right {
  display: flex;
  gap: 0.8rem;
  align-items: center;
  margin-top: 1rem;
}

.gh-link {
  font-size: 0.82rem;
  font-weight: 500;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  transition: border-color 200ms;
  color: var(--text);
}

.gh-link:hover {
  border-color: var(--text);
}

.lang-toggle {
  font: inherit;
  height: 2rem;
  padding: 0 0.6rem;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font-size: 0.78rem;
  border-radius: 6px;
}

.lang-toggle:hover {
  border-color: var(--text);
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  padding: 1.5rem 0;
  border-bottom: 1px solid var(--border);
}

.stat-item {
  padding: 0 1rem;
  border-right: 1px solid var(--border);
}

.stat-item:last-child {
  border-right: none;
}

.stat-label {
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.stat-value {
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-top: 0.15rem;
}

.status-text {
  font-size: 1rem;
  margin-top: 0.5rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1px;
  background: var(--border);
  margin-top: 1.5rem;
  border: 1px solid var(--border);
}

.card {
  background: var(--bg);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: background 200ms;
}

.card:hover {
  background: var(--panel);
}

.card-tag {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.15rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: 3px;
  align-self: start;
}

.card-tag.data {
  color: #56d3ff;
  border-color: rgba(86, 211, 255, 0.3);
}

.card-tag.geo {
  color: #34d399;
  border-color: rgba(52, 211, 153, 0.3);
}

.card-tag.finance {
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.3);
}

.card-tag.media {
  color: #a78bfa;
  border-color: rgba(167, 139, 250, 0.3);
}

.card-tag.travel {
  color: #f472b6;
  border-color: rgba(244, 114, 182, 0.3);
}

.card-tag.space {
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.3);
}

.card-tag.food {
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.3);
}

.card-tag.fun {
  color: #fb7185;
  border-color: rgba(251, 113, 133, 0.3);
}

.card-name {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.card-desc {
  font-size: 0.82rem;
  color: var(--muted);
  line-height: 1.5;
  flex: 1;
}

.card-links {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.3rem;
}

.card-link {
  font-size: 0.74rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  transition: all 150ms;
  color: var(--text);
}

.card-link:hover {
  border-color: var(--text);
  color: var(--text);
}

.footer {
  margin-top: 3rem;
  padding: 1.5rem 0;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.72rem;
  color: var(--muted);
}

.footer a {
  color: var(--muted);
}

.footer a:hover {
  color: var(--text);
}

@media (max-width: 700px) {
  .stats {
    grid-template-columns: repeat(3, 1fr);
  }

  .stat-item {
    border-right: none;
    padding: 0.4rem 0;
  }

  .grid {
    grid-template-columns: 1fr;
  }

  .footer {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }
}
</style>
