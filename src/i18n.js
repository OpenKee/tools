import { reactive, computed } from 'vue'

/* ============================================================
   全局 i18n：模块级 reactive 状态，任意组件可导入使用。
   替代旧版 window.OK 的 t/applyI18n/initLangToggle。
   ============================================================ */

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

export function setLang(lang) {
  i18nState.lang = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch (e) {}
  document.documentElement.lang = lang
}

export function toggleLang() {
  setLang(i18nState.lang === 'en' ? 'zh' : 'en')
}

/**
 * 创建响应式翻译函数。
 * @param {Object} copy - 形如 { en: {...}, zh: {...} }
 * @returns {import('vue').ComputedRef<Function>} 返回 t(key) 函数
 */
export function useT(copy) {
  return computed(() => {
    const table = copy[i18nState.lang] || copy.en || {}
    return (key) => (table[key] != null ? table[key] : key)
  })
}
