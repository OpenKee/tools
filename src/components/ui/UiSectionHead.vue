<script setup>
defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  meta: { type: String, default: '' },
})
</script>

<template>
  <div class="ui-section-head">
    <div class="ui-section-copy">
      <h2 v-if="title" class="ui-section-title">{{ title }}</h2>
      <p v-if="description" class="ui-section-desc">{{ description }}</p>
    </div>
    <span v-if="meta" class="ui-section-meta">{{ meta }}</span>
    <div v-if="$slots.meta" class="ui-section-meta"><slot name="meta" /></div>
    <div v-if="$slots.actions" class="ui-section-actions"><slot name="actions" /></div>
  </div>
</template>

<style scoped>
.ui-section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.75rem;
  margin-bottom: 0.75rem;
}

.ui-section-copy {
  min-width: 0;
  flex: 1 1 auto;
}

.ui-section-title {
  font-size: 0.98rem;
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.ui-section-desc {
  margin-top: 0.15rem;
  color: var(--ok-muted);
  font-size: 0.76rem;
  line-height: 1.5;
}

.ui-section-meta {
  margin-left: auto;
  color: var(--ok-muted);
  font-size: 0.72rem;
  white-space: nowrap;
}

.ui-section-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
}
</style>
