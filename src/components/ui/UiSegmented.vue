<script setup>
defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  options: { type: Array, default: () => [] },
  ariaLabel: { type: String, default: '' },
  size: { type: String, default: 'md' },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="ui-segmented" :class="'ui-segmented--' + size" role="group" :aria-label="ariaLabel || undefined">
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      class="ui-segmented-item"
      :class="{ active: option.value === modelValue }"
      :disabled="disabled || option.disabled"
      :aria-pressed="option.value === modelValue"
      @click="emit('update:modelValue', option.value)"
    >
      <component :is="option.icon" v-if="option.icon" :size="13" aria-hidden="true" />
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.ui-segmented {
  display: inline-flex;
  max-width: 100%;
  flex-wrap: wrap;
  gap: 0.2rem;
  padding: 0.2rem;
  border: 1px solid var(--ok-line);
  border-radius: 9px;
  background: var(--ok-panel);
}

.ui-segmented-item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.6rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ok-muted);
  font: inherit;
  font-size: 0.74rem;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.ui-segmented--sm .ui-segmented-item {
  padding: 0.24rem 0.48rem;
  font-size: 0.68rem;
}

.ui-segmented-item:hover:not(:disabled) {
  background: var(--ok-accent-soft);
  color: var(--ok-text);
}

.ui-segmented-item.active {
  background: var(--ok-accent-soft);
  color: var(--ok-accent);
  font-weight: 600;
}

.ui-segmented-item:disabled {
  opacity: 0.5;
  cursor: default;
}

.ui-segmented-item:focus-visible {
  box-shadow: inset 0 0 0 2px var(--ok-accent);
}
</style>
