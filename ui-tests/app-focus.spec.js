import { afterEach, expect, test } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../src/App.vue'
import UiPage from '../src/components/ui/UiPage.vue'

let wrapper

afterEach(() => wrapper?.unmount())

test('SPA navigation focuses the new main region without moving focus on query-only changes', async () => {
  const First = { template: '<main tabindex="-1"><router-link to="/second">Next</router-link></main>' }
  const Second = {
    components: { UiPage },
    template: '<UiPage :show-header="false" :show-footer="false"><button>Action</button></UiPage>',
  }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: First },
      { path: '/second', component: () => Promise.resolve(Second) },
    ],
  })
  await router.push('/')
  await router.isReady()
  wrapper = mount(App, { attachTo: document.body, global: { plugins: [router] } })
  wrapper.get('a').element.focus()
  await wrapper.get('a').trigger('click')
  await flushPromises()
  expect(document.activeElement).toBe(wrapper.get('main').element)
  wrapper.get('button').element.focus()
  await router.push('/second?tab=other')
  await flushPromises()
  expect(document.activeElement).toBe(wrapper.get('button').element)
})
