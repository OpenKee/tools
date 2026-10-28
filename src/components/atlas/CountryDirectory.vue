<script setup>
import { computed } from 'vue'
import { i18nState } from '../../i18n.js'
import { locale } from '../../ok.js'
import { UiBadge, UiButton, UiChip, UiEmptyState, UiErrorState, UiInput, UiLoading, UiSelect } from '../ui/index.js'
import {
  REGIONS,
  areaValue,
  capitalTextFor,
  countryName,
  densityText,
  densityValue,
  flagImg,
  fmt,
  fmtArea,
  regionTextFor,
} from '../../lib/atlas-display.js'

const props = defineProps({
  searchQuery: { type: String, default: '' },
  sortBy: { type: String, default: 'pop' },
  compareOpen: { type: Boolean, default: false },
  activeRegion: { type: String, default: '' },
  onlySovereign: { type: Boolean, default: false },
  countries: { type: Array, default: () => [] },
  selectedCode: { type: String, default: null },
  dataUpdatedAt: { type: Number, default: null },
  dataStale: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  errorMsg: { type: String, default: '' },
  t: { type: Function, required: true },
})

const emit = defineEmits([
  'update:searchQuery',
  'update:sortBy',
  'update:onlySovereign',
  'select-region',
  'toggle-compare',
  'row-click',
])

const sortOptions = computed(() => [
  { value: 'pop', label: props.t('sortPop') },
  { value: 'area', label: props.t('sortArea') },
  { value: 'density', label: props.t('sortDensity') },
  { value: 'name', label: props.t('sortName') },
])

const countUnitText = computed(() => {
  const n = props.countries.length
  if (props.onlySovereign) return n === 1 ? props.t('sovereignUnitOne') : props.t('sovereignUnit')
  return n === 1 ? props.t('countUnitOne') : props.t('countUnit')
})

const sortMetricLabel = computed(() => {
  if (props.sortBy === 'area') return props.t('sortArea')
  if (props.sortBy === 'density') return props.t('sortDensity')
  return props.t('sortPop')
})

const formattedUpdatedAt = computed(() => {
  if (!props.dataUpdatedAt) return ''
  return new Intl.DateTimeFormat(locale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(props.dataUpdatedAt))
})

function selectRegion(k) {
  emit('select-region', k)
}

function popOf(c) {
  const s = c.stats?.population
  return s?.value != null ? (s.estimated ? '~' : '') + fmt(s.value) : '—'
}

function rowMetric(c) {
  if (props.sortBy === 'area') {
    const a = areaValue(c)
    return a ? fmtArea(a) + ' km²' : '—'
  }
  if (props.sortBy === 'density') {
    const v = densityValue(c)
    return v != null ? densityText(v) + ' /km²' : '—'
  }
  return popOf(c)
}
</script>

<template>
  <section class="controls">
    <UiInput
      :model-value="searchQuery"
      class="search-field"
      size="lg"
      clearable
      :placeholder="t('searchCountry')"
      :aria-label="t('search')"
      :clear-label="t('clearSearch')"
      autocomplete="off"
      @update:model-value="emit('update:searchQuery', $event)"
    />
    <label class="sort-wrap">
      <span>{{ t('sort') }}</span>
      <UiSelect
        :model-value="sortBy"
        class="sort-select"
        :options="sortOptions"
        :aria-label="t('sort')"
        @update:model-value="emit('update:sortBy', $event)"
      />
    </label>
    <UiButton
      variant="secondary"
      class="compare-toggle"
      :active="compareOpen"
      :aria-expanded="compareOpen"
      aria-controls="atlas-compare"
      @click="emit('toggle-compare')"
    >
      {{ t('compare') }}
    </UiButton>
  </section>

  <slot name="compare" />

  <div class="region-bar">
    <div class="region-chips">
      <UiChip
        v-for="r in REGIONS"
        :key="r.k || 'all'"
        toggle
        size="sm"
        :active="activeRegion === r.k"
        @click="selectRegion(r.k)"
      >
        {{ r.l[i18nState.lang] }}
      </UiChip>
      <UiChip
        class="filter-toggle"
        toggle
        size="sm"
        :active="onlySovereign"
        @click="emit('update:onlySovereign', !onlySovereign)"
      >
        {{ t('sovereignOnly') }}
      </UiChip>
    </div>
    <span class="result-count" aria-live="polite">
      {{ countries.length }} {{ countUnitText
      }}<span v-if="formattedUpdatedAt" class="data-stamp"> · {{ t('updated') }} {{ formattedUpdatedAt }}</span
      ><span v-if="dataStale" class="data-stale">
        <UiBadge size="sm" variant="warn">{{ t('cached') }}</UiBadge>
      </span>
    </span>
  </div>

  <UiLoading v-if="loading" class="state-block" :label="t('loading')" />
  <UiErrorState v-else-if="errorMsg" class="state-block" :message="errorMsg" variant="block" retry-label="" />
  <UiEmptyState v-else-if="!countries.length" class="state-block" :description="t('noResults')" compact />

  <section v-else class="clist">
    <div class="clist-head" aria-hidden="true">
      <span></span>
      <span>{{ t('country') }}</span>
      <span class="head-region">{{ t('region') }}</span>
      <span class="head-capital">{{ t('capital') }}</span>
      <span class="head-metric">{{ sortMetricLabel }}</span>
    </div>
    <div v-for="c in countries" :key="c.cca3" class="crow" :data-code="c.cca3">
      <button
        type="button"
        class="crow-head"
        :aria-expanded="selectedCode === c.cca3"
        :aria-controls="'detail-' + c.cca3"
        @click="emit('row-click', c.cca3)"
      >
        <img class="c-flagimg" :src="flagImg(c.cca2, 40)" alt="" loading="lazy" />
        <span class="c-main">
          <span class="c-name">{{ countryName(c) }}</span>
          <span class="c-sub">
            {{ regionTextFor(c) }}<template v-if="capitalTextFor(c) !== '—'"> · {{ capitalTextFor(c) }}</template>
          </span>
        </span>
        <span class="c-region">{{ regionTextFor(c) }}</span>
        <span class="c-capital" :title="capitalTextFor(c)">{{ capitalTextFor(c) }}</span>
        <span class="c-metric">{{ rowMetric(c) }}</span>
      </button>

      <div v-if="selectedCode === c.cca3" :id="'detail-' + c.cca3" class="crow-detail">
        <slot name="detail" :country="c" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.9rem;
  margin-top: 0.4rem;
}

