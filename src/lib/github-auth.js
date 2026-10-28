import { computed, ref } from 'vue'
import { lsGet, lsRemove, lsSet } from '../ok.js'

const TOKEN_KEY = 'github-token'

export const githubToken = ref(lsGet(TOKEN_KEY) || '')
export const githubTokenConfigured = computed(() => !!githubToken.value)
export const githubTokenPanelOpen = ref(false)

export function saveGithubToken(value) {
  const token = String(value || '').trim()
  githubToken.value = token
  lsSet(TOKEN_KEY, token)
}

export function clearGithubToken() {
  githubToken.value = ''
  lsRemove(TOKEN_KEY)
}

export function useGithubToken() {
  return {
    token: githubToken,
    configured: githubTokenConfigured,
    panelOpen: githubTokenPanelOpen,
    saveToken: saveGithubToken,
    clearToken: clearGithubToken,
  }
}
