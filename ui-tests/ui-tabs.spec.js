import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import UiTabs from '../src/components/ui/UiTabs.vue'

const items = [
  { key: 'one', label: 'One' },
  { key: 'two', label: 'Two' },
  { key: 'three', label: 'Three' },
]

describe('UiTabs', () => {
  test('marks the active tab and updates on click', async () => {
    const wrapper = mount(UiTabs, { props: { modelValue: 'one', items } })
    const tabs = wrapper.findAll('[role=tab]')
    expect(tabs).toHaveLength(3)
    expect(tabs[0].attributes('aria-selected')).toBe('true')
    expect(tabs[0].attributes('tabindex')).toBe('0')
    expect(tabs[1].attributes('tabindex')).toBe('-1')
    await tabs[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['two']])
  })

  test('associates tabs with their content panel', () => {
    const wrapper = mount(UiTabs, { props: { modelValue: 'one', items, panelId: 'test-panel' } })
    expect(wrapper.findAll('[role=tab]').every((tab) => tab.attributes('aria-controls') === 'test-panel')).toBe(true)
    expect(wrapper.get('[aria-selected=true]').attributes('id')).toBe('ui-tab-one')
    wrapper.unmount()
  })

  test('supports arrow-key navigation', async () => {
    const wrapper = mount(UiTabs, { props: { modelValue: 'one', items } })
    await wrapper.get('[role=tablist]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['two'])
    await wrapper.get('[role=tablist]').trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update:modelValue')[1]).toEqual(['three'])
  })
})
