<script setup>
import { i18nState } from '../i18n.js'

defineProps({
  sources: {
    type: Array,
    default: () => [],
  },
})
</script>

<template>
  <footer class="ok-footer">
    <p v-if="sources.length" class="ok-footer-sources">
      {{ i18nState.lang === 'zh' ? '数据来源' : 'Data sources' }}:
      <template v-for="(s, i) in sources" :key="s.name"
        ><a :href="s.url" target="_blank" rel="noreferrer">{{ s.name }}</a
        ><span v-if="i < sources.length - 1"> · </span></template
      >
    </p>
    <span class="ok-footer-built"
      >Built by <a href="https://github.com/OpenKee" target="_blank" rel="noreferrer">OpenKee</a></span
    >
  </footer>
</template>

<style scoped>
.ok-footer {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.35rem 1rem;
  width: min(var(--ok-content-width, 1100px), calc(100% - var(--ok-content-gutter, 1.25rem)));
  margin: 2rem auto 0;
  padding: 1.2rem 0;
  border-top: 1px solid var(--ok-footer-line);
  font-family: var(--ok-font);
  font-size: 0.72rem;
  color: var(--ok-footer-text);
  letter-spacing: 0.03em;
}

.ok-footer-sources {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}

.ok-footer-sources + .ok-footer-built {
  margin-left: auto;
  flex-shrink: 0;
}

.ok-footer a {
  color: var(--ok-footer-link);
  text-decoration: none;
}

.ok-footer a:hover {
  text-decoration: underline;
}
</style>
