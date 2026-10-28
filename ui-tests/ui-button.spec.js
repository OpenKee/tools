import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import UiButton from '../src/components/ui/UiButton.vue'
import UiPage from '../src/components/ui/UiPage.vue'

describe('UiButton', () => {
  test('applies variant and size classes and forwards clicks', async () => {
    const wrapper = mount(UiButton, {
      props: { variant: 'primary', size: 'sm' },
      slots: { default: 'Go' },
    })
    expect(wrapper.classes()).toContain('ui-btn--primary')
    expect(wrapper.classes()).toContain('ui-btn--sm')
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  test('shows a busy state and exposes toggle state', () => {
    const wrapper = mount(UiButton, {
      props: { loading: true, toggle: true, active: true },
      slots: { default: 'Run' },
    })
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.ui-spinner').exists()).toBe(true)
  })
})

describe('UiPage', () => {
  test('provides the shared content width and page landmarks', () => {
    const wrapper = mount(UiPage, {
      props: { title: 'Demo', width: '900px' },
      slots: { default: '<p class="page-body">content</p>' },
      global: { stubs: { AppHeader: true, AppFooter: true } },
    })
    expect(wrapper.classes()).toContain('ui-page')
    expect(wrapper.get('main').find('.page-body').text()).toBe('content')
    expect(wrapper.attributes('style')).toContain('--ok-content-width: 900px')
  })

  test('embeds without page chrome or a nested main landmark', () => {
    const wrapper = mount(UiPage, {
      props: { embedded: true },
      slots: { default: '<p class="page-body">content</p>' },
      global: { stubs: { AppHeader: true, AppFooter: true } },
    })
    expect(wrapper.classes()).toContain('ui-page--embedded')
    expect(wrapper.find('main').exists()).toBe(false)
    expect(wrapper.find('.ui-page-main .page-body').text()).toBe('content')
  })
})
