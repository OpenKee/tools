import { afterEach, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LaunchBoard from '../src/views/space/LaunchBoard.vue'

vi.mock('../src/lib/space-data.js', () => ({
  getUpcomingLaunches: vi.fn(async () => [
    {
      id: 'launch-1',
      name: 'Test mission',
      net: '2099-01-01T12:00:00Z',
      status: { abbrev: 'Go', name: 'Go for Launch' },
      mission: { name: 'Test mission' },
      rocket: { configuration: { name: 'Test rocket' } },
    },
  ]),
}))

vi.mock('../src/components/ui/index.js', async (original) => ({
  ...(await original()),
  UiDialog: { props: ['open'], template: '<div v-if="open" role="dialog"><slot /></div>' },
}))

let wrapper
afterEach(() => wrapper?.unmount())

test('launch detail cards are native keyboard-activatable buttons', async () => {
  wrapper = mount(LaunchBoard)
  await flushPromises()
  const card = wrapper.get('.launch-card')
  expect(card.element.tagName).toBe('BUTTON')
  expect(card.attributes('type')).toBe('button')
  expect(card.element.tabIndex).toBe(0)
  await card.trigger('click')
  await flushPromises()
  expect(wrapper.find('[role=dialog]').exists()).toBe(true)
})
