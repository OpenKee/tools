import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import trendingSource from '../src/views/TrendingAtlas.vue?raw'
import TrendingAtlas from '../src/views/TrendingAtlas.vue'
import TechStackAdvisor from '../src/views/TechStackAdvisor.vue'
import UiSelect from '../src/components/ui/UiSelect.vue'
import { githubCachedAPI } from '../src/ok.js'
import { githubTokenPanelOpen } from '../src/lib/github-auth.js'

vi.mock('../src/ok.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, githubCachedAPI: vi.fn() }
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

function result(name, total = 200) {
  return { total_count: total, items: [{ id: name, full_name: name, html_url: 'https://github.com/' + name }] }
}

let wrapper

async function search(query) {
  await wrapper.get('input').setValue(query)
  await wrapper.get('form').trigger('submit')
}

beforeEach(() => {
  githubCachedAPI.mockReset()
  githubTokenPanelOpen.value = false
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('TrendingAtlas filters and pagination', () => {
  test.each(['resolve', 'reject'])('filter changes invalidate old pages and filters (%s)', async (settle) => {
    const page = deferred()
    const language = deferred()
    const latest = deferred()
    githubCachedAPI
      .mockResolvedValueOnce(result('initial'))
      .mockReturnValueOnce(page.promise)
      .mockReturnValueOnce(language.promise)
      .mockReturnValueOnce(latest.promise)
    wrapper = mount(TrendingAtlas)
    await flushPromises()
    expect(wrapper.findAll('.pagination button')).toHaveLength(9)
    await wrapper
      .findAll('.pagination button')
      .find((button) => button.text() === '2')
      .trigger('click')
    expect(new URL(githubCachedAPI.mock.calls[1][0]).searchParams.get('page')).toBe('2')

    wrapper.getComponent(UiSelect).vm.$emit('update:modelValue', 'JavaScript')
    await flushPromises()
    const languageUrl = new URL(githubCachedAPI.mock.calls[2][0])
    expect(languageUrl.searchParams.get('page')).toBe('1')
    expect(languageUrl.searchParams.get('q')).toContain('language:"JavaScript"')
    await wrapper.findAll('.ui-segmented-item')[2].trigger('click')
    expect(new URL(githubCachedAPI.mock.calls[3][0]).searchParams.get('page')).toBe('1')

    for (const old of [page, language]) {
      if (settle === 'resolve') old.resolve(result('stale', 999))
      else old.reject(new Error('rate_limit'))
      await flushPromises()
      expect(wrapper.find('.ui-loading').exists()).toBe(true)
      expect(wrapper.find('.repo-card').exists()).toBe(false)
      expect(wrapper.find('.ui-error').exists()).toBe(false)
      expect(githubTokenPanelOpen.value).toBe(false)
    }
    latest.resolve(result('fresh', 1))
    await flushPromises()
    expect(wrapper.get('.card-name').text()).toBe('fresh')
    expect(wrapper.get('.card-rank').text()).toBe('#1')
    expect(wrapper.find('.ui-loading').exists()).toBe(false)
    expect(wrapper.find('.pagination').exists()).toBe(false)
  })

  test('a slow earlier page cannot overwrite a newer page', async () => {
    const old = deferred()
    githubCachedAPI
      .mockResolvedValueOnce(result('initial'))
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(result('page-three'))
    wrapper = mount(TrendingAtlas)
    await flushPromises()
    for (const p of ['2', '3']) {
      await wrapper
        .findAll('.pagination button')
        .find((button) => button.text() === p)
        .trigger('click')
    }
    await flushPromises()
    expect(wrapper.get('.card-rank').text()).toBe('#49')
    old.resolve(result('stale-page-two'))
    await flushPromises()
    expect(wrapper.get('.card-name').text()).toBe('page-three')
    expect(wrapper.find('.ui-loading').exists()).toBe(false)
  })

  test('pagination CSS permits wrapping instead of overflowing narrow screens', () => {
    expect(trendingSource).toMatch(/\.pagination\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/)
  })
})

describe('TechStackAdvisor consecutive searches', () => {
  test('A → B → A keeps the latest loading and ignores stale success and error', async () => {
    const first = deferred()
    const second = deferred()
    const latest = deferred()
    githubCachedAPI
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(latest.promise)
    wrapper = mount(TechStackAdvisor)
    await search('react')
    expect(wrapper.get('input').element.disabled).toBe(false)
    await search('vue')
    await search('react')
    expect(githubCachedAPI).toHaveBeenCalledTimes(3)
    first.resolve(result('stale-react'))
    second.reject(new Error('rate_limit'))
    await flushPromises()
    expect(wrapper.find('.ui-loading').exists()).toBe(true)
    expect(wrapper.find('.ui-error').exists()).toBe(false)
    expect(wrapper.find('.repo-card').exists()).toBe(false)
    expect(githubTokenPanelOpen.value).toBe(false)
    latest.resolve(result('fresh-react'))
    await flushPromises()
    expect(wrapper.get('.repo-name').text()).toBe('fresh-react')
    expect(wrapper.find('.ui-loading').exists()).toBe(false)
  })

  test('an empty submission clears prior results and invalidates in-flight work', async () => {
    const old = deferred()
    githubCachedAPI.mockResolvedValueOnce(result('previous')).mockReturnValueOnce(old.promise)
    wrapper = mount(TechStackAdvisor)
    await search('previous')
    await flushPromises()
    expect(wrapper.find('.repo-card').exists()).toBe(true)
    await search('')
    expect(wrapper.find('.repo-card').exists()).toBe(false)
    await search('pending')
    await search('')
    old.resolve(result('obsolete'))
    await flushPromises()
    expect(githubCachedAPI).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.ui-loading').exists()).toBe(false)
    expect(wrapper.find('.repo-card').exists()).toBe(false)
    expect(wrapper.find('.start-state').exists()).toBe(true)
  })
})

test.each([
  { name: 'TrendingAtlas', component: TrendingAtlas },
  { name: 'TechStackAdvisor', component: TechStackAdvisor },
])('unmount prevents late errors and loading writes: $name', async ({ component }) => {
  const old = deferred()
  githubCachedAPI.mockReturnValueOnce(old.promise)
  wrapper = mount(component)
  if (component === TechStackAdvisor) await search('pending')
  const state = wrapper.vm.$.setupState
  expect(state.loading).toBe(true)
  wrapper.unmount()
  wrapper = null
  old.reject(new Error('rate_limit'))
  await flushPromises()
  expect(state.loading).toBe(true)
  expect(state.error).toBe(false)
  expect(githubTokenPanelOpen.value).toBe(false)
})
