import { afterEach, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import DevTools from '../src/views/DevTools.vue'

let wrapper

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

async function mountAt(url = '/apps/dev-tools') {
  window.history.replaceState({}, '', url)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: DevTools }],
  })
  await router.push(url)
  await router.isReady()
  wrapper = mount(DevTools, { attachTo: document.body, global: { plugins: [router] } })
}

test('Dev Tools exposes only the three retained applications and switches them through the URL', async () => {
  await mountAt()

  expect(wrapper.findAll('.dev-tabs .ui-tab').map((tab) => tab.text())).toEqual([
    'Markdown Studio',
    'QR Forge',
    'Password Vault',
  ])

  await wrapper.findAll('.dev-tabs .ui-tab')[1].trigger('click')
  await vi.dynamicImportSettled()
  await flushPromises()
  expect(new URLSearchParams(window.location.search).get('tool')).toBe('qr')
  expect(wrapper.find('h2').text()).toBe('QR Forge')

  await wrapper.findAll('.dev-tabs .ui-tab')[2].trigger('click')
  await vi.dynamicImportSettled()
  await flushPromises()
  expect(new URLSearchParams(window.location.search).get('tool')).toBe('password')
  expect(wrapper.find('h2').text()).toBe('Password Vault')
})

test('Dev Tools credits the API of the active tool only', async () => {
  await mountAt()
  const links = () => wrapper.findAll('.ok-footer-sources a').map((link) => [link.text(), link.attributes('href')])

  expect(links()).toEqual([['GitHub Markdown API', 'https://docs.github.com/en/rest/markdown']])

  await wrapper.findAll('.dev-tabs .ui-tab')[2].trigger('click')
  await vi.dynamicImportSettled()
  await flushPromises()
  expect(links()).toEqual([['Have I Been Pwned', 'https://haveibeenpwned.com/']])

  await wrapper.findAll('.dev-tabs .ui-tab')[1].trigger('click')
  await vi.dynamicImportSettled()
  await flushPromises()
  expect(links()).toEqual([])
})
