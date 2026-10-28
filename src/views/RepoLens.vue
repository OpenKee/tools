<script setup>
import { computed, ref, watch } from 'vue'
import { UiBadge, UiButton, UiInput, UiPage, UiTabs } from '../components/ui/index.js'
import { i18nState } from '../i18n.js'
import { useGithubToken } from '../lib/github-auth.js'
import TrendingAtlas from './TrendingAtlas.vue'
import RepoScope from './RepoScope.vue'
import TechStackAdvisor from './TechStackAdvisor.vue'
import RepoDeepDive from './RepoDeepDive.vue'
import { useUrlTab } from '../lib/use-url-tab.js'

const TABS = [
  {
    key: 'trending',
    comp: TrendingAtlas,
    label: { en: 'Trending', zh: '趋势' },
    desc: {
      en: 'Repositories created recently with at least one fork, sorted by stars.',
      zh: '近期创建且已有 Fork 的仓库，按星标排序。',
    },
  },
  {
    key: 'compare',
    comp: RepoScope,
    label: { en: 'Users', zh: '用户' },
    desc: {
      en: 'Public repositories and language breakdown for a GitHub user.',
      zh: '查看 GitHub 用户的公开仓库与语言分布。',
    },
  },
  {
    key: 'advisor',
    comp: TechStackAdvisor,
    label: { en: 'Libraries', zh: '库搜索' },
    desc: {
      en: 'Search repositories and compare stars, forks, issues, language, and last update.',
      zh: '搜索仓库并对比星标、Fork、议题、语言与更新时间。',
    },
  },
  {
    key: 'dive',
    comp: RepoDeepDive,
    label: { en: 'Repository', zh: '仓库' },
    desc: {
      en: 'Repository metadata, languages, contributors, and 52-week commit activity.',
      zh: '查看仓库信息、语言分布、贡献者与 52 周提交活动。',
    },
  },
]

const { tab: active, setTab } = useUrlTab(
  TABS.map((tab) => tab.key),
  'trending',
)
const activeTab = computed(() => TABS.find((tab) => tab.key === active.value) || TABS[0])
const tabItems = computed(() => TABS.map((tab) => ({ key: tab.key, label: tab.label[i18nState.lang] || tab.label.en })))

const { token, configured, panelOpen, saveToken, clearToken } = useGithubToken()
const tokenInput = ref(token.value)
watch(token, (value) => {
  tokenInput.value = value
})

const tokenCopy = {
  en: {
    token: 'GitHub token',
    configured: 'Configured',
    notConfigured: 'Not configured',
    save: 'Save',
    clear: 'Clear',
    hint: 'Shared by all tabs. Stored only in this browser.',
  },
  zh: {
    token: 'GitHub token',
    configured: '已配置',
    notConfigured: '未配置',
    save: '保存',
    clear: '清除',
    hint: '四个 tab 共用，仅保存在本机浏览器。',
  },
}
const tokenText = computed(() => tokenCopy[i18nState.lang === 'zh' ? 'zh' : 'en'])

function applyToken() {
  saveToken(tokenInput.value)
}

function resetToken() {
  clearToken()
  tokenInput.value = ''
}

function onTokenToggle(event) {
  panelOpen.value = event.target.open
}
</script>

<template>
  <UiPage
    class="repo-lens-app"
    :title="{ en: 'Repo Lens', zh: '仓库分析台' }"
    :sources="[{ name: 'GitHub API', url: 'https://docs.github.com/en/rest' }]"
    spacing="compact"
  >
    <UiTabs
      class="lens-tabs"
      :model-value="active"
      :items="tabItems"
      :aria-label="i18nState.lang === 'zh' ? '仓库分析视图' : 'Repo Lens views'"
      panel-id="repo-panel"
      @update:model-value="setTab"
    />

    <div class="lens-toolbar">
      <p class="lens-desc">{{ activeTab.desc[i18nState.lang] || activeTab.desc.en }}</p>
      <details class="token-panel" :open="panelOpen" @toggle="onTokenToggle">
        <summary>
          <span>{{ tokenText.token }}</span>
          <UiBadge :variant="configured ? 'up' : 'neutral'" size="sm">
            {{ configured ? tokenText.configured : tokenText.notConfigured }}
          </UiBadge>
        </summary>
        <div class="token-row">
          <UiInput
            v-model="tokenInput"
            class="token-input"
            type="password"
            size="sm"
            monospace
            placeholder="ghp_xxxx"
            autocomplete="new-password"
            aria-label="GitHub personal access token"
          />
          <UiButton variant="secondary" size="sm" @click="applyToken">{{ tokenText.save }}</UiButton>
          <UiButton variant="ghost" size="sm" @click="resetToken">{{ tokenText.clear }}</UiButton>
        </div>
        <p class="token-hint">{{ tokenText.hint }}</p>
      </details>
    </div>

    <div id="repo-panel" role="tabpanel" :aria-labelledby="'ui-tab-' + active" tabindex="0">
      <KeepAlive>
        <component :is="activeTab.comp" />
      </KeepAlive>
    </div>
  </UiPage>
</template>

<style scoped>
.repo-lens-app {
  --ok-content-width: 1100px;
}

.lens-tabs {
  margin-bottom: 0.7rem;
}

.lens-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin: 0.7rem 0 0.9rem;
}

.lens-desc {
  flex: 1 1 320px;
  color: var(--ok-muted);
  font-size: 0.82rem;
  line-height: 1.5;
}

.token-panel {
  font-size: 0.76rem;
}

.token-panel summary {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  color: var(--ok-muted);
  list-style: none;
}

.token-panel summary::-webkit-details-marker {
  display: none;
}

.token-row {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.4rem;
}

.token-input {
  width: 220px;
}

.token-hint {
  margin-top: 0.35rem;
  color: var(--ok-muted);
  font-size: 0.68rem;
}

@media (max-width: 560px) {
  .token-row {
    flex-wrap: wrap;
  }

  .token-input {
    width: 100%;
  }
}
</style>
