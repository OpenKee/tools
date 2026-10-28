<script setup>
import { computed } from 'vue'
import { i18nState } from '../../i18n.js'
import { UiBadge, UiChip, UiSectionHead, UiStat } from '../ui/index.js'
import CountryTrend from './CountryTrend.vue'
import {
  altNamesTextFor,
  areaValue,
  capitalTextFor,
  codesTextFor,
  countryName,
  countryOfficial,
  currencyNames,
  densityText,
  drivingTextFor,
  flagImg,
  fmt,
  fmtArea,
  fmtStat,
  governmentTextFor,
  iddTextFor,
  joinList,
  languageNames,
  regionTextFor,
  subregionTextFor,
  timezoneInfo,
  unGroupTextFor,
} from '../../lib/atlas-display.js'

const props = defineProps({
  country: { type: Object, required: true },
  borders: { type: Array, default: () => [] },
  usdRates: { type: Object, default: null },
  extrasState: { type: String, default: 'idle' },
  trend: { type: Object, default: null },
  trendState: { type: String, default: 'idle' },
  t: { type: Function, required: true },
})

const emit = defineEmits(['open-country'])
const EXTRA_KEYS = new Set(['gdpGrowth', 'inflation', 'unemployment', 'urban', 'internet', 'gini', 'co2'])

function makeItem(label, value, title = '', meta = '') {
  return { label, value: value == null || value === '' ? props.t('noData') : value, title, meta }
}

function statMeta(s) {
  if (!s) return ''
  if (s.year) return String(s.year)
  if (s.estimated) return props.t('estimate')
  return ''
}

function statItem(c, key, labelKey, kind) {
  const s = c.stats?.[key]
  if (s?.value != null) return makeItem(props.t(labelKey), fmtStat(s.value, kind), '', statMeta(s))
  if (EXTRA_KEYS.has(key) && (props.extrasState === 'idle' || props.extrasState === 'loading')) {
    return makeItem(props.t(labelKey), props.t('loadingShort'))
  }
  return makeItem(props.t(labelKey), props.t('noData'))
}

function unMemberFor(c) {
  return c.cca3 === 'VAT' ? false : !!c.unMember
}

const detail = computed(() => {
  const c = props.country
  const pop = c.stats?.population
  const area = areaValue(c)
  const density = pop?.value != null && area ? pop.value / area : null
  const capitalText = capitalTextFor(c)
  const regionText = regionTextFor(c)
  const subregionText = subregionTextFor(c)
  const langText = joinList(languageNames(c))
  const currText = joinList(currencyNames(c))
  const tzInfo = timezoneInfo(c)
  const govText = governmentTextFor(c, props.t)
  const driveText = drivingTextFor(c, props.t)

  const stats = [
    {
      label: props.t('population'),
      value: pop?.value != null ? (pop.estimated ? '~' : '') + fmt(pop.value) : props.t('noData'),
      meta: statMeta(pop),
    },
    {
      label: props.t('area'),
      value: area ? fmtArea(area) + ' km²' : props.t('noData'),
    },
    {
      label: props.t('density'),
      value: density != null ? densityText(density) + ' /km²' : props.t('noData'),
      meta: statMeta(pop),
    },
    {
      label: props.t('capital'),
      value: capitalText,
    },
  ]

  const facts = [
    makeItem(props.t('region'), regionText),
    makeItem(props.t('subregion'), subregionText),
    makeItem(props.t('languages'), langText),
    makeItem(props.t('currencies'), currText),
    makeItem(props.t('idd'), iddTextFor(c)),
    makeItem(props.t('timezone'), tzInfo.text, tzInfo.title),
    makeItem(props.t('government'), govText),
    makeItem(props.t('landlocked'), c.landlocked ? props.t('yes') : props.t('no')),
  ]

  const economyItems = [
    statItem(c, 'gdp', 'gdp', 'usdCompact'),
    statItem(c, 'gdpPc', 'gdpPc', 'usd'),
    statItem(c, 'gdpGrowth', 'gdpGrowth', 'pctSigned'),
    statItem(c, 'gni', 'gni', 'usd'),
    statItem(c, 'inflation', 'inflation', 'pct'),
    statItem(c, 'unemployment', 'unemployment', 'pct'),
  ]

  const societyItems = [
    statItem(c, 'lifeExp', 'lifeExp', 'years'),
    statItem(c, 'urban', 'urban', 'pct'),
    statItem(c, 'internet', 'internet', 'pct'),
    statItem(c, 'gini', 'gini', 'num1'),
    statItem(c, 'co2', 'co2', 'co2'),
  ]

  const otherItems = [
    makeItem(props.t('tld'), (c.tld || []).join(i18nState.lang === 'zh' ? '、' : ', ') || props.t('noData')),
    makeItem(props.t('drivingSide'), driveText),
    makeItem(props.t('unMember'), unMemberFor(c) ? props.t('yes') : props.t('no')),
    makeItem(props.t('sovereign'), c.independent ? props.t('yes') : props.t('no')),
    makeItem(props.t('unGroup'), unGroupTextFor(c)),
    makeItem(props.t('codes'), codesTextFor(c)),
    makeItem(props.t('altNames'), altNamesTextFor(c)),
  ]
  if (i18nState.lang !== 'zh') {
    otherItems.push(makeItem(props.t('demonym'), c.demonyms?.eng?.f || c.demonyms?.eng?.m || props.t('noData')))
  }

  const currCode = Object.keys(c.currencies || {})[0]
  const rate = currCode && props.usdRates ? props.usdRates[currCode] : null
  const fx = rate != null && currCode && currCode !== 'USD' ? `${fmt(rate, 1)} ${currCode}` : null
  const lat = c.latlng?.[0]
  const lng = c.latlng?.[1]
  const hasCoords = lat != null && lng != null

  const zhName = countryName(c)
  const wikiName = i18nState.lang === 'zh' ? zhName : c.name?.common || ''
  const links = {
    wiki: `https://${i18nState.lang === 'zh' ? 'zh' : 'en'}.wikipedia.org/wiki/${encodeURIComponent(wikiName)}`,
    baidu: `https://baike.baidu.com/item/${encodeURIComponent(zhName)}`,
    gMap: hasCoords ? 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng : null,
    osm: hasCoords ? 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lng + '#map=5/' + lat + '/' + lng : null,
  }

  return {
    name: countryName(c),
    official: countryOfficial(c),
    flagImg: flagImg(c.cca2, 320),
    stats,
    facts,
    moreSections: [
      { title: props.t('groupEconomy'), items: economyItems },
      { title: props.t('groupSociety'), items: societyItems },
      { title: props.t('groupOther'), items: otherItems },
    ],
    fx,
    links,
    hasCoords,
  }
})
</script>

