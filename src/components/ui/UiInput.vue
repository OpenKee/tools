<script setup>
import { computed, ref, useAttrs } from 'vue'
import { X } from '@lucide/vue'
import { i18nState } from '../../i18n.js'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  type: { type: String, default: 'text' },
  size: { type: String, default: 'md' },
  placeholder: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
  monospace: { type: Boolean, default: false },
  clearable: { type: Boolean, default: false },
  clearLabel: { type: String, default: '' },
  autocomplete: { type: String, default: 'off' },
  modelModifiers: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:modelValue', 'clear'])
const attrs = useAttrs()
const inputEl = ref(null)

const inputAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

function onInput(event) {
  let value = event.target.value
  if (props.modelModifiers.number) {
    value = value === '' ? '' : Number(value)
  }
  emit('update:modelValue', value)
}

function clear() {
  emit('update:modelValue', '')
  emit('clear')
  inputEl.value?.focus()
}

defineExpose({ focus: () => inputEl.value?.focus() })
</script>

<template>
  <span
    class="ui-input"
    :class="[
      'ui-input--' + size,
      $attrs.class,
      { 'is-disabled': disabled, 'is-readonly': readonly, 'is-invalid': invalid, 'is-mono': monospace },
    ]"
    :style="$attrs.style"
  >
    <slot name="prefix" />
    <input
      ref="inputEl"
      v-bind="inputAttrs"
      :value="modelValue"
      :type="type"
      :placeholder="placeholder"
      :aria-label="ariaLabel || undefined"
      :aria-invalid="invalid || undefined"
      :disabled="disabled"
      :readonly="readonly"
      :autocomplete="autocomplete"
      @input="onInput"
    />
    <button
      v-if="clearable && modelValue !== '' && modelValue !== null && modelValue !== undefined && !disabled && !readonly"
      class="ui-input-clear"
      type="button"
      :aria-label="clearLabel || (i18nState.lang === 'zh' ? '清除' : 'Clear')"
      :title="clearLabel || (i18nState.lang === 'zh' ? '清除' : 'Clear')"
      @click="clear"
    >
      <X :size="12" aria-hidden="true" />
    </button>
    <slot name="suffix" />
  </span>
</template>

<style scoped>
.ui-input {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 0.35rem;
  padding: 0 0.6rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-control);
  background: var(--ok-panel);
  color: var(--ok-text);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.ui-input--sm {
  height: 1.9rem;
  font-size: 0.74rem;
}

.ui-input--md {
  height: 2.2rem;
  font-size: 0.8rem;
}

.ui-input--lg {
  height: 2.6rem;
  font-size: 0.86rem;
}

.ui-input:hover {
  border-color: var(--ok-line-strong);
}

.ui-input:focus-within {
  border-color: var(--ok-accent);
  box-shadow: var(--ok-focus-ring);
}

.ui-input.is-invalid {
  border-color: var(--ok-down);
}

.ui-input.is-disabled {
  opacity: 0.6;
}

.ui-input.is-readonly {
  background: var(--ok-panel-subtle);
}

.ui-input input {
  width: 100%;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: inherit;
  outline: none;
}

.ui-input.is-mono input {
  font-family: var(--ok-mono);
}

.ui-input input::placeholder {
  color: var(--ok-muted);
}

.ui-input input:disabled {
  cursor: default;
}

.ui-input-clear {
  display: grid;
  width: 1.25rem;
  height: 1.25rem;
  flex: none;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--ok-text) 8%, transparent);
  color: var(--ok-muted);
  cursor: pointer;
}

.ui-input-clear:hover {
  background: var(--ok-accent-soft);
  color: var(--ok-accent);
}

.ui-input:focus-within {
  outline: none;
}
</style>
