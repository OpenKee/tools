<script setup>
defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  level: { type: Number, default: 1 },
  rule: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
})
</script>

<template>
  <header class="ui-page-head" :class="{ 'has-rule': rule, 'is-compact': compact }">
    <div class="ui-page-head-copy">
      <p v-if="eyebrow" class="ui-eyebrow">{{ eyebrow }}</p>
      <component :is="'h' + level" v-if="title" class="ui-page-title">{{ title }}</component>
      <p v-if="description" class="ui-page-desc">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="ui-page-actions"><slot name="actions" /></div>
  </header>
</template>

<style scoped>
.ui-page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.ui-page-head.has-rule {
  padding-bottom: 1.2rem;
  border-bottom: 1px solid var(--ok-line);
}

.ui-page-head-copy {
  min-width: 0;
}

.ui-eyebrow {
  color: var(--ok-muted);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.ui-page-title {
  margin-top: 0.4rem;
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.04em;
}

.ui-page-desc {
  max-width: 68ch;
  margin-top: 0.45rem;
  color: var(--ok-muted);
  font-size: 0.84rem;
  line-height: 1.6;
}

.ui-page-head.is-compact {
  margin-bottom: 0.75rem;
}

.ui-page-head.is-compact .ui-page-title {
  margin-top: 0;
  font-size: 1.05rem;
  line-height: 1.25;
  letter-spacing: -0.015em;
}

.ui-page-head.is-compact .ui-page-desc {
  max-width: 72ch;
  margin-top: 0.15rem;
  font-size: 0.76rem;
  line-height: 1.5;
}

.ui-page-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

@media (max-width: 720px) {
  .ui-page-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.65rem;
  }
}
</style>