<template>
  <div class="detail-grid">
    <div class="d-left">
      <div class="detail-head">
        <img class="d-flagimg" :src="detail.flagImg" :alt="detail.name" />
        <div class="d-head-text">
          <h2 class="d-name">{{ detail.name }}</h2>
          <div class="d-official">{{ detail.official }}</div>
        </div>
      </div>

      <div class="d-stats">
        <UiStat
          v-for="stat in detail.stats"
          :key="stat.label"
          class="d-stat"
          :label="stat.label"
          :value="stat.value"
          :sub="stat.meta"
        />
      </div>

      <div class="d-section">
        <UiSectionHead :title="t('groupBasics')" />
        <dl class="d-grid facts-grid">
          <div v-for="item in detail.facts" :key="item.label" class="d-item">
            <span class="d-label">{{ item.label }}</span>
            <span class="d-val" :title="item.title || undefined">{{ item.value }}</span>
          </div>
        </dl>
      </div>

      <div class="d-borders">
        <span class="d-label">{{ t('borders') }}</span>
        <div class="border-chips">
          <span v-if="!borders.length" class="none-note">{{ t('none') }}</span>
          <UiChip v-for="b in borders" :key="b.code" size="sm" @click="emit('open-country', b.code)">
            <img class="b-flag" :src="b.flagImg" alt="" loading="lazy" />{{ b.name }}
          </UiChip>
        </div>
      </div>

      <details class="more-block">
        <summary>
          <span>{{ t('moreMetrics') }}</span>
          <UiBadge
            v-if="extrasState === 'idle' || extrasState === 'loading'"
            class="more-status"
            size="sm"
            variant="accent"
          >
            {{ t('loadingShort') }}
          </UiBadge>
        </summary>
        <div v-for="section in detail.moreSections" :key="section.title" class="more-section">
          <UiSectionHead :title="section.title" />
          <dl class="d-grid more-grid">
            <div v-for="item in section.items" :key="item.label" class="d-item">
              <span class="d-label">{{ item.label }}</span>
              <span class="d-val" :title="item.title || undefined">
                {{ item.value }}<span v-if="item.meta" class="d-meta">{{ item.meta }}</span>
              </span>
            </div>
          </dl>
        </div>
      </details>

      <div v-if="detail.fx" class="d-fx">1 USD ≈ {{ detail.fx }}</div>

      <div class="d-links">
        <a :href="detail.links.baidu" target="_blank" rel="noreferrer">{{ t('baidu') }} ↗</a>
        <a :href="detail.links.wiki" target="_blank" rel="noreferrer">{{ t('wikipedia') }} ↗</a>
        <template v-if="detail.hasCoords">
          <a :href="detail.links.gMap" target="_blank" rel="noreferrer">{{ t('openMaps') }} ↗</a>
          <a :href="detail.links.osm" target="_blank" rel="noreferrer">{{ t('openOSM') }} ↗</a>
        </template>
      </div>
    </div>

    <div class="d-right">
      <div class="d-map-wrap">
        <div v-if="detail.hasCoords" class="d-map"></div>
        <div v-else class="d-map d-map-na">{{ t('mapNA') }}</div>
      </div>

      <CountryTrend :title="t('trendPop')" :trend="trend" :trend-state="trendState" metric="pop" :t="t" />
      <CountryTrend :title="t('trendGdp')" :trend="trend" :trend-state="trendState" metric="gdp" :t="t" />
    </div>
  </div>
