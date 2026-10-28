<script setup>
defineProps({
  modelValue: { type: Number, default: 0 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
  ariaLabel: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  showValue: { type: Boolean, default: false },
  suffix: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

function onInput(event) {
  emit('update:modelValue', Number(event.target.value))
}
</script>

<template>
  <div class="ui-range" :class="{ 'is-disabled': disabled }">
    <input
      type="range"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :aria-label="ariaLabel || undefined"
      :disabled="disabled"
      @input="onInput"
    />
    <span v-if="showValue" class="ui-range-value">{{ modelValue }}{{ suffix }}</span>
  </div>
</template>

<style scoped>
.ui-range {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.ui-range.is-disabled {
  opacity: 0.55;
}

.ui-range input[type='range'] {
  width: 100%;
  min-width: 0;
  height: 1.1rem;
  margin: 0;
  background: transparent;
  cursor: pointer;
  appearance: none;
}

.ui-range input[type='range']::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--ok-text) 14%, transparent);
}

.ui-range input[type='range']::-webkit-slider-thumb {
  width: 14px;
  height: 14px;
  margin-top: -5px;
  border: 2px solid var(--ok-panel);
  border-radius: 50%;
  background: var(--ok-accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--ok-accent) 40%, transparent);
  appearance: none;
}

.ui-range input[type='range']::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--ok-text) 14%, transparent);
}

.ui-range input[type='range']::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: 2px solid var(--ok-panel);
  border-radius: 50%;
  background: var(--ok-accent);
}

.ui-range input[type='range']:focus-visible {
  outline: 2px solid var(--ok-accent);
  outline-offset: 3px;
  border-radius: 4px;
}

.ui-range-value {
  min-width: 2.2rem;
  color: var(--ok-muted);
  font-family: var(--ok-mono);
  font-size: 0.72rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
