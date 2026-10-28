<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  variant: { type: String, default: 'ghost' },
  size: { type: String, default: 'md' },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
  toggle: { type: Boolean, default: false },
  title: { type: String, default: '' },
})

const tooltip = computed(() => props.title || props.label)
</script>

<template>
  <button
    :type="type"
    class="ui-icon-btn"
    :class="['ui-icon-btn--' + variant, 'ui-icon-btn--' + size, { 'is-active': active }]"
    :disabled="disabled"
    :aria-label="label"
    :title="tooltip"
    :aria-pressed="toggle ? active : undefined"
  >
    <slot />
  </button>
</template>

<style scoped>
.ui-icon-btn {
  display: inline-grid;
  place-items: center;
  flex: none;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--ok-radius-control);
  background: transparent;
  color: var(--ok-muted);
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.ui-icon-btn--sm {
  width: 1.9rem;
  height: 1.9rem;
  font-size: 0.92rem;
}

.ui-icon-btn--md {
  width: 2.2rem;
  height: 2.2rem;
  font-size: 1.02rem;
}

.ui-icon-btn--lg {
  width: 2.6rem;
  height: 2.6rem;
  font-size: 1.15rem;
}

.ui-icon-btn--ghost:hover:not(:disabled),
.ui-icon-btn--ghost.is-active {
  background: var(--ok-accent-soft);
  color: var(--ok-accent);
}

.ui-icon-btn--secondary {
  border-color: var(--ok-line);
  background: var(--ok-panel);
  color: var(--ok-text);
}

.ui-icon-btn--secondary:hover:not(:disabled),
.ui-icon-btn--secondary.is-active {
  border-color: var(--ok-accent);
  color: var(--ok-accent);
}

.ui-icon-btn--danger:hover:not(:disabled) {
  background: var(--ok-down-bg);
  color: var(--ok-down);
}

.ui-icon-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.ui-icon-btn:focus-visible {
  outline: none;
  box-shadow: var(--ok-focus-ring);
}

.ui-icon-btn :deep(svg) {
  display: block;
  width: 1em;
  height: 1em;
  stroke-width: 1.9;
}
</style>
