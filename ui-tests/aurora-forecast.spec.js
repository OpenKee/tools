import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AuroraForecast from '../src/views/space/AuroraForecast.vue'
import { getAuroraOval, getKpForecast, getKpIndex } from '../src/lib/space-data.js'
import { i18nState } from '../src/i18n.js'
import { nextTick } from 'vue'

vi.mock('../src/lib/space-data.js', () => ({
  getKpIndex: vi.fn(),
  getKpForecast: vi.fn(),
  getAuroraOval: vi.fn(),
}))

vi.mock('../src/lib/charts.js', () => ({
  chartTheme: () => ({
    tooltipBg: '#fff',
    tooltipBorder: '#ccc',
    text: '#000',
    muted: '#666',
    line: '#ccc',
  }),
  Bar: { template: '<div class="forecast-bar" />' },
}))

vi.mock('../src/components/ui/index.js', async (original) => ({
  ...(await original()),
  UiTooltip: { props: ['label'], template: '<slot />' },
}))

const EMPTY_AURORA = { coordinates: [] }
const MEASURED = { time_tag: '2026-06-14 21:00:00', Kp: '4.00', station_count: 8 }
const FUTURE_IN_HISTORY = { time_tag: '2026-06-15 03:00:00', Kp: '8.00', station_count: 0 }

let wrapper = null

async function mountForecast() {
  wrapper = mount(AuroraForecast)
  await flushPromises()
  await nextTick()
  return wrapper
}

beforeEach(() => {
  i18nState.lang = 'en'
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-15T00:00:00Z'))
  vi.spyOn(globalThis.HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    setLineDash: vi.fn(),
    fillRect: vi.fn(),
  }))
  vi.mocked(getAuroraOval).mockResolvedValue(EMPTY_AURORA)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('AuroraForecast future-data handling', () => {
  test('does not turn simulated KP history into a forecast when the forecast API fails', async () => {
    vi.mocked(getKpIndex).mockRejectedValue(new Error('offline'))
    vi.mocked(getKpForecast).mockRejectedValue(new Error('offline'))
    await mountForecast()

    expect(wrapper.find('.fallback-banner').text()).toContain('showing sample data')
    expect(wrapper.find('.forecast-bar').exists()).toBe(false)
    expect(wrapper.find('.chart-empty').text()).toContain('Forecast unavailable')
    expect(wrapper.find('.chart-empty').text()).toContain('Historical or sample values are not shown as forecasts')
  })

  test('does not use future-looking rows from the current KP feed when no forecast is available', async () => {
    vi.mocked(getKpIndex).mockResolvedValue([MEASURED, FUTURE_IN_HISTORY])
    vi.mocked(getKpForecast).mockRejectedValue(new Error('offline'))
    await mountForecast()

    expect(wrapper.get('.kp-value').text()).toBe('4.0')
    expect(wrapper.find('.forecast-bar').exists()).toBe(false)
    expect(wrapper.find('.chart-empty').text()).toContain('Forecast unavailable')
  })

  test('treats a forecast response with only past rows as unavailable', async () => {
    vi.mocked(getKpIndex).mockResolvedValue([MEASURED])
    vi.mocked(getKpForecast).mockResolvedValue([MEASURED])
    await mountForecast()

    expect(wrapper.find('.forecast-bar').exists()).toBe(false)
    expect(wrapper.find('.chart-empty').text()).toContain('NOAA returned no future Kp data')

    i18nState.lang = 'zh'
    await nextTick()
    expect(wrapper.find('.chart-empty').text()).toContain('不会用历史或示例数值冒充预报')
  })

  test('renders only genuine future rows from the dedicated forecast feed', async () => {
    vi.mocked(getKpIndex).mockResolvedValue([MEASURED, FUTURE_IN_HISTORY])
    vi.mocked(getKpForecast).mockResolvedValue([MEASURED, { ...FUTURE_IN_HISTORY, Kp: '5.00' }])
    await mountForecast()

    expect(wrapper.find('.forecast-bar').exists()).toBe(true)
    expect(wrapper.find('.chart-empty').exists()).toBe(false)
  })
})
