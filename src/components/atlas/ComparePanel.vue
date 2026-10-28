<script setup>
import { computed } from 'vue'
import { X } from '@lucide/vue'
import { locale } from '../../ok.js'
import { UiButton, UiCard, UiIconButton, UiSectionHead, UiSelect } from '../ui/index.js'
import {
  areaValue,
  capitalTextFor,
  countryName,
  densityText,
  densityValue,
  drivingTextFor,
  flagImg,
  fmtArea,
  fmtStat,
  governmentTextFor,
  subregionTextFor,
  timezoneInfo,
} from '../../lib/atlas-display.js'

const props = defineProps({
  a: { type: String, default: '' },
  b: { type: String, default: '' },
  countries: { type: Array, default: () => [] },
  t: { type: Function, required: true },
})

const emit = defineEmits(['update:a', 'update:b', 'close'])

const countryOptions = computed(() =>
  [...props.countries].sort((a, b) => countryName(a).localeCompare(countryName(b), locale())),
)

const compareOptions = computed(() => [
  { value: '', label: props.t('comparePick') },
  ...countryOptions.value.map((c) => ({ value: c.cca3, label: countryName(c) })),
])

const compareSelected = computed(() =>
  [props.a, props.b].map((code) => props.countries.find((c) => c.cca3 === code)).filter(Boolean),
)

function compareStat(c, key, kind) {
  const s = c.stats?.[key]
  return s?.value != null
    ? { text: fmtStat(s.value, kind), year: s.year, estimated: !!s.estimated }
    : { text: props.t('noData') }
}

const compareRows = computed(() => {
  const a = props.countries.find((c) => c.cca3 === props.a)
  const b = props.countries.find((c) => c.cca3 === props.b)
  if (!a || !b) return []

  const rows = []
  const add = (label, av, bv) => rows.push({ label, a: av, b: bv })
  const staticCell = (value) => ({ text: value })
  const densityCell = (c) => {
    const v = densityValue(c)
    return v != null
      ? {
          text: densityText(v) + ' /km²',
          year: c.stats?.population?.year,
          estimated: !!c.stats?.population?.estimated,
        }
      : { text: props.t('noData') }
  }

  add(props.t('population'), compareStat(a, 'population', 'int'), compareStat(b, 'population', 'int'))
  add(
    props.t('area'),
    staticCell(areaValue(a) ? fmtArea(areaValue(a)) + ' km²' : props.t('noData')),
    staticCell(areaValue(b) ? fmtArea(areaValue(b)) + ' km²' : props.t('noData')),
  )
  add(props.t('density'), densityCell(a), densityCell(b))
  add(props.t('gdp'), compareStat(a, 'gdp', 'usdCompact'), compareStat(b, 'gdp', 'usdCompact'))
  add(props.t('gdpPc'), compareStat(a, 'gdpPc', 'usd'), compareStat(b, 'gdpPc', 'usd'))
  add(props.t('gdpGrowth'), compareStat(a, 'gdpGrowth', 'pctSigned'), compareStat(b, 'gdpGrowth', 'pctSigned'))
  add(props.t('gni'), compareStat(a, 'gni', 'usd'), compareStat(b, 'gni', 'usd'))
  add(props.t('lifeExp'), compareStat(a, 'lifeExp', 'years'), compareStat(b, 'lifeExp', 'years'))
  add(props.t('inflation'), compareStat(a, 'inflation', 'pct'), compareStat(b, 'inflation', 'pct'))
  add(props.t('unemployment'), compareStat(a, 'unemployment', 'pct'), compareStat(b, 'unemployment', 'pct'))
  add(props.t('urban'), compareStat(a, 'urban', 'pct'), compareStat(b, 'urban', 'pct'))
  add(props.t('internet'), compareStat(a, 'internet', 'pct'), compareStat(b, 'internet', 'pct'))
  add(props.t('gini'), compareStat(a, 'gini', 'num1'), compareStat(b, 'gini', 'num1'))
  add(props.t('co2'), compareStat(a, 'co2', 'co2'), compareStat(b, 'co2', 'co2'))
  add(props.t('capital'), staticCell(capitalTextFor(a)), staticCell(capitalTextFor(b)))
  add(props.t('region'), staticCell(subregionTextFor(a)), staticCell(subregionTextFor(b)))
  add(props.t('government'), staticCell(governmentTextFor(a, props.t)), staticCell(governmentTextFor(b, props.t)))
  add(props.t('timezone'), staticCell(timezoneInfo(a).text), staticCell(timezoneInfo(b).text))
  add(props.t('drivingSide'), staticCell(drivingTextFor(a, props.t)), staticCell(drivingTextFor(b, props.t)))
  add(props.t('borders'), staticCell(String(a.borders?.length || 0)), staticCell(String(b.borders?.length || 0)))
  return rows
})

