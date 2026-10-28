import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CryptoPulse from '../src/views/CryptoPulse.vue'
import RateBoard from '../src/views/RateBoard.vue'
import UiDialog from '../src/components/ui/UiDialog.vue'
import { cryptoMarkets, locale } from '../src/ok.js'
import { getUsdRates } from '../src/lib/markets.js'
import { i18nState } from '../src/i18n.js'

vi.mock('../src/ok.js', async (importOriginal) => ({
  ...(await importOriginal()),
  cryptoMarkets: vi.fn(),
}))
vi.mock('../src/lib/markets.js', () => ({ getUsdRates: vi.fn() }))

const NOW = Date.UTC(2026, 9, 10, 12)
const KEY = 'crypto-pulse-markets'
const coins = [{ id: 'bitcoin', name: 'Bitcoin', symbol: 'btc', current_price: 100, market_cap_rank: 1 }]
const rates = {
  result: 'success',
  rates: { USD: 1, CNY: 7, EUR: 0.9 },
  time_last_update_utc: new Date(NOW).toUTCString(),
}
let wrapper
let hidden

function mountView(component) {
  wrapper = mount(component, {
    attachTo: document.body,
    global: { stubs: { AppHeader: true, AppFooter: true } },
  })
  return flushPromises()
}

beforeEach(() => {
  localStorage.clear()
  i18nState.lang = 'en'
  window.history.replaceState({}, '', '/')
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  cryptoMarkets.mockReset().mockResolvedValue(coins)
  getUsdRates.mockReset().mockResolvedValue(rates)
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected network request')))
})

afterEach(async () => {
  wrapper?.unmount()
  wrapper = null
  await flushPromises()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  window.history.replaceState({}, '', '/')
})

describe('Crypto cache and refresh', () => {
  test('shows the real cache timestamp and never renews it on a cache hit', async () => {
    const ts = NOW - 45000
    localStorage.setItem(KEY, JSON.stringify({ ts, data: coins }))
    await mountView(CryptoPulse)
    expect(cryptoMarkets).not.toHaveBeenCalled()
    expect(wrapper.get('.update-time').text()).toContain(new Date(ts).toLocaleTimeString(locale()))
    expect(JSON.parse(localStorage.getItem(KEY)).ts).toBe(ts)
  })

  test.each([NOW - 60000, NOW + 1, 'invalid', String(NOW), null])(
    'rejects stale or invalid timestamp %s',
    async (ts) => {
      localStorage.setItem(KEY, JSON.stringify({ ts, data: coins }))
      await mountView(CryptoPulse)
      expect(cryptoMarkets).toHaveBeenCalledTimes(1)
      expect(JSON.parse(localStorage.getItem(KEY)).ts).toBe(NOW)
    },
  )

  test('rejects malformed cached market data', async () => {
    localStorage.setItem(KEY, JSON.stringify({ ts: NOW, data: {} }))
    await mountView(CryptoPulse)
    expect(cryptoMarkets).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('.trow')).toHaveLength(1)
  })

  test('keeps timestamp and displays a stale warning after refresh failure, then clears it on success', async () => {
    const ts = NOW - 40000
    localStorage.setItem(KEY, JSON.stringify({ ts, data: coins }))
    await mountView(CryptoPulse)
    cryptoMarkets.mockRejectedValueOnce(new Error('offline'))
    await wrapper.get('.refresh-btn').trigger('click')
    await flushPromises()
    expect(wrapper.get('.stale-warning').text()).toContain('Refresh failed')
    expect(wrapper.get('.trow').text()).toContain('Bitcoin')
    expect(wrapper.get('.update-time').text()).toContain(new Date(ts).toLocaleTimeString(locale()))
    expect(JSON.parse(localStorage.getItem(KEY)).ts).toBe(ts)

    cryptoMarkets.mockImplementationOnce(async () => {
      vi.setSystemTime(NOW + 5000)
      return coins
    })
    await wrapper.get('.refresh-btn').trigger('click')
    await flushPromises()
    expect(wrapper.find('.stale-warning').exists()).toBe(false)
    expect(JSON.parse(localStorage.getItem(KEY)).ts).toBe(NOW + 5000)
  })

  test('does not poll hidden pages and resumes on visibilitychange; unmount removes polling', async () => {
    await mountView(CryptoPulse)
    cryptoMarkets.mockClear()
    hidden.mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(180000)
    expect(cryptoMarkets).not.toHaveBeenCalled()
    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(cryptoMarkets).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    wrapper = null
    await vi.advanceTimersByTimeAsync(60000)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(cryptoMarkets).toHaveBeenCalledTimes(1)
  })

  test.each(['Enter', ' '])('favorites remain keyboard reachable and %s never opens row details', async (key) => {
    localStorage.setItem('crypto-pulse-favorites', JSON.stringify(['bitcoin']))
    await mountView(CryptoPulse)
    const star = wrapper.get('button.star-btn')
    expect(star.element.tabIndex).toBe(0)
    expect(star.attributes('aria-pressed')).toBe('true')
    star.element.focus()
    expect(document.activeElement).toBe(star.element)
    await star.trigger('keydown', { key })
    await star.trigger('keyup', { key })

    await star.trigger('click')
    expect(star.attributes('aria-pressed')).toBe('false')
    expect(JSON.parse(localStorage.getItem('crypto-pulse-favorites'))).toEqual([])
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(wrapper.findComponent(UiDialog).props('open')).toBe(false)
    await wrapper.get('.trow').trigger('keydown', { key })
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  })
})

