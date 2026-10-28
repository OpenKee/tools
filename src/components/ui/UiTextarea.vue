<script setup>
import { computed, ref, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

defineProps({
  modelValue: { type: [String, Number], default: '' },
  rows: { type: [String, Number], default: 4 },
  size: { type: String, default: 'md' },
  placeholder: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
  monospace: { type: Boolean, default: true },
  resize: { type: String, default: 'vertical' },
  spellcheck: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
const attrs = useAttrs()
const textareaEl = ref(null)

const textareaAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

function onInput(event) {
  emit('update:modelValue', event.target.value)
}

defineExpose({ focus: () => textareaEl.value?.focus() })
</script>

<template>
  <span
    class="ui-textarea"
    :class="[
      'ui-textarea--' + size,
      $attrs.class,
      { 'is-disabled': disabled, 'is-readonly': readonly, 'is-invalid': invalid, 'is-mono': monospace },
    ]"
    :style="[{ '--ui-textarea-resize': resize }, $attrs.style]"
  >
    <textarea
      ref="textareaEl"
      v-bind="textareaAttrs"
      :value="modelValue"
      :rows="rows"
      :placeholder="placeholder"
      :aria-label="ariaLabel || undefined"
      :aria-invalid="invalid || undefined"
      :disabled="disabled"
      :readonly="readonly"
      :spellcheck="spellcheck"
      @input="onInput"
    ></textarea>
  </span>
</template>

<style scoped>
.ui-textarea {
  display: block;
  width: 100%;
  min-width: 0;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-control);
  background: var(--ok-panel);
  color: var(--ok-text);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.ui-textarea--sm {
  font-size: 0.74rem;
}

.ui-textarea--md {
  font-size: 0.8rem;
}

.ui-textarea--lg {
  font-size: 0.86rem;
}

.ui-textarea:hover {
  border-color: var(--ok-line-strong);
}

.ui-textarea:focus-within {
  border-color: var(--ok-accent);
  box-shadow: var(--ok-focus-ring);
}

.ui-textarea.is-invalid {
  border-color: var(--ok-down);
}

.ui-textarea.is-disabled {
  opacity: 0.6;
}

.ui-textarea.is-readonly {
  background: var(--ok-panel-subtle);
}

.ui-textarea textarea {
  display: block;
  width: 100%;
  min-height: 4.5rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: inherit;
  line-height: 1.55;
  outline: none;
  resize: var(--ui-textarea-resize, vertical);
}

.ui-textarea.is-mono textarea {
  font-family: var(--ok-mono);
  font-size: 0.78rem;
}

.ui-textarea textarea::placeholder {
  color: var(--ok-muted);
}
</style>
