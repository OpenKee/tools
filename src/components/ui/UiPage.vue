<script setup>
import { computed, useAttrs } from 'vue'
import AppFooter from '../AppFooter.vue'
import AppHeader from '../AppHeader.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Object], default: '' },
  sources: { type: Array, default: () => [] },
  showHeader: { type: Boolean, default: true },
  showFooter: { type: Boolean, default: true },
  langToggle: { type: Boolean, default: true },
  themeToggle: { type: Boolean, default: true },
  width: { type: String, default: '1100px' },
  gutter: { type: String, default: '1.25rem' },
  spacing: { type: String, default: 'default' },
  embedded: { type: Boolean, default: false },
})

const attrs = useAttrs()

const rootStyle = computed(() => [
  { '--ok-content-width': props.width, '--ok-content-gutter': props.gutter },
  attrs.style,
])
</script>

<template>
  <div
    class="ui-page"
    :class="[attrs.class, 'ui-page--' + spacing, { 'ui-page--embedded': embedded }]"
    :style="rootStyle"
  >
    <AppHeader
      v-if="showHeader && !embedded"
      :title="title"
      :show-lang-toggle="langToggle"
      :show-theme-toggle="themeToggle"
    />
    <component :is="embedded ? 'div' : 'main'" class="ui-page-main" :tabindex="embedded ? undefined : -1">
      <slot />
    </component>
    <AppFooter v-if="showFooter && !embedded" :sources="sources" />
  </div>
</template>

<style scoped>
.ui-page {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  color: var(--ok-text);
  font-family: var(--ok-font);
}

.ui-page-main {
  width: min(var(--ok-content-width, 1100px), calc(100% - var(--ok-content-gutter, 1.25rem)));
  flex: 1;
  margin: 0 auto;
  padding: 0.9rem 0 2.5rem;
}

.ui-page-main:focus {
  outline: none;
}

.ui-page--compact .ui-page-main {
  padding-top: 0.55rem;
}

.ui-page--roomy .ui-page-main {
  padding-top: 1.6rem;
}

.ui-page--none .ui-page-main {
  padding-top: 0;
}

.ui-page--embedded {
  min-height: 0;
  color: inherit;
  font-family: inherit;
}

.ui-page--embedded .ui-page-main {
  width: 100%;
  padding: 0;
}
</style>
