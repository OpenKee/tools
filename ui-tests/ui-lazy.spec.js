import { expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const { loaded } = vi.hoisted(() => ({ loaded: vi.fn() }))
vi.mock('reka-ui', () => {
  loaded()
  return {}
})

import { UiButton, UiCard, UiTabs } from '../src/components/ui/index.js'

test('basic controls do not evaluate Reka UI through the shared entry', () => {
  const button = mount(UiButton, { slots: { default: 'Refresh' } })
  const card = mount(UiCard, { slots: { default: 'Overview' } })
  const tabs = mount(UiTabs, { props: { modelValue: 'overview', items: [{ key: 'overview', label: 'Overview' }] } })
  expect(button.text()).toBe('Refresh')
  expect(card.text()).toBe('Overview')
  expect(tabs.get('[role=tab]').text()).toBe('Overview')
  expect(loaded).not.toHaveBeenCalled()
  button.unmount()
  card.unmount()
  tabs.unmount()
})
