import { reactive, computed } from 'vue'

const STORAGE_KEY = 'openkee-lang'

function loadLang() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'en'
  } catch (e) {
    return 'en'
  }
}

export const i18nState = reactive({
  lang: loadLang(),
})

function applyLang(lang) {
  if (typeof document !== 'undefined') document.documentElement.lang = lang
}

export function setLang(lang) {
  i18nState.lang = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch (e) {}
  applyLang(lang)
}

export function toggleLang() {
  setLang(i18nState.lang === 'en' ? 'zh' : 'en')
}

applyLang(i18nState.lang)

export function useT(copy) {
  return computed(() => {
    const table = copy[i18nState.lang] || copy.en || {}
    return (key) => (table[key] != null ? table[key] : key)
  })
}

applyLang(i18nState.lang)
