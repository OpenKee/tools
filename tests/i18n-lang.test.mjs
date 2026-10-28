import test from 'node:test'
import assert from 'node:assert/strict'

const realDocument = globalThis.document
const realLocalStorage = globalThis.localStorage

function stubEnv({ saved }) {
  const html = { lang: 'en', dataset: {} }

  globalThis.document = {
    documentElement: html,
    createElement: () => ({ content: {}, innerHTML: '', firstChild: null }),
  }
  globalThis.localStorage = {
    getItem: (k) => (k === 'openkee-lang' ? saved : null),
    setItem() {},
    removeItem() {},
  }
  return html
}

test.afterEach(() => {
  globalThis.document = realDocument
  globalThis.localStorage = realLocalStorage
})

test('i18n applies the saved language to <html lang> on load', async () => {
  const html = stubEnv({ saved: 'zh' })
  const mod = await import(`../src/i18n.js?lang=zh-${Date.now()}`)
  assert.equal(mod.i18nState.lang, 'zh')
  assert.equal(html.lang, 'zh')
})

test('i18n falls back to English and still sets <html lang>', async () => {
  const html = stubEnv({ saved: null })
  const mod = await import(`../src/i18n.js?lang=default-${Date.now()}`)
  assert.equal(mod.i18nState.lang, 'en')
  assert.equal(html.lang, 'en')
})

test('setLang keeps <html lang> in sync when toggling', async () => {
  const html = stubEnv({ saved: 'en' })
  const mod = await import(`../src/i18n.js?lang=toggle-${Date.now()}`)
  mod.setLang('zh')
  assert.equal(html.lang, 'zh')
})
