import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope } from 'vue'
import { useUrlTab } from '../src/lib/use-url-tab.js'

const realWindow = globalThis.window

function stubWindow(href = 'https://example.com/apps/x') {
  const calls = []
  const state = { scroll: { top: 42 } }
  const location = {
    href,
    get search() {
      return new URL(this.href).search
    },
  }
  globalThis.window = {
    location,
    history: {
      state,
      replaceState(nextState, _title, url) {
        calls.push({ nextState, url: String(url) })
        location.href = String(url)
      },
    },
    addEventListener(type, fn) {
      this._listeners = this._listeners || {}
      this._listeners[type] = fn
    },
    removeEventListener(type, fn) {
      if (this._listeners && this._listeners[type] === fn) delete this._listeners[type]
    },
  }
  return { calls, state, win: globalThis.window }
}

test.afterEach(() => {
  globalThis.window = realWindow
})

test('useUrlTab reads a valid tab from the URL', () => {
  stubWindow('https://example.com/apps/x?tab=b')
  const { tab } = useUrlTab(['a', 'b'], 'a')
  assert.equal(tab.value, 'b')
})

test('useUrlTab falls back to the default for unknown tabs', () => {
  stubWindow('https://example.com/apps/x?tab=nope')
  const { tab } = useUrlTab(['a', 'b'], 'a')
  assert.equal(tab.value, 'a')
})

test('useUrlTab rewrites an unknown tab out of the URL', () => {
  const { calls } = stubWindow('https://example.com/apps/x?tab=nope')
  const { tab } = useUrlTab(['a', 'b'], 'a')
  assert.equal(tab.value, 'a')
  assert.equal(calls.length, 1)
  assert.doesNotMatch(calls[0].url, /[?&]tab=/)
})

test('useUrlTab writes a non-default tab into the query', () => {
  const { calls } = stubWindow()
  const { tab, setTab } = useUrlTab(['a', 'b'], 'a')
  setTab('b')
  assert.equal(tab.value, 'b')
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /[?&]tab=b/)
})

test('useUrlTab drops the tab param when switching back to the default', () => {
  const { calls } = stubWindow('https://example.com/apps/x?tab=b')
  const { setTab } = useUrlTab(['a', 'b'], 'a')
  setTab('a')
  assert.equal(calls.length, 1)
  assert.doesNotMatch(calls[0].url, /[?&]tab=/)
})

test('useUrlTab can read and write a custom query parameter', () => {
  const { calls } = stubWindow('https://example.com/apps/dev-tools?tool=qr')
  const { tab, setTab } = useUrlTab(['css', 'qr'], 'css', 'tool')
  assert.equal(tab.value, 'qr')
  setTab('css')
  assert.doesNotMatch(calls[0].url, /[?&]tool=/)
})

test('useUrlTab preserves history.state so router scroll positions survive', () => {
  const { calls, state } = stubWindow()
  const { setTab } = useUrlTab(['a', 'b'], 'a')
  setTab('b')
  assert.equal(calls[0].nextState, state)
})

test('useUrlTab ignores unknown and repeated keys', () => {
  const { calls } = stubWindow()
  const { tab, setTab } = useUrlTab(['a', 'b'], 'a')
  setTab('zzz')
  setTab('a')
  assert.equal(tab.value, 'a')
  assert.equal(calls.length, 0)
})

test('useUrlTab follows the URL on popstate', () => {
  const { win } = stubWindow()
  const { tab } = useUrlTab(['a', 'b'], 'a')
  win.location.href = 'https://example.com/apps/x?tab=b'
  win._listeners.popstate()
  assert.equal(tab.value, 'b')
})

test('useUrlTab removes its popstate listener when the scope is disposed', () => {
  const { win } = stubWindow()
  const scope = effectScope()
  scope.run(() => useUrlTab(['a', 'b'], 'a'))
  assert.equal(typeof win._listeners.popstate, 'function')
  scope.stop()
  assert.equal(win._listeners.popstate, undefined)
})
