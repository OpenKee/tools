<script setup>
defineProps({
  label: { type: String, default: '' },
  inline: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
})
</script>

<template>
  <div class="ui-loading" :class="{ 'is-inline': inline, 'is-compact': compact }" role="status" aria-live="polite">
    <span class="ui-spinner" aria-hidden="true"></span>
    <span v-if="label" class="ui-loading-label">{{ label }}</span>
  </div>
</template>

<style scoped>
.ui-loading {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 1.5rem;
  color: var(--ok-muted);
  font-size: 0.84rem;
}

.ui-loading.is-inline {
  padding: 0.65rem 0;
  font-size: 0.78rem;
}

.ui-loading.is-compact {
  padding: 0.4rem 0;
  font-size: 0.74rem;
}

.ui-loading-label {
  min-width: 0;
}
</style>
