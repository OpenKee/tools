<script setup>
import { nextTick } from 'vue'

const props = defineProps({
  modelValue: { type: String, required: true },
  items: { type: Array, default: () => [] },
  ariaLabel: { type: String, default: '' },
  panelId: { type: String, default: '' },
  size: { type: String, default: 'md' },
})
const emit = defineEmits(['update:modelValue'])

const buttons = new Map()

function setButton(key, el) {
  if (el) buttons.set(key, el)
  else buttons.delete(key)
}

function select(key) {
  if (key !== props.modelValue) emit('update:modelValue', key)
}

function onKeydown(event) {
  const keys = props.items.map((item) => item.key)
  const current = keys.indexOf(props.modelValue)
  let next = -1
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % keys.length
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + keys.length) % keys.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = keys.length - 1
  if (next < 0) return
  event.preventDefault()
  const key = keys[next]
  select(key)
  nextTick(() => {
    const el = buttons.get(key)
    if (!el) return
    el.focus()
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  })
}
</script>

<template>
  <div
    class="ui-tabs"
    :class="'ui-tabs--' + size"
    role="tablist"
    :aria-label="ariaLabel || undefined"
    @keydown="onKeydown"
  >
    <button
      v-for="item in items"
      :id="'ui-tab-' + item.key"
      :key="item.key"
      :ref="(el) => setButton(item.key, el)"
      type="button"
      class="ui-tab"
      role="tab"
      :aria-selected="modelValue === item.key"
      :aria-controls="panelId || undefined"
      :tabindex="modelValue === item.key ? 0 : -1"
      :class="{ active: modelValue === item.key }"
      @click="select(item.key)"
    >
      <component :is="item.icon" v-if="item.icon" :size="14" aria-hidden="true" />
      {{ item.label }}
      <span v-if="item.count != null" class="ui-tab-count">{{ item.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.ui-tabs {
  display: flex;
  width: fit-content;
  max-width: 100%;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid var(--ok-line);
  border-radius: 12px;
  background: var(--ok-panel);
  box-shadow: var(--ok-shadow-card);
  overflow-x: auto;
}

.ui-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.45rem 0.72rem;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--ok-muted);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.ui-tabs--sm .ui-tab {
  padding: 0.32rem 0.58rem;
  font-size: 0.74rem;
}

.ui-tab:hover {
  background: var(--ok-accent-soft);
  color: var(--ok-text);
}

.ui-tab.active {
  background: var(--ok-accent-soft);
  color: var(--ok-accent);
  font-weight: 600;
}

.ui-tab:focus-visible {
  outline: none;
  box-shadow: var(--ok-focus-ring);
}

.ui-tab-count {
  padding: 0.08rem 0.34rem;
  border-radius: var(--ok-radius-pill);
  background: color-mix(in srgb, currentColor 12%, transparent);
  font-size: 0.62rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 680px) {
  .ui-tabs {
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .ui-tabs::-webkit-scrollbar {
    display: none;
  }
}
</style>
