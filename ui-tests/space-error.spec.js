import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import UiErrorState from '../src/components/ui/UiErrorState.vue'

describe('UiErrorState', () => {
  test('renders the message and emits retry', async () => {
    const wrapper = mount(UiErrorState, {
      props: { message: 'API unavailable', retryLabel: 'Try again' },
    })
    expect(wrapper.text()).toContain('API unavailable')
    expect(wrapper.text()).toContain('Try again')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