describe('Rate Board refresh and accessibility', () => {
  test('uses cache on initial load and explicit force:true on manual refresh and retry', async () => {
    await mountView(RateBoard)
    expect(getUsdRates).toHaveBeenNthCalledWith(1, { force: false })
    getUsdRates.mockRejectedValueOnce(new Error('offline'))
    await wrapper.get('button[aria-label="Refresh"]').trigger('click')
    await flushPromises()
    expect(getUsdRates).toHaveBeenNthCalledWith(2, { force: true })
    await wrapper.get('.inline-alert button').trigger('click')
    await flushPromises()
    expect(getUsdRates).toHaveBeenNthCalledWith(3, { force: true })
  })

  test('has four clear associated bilingual labels and a readonly conversion result', async () => {
    await mountView(RateBoard)
    const ids = ['rate-from-currency', 'rate-from-amount', 'rate-to-currency', 'rate-result']
    const en = ['Source currency', 'Source amount', 'Target currency', 'Conversion result']
    const zh = ['源币种', '源金额', '目标币种', '换算结果']
    for (let i = 0; i < ids.length; i++) {
      expect(wrapper.get(`label[for="${ids[i]}"]`).text()).toBe(en[i])
      expect(wrapper.get(`#${ids[i]}`).element.labels[0].textContent).toBe(en[i])
    }
    expect(wrapper.get('#rate-result').element.readOnly).toBe(true)
    expect(wrapper.get('#rate-result').element.value).toBe('7000.00')
    i18nState.lang = 'zh'
    await nextTick()
    ids.forEach((id, i) => expect(wrapper.get(`label[for="${id}"]`).text()).toBe(zh[i]))
  })

  test('tabs control a focusable panel labelled by the active tab', async () => {
    await mountView(RateBoard)
    const panel = wrapper.get('[role="tabpanel"]')
    for (const tab of wrapper.findAll('[role="tab"]')) {
      expect(tab.attributes('aria-controls')).toBe(panel.attributes('id'))
    }
    expect(panel.attributes('tabindex')).toBe('0')
    expect(panel.attributes('aria-labelledby')).toBe('ui-tab-fx')
    await wrapper.get('#ui-tab-fx').trigger('keydown', { key: 'End' })
    await flushPromises()
    expect(panel.attributes('aria-labelledby')).toBe('ui-tab-asset')
    expect(wrapper.get('#ui-tab-asset').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('#ui-tab-fx').attributes('tabindex')).toBe('-1')
  })
})