.search-field {
  flex: 1 1 260px;
  min-width: 200px;
}

.sort-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--ok-muted);
  font-size: 0.74rem;
  white-space: nowrap;
}

.sort-select {
  width: auto;
  min-width: 8.5rem;
}

.region-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
  margin-top: 0.85rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--ok-line);
}

.region-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.region-chips .filter-toggle {
  margin-left: 0.3rem;
}

.result-count {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
  color: var(--ok-muted);
  font-size: 0.72rem;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.data-stamp {
  color: var(--ok-muted);
  font-size: 0.65rem;
}

.state-block {
  margin-top: 1.5rem;
}

.clist {
  margin-top: 0.2rem;
}

.clist-head,
.crow-head {
  display: grid;
  grid-template-columns: 32px minmax(160px, 0.75fr) minmax(90px, 0.6fr) minmax(150px, 1.1fr) minmax(90px, 0.5fr);
  align-items: center;
  gap: 0.75rem;
}

.clist-head {
  padding: 0.5rem 0.15rem 0.45rem;
  border-bottom: 1px solid var(--ok-line);
  color: var(--ok-muted);
  font-size: 0.66rem;
  letter-spacing: 0.02em;
}

.clist-head .head-metric {
  text-align: right;
}

.crow {
  border-bottom: 1px solid var(--ok-line);
  scroll-margin-top: 4.5rem;
}

.crow-head {
  width: 100%;
  padding: 0.7rem 0.15rem;
  border: 0;
  background: none;
  color: var(--ok-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.crow-head:hover .c-name {
  color: var(--ok-accent);
}

.crow-head:focus-visible {
  outline: 1px solid var(--ok-accent);
  outline-offset: -1px;
}

.c-flagimg {
  width: 24px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 1px;
  object-fit: cover;
  background: var(--ok-panel-subtle);
  box-shadow: 0 0 0 1px var(--ok-line);
}

.c-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.08rem;
}

.c-name {
  overflow: hidden;
  min-width: 0;
  color: var(--ok-text);
  font-size: 0.98rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.c-sub {
  display: none;
  overflow: hidden;
  color: var(--ok-muted);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.c-region,
.c-capital {
  overflow: hidden;
  min-width: 0;
  color: var(--ok-muted);
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.c-metric {
  color: var(--ok-muted);
  font-size: 0.84rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.crow-detail {
  padding: 0.2rem 0.15rem 2.2rem;
}

@media (max-width: 700px) {
  .controls {
    gap: 0.6rem;
  }

  .search-field {
    flex-basis: 100%;
  }

  .sort-wrap {
    flex: 1 1 auto;
    justify-content: flex-start;
  }

  .compare-toggle {
    margin-left: auto;
  }

  .region-bar {
    gap: 0.5rem;
  }

  .result-count {
    flex-basis: 100%;
    justify-content: flex-end;
    margin-left: 0;
    padding-top: 0.2rem;
    white-space: normal;
  }

  .clist-head {
    display: none;
  }

  .crow-head {
    display: flex;
    gap: 0.7rem;
  }

  .c-region,
  .c-capital {
    display: none;
  }

  .c-sub {
    display: block;
  }

  .c-metric {
    margin-left: auto;
  }

  .data-stamp {
    display: block;
  }
}

@media (max-width: 480px) {
  .c-sub {
    display: none;
  }

  .c-metric {
    font-size: 0.8rem;
  }
}
</style>