function swapCompare() {
  const a = props.a
  emit('update:a', props.b)
  emit('update:b', a)
}

function clearCompare() {
  emit('update:a', '')
  emit('update:b', '')
}
</script>

<template>
  <UiCard id="atlas-compare" padding="sm" class="compare-panel">
    <UiSectionHead :title="t('compareTitle')">
      <template #actions>
        <UiIconButton :label="t('close')" size="sm" @click="emit('close')">
          <X :size="14" aria-hidden="true" />
        </UiIconButton>
      </template>
    </UiSectionHead>
    <div class="compare-controls">
      <UiSelect
        :model-value="a"
        class="cmp-select"
        :options="compareOptions"
        :aria-label="t('comparePick')"
        @update:model-value="emit('update:a', $event)"
      />
      <UiButton variant="secondary" size="sm" class="cmp-btn" @click="swapCompare">
        <span aria-hidden="true">⇄</span>{{ t('compareSwap') }}
      </UiButton>
      <UiSelect
        :model-value="b"
        class="cmp-select"
        :options="compareOptions"
        :aria-label="t('comparePick')"
        @update:model-value="emit('update:b', $event)"
      />
      <UiButton variant="ghost" size="sm" class="cmp-btn" @click="clearCompare">
        {{ t('compareClear') }}
      </UiButton>
    </div>
    <p v-if="!compareRows.length" class="compare-hint">{{ t('compareHint') }}</p>
    <div v-else class="cmp-scroll">
      <table class="cmp-table">
        <thead>
          <tr>
            <th scope="col"></th>
            <th v-for="c in compareSelected" :key="c.cca3" scope="col">
              <span class="cmp-country">
                <img class="cmp-flag" :src="flagImg(c.cca2, 40)" alt="" loading="lazy" />
                {{ countryName(c) }}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in compareRows" :key="row.label">
            <th scope="row">{{ row.label }}</th>
            <td :title="row.a.title || undefined">
              <span>{{ row.a.text }}</span>
              <span v-if="row.a.year" class="cmp-year">{{ row.a.year }}</span>
              <span v-else-if="row.a.estimated" class="cmp-year">{{ t('estimate') }}</span>
            </td>
            <td :title="row.b.title || undefined">
              <span>{{ row.b.text }}</span>
              <span v-if="row.b.year" class="cmp-year">{{ row.b.year }}</span>
              <span v-else-if="row.b.estimated" class="cmp-year">{{ t('estimate') }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UiCard>
</template>

<style scoped>
.compare-panel {
  margin-top: 1rem;
}

.compare-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.cmp-select {
  flex: 1 1 180px;
  min-width: 150px;
  width: auto;
}

.compare-hint {
  margin: 0.6rem 0 0;
  color: var(--ok-muted);
  font-size: 0.8rem;
}

.cmp-scroll {
  overflow-x: auto;
  margin-top: 0.8rem;
}

.cmp-table {
  width: 100%;
  min-width: 560px;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.cmp-table th,
.cmp-table td {
  padding: 0.45rem 0.35rem;
  border-bottom: 1px solid var(--ok-line);
  text-align: left;
  vertical-align: top;
}

.cmp-table thead th {
  color: var(--ok-text);
  font-weight: 600;
  white-space: nowrap;
}

.cmp-table tbody th {
  width: 30%;
  color: var(--ok-muted);
  font-weight: 400;
}

.cmp-country {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.cmp-flag {
  width: 20px;
  height: auto;
  border-radius: 1px;
}

.cmp-year {
  margin-left: 0.25rem;
  color: var(--ok-muted);
  font-size: 0.62rem;
}

@media (max-width: 700px) {
  .compare-controls {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .cmp-select {
    flex-basis: auto;
    width: 100%;
  }
}

@media (max-width: 480px) {
  .cmp-table {
    min-width: 520px;
  }
}
</style>
