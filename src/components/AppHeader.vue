<script setup>
import { computed, watchEffect } from 'vue'
import { RouterLink } from 'vue-router'
import { i18nState, toggleLang } from '../i18n.js'

const props = defineProps({
  // 是否显示语言切换按钮（首页有自己的布局，可能不需要）
  showLangToggle: {
    type: Boolean,
    default: true,
  },
  // 顶栏标题：可传字符串，或 { en, zh } 对象按语言自动切换
  title: {
    type: [String, Object],
    default: '',
  },
})

// 按当前语言解析标题
const displayTitle = computed(() => {
  if (!props.title) return ''
  if (typeof props.title === 'string') return props.title
  return props.title[i18nState.lang] || props.title.en || ''
})

// 返回链接文案
const backLabel = computed(() => (i18nState.lang === 'zh' ? '← OpenKee 工具集' : '← OpenKee Tools'))

// 浏览器标签页标题随应用标题 + 语言切换
watchEffect(() => {
  const t = displayTitle.value
  if (t) {
    document.title = i18nState.lang === 'zh' ? `${t} — OpenKee 工具集` : `${t} — OpenKee Tools`
  }
})
</script>

<template>
  <nav class="ok-topbar">
    <div class="topbar-left">
      <RouterLink to="/" class="ok-topbar-link">{{ backLabel }}</RouterLink>
      <h1 v-if="displayTitle" class="topbar-title">{{ displayTitle }}</h1>
    </div>
    <button
      v-if="showLangToggle"
      class="ok-lang-toggle"
      type="button"
      :aria-label="i18nState.lang === 'zh' ? '切换语言' : 'Switch language'"
      @click="toggleLang"
    >
      {{ i18nState.lang === 'en' ? '中文' : 'EN' }}
    </button>
  </nav>
</template>

<style scoped>
.topbar-left {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.topbar-title {
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0;
  opacity: 0.7;
}
</style>
