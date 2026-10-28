<script setup>
import { computed } from 'vue'
import { UiPage, UiTabs } from '../components/ui/index.js'
import { i18nState } from '../i18n.js'
import { useUrlTab } from '../lib/use-url-tab.js'
import TasteAtlas from './TasteAtlas.vue'
import CocktailBar from './CocktailBar.vue'

const TABS = [
  { key: 'recipes', comp: TasteAtlas, label: { en: 'Recipes', zh: '食谱' } },
  { key: 'drinks', comp: CocktailBar, label: { en: 'Drinks', zh: '调酒' } },
]

const { tab: active, setTab } = useUrlTab(
  TABS.map((tab) => tab.key),
  'recipes',
)
const tabItems = computed(() => TABS.map((tab) => ({ key: tab.key, label: tab.label[i18nState.lang] || tab.label.en })))

function activeComp() {
  return (TABS.find((t) => t.key === active.value) || TABS[0]).comp
}
</script>

<template>
  <UiPage
    class="food-atlas-app"
    :title="{ en: 'Food & Drinks', zh: '美食与调酒' }"
    :sources="[
      { name: 'TheMealDB', url: 'https://www.themealdb.com/' },
      { name: 'TheCocktailDB', url: 'https://www.thecocktaildb.com/' },
    ]"
    spacing="compact"
  >
    <UiTabs
      class="food-tabs"
      :model-value="active"
      :items="tabItems"
      panel-id="food-atlas-panel"
      :aria-label="i18nState.lang === 'zh' ? '美食与调酒' : 'Food and drinks views'"
      @update:model-value="setTab"
    />

    <div id="food-atlas-panel" role="tabpanel" :aria-labelledby="'ui-tab-' + active" tabindex="0">
      <KeepAlive>
        <component :is="activeComp()" />
      </KeepAlive>
    </div>
  </UiPage>
</template>

<style scoped>
.food-atlas-app {
  --ok-content-width: 1100px;
}

.food-tabs {
  margin-bottom: 0.8rem;
}
</style>
