import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Home from '../src/views/Home.vue'
import ApiProbe from '../src/views/ApiProbe.vue'
import { i18nState } from '../src/i18n.js'

const NOW = Date.UTC(2026, 9, 10, 12)
const STALE = 30 * 60 * 1000
const KEY = 'api-probe-results'
let wrapper
let fetchMock

function save(time, results = { 'om-forecast': { ok: true, status: 200, note: '', ms: 1 } }) {
  localStorage.setItem(KEY, JSON.stringify({ time, results }))
}

function mountView(component) {
  wrapper = mount(component, {
    global: {
      stubs: { AppHeader: true, RouterLink: { template: '<a><slot /></a>' } },
    },
  })
  return flushPromises()
}

function counts() {
  return wrapper.findAll('.sum-grid .ui-stat-value').map((el) => Number(el.text()))
}

beforeEach(() => {
  localStorage.clear()
  i18nState.lang = 'en'
  vi.useFakeTimers()
  vi.setSystemTime(NOW)

  fetchMock = vi.fn().mockRejectedValue(new TypeError('Local mock: network unavailable'))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Home API status freshness', () => {
  test.each([NOW - STALE, NOW - STALE - 1, NOW + 1, 'invalid', String(NOW), null, undefined])(
    'shows unknown for stale or invalid time %s',
    async (time) => {
      save(time)
      await mountView(Home)
      expect(wrapper.get('.probe-dot').classes()).toContain('unknown')
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  test('expires a recent result while Home remains mounted', async () => {
    save(NOW - STALE + 1)
    await mountView(Home)
    expect(wrapper.get('.probe-dot').classes()).toContain('ok')
    await vi.advanceTimersByTimeAsync(1)
    expect(wrapper.get('.probe-dot').classes()).toContain('unknown')
  })

  test.each([
    ['ok', 0],
    ['warn', 1],
    ['bad', 3],
  ])('retains the %s status for fresh results', async (state, failures) => {
    const results = { healthy: { ok: true } }
    for (let i = 0; i < failures; i++) results[`failure-${i}`] = { ok: false }
    save(NOW, results)
    await mountView(Home)
    expect(wrapper.get('.probe-dot').classes()).toContain(state)
  })

  test('shows unknown for empty or malformed stored results', async () => {
    save(NOW, {})
    await mountView(Home)
    expect(wrapper.get('.probe-dot').classes()).toContain('unknown')
    wrapper.unmount()
    localStorage.setItem(KEY, '{bad json')
    await mountView(Home)
    expect(wrapper.get('.probe-dot').classes()).toContain('unknown')
  })
})

describe('ApiProbe local results', () => {
  test('counts only note:timeout as timeout; other status 0 failures remain failures', async () => {
    save(NOW, {
      'om-forecast': { ok: true, status: 200, note: '', ms: 1 },
      'om-air': { ok: false, status: 0, note: 'timeout', ms: 8000 },
      'om-archive': { ok: false, status: 0, note: 'fail', ms: 2 },
      'om-marine': { ok: false, status: 0, note: '', ms: 2 },
      ipquery: { ok: false, status: 503, note: '', ms: 5 },
    })
    await mountView(ApiProbe)
    expect(counts()).toEqual([1, 3, 1])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('manual probe classifies local network, timeout, HTTP, validation and opaque responses', async () => {
    save(NOW, {})
    await mountView(ApiProbe)
    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockImplementation(async (url, options) => {
      if (options.mode === 'no-cors') return { type: 'opaque', status: 0, ok: false }
      if (url.startsWith('https://api.open-meteo.com/')) {
        return { ok: true, status: 200, json: async () => ({ current: {} }) }
      }
      if (url.startsWith('https://air-quality-api.open-meteo.com/'))
        throw new window.DOMException('Timed out', 'TimeoutError')
      if (url.startsWith('https://archive-api.open-meteo.com/')) throw new TypeError('Failed to fetch')
      if (url.startsWith('https://marine-api.open-meteo.com/')) return { ok: true, status: 200, json: async () => ({}) }
      return { ok: false, status: 503, json: async () => ({}), text: async () => '' }
    })
    await wrapper.get('.toolbar button').trigger('click')
    await flushPromises()
    const endpointCount = wrapper.findAll('.row').length
    expect(fetchMock).toHaveBeenCalledTimes(endpointCount)
    expect(counts()).toEqual([2, endpointCount - 3, 1])
    const saved = JSON.parse(localStorage.getItem(KEY))
    expect(saved.time).toBe(NOW)
    expect(saved.results['om-air'].note).toBe('timeout')
    expect(saved.results['om-archive'].note).toBe('fail')
    expect(saved.results['om-marine'].note).toBe('bad')
    expect(saved.results['esri-tiles'].note).toBe('opaque')
  })

  test('renders bilingual endpoint names and apps, exact clickable URLs and an honest footer', async () => {
    save(NOW)
    await mountView(ApiProbe)
    const englishNames = wrapper.findAll('.ep-name').map((el) => el.text())
    const englishApps = wrapper.findAll('.ep-apps').map((el) => el.text())
    for (const text of [...englishNames, ...englishApps]) {
      expect(text).not.toBe('')
      expect(text).not.toMatch(/[\u3400-\u9fff]/)
    }
    for (const link of wrapper.findAll('a.ep-url')) {
      expect(link.attributes('href')).toBe(link.text())
      expect(link.attributes('href')).toMatch(/^https:\/\//)
      expect(link.attributes('rel')).toContain('noreferrer')
    }
    expect(wrapper.get('.probe-note').text()).toContain('not a service-wide guarantee')
    expect(wrapper.find('.ok-footer-sources').exists()).toBe(false)
    i18nState.lang = 'zh'
    await nextTick()
    expect(wrapper.findAll('.ep-name')[0].text()).toContain('天气预报')
    expect(wrapper.findAll('.ep-apps').every((el) => /[\u3400-\u9fff]/.test(el.text()))).toBe(true)
    expect(wrapper.get('.probe-note').text()).toContain('无法确认 HTTP 状态或内容')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
