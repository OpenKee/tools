import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import HourBridge from '../src/views/HourBridge.vue'
import { geocode } from '../src/ok.js'

vi.mock('../src/ok.js', async (importOriginal) => ({
  ...(await importOriginal()),
  geocode: vi.fn(),
}))

let wrapper = null
let zoneMap = {}

async function mountBridge(zones) {
  zoneMap = zones
  wrapper = mount(HourBridge)
  await flushPromises()
  return wrapper
}

function bestRow(hour) {
  const label = `UTC ${String(hour).padStart(2, '0')}:00`
  return wrapper.findAll('.best-row').find((row) => row.get('.best-time').text() === label)
}

function score(hour) {
  const row = bestRow(hour)
  expect(row, `missing recommendation for UTC ${hour}`).toBeDefined()
  return Number.parseInt(row.get('.best-score').text(), 10)
}

async function setDuration(label) {
  const button = wrapper.findAll('.ui-segmented-item').find((item) => item.text() === label)
  await button.trigger('click')
  await nextTick()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  vi.mocked(geocode).mockImplementation(async (name) => [{ name, timezone: zoneMap[name] || 'UTC', lat: 0, lon: 0 }])
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('HourBridge full-duration recommendations', () => {
  test('supports all durations and includes every city end time', async () => {
    await mountBridge({ Shanghai: 'UTC', London: 'UTC', 'New York': 'UTC' })

    for (const [label, end] of [
      ['30m', '09:30'],
      ['1h', '10:00'],
      ['1.5h', '10:30'],
      ['2h', '11:00'],
    ]) {
      await setDuration(label)
      const row = bestRow(9)
      expect(row).toBeDefined()
      const details = row.get('.best-detail').text()
      expect(details).toContain(`Shanghai 09:00–${end}`)
      expect(details).toContain(`London 09:00–${end}`)
      expect(details).toContain(`New York 09:00–${end}`)
    }
  })

  test('scores later hours instead of giving equal scores to equal start-hour statuses', async () => {
    await mountBridge({ Shanghai: 'UTC', London: 'America/New_York', 'New York': 'America/New_York' })
    await setDuration('2h')

    expect(score(17)).toBeGreaterThan(score(18))
    expect(bestRow(18).get('.best-detail').text()).toContain('Shanghai 18:00–20:00')
    expect(bestRow(18).get('.best-detail').text()).toContain('London 14:00–16:00')
  })

  test('penalizes a meeting whose ending enters night and still shows the end range', async () => {
    await mountBridge({ Shanghai: 'UTC', London: 'Etc/GMT-12', 'New York': 'Etc/GMT-12' })
    await setDuration('2h')

    expect(score(20)).toBeGreaterThan(score(21))
    const details = bestRow(21).get('.best-detail').text()
    expect(details).toContain('Shanghai 21:00–23:00')
    expect(details).toContain('London 09:00–11:00')
  })
})

describe('HourBridge KeepAlive clock lifecycle', () => {
  test('stops while deactivated and resumes without duplicate intervals', async () => {
    const Host = defineComponent({
      components: { HourBridge },
      data: () => ({ active: true }),
      template: '<KeepAlive><HourBridge v-if="active" /></KeepAlive>',
    })
    wrapper = mount(Host)
    await flushPromises()
    expect(vi.getTimerCount()).toBe(1)

    wrapper.vm.active = false
    await nextTick()
    expect(vi.getTimerCount()).toBe(0)

    wrapper.vm.active = true
    await nextTick()
    expect(vi.getTimerCount()).toBe(1)

    wrapper.unmount()
    wrapper = null
    expect(vi.getTimerCount()).toBe(0)
  })
})
