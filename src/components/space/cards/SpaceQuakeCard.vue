<script setup>
import { computed } from 'vue'
import { Activity, ArrowRight } from '@lucide/vue'
import { useT } from '../../../i18n.js'
import copy from '../../../copy/space-now.js'
import { UiButton, UiCard, UiErrorState } from '../../ui/index.js'

const props = defineProps({
  state: { type: String, default: 'loading' },
  quakes: { type: Array, default: () => [] },
  now: { type: Number, default: Date.now },
})
const emit = defineEmits(['retry', 'navigate'])
const t = useT(copy)

function magClass(m) {
  if (m == null) return 'mag-na'
  if (m < 4) return 'mag-low'
  if (m < 5) return 'mag-mid'
  if (m < 6) return 'mag-high'
  return 'mag-severe'
}

const stat = computed(() => {
  const list = props.quakes
  if (!list.length) return { n: 0, max: null }
  let max = -Infinity
  for (const q of list) if (q.mag > max) max = q.mag
  return { n: list.length, max }
})

const list = computed(() => props.quakes.slice(0, 4))

function timeAgo(ts) {
  if (!ts) return '--'
  const sec = Math.max(0, Math.floor((props.now - ts) / 1000))
  if (sec < 60) return sec + 's'
  const min = Math.floor(sec / 60)
  if (min < 60) return min + 'm'
  return Math.floor(min / 60) + 'h'
}

const timeline = computed(() => {
  const windowMs = 60 * 60 * 1000
  return props.quakes.slice(0, 30).map((q) => {
    const age = Math.max(0, Math.min(windowMs, props.now - (q.time || props.now)))
    return {
      key: (q.time || 0) + '-' + (q.mag || 0),
      left: 100 - (age / windowMs) * 100,
      mag: q.mag,
      place: q.place || '',
    }
  })
})

const mapPoints = computed(() =>
  props.quakes
    .filter((q) => q.lon != null && q.lat != null)
    .map((q) => ({
      key: (q.time || 0) + '-' + (q.mag || 0),
      left: ((q.lon + 180) / 360) * 100,
      top: ((90 - q.lat) / 180) * 100,
      size: Math.min(10, 6 + (q.mag || 0) * 0.8),
      mag: q.mag,
      place: q.place || '',
    })),
)
</script>

<template>
  <UiCard
    class="card-wide"
    :label="t('quakes')"
    :icon="Activity"
    accent="#fb923c"
    :loading="state === 'loading'"
    :rows="6"
  >
    <UiErrorState v-if="state === 'error'" :message="t('error')" :retry-label="t('retry')" @retry="emit('retry')" />
    <template v-else>
      <div class="stat-row">
        <span v-if="stat.n > 0">
          {{
            t('quakeStat')
              .replace('{n}', stat.n)
              .replace('{m}', stat.max != null ? stat.max.toFixed(1) : '--')
          }}
        </span>
        <span v-else>{{ t('noQuakes') }}</span>
      </div>

      <div class="quake-timeline">
        <span class="qt-edge">{{ t('lastHourShort') }}</span>
        <div class="qt-track" role="img" :aria-label="t('quakeTimeline')">
          <span
            v-for="q in timeline"
            :key="q.key"
            class="qt-dot"
            :class="magClass(q.mag)"
            :style="{ left: q.left + '%' }"
            :title="'M' + (q.mag != null ? q.mag.toFixed(1) : '?') + ' · ' + q.place"
          />
        </div>
        <span class="qt-edge">{{ t('now') }}</span>
      </div>

      <div class="quake-body">
        <div class="quake-map" role="img" :aria-label="t('quakeMapCaption')">
          <span
            v-for="q in mapPoints"
            :key="q.key"
            class="qm-dot"
            :class="magClass(q.mag)"
            :style="{ left: q.left + '%', top: q.top + '%', width: q.size + 'px', height: q.size + 'px' }"
            :title="'M' + (q.mag != null ? q.mag.toFixed(1) : '?') + ' · ' + q.place"
          />
          <span class="qm-caption">{{ t('quakeMapCaption') }}</span>
        </div>
        <ul class="quake-list">
          <li v-for="(q, i) in list" :key="i" class="quake-item">
            <span class="quake-time">{{ timeAgo(q.time) }}</span>
            <span class="mag-badge" :class="magClass(q.mag)">M{{ q.mag.toFixed(1) }}</span>
            <span class="quake-place">{{ q.place || '--' }}</span>
          </li>
        </ul>
      </div>
    </template>
    <template #footer>
      <UiButton variant="soft" size="sm" @click="emit('navigate', 'quake')">
        {{ t('openQuakeMap') }} <ArrowRight :size="14" aria-hidden="true" />
      </UiButton>
    </template>
  </UiCard>
