<script setup>
defineProps({
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  sub: { type: String, default: '' },
  tone: { type: String, default: 'neutral' },
  card: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
})
</script>

<template>
  <div class="ui-stat" :class="['ui-stat--' + tone, { 'is-card': card, 'is-compact': compact }]">
    <span class="ui-stat-label">{{ label }}</span>
    <strong class="ui-stat-value">{{ value }}</strong>
    <span v-if="sub" class="ui-stat-sub">{{ sub }}</span>
  </div>
</template>

<style scoped>
.ui-stat {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.15rem;
}

.ui-stat.is-card {
  gap: 0.25rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-surface);
  background: var(--ok-panel);
}

.ui-stat.is-compact {
  padding: 0.55rem 0.65rem;
}

.ui-stat-label {
  color: var(--ok-muted);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ui-stat-value {
  color: var(--ok-text);
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.ui-stat.is-compact .ui-stat-value {
  font-size: 1rem;
}

.ui-stat-sub {
  color: var(--ok-muted);
  font-size: 0.7rem;
  line-height: 1.4;
}

.ui-stat--accent .ui-stat-value {
  color: var(--ok-accent);
}

.ui-stat--up .ui-stat-value {
  color: var(--ok-up);
}

.ui-stat--down .ui-stat-value {
  color: var(--ok-down);
}

.ui-stat--warn .ui-stat-value {
  color: #d97706;
}

:root[data-theme='dark'] .ui-stat--warn .ui-stat-value {
  color: #fbbf24;
}
</style>
