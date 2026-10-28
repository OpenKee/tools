<script setup>
import { computed } from 'vue'

const props = defineProps({
  lines: { type: Number, default: 3 },
  widths: { type: Array, default: () => [] },
  compact: { type: Boolean, default: false },
})

const lineWidths = computed(() => {
  if (props.widths.length) return props.widths
  return Array.from({ length: props.lines }, (_, index) => {
    if (index === props.lines - 1) return '62%'
    return index % 2 === 0 ? '100%' : '84%'
  })
})
</script>

<template>
  <div class="ui-skeleton" :class="{ 'is-compact': compact }" aria-hidden="true">
    <span v-for="(width, index) in lineWidths" :key="index" :style="{ width }" />
  </div>
</template>

<style scoped>
.ui-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-top: 0.15rem;
}

.ui-skeleton span {
  display: block;
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--ok-text) 5%, transparent),
    color-mix(in srgb, var(--ok-text) 11%, transparent),
    color-mix(in srgb, var(--ok-text) 5%, transparent)
  );
  background-size: 200% 100%;
  animation: ui-shimmer 1.5s ease-in-out infinite;
}

.ui-skeleton span:first-child {
  height: 20px;
}

.ui-skeleton.is-compact {
  gap: 0.4rem;
}

.ui-skeleton.is-compact span {
  height: 9px;
}

@keyframes ui-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-skeleton span {
    animation: none;
  }
}
</style>
