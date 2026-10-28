<script setup>
defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
  compact: { type: Boolean, default: false },
})
</script>

<template>
  <div class="ui-empty" :class="{ 'is-compact': compact }">
    <span v-if="icon" class="ui-empty-icon"><component :is="icon" :size="18" aria-hidden="true" /></span>
    <h3 v-if="title" class="ui-empty-title">{{ title }}</h3>
    <p v-if="description" class="ui-empty-desc">{{ description }}</p>
    <div v-if="$slots.actions" class="ui-empty-actions"><slot name="actions" /></div>
  </div>
</template>

<style scoped>
.ui-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  padding: 2.5rem 1.5rem;
  border: 1px dashed var(--ok-line);
  border-radius: var(--ok-radius-surface);
  color: var(--ok-muted);
  text-align: center;
}

.ui-empty.is-compact {
  padding: 1.4rem 1rem;
}

.ui-empty-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 10px;
  background: var(--ok-accent-soft);
  color: var(--ok-accent);
}

.ui-empty-title {
  color: var(--ok-text);
  font-size: 0.92rem;
  font-weight: 600;
}

.ui-empty-desc {
  max-width: 52ch;
  font-size: 0.8rem;
  line-height: 1.6;
}

.ui-empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.45rem;
  margin-top: 0.4rem;
}
</style>