</template>

<style scoped>
.stat-row {
  font-size: 0.86rem;
  color: var(--ok-text);
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--ok-line);
}

.quake-timeline {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.1rem 0;
}

.qt-edge {
  flex: none;
  font-family: var(--ok-mono);
  font-size: 0.6rem;
  color: var(--ok-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.qt-track {
  position: relative;
  flex: 1;
  height: 24px;
  border: 1px solid var(--ok-line);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ok-text) 4%, transparent);
}

.qt-dot {
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  border-radius: 50%;
  transform: translateY(-50%);
  background: var(--ok-muted);
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 12%, transparent);
}

.quake-body {
  display: grid;
  flex: 1;
  grid-template-columns: 1.3fr 1fr;
  gap: 0.9rem;
  align-items: stretch;
}

.quake-map {
  position: relative;
  height: 100%;
  min-height: 116px;
  overflow: hidden;
  border: 1px solid var(--ok-line);
  border-radius: 10px;
  background-color: color-mix(in srgb, var(--ok-text) 3%, transparent);
  background-image:
    linear-gradient(to right, var(--ok-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--ok-line) 1px, transparent 1px),
    radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--card-accent) 10%, transparent), transparent 55%);
  background-size:
    16.666% 100%,
    100% 33.333%,
    100% 100%;
}

.qm-dot {
  position: absolute;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: var(--ok-muted);
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 12%, transparent);
}

.qm-caption {
  position: absolute;
  right: 8px;
  bottom: 6px;
  font-family: var(--ok-mono);
  font-size: 0.56rem;
  color: var(--ok-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  pointer-events: none;
}

.quake-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.quake-item {
  display: grid;
  grid-template-columns: 44px 56px 1fr;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.8rem;
  padding: 0.25rem 0;
}

.quake-time {
  font-family: var(--ok-mono);
  font-size: 0.72rem;
  color: var(--ok-muted);
}

.quake-place {
  color: var(--ok-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mag-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--ok-mono);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.15rem 0.4rem;
  border-radius: var(--ok-radius-sm);
  border: 1px solid transparent;
}

.mag-low {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.12);
  border-color: rgba(74, 222, 128, 0.35);
}
.mag-mid {
  color: #facc15;
  background: rgba(250, 204, 21, 0.12);
  border-color: rgba(250, 204, 21, 0.35);
}
.mag-high {
  color: #fb923c;
  background: rgba(251, 146, 60, 0.14);
  border-color: rgba(251, 146, 60, 0.38);
}
.mag-severe {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.16);
  border-color: rgba(239, 68, 68, 0.45);
}
.mag-na {
  color: var(--ok-muted);
  background: var(--ok-bg);
  border-color: var(--ok-line);
}

.qt-dot.mag-low,
.qm-dot.mag-low {
  background: #4ade80;
  color: #4ade80;
}
.qt-dot.mag-mid,
.qm-dot.mag-mid {
  background: #facc15;
  color: #facc15;
}
.qt-dot.mag-high,
.qm-dot.mag-high {
  background: #fb923c;
  color: #fb923c;
}
.qt-dot.mag-severe,
.qm-dot.mag-severe {
  background: #ef4444;
  color: #ef4444;
}

@media (max-width: 680px) {
  .quake-body {
    grid-template-columns: 1fr;
  }
  .quake-map {
    min-height: 104px;
  }
  .quake-item {
    grid-template-columns: 40px 52px 1fr;
  }
}
</style>
