import { reactive } from 'vue'
import { lsGet, lsSet } from './ok.js'

const STORAGE_KEY = 'openkee-theme'

function storedTheme() {
  const v = lsGet(STORAGE_KEY)
  return v === 'dark' || v === 'light' ? v : null
}

function systemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const themeState = reactive({
  theme: storedTheme() || systemTheme(),
})

function apply(theme) {
  themeState.theme = theme
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0e14' : '#f5f7fb')
}

export function setTheme(theme) {
  apply(theme)
  lsSet(STORAGE_KEY, theme)
}

export function toggleTheme() {
  setTheme(themeState.theme === 'dark' ? 'light' : 'dark')
}

apply(themeState.theme)

const mql = window.matchMedia('(prefers-color-scheme: dark)')
mql.addEventListener('change', (e) => {
  if (!storedTheme()) apply(e.matches ? 'dark' : 'light')
})
