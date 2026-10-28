<script setup>
import { computed } from 'vue'
import UiButton from './UiButton.vue'
import UiInput from './UiInput.vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  placeholder: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  submitLabel: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'md' },
  clearable: { type: Boolean, default: true },
  clearLabel: { type: String, default: '' },
  inputType: { type: String, default: 'search' },
})

const emit = defineEmits(['update:modelValue', 'submit'])

const proxy = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

function onSubmit() {
  if (props.busy || props.disabled) return
  emit('submit')
}
</script>

<template>
  <form class="ui-search" role="search" @submit.prevent="onSubmit">
    <div class="ui-search-row">
      <slot name="prefix" />
      <UiInput
        v-model="proxy"
        class="ui-search-input"
        :type="inputType"
        :size="size"
        :placeholder="placeholder"
        :aria-label="ariaLabel"
        :disabled="disabled || busy"
        :clearable="clearable"
        :clear-label="clearLabel"
      />
      <UiButton v-if="submitLabel" type="submit" variant="primary" :size="size" :loading="busy" :disabled="disabled">
        {{ submitLabel }}
      </UiButton>
      <slot name="actions" />
    </div>
    <div v-if="$slots.extra" class="ui-search-extra"><slot name="extra" /></div>
  </form>
</template>

<style scoped>
.ui-search {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.6rem;
}

.ui-search-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.45rem;
}

.ui-search-input {
  flex: 1 1 12rem;
}

.ui-search-extra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

@media (max-width: 520px) {
  .ui-search-row {
    flex-wrap: wrap;
  }

  .ui-search-input {
    flex-basis: 100%;
  }
}
</style>
