<script setup>
import { computed, defineAsyncComponent, h } from 'vue'
import { useT } from '../../i18n.js'
import { useUrlTab } from '../../lib/use-url-tab.js'
import '../../styles/space.css'
import { UiCard, UiErrorState, UiPage, UiTabs } from '../../components/ui/index.js'
import SpaceOverview from './SpaceOverview.vue'
import copy from '../../copy/space-now.js'

const t = useT(copy)

const TABS = [
  { key: 'overview', label: 'tabOverview' },
  { key: 'tonight', label: 'tabTonight' },
  { key: 'aurora', label: 'tabAurora' },
  { key: 'iss', label: 'tabIss' },
  { key: 'launch', label: 'tabLaunch' },
  { key: 'quake', label: 'tabQuake' },
  { key: 'mars', label: 'tabMars' },
]
const TAB_KEYS = TABS.map((item) => item.key)
const { tab, setTab } = useUrlTab(TAB_KEYS, 'overview')

const PanelLoading = {
  setup() {
    return () =>
      h(
        'div',
        { class: 'panel-skeleton', 'aria-hidden': 'true' },
        Array.from({ length: 3 }, () => h(UiCard, { loading: true, rows: 3 })),
      )
  },
}

const PanelError = {
  setup() {
    return () =>
      h(UiErrorState, {
        variant: 'block',
        message: t.value('panelLoadFailed'),
        retryLabel: t.value('retry'),
        onRetry: () => window.location.reload(),
      })
  },
}

function asyncPanel(loader) {
  return defineAsyncComponent({
    loader,
    loadingComponent: PanelLoading,
    errorComponent: PanelError,
    delay: 120,
    timeout: 20000,
  })
}

const NightSkyGuide = asyncPanel(() => import('./NightSkyGuide.vue'))
const IssTracker = asyncPanel(() => import('./IssTracker.vue'))
const LaunchBoard = asyncPanel(() => import('./LaunchBoard.vue'))
const Earthquake = asyncPanel(() => import('./Earthquake.vue'))
const MarsWeather = asyncPanel(() => import('./MarsWeather.vue'))

const ASYNC_PANELS = {
  iss: IssTracker,
  launch: LaunchBoard,
  quake: Earthquake,
  mars: MarsWeather,
}

const activePanel = computed(() => {
  const current = tab.value
  if (current === 'overview') {
    return { key: 'overview', comp: SpaceOverview, props: { onNavigate: navigate } }
  }
  if (current === 'tonight' || current === 'aurora') {
    return { key: 'sky', comp: NightSkyGuide, props: { view: current, onNavigate: navigate } }
  }
  return { key: current, comp: ASYNC_PANELS[current], props: {} }
})

const tabItems = computed(() => TABS.map((item) => ({ key: item.key, label: t.value(item.label) })))

function navigate(key) {
  if (!TAB_KEYS.includes(key)) return
  setTab(key)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function onTabChange(key) {
  setTab(key)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <UiPage
    class="space-now"
    :title="{ en: 'Space Now', zh: '此刻太空' }"
    :sources="[
      { name: 'USGS', url: 'https://earthquake.usgs.gov/' },
      { name: 'WhereTheISS.at', url: 'https://wheretheiss.at/' },
      { name: 'TLE API', url: 'https://tle.ivanstanojevic.me/' },
      { name: 'NOAA SWPC', url: 'https://www.swpc.noaa.gov/' },
      { name: 'Launch Library 2', url: 'https://thespacedevs.com/llapi' },
      { name: 'NASA MSL', url: 'https://mars.nasa.gov/msl/weather/' },
      { name: 'Open-Meteo Geocoding', url: 'https://open-meteo.com/en/docs/geocoding-api' },
      { name: 'Esri', url: 'https://www.esri.com/' },
    ]"
  >
    <UiTabs
      class="space-tabs"
      :model-value="tab"
      :items="tabItems"
      :aria-label="t('tablistLabel')"
      panel-id="space-panel"
      @update:model-value="onTabChange"
    />

    <div id="space-panel" class="tab-panel" role="tabpanel" :aria-labelledby="'ui-tab-' + tab">
      <KeepAlive :max="3">
        <component :is="activePanel.comp" :key="activePanel.key" v-bind="activePanel.props" />
      </KeepAlive>
    </div>
  </UiPage>
</template>

<style scoped>
.space-now {
  background:
    radial-gradient(1100px 620px at 12% -8%, rgba(56, 189, 248, 0.14), transparent 60%),
    radial-gradient(900px 520px at 92% -4%, rgba(167, 139, 250, 0.1), transparent 60%), var(--ok-bg);
}

.tab-panel {
  min-width: 0;
}

.space-tabs {
  margin-bottom: 1rem;
}

.panel-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}
</style>
