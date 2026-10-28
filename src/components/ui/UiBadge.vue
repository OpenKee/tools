<script setup>
defineProps({
  variant: { type: String, default: 'neutral' },
  size: { type: String, default: 'md' },
  dot: { type: Boolean, default: false },
  mono: { type: Boolean, default: false },
})
</script>

<template>
  <span class="ui-badge" :class="['ui-badge--' + variant, 'ui-badge--' + size, { 'is-mono': mono }]">
    <span v-if="dot" class="ui-badge-dot" aria-hidden="true"></span>
    <slot />
  </span>
</template>

<style scoped>
.ui-badge {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-pill);
  background: var(--ok-panel-subtle);
  color: var(--ok-muted);
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.ui-badge--sm {
  padding: 0.22rem 0.45rem;
  font-size: 0.64rem;
}

.ui-badge--md {
  padding: 0.3rem 0.55rem;
}

.ui-badge.is-mono {
  font-family: var(--ok-mono);
  font-weight: 500;
}

.ui-badge-dot {
  width: 0.42rem;
  height: 0.42rem;
  flex: none;
  border-radius: 50%;
  background: currentColor;
}

.ui-badge--accent {
  border-color: color-mix(in srgb, var(--ok-accent) 26%, transparent);
  background: var(--ok-accent-soft);
  color: var(--ok-accent);
}

.ui-badge--up {
  border-color: color-mix(in srgb, var(--ok-up) 30%, transparent);
  background: var(--ok-up-bg);
  color: var(--ok-up);
}

.ui-badge--down {
  border-color: color-mix(in srgb, var(--ok-down) 30%, transparent);
  background: var(--ok-down-bg);
  color: var(--ok-down);
}

.ui-badge--warn {
  border-color: color-mix(in srgb, #d97706 30%, transparent);
  background: color-mix(in srgb, #f59e0b 12%, transparent);
  color: #b45309;
}

:root[data-theme='dark'] .ui-badge--warn {
  color: #fbbf24;
}

.ui-badge--outline {
  background: transparent;
  color: var(--ok-text);
}

.ui-badge--solid {
  border-color: var(--ok-text);
  background: var(--ok-text);
  color: var(--ok-bg);
}
</style>
