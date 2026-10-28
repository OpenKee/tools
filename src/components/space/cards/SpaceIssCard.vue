<script setup>
import { computed } from 'vue'
import { ArrowRight, Satellite } from '@lucide/vue'
import { i18nState, useT } from '../../../i18n.js'
import { locale } from '../../../ok.js'
import { detectRegion } from '../../../lib/regions.js'
import copy from '../../../copy/space-now.js'
import { UiButton, UiCard, UiErrorState } from '../../ui/index.js'

const props = defineProps({
  state: { type: String, default: 'loading' },
  iss: { type: Object, default: null },
})
const emit = defineEmits(['retry', 'navigate'])
const t = useT(copy)

const region = computed(() => {
  if (!props.iss) return '--'
  const r = detectRegion(props.iss.lat, props.iss.lon)
  return i18nState.lang === 'zh' ? r.zh : r.en
})
const lat = computed(() => (props.iss ? props.iss.lat.toFixed(3) + '°' : '--'))
const lon = computed(() => (props.iss ? props.iss.lon.toFixed(3) + '°' : '--'))
const speed = computed(() => {
  const s = props.iss && props.iss.speed
  if (s == null) return '~27,600 km/h'
  return Math.round(s).toLocaleString(locale()) + ' km/h'
})
const alt = computed(() => {
  const a = props.iss && props.iss.alt
  return (a != null ? '~' + Math.round(a) : '~408') + ' km'
})
const time = computed(() => {
  if (!props.iss || !props.iss.ts) return '--'
  return new Date(props.iss.ts).toLocaleTimeString(locale(), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
})
</script>

<template>
  <UiCard :label="t('iss')" :icon="Satellite" accent="#38bdf8" :loading="state === 'loading'" :rows="8">
    <UiErrorState v-if="state === 'error'" :message="t('error')" :retry-label="t('retry')" @retry="emit('retry')" />
    <template v-else-if="iss">
      <div class="flying">{{ t('flyingOver').replace('{region}', region) }}</div>
      <div class="metric-rows">
        <div class="metric">
          <span>{{ t('latitude') }}</span
          ><strong>{{ lat }}</strong>
        </div>
        <div class="metric">
          <span>{{ t('longitude') }}</span
          ><strong>{{ lon }}</strong>
        </div>
        <div class="metric">
          <span>{{ t('speed') }}</span
          ><strong>{{ speed }}</strong>
        </div>
        <div class="metric">
          <span>{{ t('altitude') }}</span
          ><strong>{{ alt }}</strong>
        </div>
        <div class="metric">
          <span>{{ t('inclination') }}</span
          ><strong>51.6°</strong>
        </div>
        <div class="metric">
          <span>{{ t('orbitPeriod') }}</span
          ><strong>{{ t('orbitPeriodValue') }}</strong>
        </div>
        <div class="metric">
          <span>{{ t('positionTime') }}</span
          ><strong>{{ time }}</strong>
        </div>
      </div>
    </template>
    <template #footer>
      <UiButton variant="soft" size="sm" @click="emit('navigate', 'iss')">
        {{ t('openIssMap') }} <ArrowRight :size="14" aria-hidden="true" />
      </UiButton>
    </template>
  </UiCard>
</template>

<style scoped>
.flying {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--card-accent);
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--ok-line);
}
</style>
