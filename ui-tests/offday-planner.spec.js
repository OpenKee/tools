import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import OffdayPlanner from '../src/views/OffdayPlanner.vue'
import { fetchJSON } from '../src/ok.js'
import { i18nState } from '../src/i18n.js'
import { nextTick } from 'vue'

vi.mock('../src/ok.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchJSON: vi.fn(),
}))

const CN_HOLIDAYS = [
  { date: '2026-02-17', localName: '春节', name: 'Chinese New Year (Spring Festival)' },
  { date: '2026-01-01', localName: '元旦', name: "New Year's Day" },
]
const US_HOLIDAYS = [{ date: '2026-11-26', localName: 'Thanksgiving Day', name: 'Thanksgiving Day' }]

let wrapper = null

async function mountPlanner() {
  wrapper = mount(OffdayPlanner)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  i18nState.lang = 'en'
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  vi.mocked(fetchJSON).mockImplementation(async (url) => {
    if (url.includes('/CN')) return CN_HOLIDAYS
    if (url.includes('/US')) return US_HOLIDAYS
    return []
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('OffdayPlanner data honesty', () => {
  test('uses only API dates and disables unsupported Chinese leave optimization', async () => {
    await mountPlanner()

    const holidays = wrapper.findAll('.cal-day.holiday')
    expect(holidays).toHaveLength(2)
    expect(holidays.map((day) => day.attributes('title')).sort()).toEqual([
      'Chinese New Year (Spring Festival)',
      "New Year's Day",
    ])
    expect(wrapper.findAll('.holiday-row')).toHaveLength(2)
    expect(wrapper.findAll('.holiday-badge').map((badge) => badge.text())).toEqual(['1d', '1d'])

    const stats = wrapper.findAll('.summary-grid .ui-stat')
    expect(stats[0].text()).toContain('2')
    expect(stats[0].text()).toContain('API-reported holiday dates')
    expect(stats[1].text()).toContain('—')
    expect(stats[1].text()).toContain('Official adjusted workdays unavailable')
    expect(wrapper.find('.optimizer-section').text()).toContain(
      'not the complete official annual adjusted-workday schedule',
    )
    expect(wrapper.findAll('.optimize-card')).toHaveLength(0)

    i18nState.lang = 'zh'
    await nextTick()
    expect(wrapper.find('.optimizer-section').text()).toContain('没有完整的官方年度调休数据')
    expect(wrapper.find('.optimizer-section').text()).toContain('不生成连休或请假建议')
  })

  test('does not request leave on an existing public holiday or merge non-adjacent dates', async () => {
    vi.mocked(fetchJSON).mockResolvedValue([
      { date: '2026-11-26', name: 'Holiday', localName: 'Holiday' },
      { date: '2026-11-27', name: 'Holiday', localName: 'Holiday' },
      { date: '2026-12-25', name: 'Holiday', localName: 'Holiday' },
    ])
    await mountPlanner()
    await wrapper.findAll('select')[0].setValue('US')
    await flushPromises()
    expect(wrapper.findAll('.optimize-card')).toHaveLength(0)
    expect(wrapper.findAll('.holiday-row')).toHaveLength(2)
  })

  test('labels retained recommendations as a Monday-Friday heuristic', async () => {
    await mountPlanner()
    await wrapper.findAll('select')[0].setValue('US')
    await flushPromises()

    expect(wrapper.find('.optimizer-section').text()).toContain('standard Monday–Friday workweek')
    expect(wrapper.find('.optimizer-section').text()).toContain('does not include official adjusted workdays')
    expect(wrapper.findAll('.optimize-card')).toHaveLength(1)
    expect(wrapper.find('.opt-days').text()).toContain('11/27')
    expect(wrapper.find('.summary-grid').text()).toContain('Mon–Fri heuristic; not an official work schedule')
  })
})
