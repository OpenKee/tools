import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import HnReader from '../src/views/HnReader.vue'
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

function mountReader() {
  return mount(HnReader, {
    global: {
      stubs: { AppHeader: true, AppFooter: true },
    },
  })
}

let wrapper

beforeEach(() => {
  window.history.replaceState({}, '', '/apps/hn-reader')
  fetchJSON.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

describe('HnReader request invalidation', () => {
  test('Top → Best → Top ignores slow responses and old finally handlers', async () => {
    const topRequests = []
    const bestRequests = []
    const itemRequests = new Map()
    fetchJSON.mockImplementation((url) => {
      if (url.endsWith('/topstories.json')) {
        const request = deferred()
        topRequests.push(request)
        return request.promise
      }
      if (url.endsWith('/beststories.json')) {
        const request = deferred()
        bestRequests.push(request)
        return request.promise
      }
      const id = /\/item\/(\d+)\.json$/.exec(url)?.[1]
      const request = deferred()
      itemRequests.set(id, request)
      return request.promise
    })

    wrapper = mountReader()
    expect(topRequests).toHaveLength(1)
    expect(wrapper.get('[role=tabpanel]').attributes()).toMatchObject({
      id: 'hn-panel',
      'aria-labelledby': 'ui-tab-top',
    })
    wrapper.findAll('[role=tab]').forEach((tab) => {
      expect(tab.attributes('aria-controls')).toBe('hn-panel')
    })

    await wrapper.findAll('[role=tab]')[1].trigger('click')
    expect(bestRequests).toHaveLength(1)
    await wrapper.findAll('[role=tab]')[0].trigger('click')
    expect(topRequests).toHaveLength(2)

    topRequests[0].resolve([100])
    await flushPromises()
    bestRequests[0].resolve([200])
    await flushPromises()
    topRequests[1].resolve([1])
    await flushPromises()

    expect(wrapper.find('.ui-loading').exists()).toBe(true)
    expect(wrapper.findAll('.row')).toHaveLength(0)

    itemRequests.get('1').resolve({ id: 1, title: 'Fresh Top', url: 'javascript:alert(1)', time: 1 })
    await flushPromises()

    expect(wrapper.find('.row').text()).toContain('Fresh Top')
    expect(wrapper.find('.ui-loading').exists()).toBe(false)
    expect(wrapper.get('a.title').attributes('href')).toBe('https://news.ycombinator.com/item?id=1')
    expect(wrapper.find('.end-msg').exists()).toBe(true)
  })

  test('popstate resets state and loads the URL tab', async () => {
    const bestIds = deferred()
    const bestItem = deferred()
    fetchJSON.mockImplementation((url) => {
      if (url.endsWith('/topstories.json')) return Promise.resolve([1])
      if (url.endsWith('/beststories.json')) return bestIds.promise
      if (url.endsWith('/item/1.json')) return Promise.resolve({ id: 1, title: 'Top Story', time: 1 })
      if (url.endsWith('/item/2.json')) return bestItem.promise
      return Promise.reject(new Error(`unexpected URL: ${url}`))
    })

    wrapper = mountReader()
    await flushPromises()
    expect(wrapper.find('.row').text()).toContain('Top Story')

    window.history.replaceState({}, '', '/apps/hn-reader?tab=best')
    window.dispatchEvent(new Event('popstate'))
    await flushPromises()

    expect(wrapper.find('.row').exists()).toBe(false)
    expect(wrapper.find('.end-msg').exists()).toBe(false)
    expect(wrapper.get('[role=tabpanel]').attributes('aria-labelledby')).toBe('ui-tab-best')
    expect(wrapper.find('.ui-loading').exists()).toBe(true)

    bestIds.resolve([2])
    await flushPromises()
    bestItem.resolve({ id: 2, title: 'Best Story', time: 1 })
    await flushPromises()

    expect(wrapper.find('.row').text()).toContain('Best Story')
    expect(wrapper.find('.row').text()).not.toContain('Top Story')
  })

  test('does not show the end message until the final page is loaded', async () => {
    fetchJSON.mockImplementation((url) => {
      if (url.endsWith('/topstories.json')) {
        return Promise.resolve(Array.from({ length: 21 }, (_, index) => index + 1))
      }
      const id = Number(/\/item\/(\d+)\.json$/.exec(url)?.[1])
      return Promise.resolve({ id, title: `Story ${id}`, time: 1 })
    })

    wrapper = mountReader()
    await flushPromises()
    expect(wrapper.findAll('.row')).toHaveLength(20)
    expect(wrapper.find('.end-msg').exists()).toBe(false)

    globalThis.__triggerIntersection()
    await flushPromises()
    expect(wrapper.findAll('.row')).toHaveLength(21)
    expect(wrapper.find('.end-msg').exists()).toBe(true)
  })

  test('same-tick popstate round trips invalidate requests before Vue batches updates', async () => {
    const oldTop = deferred()
    const best = deferred()
    const freshTop = deferred()
    fetchJSON
      .mockReturnValueOnce(oldTop.promise)
      .mockReturnValueOnce(best.promise)
      .mockReturnValueOnce(freshTop.promise)
    wrapper = mountReader()

    for (const query of ['?tab=best', '']) {
      window.history.replaceState({}, '', '/apps/hn-reader' + query)
      window.dispatchEvent(new Event('popstate'))
    }
    expect(fetchJSON).toHaveBeenCalledTimes(3)
    oldTop.reject(new Error('stale Top'))
    best.reject(new Error('stale Best'))
    await flushPromises()
    expect(wrapper.find('.ui-loading').exists()).toBe(true)
    expect(wrapper.find('.ui-error').exists()).toBe(false)
    freshTop.resolve([])
    await flushPromises()
    expect(wrapper.find('.ui-loading').exists()).toBe(false)
    expect(wrapper.find('.ui-empty').exists()).toBe(true)
    expect(wrapper.find('.end-msg').exists()).toBe(false)
  })

  test('a late old Top ID list cannot poison the current pagination cache', async () => {
    const oldTop = deferred()
    let topCalls = 0
    fetchJSON.mockImplementation((url) => {
      if (url.endsWith('/topstories.json')) {
        return ++topCalls === 1 ? oldTop.promise : Promise.resolve(Array.from({ length: 21 }, (_, i) => i + 1))
      }
      if (url.endsWith('/beststories.json')) return Promise.resolve([])
      const id = Number(/\/item\/(\d+)\.json$/.exec(url)?.[1])
      return Promise.resolve({ id, title: `Fresh ${id}` })
    })
    wrapper = mountReader()
    await wrapper.get('#ui-tab-best').trigger('click')
    await wrapper.get('#ui-tab-top').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.row')).toHaveLength(20)
    oldTop.resolve([100])
    await flushPromises()
    globalThis.__triggerIntersection()
    await flushPromises()
    expect(wrapper.findAll('.row')).toHaveLength(21)
    expect(wrapper.findAll('.row').at(-1).text()).toContain('Fresh 21')
  })

  test('stale item workers stop after a tab switch without clearing the new loading', async () => {
    const oldItems = deferred()
    const best = deferred()
    fetchJSON.mockImplementation((url) => {
      if (url.endsWith('/topstories.json')) return Promise.resolve(Array.from({ length: 20 }, (_, i) => i + 1))
      if (url.endsWith('/beststories.json')) return best.promise
      return oldItems.promise
    })
    wrapper = mountReader()
    await flushPromises()
    expect(fetchJSON).toHaveBeenCalledTimes(9)
    await wrapper.get('#ui-tab-best').trigger('click')
    oldItems.resolve({ id: 1, title: 'Stale item' })
    await flushPromises()
    expect(fetchJSON).toHaveBeenCalledTimes(10)
    expect(wrapper.find('.row').exists()).toBe(false)
    expect(wrapper.find('.ui-loading').exists()).toBe(true)
    best.resolve([])
    await flushPromises()
  })

  test.each(['ids', 'items'])('unmount during %s stops workers, observers and URL/scroll listeners', async (stage) => {
    let notify
    const disconnect = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback) {
          notify = callback
        }
        observe() {}
        disconnect() {
          disconnect()
        }
      },
    )
    const pending = deferred()
    const ids = Array.from({ length: 20 }, (_, i) => i + 1)
    fetchJSON.mockImplementation((url) => {
      if (url.endsWith('/topstories.json') && stage === 'items') return Promise.resolve(ids)
      return pending.promise
    })
    wrapper = mountReader()
    await flushPromises()
    const callCount = fetchJSON.mock.calls.length
    wrapper.unmount()
    wrapper = null
    expect(disconnect).toHaveBeenCalledOnce()
    pending.resolve(stage === 'ids' ? ids : { id: 1, title: 'Detached' })
    await flushPromises()
    notify([{ isIntersecting: true }])
    window.history.replaceState({}, '', '/apps/hn-reader?tab=best')
    window.dispatchEvent(new Event('popstate'))
    window.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(fetchJSON).toHaveBeenCalledTimes(callCount)
  })

  test('HTTP(S) story and text links remain usable while unsafe protocols stay inert', async () => {
    fetchJSON.mockImplementation((url) => {
      if (url.endsWith('/topstories.json')) return Promise.resolve([1, 2])
      if (url.endsWith('/item/1.json'))
        return Promise.resolve({ id: 1, title: 'Safe', url: 'https://example.com/story' })
      return Promise.resolve({
        id: 2,
        title: 'Text',
        url: 'data:text/html,unsafe',
        text: '<p><a href="https://example.com/?a=1&b=2">safe</a> <a href="javascript:alert(1)">unsafe</a><img src=x onerror=alert(1)></p>',
      })
    })
    wrapper = mountReader()
    await flushPromises()
    expect(wrapper.get('a.title').attributes('href')).toBe('https://example.com/story')
    await wrapper.get('.title-toggle').trigger('click')
    expect(wrapper.get('.title-toggle').attributes('aria-expanded')).toBe('true')
    const content = wrapper.get('.content')
    expect(content.findAll('a')).toHaveLength(1)
    expect(content.get('a').attributes()).toMatchObject({
      href: 'https://example.com/?a=1&b=2',
      rel: 'noreferrer noopener',
    })
    expect(content.find('img').exists()).toBe(false)
  })
})
