<script setup>
import { computed, useAttrs } from 'vue'
import { ChevronDown } from '@lucide/vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'md' },
})

const emit = defineEmits(['update:modelValue'])
const attrs = useAttrs()

const normalized = computed(() =>
  props.options.map((option) =>
    option !== null && typeof option === 'object' ? option : { value: option, label: String(option) },
  ),
)

const proxy = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const showPlaceholder = computed(() => !!props.placeholder && !normalized.value.some((option) => option.value === ''))

const selectAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})
</script>

<template>
  <span
    class="ui-select"
    :class="['ui-select--' + size, $attrs.class, { 'is-disabled': disabled }]"
    :style="$attrs.style"
  >
    <select v-bind="selectAttrs" v-model="proxy" :aria-label="ariaLabel || undefined" :disabled="disabled">
      <option v-if="showPlaceholder" value="" disabled>{{ placeholder }}</option>
      <option
        v-for="option in normalized"
        :key="String(option.value)"
        :value="option.value"
        :disabled="option.disabled || undefined"
      >
        {{ option.label }}
      </option>
    </select>
    <ChevronDown class="ui-select-icon" :size="14" aria-hidden="true" />
  </span>
</template>

<style scoped>
.ui-select {
  position: relative;
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-control);
  background: var(--ok-panel);
  color: var(--ok-text);
  transition: border-color 0.15s ease;
}

.ui-select--sm {
  height: 1.9rem;
  font-size: 0.74rem;
}

.ui-select--md {
  height: 2.2rem;
  font-size: 0.8rem;
}

.ui-select--lg {
  height: 2.6rem;
  font-size: 0.86rem;
}

.ui-select:hover {
  border-color: var(--ok-line-strong);
}

.ui-select:focus-within {
  border-color: var(--ok-accent);
  box-shadow: var(--ok-focus-ring);
}

.ui-select.is-disabled {
  opacity: 0.6;
}

.ui-select select {
  width: 100%;
  height: 100%;
  min-width: 0;
  padding: 0 2rem 0 0.6rem;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: inherit;
  outline: none;
  cursor: pointer;
  appearance: none;
}

.ui-select select:disabled {
  cursor: default;
}

.ui-select option {
  background: var(--ok-panel);
  color: var(--ok-text);
}

.ui-select-icon {
  position: absolute;
  right: 0.6rem;
  pointer-events: none;
  color: var(--ok-muted);
}
</style>
