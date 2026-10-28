import { describe, expect, test } from 'vitest'
import { markRaw } from 'vue'
import { mount } from '@vue/test-utils'
import UiCard from '../src/components/ui/UiCard.vue'

const Icon = markRaw({ template: '<span class="test-icon" />' })

describe('UiCard', () => {
  test('renders label, badge, body and footer', () => {
    const wrapper = mount(UiCard, {
      props: { label: 'Test card', accent: '#38bdf8' },
      slots: {
        badge: '<span class="badge">live</span>',
        default: '<p class="body">content</p>',
        footer: '<button class="footer">open</button>',
      },
    })
    expect(wrapper.text()).toContain('Test card')
    expect(wrapper.find('.badge').exists()).toBe(true)
    expect(wrapper.find('.body').text()).toBe('content')
    expect(wrapper.find('.footer').exists()).toBe(true)
    expect(wrapper.attributes('style')).toContain('--ui-card-accent: #38bdf8')
  })

  test('renders an icon when provided', () => {
    const wrapper = mount(UiCard, { props: { label: 'Card', icon: Icon } })
    expect(wrapper.find('.test-icon').exists()).toBe(true)
  })

  test('replaces body and footer with a skeleton while loading', () => {
    const wrapper = mount(UiCard, {
      props: { label: 'Card', loading: true, rows: 3 },
      slots: { default: '<p class="body">content</p>', footer: '<button class="footer">open</button>' },
    })
    expect(wrapper.findAll('.ui-skeleton span')).toHaveLength(3)
    expect(wrapper.find('.body').exists()).toBe(false)
    expect(wrapper.find('.footer').exists()).toBe(false)
  })

  test('supports action slot, compact density and static variant', () => {
    const wrapper = mount(UiCard, {
      props: { label: 'Card', density: 'compact', interactive: false },
      slots: { actions: '<button class="action">refresh</button>' },
    })
    expect(wrapper.find('.ui-card-tools .action').exists()).toBe(true)
    expect(wrapper.classes()).toContain('is-compact')
    expect(wrapper.classes()).toContain('is-static')
  })
})
