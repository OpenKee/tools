import { afterEach, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CountryDetail from '../src/components/atlas/CountryDetail.vue'
import { i18nState } from '../src/i18n.js'

let wrapper
const country = {
  cca2: 'US',
  cca3: 'USA',
  name: { common: 'United States', official: 'United States of America' },
  demonyms: { eng: { f: 'American', m: 'American' } },
  timezones: ['UTC-05:00'],
}

afterEach(() => wrapper?.unmount())

test('shows the English demonym only in English', async () => {
  i18nState.lang = 'en'
  wrapper = mount(CountryDetail, { props: { country, t: (key) => key }, global: { stubs: { CountryTrend: true } } })
  expect(wrapper.text()).toContain('demonym')
  expect(wrapper.text()).toContain('American')
  i18nState.lang = 'zh'
  await nextTick()
  expect(wrapper.text()).not.toContain('demonym')
  expect(wrapper.text()).not.toContain('American')
})
