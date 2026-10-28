<script setup>
import { computed, watchEffect } from 'vue'
import { RouterLink } from 'vue-router'
import { Moon, Sun } from '@lucide/vue'
import { i18nState, toggleLang } from '../i18n.js'
import { themeState, toggleTheme } from '../theme.js'
import UiButton from './ui/UiButton.vue'
import UiIconButton from './ui/UiIconButton.vue'

const props = defineProps({
  showLangToggle: {
    type: Boolean,
    default: true,
  },

  showThemeToggle: {
    type: Boolean,
    default: true,
  },

  title: {
    type: [String, Object],
    default: '',
  },
})

const displayTitle = computed(() => {
  if (!props.title) return ''
  if (typeof props.title === 'string') return props.title
  return props.title[i18nState.lang] || props.title.en || ''
})

const backLabel = computed(() => (i18nState.lang === 'zh' ? '← OpenKee 工具集' : '← OpenKee Tools'))
const themeLabel = computed(() =>
  themeState.theme === 'dark'
    ? i18nState.lang === 'zh'
      ? '切换浅色模式'
      : 'Switch to light mode'
    : i18nState.lang === 'zh'
      ? '切换深色模式'
      : 'Switch to dark mode',
)
const langLabel = computed(() => (i18nState.lang === 'zh' ? '切换语言' : 'Switch language'))

watchEffect(() => {
  const t = displayTitle.value
  if (t) {
    document.title = i18nState.lang === 'zh' ? `${t} — OpenKee 工具集` : `${t} — OpenKee Tools`
  }
})
</script>

<template>
  <nav class="ok-topbar">
    <div class="ok-topbar-inner">
      <div class="topbar-left">
        <RouterLink to="/" class="ok-topbar-link">{{ backLabel }}</RouterLink>
      </div>
      <h1 class="topbar-title">{{ displayTitle }}</h1>
      <div class="topbar-actions">
        <UiIconButton v-if="showThemeToggle" :label="themeLabel" size="sm" variant="ghost" @click="toggleTheme">
          <Sun v-if="themeState.theme === 'dark'" aria-hidden="true" />
          <Moon v-else aria-hidden="true" />
        </UiIconButton>
        <UiButton v-if="showLangToggle" :aria-label="langLabel" size="sm" variant="secondary" @click="toggleLang">
          {{ i18nState.lang === 'en' ? '中文' : 'EN' }}
        </UiButton>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.ok-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  flex-shrink: 0;
  height: var(--ok-topbar-h, 3.4rem);
  padding: 0;
  font-size: 0.85rem;
  background: var(--ok-topbar-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--ok-topbar-line);
}

.ok-topbar-inner {
  height: 100%;
  width: min(var(--ok-content-width, 1100px), calc(100% - var(--ok-content-gutter, 1.25rem)));
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.ok-topbar-link {
  color: var(--ok-muted);
  text-decoration: none;
}

.ok-topbar-link:hover {
  color: var(--ok-text);
}

.topbar-title {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
}

@media (max-width: 520px) {
  .ok-topbar-inner {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.4rem;
  }
  .topbar-left .ok-topbar-link {
    font-size: 0.78rem;
    white-space: nowrap;
  }
  .topbar-title {
    font-size: 0.92rem;
  }
  .topbar-actions {
    gap: 0.3rem;
  }
}
</style>
