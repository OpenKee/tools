<script setup>
import { computed } from 'vue'
import { ArrowRight, CloudSun } from '@lucide/vue'
import { i18nState, useT } from '../../../i18n.js'
import { locale } from '../../../ok.js'
import { seasonFromLs } from '../../../lib/mars.js'
import copy from '../../../copy/space-now.js'
import { UiButton, UiCard, UiErrorState } from '../../ui/index.js'

const props = defineProps({
  state: { type: String, default: 'loading' },
  mars: { type: Object, default: null },
})
const emit = defineEmits(['retry', 'navigate'])
const t = useT(copy)

const high = computed(() => (props.mars && props.mars.max != null ? props.mars.max + '°C' : '--'))
const low = computed(() => (props.mars && props.mars.min != null ? props.mars.min + '°C' : '--'))
const sol = computed(() => (props.mars ? props.mars.sol : '--'))
const season = computed(() => {
  if (!props.mars || props.mars.ls == null) return '--'
  const s = seasonFromLs(props.mars.ls)
  return i18nState.lang === 'zh' ? s.zh : s.en
})
const observed = computed(() => {
  const raw = props.mars && props.mars.date
  if (!raw) return '--'
  const d = new Date(raw + 'T00:00:00')
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric' })
})
const diff = computed(() => (props.mars && props.mars.max != null ? Math.round(15 - props.mars.max) : null))
</script>

<template>
  <UiCard :label="t('mars')" :icon="CloudSun" accent="#f87171" :loading="state === 'loading'" :rows="5">
    <UiErrorState
      v-if="state === 'error'"
      :message="t('marsFailed')"
      :retry-label="t('retry')"
      @retry="emit('retry')"
    />
    <template v-else-if="mars">
      <div class="mars-temp-row">
        <div class="mars-temp high">
          <span class="t-lab">{{ t('marsHigh') }}</span>
          <span class="t-val">{{ high }}</span>
        </div>
        <div class="mars-temp low">
          <span class="t-lab">{{ t('marsLow') }}</span>
          <span class="t-val">{{ low }}</span>
        </div>
      </div>
      <div class="metric">
        <span>{{ t('marsSol') }}</span
        ><strong>Sol {{ sol }}</strong>
      </div>
      <div class="metric">
        <span>{{ t('marsSeason') }}</span
        ><strong>{{ season }}</strong>
      </div>
      <div class="metric">
        <span>{{ t('marsObserved') }}</span
        ><strong>{{ observed }}</strong>
      </div>
      <p v-if="diff != null" class="mars-vs">{{ t('marsVsEarth').replace('{diff}', diff) }}</p>
    </template>
    <template #footer>
      <UiButton variant="soft" size="sm" @click="emit('navigate', 'mars')">
        {{ t('openMars') }} <ArrowRight :size="14" aria-hidden="true" />
      </UiButton>
    </template>
  </UiCard>
</template>

<style scoped>
.mars-temp-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--ok-line);
}

.mars-temp {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--ok-line);
  border-radius: 10px;
  background: var(--ok-bg);
}

.mars-temp .t-lab {
  font-size: 0.64rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ok-muted);
}

.mars-temp .t-val {
  font-family: var(--ok-mono);
  font-size: 1.3rem;
  font-weight: 700;
}

.mars-temp.high .t-val {
  color: #fb923c;
}
.mars-temp.low .t-val {
  color: #60a5fa;
}

.mars-vs {
  font-size: 0.74rem;
  color: var(--ok-muted);
  line-height: 1.5;
}
</style>