</template>

<style scoped>
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
  gap: 2rem;
}

.d-left,
.d-right {
  min-width: 0;
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-bottom: 1rem;
}

.d-flagimg {
  width: 64px;
  height: auto;
  flex-shrink: 0;
  border-radius: 2px;
  box-shadow: 0 0 0 1px var(--ok-line);
}

.d-head-text {
  min-width: 0;
}

.d-name {
  margin: 0;
  font-size: 1.55rem;
  font-weight: 500;
  line-height: 1.15;
}

.d-official {
  margin-top: 0.12rem;
  color: var(--ok-muted);
  font-size: 0.76rem;
}

.d-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0.9rem 0;
  border-top: 1px solid var(--ok-line);
  border-bottom: 1px solid var(--ok-line);
}

.d-stat :deep(.ui-stat-label) {
  letter-spacing: 0.04em;
}

.d-stat :deep(.ui-stat-value) {
  overflow-wrap: anywhere;
  font-size: 1.05rem;
  font-weight: 500;
}

.d-section {
  margin-top: 0.85rem;
}

.d-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem 1.2rem;
  margin: 0;
}

.d-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.12rem;
}

.d-label {
  color: var(--ok-muted);
  font-size: 0.65rem;
}

.d-val {
  color: var(--ok-text);
  font-size: 0.86rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.d-meta {
  margin-left: 0.28rem;
  color: var(--ok-muted);
  font-size: 0.62rem;
  font-variant-numeric: tabular-nums;
}

.d-fx {
  margin-top: 0.9rem;
  color: var(--ok-muted);
  font-size: 0.76rem;
}

.d-borders {
  margin-top: 1rem;
}

.none-note {
  color: var(--ok-muted);
  font-size: 0.8rem;
}

.border-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.35rem;
}

.b-flag {
  width: 15px;
  height: auto;
  border-radius: 1px;
}

.d-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.9rem;
  margin-top: 1.2rem;
  font-size: 0.78rem;
}

.d-links a {
  color: var(--ok-accent);
  text-decoration: none;
}

.d-links a:hover {
  text-decoration: underline;
  text-underline-offset: 0.18em;
}

.more-block {
  margin-top: 1.25rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--ok-line);
}

.more-block summary {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  list-style: none;
  font-size: 0.78rem;
  cursor: pointer;
}

.more-block summary::-webkit-details-marker {
  display: none;
}

.more-block summary::before {
  content: '+';
  width: 0.8rem;
  color: var(--ok-accent);
  line-height: 1;
}

.more-block[open] summary::before {
  content: '−';
}

.more-status {
  margin-left: auto;
}

.more-section {
  margin-top: 0.9rem;
}

.more-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.d-map-wrap {
  margin-bottom: 0.9rem;
}

.d-map {
  height: 190px;
  border: 1px solid var(--ok-line);
  border-radius: 2px;
}

.d-map-na {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ok-muted);
  font-size: 0.8rem;
}

@media (max-width: 860px) {
  .detail-grid {
    grid-template-columns: 1fr;
    gap: 1.6rem;
  }

  .more-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .d-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.8rem 1rem;
  }
}

@media (max-width: 480px) {
  .d-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .facts-grid,
  .more-grid {
    grid-template-columns: 1fr;
  }

  .detail-head {
    gap: 0.6rem;
  }

  .d-flagimg {
    width: 52px;
  }

  .d-name {
    font-size: 1.35rem;
  }
}
</style>
