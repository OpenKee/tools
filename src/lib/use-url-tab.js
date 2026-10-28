import { getCurrentScope, onScopeDispose, ref } from 'vue'

export function useUrlTab(keys, defaultKey, param = 'tab') {
  const allowed = Array.isArray(keys) ? keys : []
  const fallback = allowed.includes(defaultKey) ? defaultKey : allowed[0]

  function fromUrl() {
    const raw = new URLSearchParams(window.location.search).get(param)
    return allowed.includes(raw) ? raw : fallback
  }

  const tab = ref(fromUrl())

  function writeUrl(key) {
    const url = new URL(window.location.href)
    if (key === fallback) url.searchParams.delete(param)
    else url.searchParams.set(param, key)
    window.history.replaceState(window.history.state, '', url)
  }

  const fromQueryParam = new URLSearchParams(window.location.search).get(param)
  if (fromQueryParam !== null && !allowed.includes(fromQueryParam)) writeUrl(fallback)

  function setTab(key) {
    if (!allowed.includes(key) || tab.value === key) return
    tab.value = key
    writeUrl(key)
  }

  function onPopState() {
    const next = fromUrl()
    if (next !== tab.value) tab.value = next
  }
  window.addEventListener('popstate', onPopState)

  if (getCurrentScope()) {
    onScopeDispose(() => window.removeEventListener('popstate', onPopState))
  }

  return { tab, setTab }
}
