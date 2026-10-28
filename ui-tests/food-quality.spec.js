import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, KeepAlive, ref } from 'vue'
import FoodAtlas from '../src/views/FoodAtlas.vue'
import UiDialog from '../src/components/ui/UiDialog.vue'
import { fetchJSON } from '../src/ok.js'

vi.mock('../src/ok.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchJSON: vi.fn(),
}))

const meal = { idMeal: '1', strMeal: 'Test meal', strInstructions: 'Cook' }
const drink = { idDrink: '2', strDrink: 'Test drink', strInstructions: 'Mix' }
const cases = [
  { tab: 'recipes', other: 'drinks', card: '.recipe-card', data: { meals: [meal] } },
  { tab: 'drinks', other: 'recipes', card: '.drink-card', data: { drinks: [drink] } },
]
let wrapper

function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function mountFood(tab, component = FoodAtlas) {
  window.history.replaceState({}, '', `/apps/food-atlas?tab=${tab}`)
  wrapper = mount(component, {
    attachTo: document.body,
    global: { stubs: { AppHeader: true, AppFooter: true } },
  })
  return flushPromises()
}

async function switchTab(tab) {
  await wrapper.get(`#ui-tab-${tab}`).trigger('click')
  await flushPromises()
}

async function expectClosed() {
  await vi.waitFor(() => {
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.querySelector('.ui-dialog-overlay')).toBeNull()
    expect(document.body.style.overflow).toBe('auto')
    expect(document.body.style.pointerEvents).not.toBe('none')
  })
}

beforeEach(() => {
  localStorage.clear()
  document.body.style.overflow = 'auto'
  fetchJSON.mockReset().mockImplementation(async (url) => {
    if (url.includes('list.php')) return url.includes('themealdb') ? { meals: [] } : { drinks: [] }
    return url.includes('themealdb') ? { meals: [meal] } : { drinks: [drink] }
  })
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected network request')))
})

afterEach(async () => {
  wrapper?.unmount()
  wrapper = null
  await flushPromises()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  document.body.style.overflow = ''
  window.history.replaceState({}, '', '/')
})

describe.each(cases)('Food KeepAlive: $tab', ({ tab, other, card, data }) => {
  test('closes the real teleported Dialog and restores scrolling without reopening on activation', async () => {
    await mountFood(tab)
    await wrapper.get(card).trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(UiDialog).props('open')).toBe(true)
    await vi.waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeNull()
      expect(document.body.style.overflow).toBe('hidden')
    })

    expect(wrapper.element.querySelector('[role="dialog"]')).toBeNull()
    await switchTab(other)
    await expectClosed()
    await switchTab(tab)
    await expectClosed()
    expect(wrapper.find(card).exists()).toBe(true)
  })

  test.each(['lookup', 'random'])('ignores late %s responses while inactive and after reactivation', async (kind) => {
    await mountFood(tab)
    const pending = deferred()
    fetchJSON.mockImplementation((url) => {
      if (url.includes(`/${kind}.php`)) return pending.promise
      return Promise.resolve(url.includes('themealdb') ? { meals: [meal] } : { drinks: [drink] })
    })
    if (kind === 'lookup') await wrapper.get(card).trigger('click')
    else await wrapper.get('.ui-search button.ui-btn--secondary').trigger('click')
    await switchTab(other)

    await switchTab(tab)
    pending.resolve(data)
    await flushPromises()
    await expectClosed()

    const inactive = deferred()
    fetchJSON.mockReturnValue(inactive.promise)
    await wrapper.get(card).trigger('click')
    await switchTab(other)
    inactive.resolve(data)
    await flushPromises()
    await expectClosed()
    await switchTab(tab)
    await expectClosed()
  })

  test('also closes when the entire Food page is deactivated', async () => {
    const shown = ref(true)
    const host = defineComponent({
      setup: () => () => h(KeepAlive, null, { default: () => (shown.value ? h(FoodAtlas) : h('div', 'Other page')) }),
    })
    await mountFood(tab, host)
    await wrapper.get(card).trigger('click')
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    shown.value = false
    await flushPromises()
    await expectClosed()
    shown.value = true
    await flushPromises()
    await expectClosed()
  })
})

test('tabs and the active panel have reciprocal ARIA references and keyboard navigation', async () => {
  await mountFood('recipes')
  const panel = wrapper.get('[role="tabpanel"]')
  expect(panel.attributes('tabindex')).toBe('0')
  expect(panel.attributes('aria-labelledby')).toBe('ui-tab-recipes')
  for (const tab of wrapper.findAll('[role="tab"]')) {
    expect(tab.attributes('aria-controls')).toBe(panel.attributes('id'))
  }
  await wrapper.get('#ui-tab-recipes').trigger('keydown', { key: 'ArrowRight' })
  await flushPromises()
  expect(panel.attributes('aria-labelledby')).toBe('ui-tab-drinks')
  expect(wrapper.get('#ui-tab-drinks').attributes('aria-selected')).toBe('true')
})
