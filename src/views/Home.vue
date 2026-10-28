<script setup>
import { ref, computed, watchEffect, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { Moon, Sun } from '@lucide/vue'
import { PROJECTS, slugify } from '../data/projects.js'
import { i18nState, toggleLang, useT } from '../i18n.js'
import { lsGet } from '../ok.js'
import { themeState, toggleTheme } from '../theme.js'
import { UiBadge, UiButton, UiCard, UiIconButton, UiPage, UiPageHead } from '../components/ui/index.js'
import copy from '../copy/home.js'

const t = useT(copy)

const categoryCount = computed(() => new Set(PROJECTS.map((p) => p.typeClass)).size)

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

const badgeVariant = {
  space: 'accent',
  data: 'neutral',
  finance: 'up',
  media: 'accent',
  tool: 'neutral',
  food: 'warn',
  fun: 'warn',
}

const PROBE_STALE = 30 * 60 * 1000
const probeCls = ref('unknown')
let probeExpiryTimer = null
const probeTitle = computed(() => {
  const map = {
    unknown: { zh: 'API 探针（暂无有效近期数据）', en: 'API probe (no recent valid data)' },
    ok: { zh: 'API 探针：依赖全部正常', en: 'API probe: all dependencies OK' },
    warn: { zh: 'API 探针：个别依赖异常', en: 'API probe: some dependencies failing' },
    bad: { zh: 'API 探针：多个依赖异常', en: 'API probe: several dependencies failing' },
  }
  return map[probeCls.value][i18nState.lang === 'zh' ? 'zh' : 'en']
})

function loadProbeState() {
  clearTimeout(probeExpiryTimer)
  const raw = lsGet('api-probe-results')
  try {
    const saved = JSON.parse(raw || 'null')
    const age = Date.now() - saved?.time
    if (!Number.isFinite(saved?.time) || age < 0 || age >= PROBE_STALE) {
      probeCls.value = 'unknown'
      return
    }
    const vals = saved && saved.results ? Object.values(saved.results) : []
    if (!vals.length) {
      probeCls.value = 'unknown'
      return
    }
    const bad = vals.filter((v) => !v.ok).length
    probeCls.value = bad === 0 ? 'ok' : bad < 3 ? 'warn' : 'bad'
    probeExpiryTimer = setTimeout(loadProbeState, PROBE_STALE - age)
  } catch (e) {
    probeCls.value = 'unknown'
  }
}

onMounted(loadProbeState)
onBeforeUnmount(() => clearTimeout(probeExpiryTimer))

watchEffect(() => {
  document.title = i18nState.lang === 'zh' ? 'OpenKee 工具集 — API 驱动的实用工具' : 'OpenKee Tools — API Utilities'
})
</script>

<template>
  <UiPage class="home-app" :show-header="false" spacing="roomy">
    <UiPageHead :eyebrow="t('eyebrow')" :title="t('title')" :description="t('lead')" rule>
      <template #actions>
        <section class="home-meta" :aria-label="i18nState.lang === 'zh' ? '工具集概览' : 'Toolset summary'">
          <span class="meta-item"
            ><strong>{{ PROJECTS.length }}</strong> {{ t('tools') }}</span
          >
          <span class="meta-divider" aria-hidden="true" />
          <span class="meta-item"
            ><strong>{{ categoryCount }}</strong> {{ t('categories') }}</span
          >
        </section>
        <UiButton href="https://github.com/OpenKee/tools" target="_blank" variant="secondary" size="sm">
          {{ t('github') }}
        </UiButton>
        <UiButton href="https://openkee.github.io/" target="_blank" variant="secondary" size="sm">
          {{ t('allProjects') }}
        </UiButton>
        <UiButton :to="'/apps/api-probe'" variant="secondary" size="sm" :title="probeTitle" :aria-label="probeTitle">
          <span class="probe-dot" :class="probeCls"></span>API
        </UiButton>
        <UiIconButton
          :label="
            themeState.theme === 'dark'
              ? i18nState.lang === 'zh'
                ? '切换浅色模式'
                : 'Switch to light mode'
              : i18nState.lang === 'zh'
                ? '切换深色模式'
                : 'Switch to dark mode'
          "
          variant="secondary"
          size="sm"
          @click="toggleTheme"
        >
          <Sun v-if="themeState.theme === 'dark'" aria-hidden="true" />
          <Moon v-else aria-hidden="true" />
        </UiIconButton>
        <UiButton variant="secondary" size="sm" @click="toggleLang">
          {{ i18nState.lang === 'en' ? '中文' : 'EN' }}
        </UiButton>
      </template>
    </UiPageHead>

    <section class="project-grid">
      <UiCard
        v-for="p in projects"
        :key="p.name"
        :as="RouterLink"
        :to="p.vuePath"
        interactive
        density="compact"
        class="project-card"
      >
        <UiBadge :variant="badgeVariant[p.typeClass] || 'neutral'" size="sm" class="project-tag">
          {{ t(p.typeClass) }}
        </UiBadge>
        <div class="project-name">{{ p.displayName }}</div>
        <p class="project-desc">{{ p.desc[i18nState.lang] }}</p>
      </UiCard>
    </section>
  </UiPage>
</template>

<style scoped>
.home-app {
  --ok-footer-link: var(--ok-muted);
}

.home-meta {
  display: flex;
  min-height: 1.9rem;
  align-items: center;
  gap: 0.5rem;
  margin-right: 0.25rem;
  color: var(--ok-muted);
  font-size: 0.72rem;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  white-space: nowrap;
}

.meta-item strong {
  color: var(--ok-text);
  font-size: 0.82rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.meta-divider {
  width: 1px;
  height: 0.75rem;
  background: var(--ok-line);
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 0.8rem;
  margin-top: 1.2rem;
}

.project-card {
  color: inherit;
  text-decoration: none;
}

.project-tag {
  align-self: flex-start;
}

.project-name {
  font-size: 1.02rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.project-desc {
  flex: 1;
  display: -webkit-box;
  overflow: hidden;
  color: var(--ok-muted);
  font-size: 0.8rem;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.probe-dot {
  width: 0.45rem;
  height: 0.45rem;
  flex: none;
  border-radius: 50%;
  background: var(--ok-muted);
}

.probe-dot.ok {
  background: var(--ok-up);
}

.probe-dot.warn {
  background: #eab308;
}

.probe-dot.bad {
  background: var(--ok-down);
}

@media (max-width: 700px) {
  .home-meta {
    width: 100%;
    justify-content: flex-start;
  }

  .project-grid {
    grid-template-columns: 1fr;
  }
}
</style>
