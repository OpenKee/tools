import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import RepoDeepDive from '../src/views/RepoDeepDive.vue'
import RepoScope from '../src/views/RepoScope.vue'
import { githubAPI } from '../src/ok.js'

vi.mock('../src/ok.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, githubAPI: vi.fn() }
})
vi.mock('../src/views/RepoLens.vue', () => ({ default: { template: '<div />' } }))

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

let wrapper

beforeEach(() => {
  localStorage.clear()
  githubAPI.mockReset()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.history.replaceState({}, '', '/')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  window.history.replaceState({}, '', '/')
})

describe('RepoScope details', () => {
  test('uses native buttons and only applies the latest detail response', async () => {
    const firstDetail = deferred()
    const secondDetail = deferred()
    const repos = [
      {
        id: 1,
        name: 'alpha',
        full_name: 'octocat/alpha',
        fork: false,
        stargazers_count: 2,
        forks_count: 1,
        pushed_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: 2,
        name: 'beta',
        full_name: 'octocat/beta',
        fork: false,
        stargazers_count: 1,
        forks_count: 1,
        pushed_at: '2026-01-02',
        updated_at: '2026-01-02',
      },
    ]
    githubAPI.mockImplementation((url) => {
      if (url === 'https://api.github.com/users/octocat') {
        return Promise.resolve({ login: 'octocat', html_url: 'https://github.com/octocat', created_at: '2020-01-01' })
      }
      if (url === 'https://api.github.com/users/octocat/repos?per_page=100&sort=updated') {
        return Promise.resolve(repos)
      }
      if (url.endsWith('/repos/octocat/alpha')) return firstDetail.promise
      if (url.endsWith('/repos/octocat/beta')) return secondDetail.promise
      return Promise.reject(new Error(`unexpected URL: ${url}`))
    })

    window.history.replaceState({}, '', '/apps/repo-scope#octocat')
    wrapper = mount(RepoScope, { attachTo: document.body })
    await flushPromises()

    const cards = wrapper.findAll('button.repo-card')
    expect(cards).toHaveLength(2)

    cards.forEach((card) => {
      expect(card.attributes('type')).toBe('button')
      expect(card.element.tabIndex).toBe(0)
      expect(card.element.disabled).toBe(false)
    })
    cards[0].element.focus()
    expect(document.activeElement).toBe(cards[0].element)

    await cards[0].trigger('click')
    await cards[1].trigger('click')
    expect(wrapper.get('.detail-section').text()).toContain('octocat/beta')

    firstDetail.resolve({ full_name: 'octocat/alpha' })
    await flushPromises()
    expect(wrapper.get('.detail-section').text()).toContain('octocat/beta')
    expect(wrapper.get('.detail-section').text()).not.toContain('octocat/alpha')
    expect(wrapper.find('.detail-section .ui-loading').exists()).toBe(true)

    secondDetail.resolve({
      full_name: 'octocat/beta',
      html_url: 'javascript:alert(1)',
      homepage: 'javascript:alert(1)',
      created_at: '2020-01-01',
      pushed_at: '2026-01-01',
    })
    await flushPromises()

    expect(wrapper.find('.detail-section .ui-loading').exists()).toBe(false)
    expect(wrapper.find('.detail-section a').exists()).toBe(false)
    expect(wrapper.get('.detail-section').text()).toContain('javascript:alert(1)')
  })

  test('closing and reopening the same detail ignores an old rejection and finally', async () => {
    const old = deferred()
    const fresh = deferred()
    githubAPI
      .mockResolvedValueOnce({ login: 'octocat' })
      .mockResolvedValueOnce([{ id: 1, name: 'alpha', full_name: 'octocat/alpha' }])
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise)
    window.history.replaceState({}, '', '/apps/repo-scope#octocat')
    wrapper = mount(RepoScope)
    await flushPromises()
    await wrapper.get('button.repo-card').trigger('click')
    await wrapper.get('button[aria-label="Close"]').trigger('click')
    expect(wrapper.find('.detail-section').exists()).toBe(false)
    await wrapper.get('button.repo-card').trigger('click')
    old.reject(new Error('stale detail'))
    await flushPromises()
    expect(wrapper.find('.detail-section .ui-loading').exists()).toBe(true)
    expect(wrapper.find('.detail-section .ui-error').exists()).toBe(false)
    fresh.resolve({
      full_name: 'octocat/alpha',
      html_url: 'https://github.com/octocat/alpha',
      homepage: 'http://example.com/',
    })
    await flushPromises()
    expect(wrapper.find('.detail-section .ui-loading').exists()).toBe(false)
    expect(wrapper.findAll('.detail-section a').map((a) => a.attributes('href'))).toEqual([
      'http://example.com/',
      'https://github.com/octocat/alpha',
    ])
  })

  test.each(['new user', 'unmount'])('%s invalidates pending details', async (action) => {
    const pending = deferred()
    githubAPI
      .mockResolvedValueOnce({ login: 'octocat' })
      .mockResolvedValueOnce([{ id: 1, name: 'alpha', full_name: 'octocat/alpha' }])
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce({ login: 'other' })
      .mockResolvedValueOnce([])
    window.history.replaceState({}, '', '/apps/repo-scope#octocat')
    wrapper = mount(RepoScope)
    await flushPromises()
    await wrapper.get('button.repo-card').trigger('click')
    const state = wrapper.vm.$.setupState
    if (action === 'unmount') {
      wrapper.unmount()
      wrapper = null
    } else {
      await wrapper.get('input[aria-label="GitHub username"]').setValue('other')
      await wrapper.get('form').trigger('submit')
    }
    pending.resolve({ full_name: 'octocat/alpha' })
    await flushPromises()
    expect(state.detail).toBeNull()
    if (wrapper) {
      expect(wrapper.find('.detail-section').exists()).toBe(false)
      expect(wrapper.get('.profile-section').text()).toContain('other')
    }
  })

  test.each([
    ['javascript:alert(1)', 'data:image/svg+xml,unsafe', false],
    ['example.com/blog', 'https://example.com/avatar.png', true],
  ])('profile URLs are validated: %s', async (blog, avatar, safe) => {
    githubAPI
      .mockResolvedValueOnce({
        login: 'octocat',
        blog,
        avatar_url: avatar,
        html_url: safe ? 'https://github.com/octocat' : blog,
      })
      .mockResolvedValueOnce([])
    window.history.replaceState({}, '', '/apps/repo-scope#octocat')
    wrapper = mount(RepoScope)
    await flushPromises()
    expect(wrapper.find('.avatar').exists()).toBe(safe)
    expect(wrapper.find('.profile-link').exists()).toBe(safe)
    expect(wrapper.find('.profile-meta a').exists()).toBe(safe)
    if (safe) expect(wrapper.get('.profile-meta a').attributes('href')).toBe('https://example.com/blog')
    else expect(wrapper.get('.profile-meta').text()).toContain(blog)
  })
})

