import { reactive, computed, type ComputedRef } from 'vue'

/* ============================================================
   全局 i18n：模块级 reactive 状态，任意组件可导入使用。
   替代旧版 window.OK 的 t/applyI18n/initLangToggle。
   ============================================================ */

export type Lang = 'en' | 'zh'

/** 文案字典：{ key: 文案 } */
export type CopyTable = Record<string, string>

/** 组件文案：{ en: {...}, zh: {...} } */
export type CopyDict = Partial<Record<Lang, CopyTable>>

export type TFunc = (key: string) => string

const STORAGE_KEY = 'openkee-lang'

function loadLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'zh' ? 'zh' : 'en'
  } catch (e) {
    return 'en'
  }
}

export const i18nState = reactive<{ lang: Lang }>({ lang: loadLang() })

export function setLang(lang: Lang): void {
  i18nState.lang = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch (e) {}
  document.documentElement.lang = lang
}

export function toggleLang(): void {
  setLang(i18nState.lang === 'en' ? 'zh' : 'en')
}

/**
 * 创建响应式翻译函数。
 * @param copy - 形如 { en: {...}, zh: {...} }
 * @returns 返回 t(key) 的 computed；模板中直接 t('key')，script 中用 t.value('key')
 */
export function useT(copy: CopyDict): ComputedRef<TFunc> {
  return computed(() => {
    const table = (copy[i18nState.lang] || copy.en || {}) as CopyTable
    return (key: string) => (table[key] != null ? table[key] : key)
  })
}
