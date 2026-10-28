<script setup>
import { computed } from 'vue'
import { ArrowRight, Sparkles } from '@lucide/vue'
import { useT } from '../../../i18n.js'
import { kpBand, kpVisibleLat } from '../../../lib/kp.js'
import copy from '../../../copy/space-now.js'
import kpScale from '../../../copy/kp-scale.js'
import { UiBadge, UiButton, UiCard, UiErrorState } from '../../ui/index.js'

const props = defineProps({
  state: { type: String, default: 'loading' },
  kp: { type: Number, default: null },
})
const emit = defineEmits(['retry', 'navigate'])
const t = useT(copy)
const kpText = useT(kpScale)

const band = computed(() => kpBand(props.kp))
const display = computed(() => (props.kp != null ? props.kp.toFixed(1) : '--'))
const visibleLat = computed(() => {
  const lat = kpVisibleLat(props.kp)
  return lat == null ? '--' : lat
})
</script>

<template>
  <UiCard :label="t('aurora')" :icon="Sparkles" accent="#22c55e" :loading="state === 'loading'" :rows="4">
    <UiErrorState v-if="state === 'error'" :message="t('error')" :retry-label="t('retry')" @retry="emit('retry')" />
    <template v-else>
      <div class="kp-main">
        <div class="kp-value">{{ display }}</div>
        <UiBadge v-if="band" class="kp-level" :style="{ color: band.color, borderColor: band.color }">
          {{ kpText(band.key) }}
        </UiBadge>
      </div>
      <div class="metric">
        <span>{{ t('visibleRange') }}</span
        ><strong>{{ t('visibleAbove').replace('{lat}', visibleLat) }}</strong>
      </div>
      <p class="aurora-note">{{ t('auroraNote') }}</p>
    </template>
    <template #footer>
      <UiButton variant="soft" size="sm" @click="emit('navigate', 'aurora')">
        {{ t('openAurora') }} <ArrowRight :size="14" aria-hidden="true" />
      </UiButton>
    </template>
  </UiCard>
</template>

<style scoped>
.kp-main {
  display: flex;
  align-items: baseline;
  gap: 0.8rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--ok-line);
}

.kp-value {
  font-family: var(--ok-mono);
  font-size: 3.4rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--ok-text);
  font-variant-numeric: tabular-nums;
}

.kp-level {
  background: transparent;
}

.aurora-note {
  font-size: 0.74rem;
  color: var(--ok-muted);
  line-height: 1.5;
}
</style>
