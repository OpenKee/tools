import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MemeForge from '../src/views/MemeForge.vue'
import { i18nState } from '../src/i18n.js'

vi.mock('../src/ok.js', async (original) => ({
  ...(await original()),
  fetchJSON: vi.fn(async () => ({ url: 'https://example.com/image.png', title: 'Test meme', preview: [] })),
}))

let wrapper
let clipboard

beforeEach(() => {
  i18nState.lang = 'en'
  clipboard = { writeText: vi.fn() }
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard })
})

afterEach(() => {
  wrapper?.unmount()
  delete navigator.clipboard
  vi.restoreAllMocks()
})

test('reports clipboard success', async () => {
  clipboard.writeText.mockResolvedValue()
  wrapper = mount(MemeForge, { global: { stubs: { UiPage: { template: '<main><slot /></main>' } } } })
  await flushPromises()
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Copy link')
    .trigger('click')
  await flushPromises()
  expect(clipboard.writeText).toHaveBeenCalledWith('https://example.com/image.png')
  expect(wrapper.text()).toContain('Copied!')
})

test('reports clipboard failure', async () => {
  clipboard.writeText.mockRejectedValue(new Error('denied'))
  wrapper = mount(MemeForge, { global: { stubs: { UiPage: { template: '<main><slot /></main>' } } } })
  await flushPromises()
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Copy link')
    .trigger('click')
  await flushPromises()
  expect(wrapper.find('[role=alert]').text()).toContain('Copy failed')
})
