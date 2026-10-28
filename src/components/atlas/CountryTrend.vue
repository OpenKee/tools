<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  trend: { type: Object, default: null },
  trendState: { type: String, default: 'idle' },
  metric: { type: String, required: true },
  t: { type: Function, required: true },
})

const points = computed(() => chartPoints(props.trend?.rows, props.metric))
const lastPoint = computed(() => lastChartPoint(props.trend?.rows, props.metric))

function chartPointList(rows, key) {
  if (!rows?.length) return []
  const values = rows.map((row) => row[key]).filter((value) => value != null)
  if (!values.length) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min || Math.abs(max) || 1
  const lower = min - spread * 0.15
  const upper = max + spread * 0.15
  const w = 300
  const h = 64
  const pad = 6
  const span = rows.length > 1 ? rows.length - 1 : 1
  const points = []
  rows.forEach((row, i) => {
    const value = row[key]
    if (value == null) return
    const x = pad + (i / span) * (w - pad * 2)
    const y = h - pad - ((value - lower) / (upper - lower)) * (h - pad * 2)
    points.push({ x, y })
  })
  return points
}

function chartPoints(rows, key) {
  return chartPointList(rows, key)
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')
}

function lastChartPoint(rows, key) {
  const points = chartPointList(rows, key)
  return points[points.length - 1] || null
}
</script>

<template>
  <div class="t-block">
    <div class="t-head">
      <span class="t-title">{{ title }}</span>
      <span v-if="trend" class="t-range">{{ trend.start }}–{{ trend.end }}</span>
    </div>
    <div v-if="trendState === 'loading'" class="muted small">{{ t('loadingShort') }}</div>
    <div v-else-if="trendState === 'error' || !trend" class="muted small">{{ t('trendNA') }}</div>
    <template v-else>
      <svg class="t-chart" viewBox="0 0 300 64" preserveAspectRatio="none" role="img" :aria-label="title">
        <polyline class="t-line" :class="metric" :points="points" vector-effect="non-scaling-stroke" />
        <line
          v-if="lastPoint"
          class="t-dot"
          :class="metric"
          :x1="lastPoint.x"
          :y1="lastPoint.y"
          :x2="lastPoint.x"
          :y2="lastPoint.y"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      <div class="t-axis">
        <span>{{ trend.start }}</span
        ><span>{{ trend.end }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.t-block {
  margin-top: 1.1rem;
}

.t-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
}

.t-title {
  color: var(--ok-muted);
  font-size: 0.7rem;
}

.t-range {
  color: var(--ok-muted);
  font-size: 0.62rem;
  font-variant-numeric: tabular-nums;
}

.t-chart {
  display: block;
  width: 100%;
  height: 64px;
  margin-top: 0.35rem;
}

.t-line {
  fill: none;
  stroke-width: 1.5;
}

.t-line.pop {
  stroke: var(--ok-accent);
}

.t-line.gdp {
  stroke: var(--atlas-gold);
}

.t-dot {
  stroke-linecap: round;
  stroke-width: 4;
}

.t-dot.pop {
  stroke: var(--ok-accent);
}

.t-dot.gdp {
  stroke: var(--atlas-gold);
}

.t-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 0.2rem;
  color: var(--ok-muted);
  font-size: 0.6rem;
  font-variant-numeric: tabular-nums;
}

.muted {
  color: var(--ok-muted);
}

.small {
  font-size: 0.78rem;
}
</style>
