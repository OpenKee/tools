<script setup>
import { TooltipArrow, TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui'

defineProps({
  label: { type: String, required: true },
  side: { type: String, default: 'top' },
  delay: { type: Number, default: 250 },
})
</script>

<template>
  <TooltipProvider :delay-duration="delay">
    <TooltipRoot>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent class="ui-tooltip" :side="side" :side-offset="6">
          {{ label }}
          <TooltipArrow class="ui-tooltip-arrow" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<style scoped>
.ui-tooltip {
  z-index: 90;
  padding: 0.32rem 0.5rem;
  border: 1px solid var(--ok-line);
  border-radius: 7px;
  background: var(--ok-panel);
  color: var(--ok-text);
  box-shadow: var(--ok-shadow-card-hover);
  font-size: 0.7rem;
  line-height: 1.2;
  user-select: none;
  animation: ui-tooltip-in 0.12s ease;
}

.ui-tooltip-arrow {
  fill: var(--ok-panel);
}

@keyframes ui-tooltip-in {
  from {
    opacity: 0;
    transform: translateY(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-tooltip {
    animation: none;
  }
}
</style>
