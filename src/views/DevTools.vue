<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { useT } from '../i18n.js'
import { useUrlTab } from '../lib/use-url-tab.js'
import { UiLoading, UiPage, UiTabs } from '../components/ui/index.js'
import copy from '../copy/dev-tools.js'

const MarkdownStudioTool = defineAsyncComponent(() => import('./MarkdownStudio.vue'))
const QrForgeTool = defineAsyncComponent(() => import('./QrForge.vue'))
const PasswordVaultTool = defineAsyncComponent(() => import('./PasswordVault.vue'))

const t = useT(copy)
const TOOLS = [
  { id: 'md', label: 'tool.md', component: MarkdownStudioTool },
  { id: 'qr', label: 'tool.qr', component: QrForgeTool },
  { id: 'password', label: 'tool.password', component: PasswordVaultTool },
]
const SOURCES = {
  md: [{ name: 'GitHub Markdown API', url: 'https://docs.github.com/en/rest/markdown' }],
  qr: [],
  password: [{ name: 'Have I Been Pwned', url: 'https://haveibeenpwned.com/' }],
}

const { tab: currentTool, setTab: selectTool } = useUrlTab(
  TOOLS.map((tool) => tool.id),
  'md',
  'tool',
)
const activeTool = computed(() => TOOLS.find((tool) => tool.id === currentTool.value) || TOOLS[0])
const activeSources = computed(() => SOURCES[currentTool.value] || [])
const tabItems = computed(() => TOOLS.map((tool) => ({ key: tool.id, label: t.value(tool.label) })))
</script>

<template>
  <UiPage class="dev-app" :title="t('title')" :sources="activeSources" width="1100px" spacing="compact">
    <UiTabs
      class="dev-tabs"
      :model-value="currentTool"
      :items="tabItems"
      aria-label="Developer tools"
      panel-id="dev-panel"
      size="sm"
      @update:model-value="selectTool"
    />

    <div id="dev-panel" class="content" role="tabpanel" :aria-labelledby="'ui-tab-' + currentTool">
      <Suspense>
        <KeepAlive :max="3">
          <component :is="activeTool.component" :key="activeTool.id" embedded />
        </KeepAlive>
        <template #fallback>
          <UiLoading :label="t('msg.loadingTool')" />
        </template>
      </Suspense>
    </div>
  </UiPage>
</template>

<style scoped>
.dev-tabs {
  margin-bottom: 0.85rem;
}

.content {
  min-width: 0;
}
</style>
