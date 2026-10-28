<script setup>
import { computed } from 'vue'
import { ArrowRight, Rocket } from '@lucide/vue'
import { useT } from '../../../i18n.js'
import { pad2 } from '../../../lib/format.js'
import copy from '../../../copy/space-now.js'
import { UiButton, UiCard, UiEmptyState, UiErrorState } from '../../ui/index.js'

const props = defineProps({
  state: { type: String, default: 'loading' },
  errorKind: { type: String, default: '' },
  launch: { type: Object, default: null },
  now: { type: Number, default: Date.now },
})
const emit = defineEmits(['retry', 'navigate'])
const t = useT(copy)

const errorMessage = computed(() => (props.errorKind === 'quota' ? t.value('quotaHint') : t.value('error')))

const countdown = computed(() => {
  if (!props.launch || !props.launch.net) return null
  const target = new Date(props.launch.net).getTime()
  if (isNaN(target)) return null
  let diff = target - props.now
  const launched = diff <= 0
  diff = Math.max(0, diff)
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
    launched,
  }
})

const rocket = computed(() => {
  const l = props.launch
  const c = l && l.rocket && l.rocket.configuration
  return (c && (c.full_name || c.name)) || ''
})
const pad = computed(() => {
  const l = props.launch
  if (!l || !l.pad) return ''
  return (l.pad.location && l.pad.location.name) || l.pad.name || ''
})
const mission = computed(() => {
  const l = props.launch
  return (l && ((l.mission && l.mission.name) || l.name)) || ''
})
</script>

<template>
  <UiCard :label="t('launch')" :icon="Rocket" accent="#f59e0b" :loading="state === 'loading'" :rows="5">
    <UiErrorState v-if="state === 'error'" :message="errorMessage" :retry-label="t('retry')" @retry="emit('retry')" />
    <UiEmptyState v-else-if="state === 'empty' || !launch" :description="t('noLaunch')" compact />
    <template v-else>
      <div v-if="countdown && countdown.launched" class="launch-launched">{{ t('launched') }}</div>
      <div v-else-if="countdown" class="countdown">
        <div class="cd-unit">
          <span class="cd-val">{{ pad2(countdown.d) }}</span
          ><span class="cd-lab">{{ t('days') }}</span>
        </div>
        <span class="cd-sep">:</span>
        <div class="cd-unit">
          <span class="cd-val">{{ pad2(countdown.h) }}</span
          ><span class="cd-lab">{{ t('hours') }}</span>
        </div>
        <span class="cd-sep">:</span>
        <div class="cd-unit">
          <span class="cd-val">{{ pad2(countdown.m) }}</span
          ><span class="cd-lab">{{ t('minutes') }}</span>
        </div>
        <span class="cd-sep">:</span>
        <div class="cd-unit">
          <span class="cd-val">{{ pad2(countdown.s) }}</span
          ><span class="cd-lab">{{ t('seconds') }}</span>
        </div>
      </div>
      <div class="metric">
        <span>{{ t('rocket') }}</span
        ><strong>{{ rocket }}</strong>
      </div>
      <div class="metric">
        <span>{{ t('pad') }}</span
        ><strong>{{ pad }}</strong>
      </div>
      <div class="metric">
        <span>{{ t('mission') }}</span
        ><strong>{{ mission }}</strong>
      </div>
    </template>
    <template #footer>
      <UiButton variant="soft" size="sm" @click="emit('navigate', 'launch')">
        {{ t('openLaunchBoard') }} <ArrowRight :size="14" aria-hidden="true" />
      </UiButton>
    </template>
  </UiCard>
</template>

<style scoped>
.countdown {
  display: flex;
  align-items: flex-end;
  gap: 0.25rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--ok-line);
}

.cd-unit {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}

.cd-val {
  font-family: var(--ok-mono);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
  color: var(--card-accent);
  font-variant-numeric: tabular-nums;
}

.cd-lab {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ok-muted);
}

.cd-sep {
  font-family: var(--ok-mono);
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--ok-muted);
  padding-bottom: 0.15rem;
}

.launch-launched {
  font-family: var(--ok-mono);
  font-size: 1.1rem;
  font-weight: 700;
  color: #4ade80;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--ok-line);
}
</style>
