<script setup>
import { CircleAlert, RotateCw } from '@lucide/vue'
import UiButton from './UiButton.vue'

defineProps({
  message: { type: String, required: true },
  title: { type: String, default: '' },
  retryLabel: { type: String, default: 'Retry' },
  variant: { type: String, default: 'inline' },
})
defineEmits(['retry'])
</script>

<template>
  <div class="ui-error" :class="'ui-error--' + variant" role="alert">
    <span class="ui-error-icon"><CircleAlert :size="variant === 'block' ? 22 : 17" aria-hidden="true" /></span>
    <div class="ui-error-copy">
      <strong v-if="title" class="ui-error-title">{{ title }}</strong>
      <span class="ui-error-text">{{ message }}</span>
    </div>
    <UiButton v-if="retryLabel" variant="ghost" size="sm" class="ui-error-retry" @click="$emit('retry')">
      <RotateCw :size="12" aria-hidden="true" />
      {{ retryLabel }}
    </UiButton>
  </div>
</template>

<style scoped>
.ui-error {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--ok-down) 24%, transparent);
  border-radius: 10px;
  background: var(--ok-down-bg);
  color: var(--ok-down);
  font-size: 0.78rem;
  line-height: 1.45;
}

.ui-error--block {
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem 1.5rem;
  border-radius: var(--ok-radius-surface);
  text-align: center;
}

.ui-error-icon {
  display: grid;
  flex: none;
  place-items: center;
}

.ui-error-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.15rem;
}

.ui-error--block .ui-error-copy {
  flex: none;
  align-items: center;
}

.ui-error-title {
  font-size: 0.88rem;
  font-weight: 650;
}

.ui-error-text {
  overflow-wrap: anywhere;
}

.ui-error-retry {
  margin-left: auto;
  color: var(--ok-down);
}

.ui-error--block .ui-error-retry {
  margin: 0.3rem 0 0;
}

.ui-error-retry:hover {
  background: color-mix(in srgb, var(--ok-down) 12%, transparent);
  color: var(--ok-down);
}
</style>
