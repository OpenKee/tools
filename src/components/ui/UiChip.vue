<script setup>
defineProps({
  active: { type: Boolean, default: false },
  toggle: { type: Boolean, default: false },
  variant: { type: String, default: 'neutral' },
  size: { type: String, default: 'md' },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
})
</script>

<template>
  <button
    :type="type"
    class="ui-chip"
    :class="['ui-chip--' + variant, 'ui-chip--' + size, { 'is-active': active }]"
    :disabled="disabled"
    :aria-pressed="toggle ? active : undefined"
  >
    <slot />
  </button>
</template>

<style scoped>
.ui-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-pill);
  background: transparent;
  color: var(--ok-text);
  font: inherit;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}

.ui-chip--sm {
  padding: 0.28rem 0.55rem;
  font-size: 0.68rem;
}

.ui-chip--md {
  padding: 0.36rem 0.7rem;
  font-size: 0.76rem;
}

.ui-chip:hover:not(:disabled) {
  border-color: var(--ok-accent);
  color: var(--ok-accent);
}

.ui-chip.is-active {
  border-color: color-mix(in srgb, var(--ok-accent) 45%, transparent);
  background: var(--ok-accent-soft);
  color: var(--ok-accent);
}

.ui-chip--accent {
  border-color: color-mix(in srgb, var(--ok-accent) 26%, transparent);
  background: var(--ok-accent-soft);
  color: var(--ok-accent);
}

.ui-chip--up {
  border-color: color-mix(in srgb, var(--ok-up) 32%, transparent);
  background: var(--ok-up-bg);
  color: var(--ok-up);
}

.ui-chip--down {
  border-color: color-mix(in srgb, var(--ok-down) 32%, transparent);
  background: var(--ok-down-bg);
  color: var(--ok-down);
}

.ui-chip:disabled {
  opacity: 0.5;
  cursor: default;
}

.ui-chip:focus-visible {
  outline: none;
  box-shadow: var(--ok-focus-ring);
}
</style>
