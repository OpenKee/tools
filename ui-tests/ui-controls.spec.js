import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import UiBadge from '../src/components/ui/UiBadge.vue'
import UiCheckbox from '../src/components/ui/UiCheckbox.vue'
import UiErrorState from '../src/components/ui/UiErrorState.vue'
import UiField from '../src/components/ui/UiField.vue'
import UiRange from '../src/components/ui/UiRange.vue'
import UiSearch from '../src/components/ui/UiSearch.vue'
import UiSelect from '../src/components/ui/UiSelect.vue'
import UiStat from '../src/components/ui/UiStat.vue'
import { i18nState } from '../src/i18n.js'
import { nextTick } from 'vue'

describe('UiSelect', () => {
  test('emits the selected option value', async () => {
    const wrapper = mount(UiSelect, {
      props: {
        modelValue: 'a',
        options: [
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta' },
        ],
      },
    })
    await wrapper.get('select').setValue('b')
    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])
  })

  test('keeps non-string option values', async () => {
    const wrapper = mount(UiSelect, {
      props: {
        modelValue: 5,
        options: [
          { value: 5, label: 'Five' },
          { value: 10, label: 'Ten' },
        ],
      },
    })
    await wrapper.get('select').setValue(10)
    expect(wrapper.emitted('update:modelValue')).toEqual([[10]])
  })

  test('does not duplicate an empty option when the list already has one', () => {
    const wrapper = mount(UiSelect, {
      props: {
        modelValue: '',
        placeholder: 'All',
        options: [{ value: '', label: 'All' }],
      },
    })
    expect(wrapper.findAll('option')).toHaveLength(1)
  })
})

describe('UiSearch', () => {
  test('localizes the clear action and accepts an explicit label', async () => {
    const saved = i18nState.lang
    i18nState.lang = 'zh'
    const wrapper = mount(UiSearch, { props: { modelValue: 'mars' } })
    expect(wrapper.get('.ui-input-clear').attributes('aria-label')).toBe('清除')
    i18nState.lang = 'en'
    await nextTick()
    expect(wrapper.get('.ui-input-clear').attributes('aria-label')).toBe('Clear')
    await wrapper.setProps({ clearLabel: 'Reset search' })
    expect(wrapper.get('.ui-input-clear').attributes('aria-label')).toBe('Reset search')
    wrapper.unmount()
    i18nState.lang = saved
  })

  test('updates the query and emits submit', async () => {
    const wrapper = mount(UiSearch, {
      props: { modelValue: '', submitLabel: 'Go' },
    })
    await wrapper.get('input').setValue('mars')
    expect(wrapper.emitted('update:modelValue')).toEqual([['mars']])
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  test('blocks submit while busy', async () => {
    const wrapper = mount(UiSearch, {
      props: { modelValue: 'mars', submitLabel: 'Go', busy: true },
    })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})

describe('UiCheckbox', () => {
  test('emits the next checked state', async () => {
    const wrapper = mount(UiCheckbox, { props: { modelValue: false, label: 'Uppercase' } })
    await wrapper.get('input').setValue(true)
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
    expect(wrapper.emitted('change')).toEqual([[true]])
  })
})

describe('UiRange', () => {
  test('emits a number', async () => {
    const wrapper = mount(UiRange, { props: { modelValue: 10, min: 0, max: 20 } })
    await wrapper.get('input').setValue('14')
    expect(wrapper.emitted('update:modelValue')).toEqual([[14]])
  })
})

describe('UiField', () => {
  test('renders label, hint and error state', () => {
    const wrapper = mount(UiField, { props: { label: 'Length', hint: '8-64', error: '' } })
    expect(wrapper.get('.ui-field-label').text()).toBe('Length')
    expect(wrapper.get('.ui-field-message').text()).toBe('8-64')
    const errored = mount(UiField, { props: { label: 'Length', error: 'Too short' } })
    expect(errored.classes()).toContain('has-error')
    expect(errored.get('.ui-field-message').attributes('role')).toBe('alert')
  })
})

describe('UiStat / UiBadge', () => {
  test('renders stat values and badge variants', () => {
    const stat = mount(UiStat, { props: { label: 'Tools', value: 14, sub: 'active' } })
    expect(stat.text()).toContain('Tools')
    expect(stat.text()).toContain('14')
    expect(stat.text()).toContain('active')

    const badge = mount(UiBadge, { props: { variant: 'up', dot: true }, slots: { default: 'Live' } })
    expect(badge.classes()).toContain('ui-badge--up')
    expect(badge.find('.ui-badge-dot').exists()).toBe(true)
  })
})

describe('UiErrorState', () => {
  test('supports a block variant and optional retry', () => {
    const wrapper = mount(UiErrorState, {
      props: { variant: 'block', title: 'Failed', message: 'API down', retryLabel: '' },
    })
    expect(wrapper.classes()).toContain('ui-error--block')
    expect(wrapper.text()).toContain('API down')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
