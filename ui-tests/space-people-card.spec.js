import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import SpacePeopleCard from '../src/components/space/cards/SpacePeopleCard.vue'

const people = {
  number: 4,
  people: [
    { name: 'Zoe', agency: 'NASA', agencyAbbrev: 'NASA' },
    { name: 'Ada', agency: 'NASA', agencyAbbrev: 'NASA' },
    { name: 'Yuri', agency: 'Roscosmos', agencyAbbrev: 'RFSA' },
    { name: 'Li', agency: 'CNSA', agencyAbbrev: 'CNSA' },
  ],
}

describe('SpacePeopleCard', () => {
  test('groups people by agency and sorts names', () => {
    const wrapper = mount(SpacePeopleCard, { props: { state: 'loaded', people } })
    const groups = wrapper.findAll('.people-group')
    expect(groups).toHaveLength(3)
    expect(groups[0].text()).toContain('NASA')
    expect(groups[0].findAll('.people-names li').map((n) => n.text())).toEqual(['Ada', 'Zoe'])
    expect(groups[1].text()).toContain('CNSA')
    expect(groups[2].text()).toContain('RFSA')
  })

  test('shows a quota-aware error instead of an empty roster', () => {
    const wrapper = mount(SpacePeopleCard, {
      props: { state: 'error', errorKind: 'quota', people: null },
    })
    expect(wrapper.find('.ui-error').exists()).toBe(true)
    expect(wrapper.text()).toContain('quota')
  })
})
