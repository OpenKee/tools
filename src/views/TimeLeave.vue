<script setup>
import { computed } from 'vue'
import { i18nState } from '../i18n.js'
import { UiPage, UiPageHead, UiTabs } from '../components/ui/index.js'
import HourBridge from './HourBridge.vue'
import OffdayPlanner from './OffdayPlanner.vue'
import { useUrlTab } from '../lib/use-url-tab.js'

const TABS = [
  {
    key: 'meeting',
    comp: HourBridge,
    label: { en: 'Meeting planner', zh: '会议规划' },
    desc: {
      en: 'Pick cities, scan the 24-hour grid, and choose the fairest meeting slot.',
      zh: '选城市，查看 24 小时时间线，找到最公平的开会时间。',
    },
  },
  {
    key: 'holidays',
    comp: OffdayPlanner,
    label: { en: 'Holidays', zh: '假期规划' },
    desc: {
      en: 'Browse API-reported holiday dates and workweek-based leave estimates where supported.',
      zh: '查看接口提供的假期日期，以及支持地区按工作周估算的请假建议。',
    },
  },
]

const { tab: active, setTab } = useUrlTab(
  TABS.map((tab) => tab.key),
  'meeting',
)

const activeTab = computed(() => TABS.find((tab) => tab.key === active.value) || TABS[0])
const tabItems = computed(() => TABS.map((tab) => ({ key: tab.key, label: tab.label[i18nState.lang] || tab.label.en })))
</script>

<template>
  <UiPage
    class="time-leave-app"
    :title="{ en: 'Time & Leave', zh: '时间与假期' }"
    :sources="[
      { name: 'Open-Meteo Geocoding', url: 'https://open-meteo.com/en/docs/geocoding-api' },
      { name: 'Nager.Date', url: 'https://date.nager.at/' },
    ]"
    spacing="compact"
  >
    <UiTabs
      class="time-tabs"
      :model-value="active"
      :items="tabItems"
      :aria-label="i18nState.lang === 'zh' ? '时间与假期视图' : 'Time and leave views'"
      panel-id="time-panel"
      @update:model-value="setTab"
    />

    <div id="time-panel" role="tabpanel" :aria-labelledby="'ui-tab-' + active" tabindex="0">
      <UiPageHead :description="activeTab.desc[i18nState.lang] || activeTab.desc.en" />
      <KeepAlive>
        <component :is="activeTab.comp" />
      </KeepAlive>
    </div>
  </UiPage>
</template>

<style scoped>
.time-leave-app {
  --ok-content-width: 1100px;
}

.time-tabs {
  margin-bottom: 0.65rem;
}
</style>
