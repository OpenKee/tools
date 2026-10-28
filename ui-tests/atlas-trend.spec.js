import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AtlasInfo from '../src/views/AtlasInfo.vue'
import CountryDetail from '../src/components/atlas/CountryDetail.vue'
import UiPage from '../src/components/ui/UiPage.vue'
import { fetchJSON } from '../src/ok.js'

vi.mock('../src/ok.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchJSON: vi.fn() }
})

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const year = new Date().getFullYear() - 1
const trendResponse = (value) => [{ pages: 1 }, [{ date: String(year), value }]]
let wrapper
let router
let canada
let mexico

beforeEach(async () => {
  localStorage.clear()
  fetchJSON.mockReset()
  canada = deferred()
  mexico = deferred()
  localStorage.setItem(
    'atlas-info-cache-v1',
    JSON.stringify({
      version: 1,
      year,
      savedAt: Date.now(),
      extrasReady: true,
      countries: [
        { cca3: 'USA', cca2: 'US', name: { common: 'United States' } },
        { cca3: 'CAN', cca2: 'CA', name: { common: 'Canada' } },
        { cca3: 'MEX', cca2: 'MX', name: { common: 'Mexico' } },
      ].map((c) => ({ ...c, region: 'Americas', independent: true, stats: {} })),
    }),
  )
  fetchJSON.mockImplementation((url) => {
    if (url.includes('/country/USA/')) return Promise.resolve(trendResponse(100))
    if (url.includes('/country/CAN/')) return canada.promise
    if (url.includes('/country/MEX/')) return mexico.promise
    return Promise.reject(new Error('Unexpected URL: ' + url))
  })
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/apps/atlas-info', component: AtlasInfo }],
  })
  await router.push('/apps/atlas-info')
  wrapper = mount(AtlasInfo, {
    global: { plugins: [router], stubs: { AppHeader: true, AppFooter: true, CountryDetail: true } },
  })
  await flushPromises()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  router.options.history.destroy()
  localStorage.clear()
})

async function select(code) {
  await wrapper.get(`[data-code="${code}"] .crow-head`).trigger('click')
  await flushPromises()
}

const detail = () => wrapper.getComponent(CountryDetail)

describe('Atlas trend request ownership', () => {
  test.each(['resolve', 'reject'])('returning to a cached country invalidates the old trend (%s)', async (settle) => {
    await select('USA')
    expect(detail().props('trendState')).toBe('loaded')
    const cached = detail().props('trend')
    await select('CAN')
    expect(detail().props('trendState')).toBe('loading')
    const calls = fetchJSON.mock.calls.length
    await select('USA')
    expect(fetchJSON).toHaveBeenCalledTimes(calls)
    expect(detail().props('trend')).toBe(cached)
    if (settle === 'resolve') canada.resolve(trendResponse(999))
    else canada.reject(new Error('stale failure'))
    await flushPromises()
    expect(detail().props('country').cca3).toBe('USA')
    expect(detail().props('trendState')).toBe('loaded')
    expect(detail().props('trend')).toBe(cached)
  })

  test('old completion does not end the new country loading state', async () => {
    await select('CAN')
    await select('MEX')
    canada.resolve(trendResponse(999))
    await flushPromises()
    expect(detail().props('country').cca3).toBe('MEX')
    expect(detail().props('trendState')).toBe('loading')
    expect(detail().props('trend')).toBeNull()
    mexico.resolve(trendResponse(200))
    await flushPromises()
    expect(detail().props('trendState')).toBe('loaded')
    expect(detail().props('trend').rows.at(-1)).toMatchObject({ pop: 200, gdp: 200 })
  })

  test.each(['close', 'unmount'])('%s invalidates pending trends', async (action) => {
    await select('CAN')
    const state = wrapper.vm.$.setupState
    if (action === 'close') await select('CAN')
    else {
      wrapper.unmount()
      wrapper = null
    }
    canada.resolve(trendResponse(999))
    await flushPromises()
    expect(state.trend).toBeNull()
    expect(state.trendState).toBe(action === 'close' ? 'idle' : 'loading')
  })

  test('lists Esri as the basemap source', () => {
    expect(wrapper.getComponent(UiPage).props('sources')).toContainEqual({ name: 'Esri', url: 'https://www.esri.com/' })
  })
})