describe('RepoDeepDive external URLs', () => {
  test.each([false, true])('validates overview, homepage, contributor links and avatars (safe=%s)', async (safe) => {
    const url = safe ? 'https://example.com/' : 'javascript:alert(1)'
    githubAPI.mockImplementation((endpoint) => {
      if (endpoint.endsWith('/languages')) return Promise.resolve({})
      if (endpoint.endsWith('/stats/participation')) return Promise.resolve({ all: [] })
      if (endpoint.includes('/contributors?'))
        return Promise.resolve([
          { id: 1, login: 'author', html_url: url, avatar_url: url, contributions: 2 },
          { id: 2, login: 'fallback/name', contributions: 1 },
        ])
      return Promise.resolve({ full_name: 'owner/repo', html_url: url, homepage: url })
    })
    window.history.replaceState({}, '', '/apps/repo-deep-dive#owner%2Frepo')
    wrapper = mount(RepoDeepDive)
    await flushPromises()
    expect(wrapper.get('.overview-head').text()).toContain('owner/repo')
    expect(wrapper.findAll('.card-overview a')).toHaveLength(safe ? 3 : 0)
    const cards = wrapper.findAll('.contrib-card')
    expect(cards[0].element.tagName).toBe(safe ? 'A' : 'DIV')
    expect(cards[0].find('img').exists()).toBe(safe)
    expect(cards[1].attributes('href')).toBe('https://github.com/fallback%2Fname')
    for (const a of wrapper.findAll('a')) expect(a.attributes('href')).toMatch(/^https?:\/\//)
  })
})
