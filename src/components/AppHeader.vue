<script setup>
import { RouterLink } from 'vue-router'
import { i18nState, toggleLang } from '../i18n.js'

defineProps({
  // 是否显示语言切换按钮（首页有自己的布局，可能不需要）
  showLangToggle: {
    type: Boolean,
    default: true,
  },
  // 顶栏标题（可选）
  title: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <nav class="ok-topbar">
    <div class="topbar-left">
      <RouterLink to="/" class="ok-topbar-link">← OpenKee Tools</RouterLink>
      <h1 v-if="title" class="topbar-title">{{ title }}</h1>
    </div>
    <button
      v-if="showLangToggle"
      class="ok-lang-toggle"
      type="button"
      :aria-label="'Switch language'"
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
