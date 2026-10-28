<script setup>
import { Check } from '@lucide/vue'

defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, default: '' },
  description: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  name: { type: String, default: '' },
  variant: { type: String, default: 'inline' },
})
const emit = defineEmits(['update:modelValue', 'change'])

function onChange(event) {
  emit('update:modelValue', event.target.checked)
  emit('change', event.target.checked)
}
</script>

<template>
  <label class="ui-check" :class="['ui-check--' + variant, { 'is-checked': modelValue, 'is-disabled': disabled }]">
    <input
      class="ui-check-input"
      type="checkbox"
      :name="name || undefined"
      :checked="modelValue"
      :disabled="disabled"
      @change="onChange"
    />
    <span class="ui-check-box" aria-hidden="true"><Check :size="12" /></span>
    <span class="ui-check-copy">
      <span class="ui-check-label"
        ><slot>{{ label }}</slot></span
      >
      <span v-if="description" class="ui-check-desc">{{ description }}</span>
    </span>
  </label>
</template>

<style scoped>
.ui-check {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 0.5rem;
  color: var(--ok-text);
  font-size: 0.8rem;
  line-height: 1.4;
  cursor: pointer;
}

.ui-check--tile {
  padding: 0.6rem 0.65rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-control);
  background: var(--ok-panel);
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.ui-check--tile:hover {
  border-color: var(--ok-line-strong);
}

.ui-check--tile.is-checked {
  border-color: color-mix(in srgb, var(--ok-accent) 40%, transparent);
  background: var(--ok-accent-soft);
}

.ui-check.is-disabled {
  opacity: 0.55;
  cursor: default;
}

.ui-check-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.ui-check-box {
  display: grid;
  width: 1.05rem;
  height: 1.05rem;
  flex: none;
  place-items: center;
  margin-top: 0.05rem;
  border: 1px solid var(--ok-line-strong);
  border-radius: 4px;
  background: var(--ok-panel);
  color: var(--ok-bg);
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.ui-check-box :deep(svg) {
  opacity: 0;
  transform: scale(0.7);
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.ui-check.is-checked .ui-check-box {
  border-color: var(--ok-accent);
  background: var(--ok-accent);
}

.ui-check.is-checked .ui-check-box :deep(svg) {
  opacity: 1;
  transform: scale(1);
}

.ui-check-input:focus-visible + .ui-check-box {
  box-shadow: var(--ok-focus-ring);
}

.ui-check-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.1rem;
}

.ui-check-label {
  font-weight: 500;
}

.ui-check-desc {
  color: var(--ok-muted);
  font-size: 0.7rem;
}
</style>
