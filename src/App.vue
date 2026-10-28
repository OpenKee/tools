<script setup>
import { nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
watch(
  () => route.path,
  async () => {
    await nextTick()
    document.querySelector('main')?.focus({ preventScroll: true })
  },
  { flush: 'post' },
)
</script>

<template>
  <router-view />
</template>
