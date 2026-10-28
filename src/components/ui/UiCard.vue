<script setup>
import { computed, useSlots } from 'vue'
import UiSkeleton from './UiSkeleton.vue'

const props = defineProps({
  label: { type: String, default: '' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
  accent: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  rows: { type: Number, default: 3 },
  interactive: { type: Boolean, default: false },
  density: { type: String, default: 'default' },
  padding: { type: String, default: 'md' },
  as: { type: [String, Object, Function], default: 'article' },
})

const slots = useSlots()

const hasHeader = computed(
  () => !!props.label || !!props.title || !!props.description || !!props.icon || !!slots.header,
)

const cardStyle = computed(() => (props.accent ? { '--ui-card-accent': props.accent } : null))
</script>

<template>
  <component
    :is="as"
    class="ui-card"
    :class="[
      'ui-card--pad-' + padding,
      {
        'is-compact': density === 'compact',
        'is-static': !interactive,
        'has-accent': !!accent,
      },
    ]"
    :style="cardStyle"
  >
    <header v-if="hasHeader" class="ui-card-head">
      <slot name="header">
        <span v-if="icon" class="ui-card-icon">
          <component :is="icon" :size="14" :stroke-width="1.9" aria-hidden="true" />
        </span>
        <span class="ui-card-heading">
          <span v-if="label" class="ui-card-label">{{ label }}</span>
          <h3 v-if="title" class="ui-card-title">{{ title }}</h3>
          <p v-if="description" class="ui-card-desc">{{ description }}</p>
        </span>
      </slot>
      <span v-if="$slots.badge || $slots.actions" class="ui-card-tools">
        <slot name="badge" />
        <slot name="actions" />
      </span>
    </header>

    <UiSkeleton v-if="loading" :lines="rows" class="ui-card-skeleton" />
    <div v-else class="ui-card-body"><slot /></div>

    <footer v-if="$slots.footer && !loading" class="ui-card-footer">
      <slot name="footer" />
    </footer>
  </component>
</template>

<style scoped>
.ui-card {
  --ui-card-accent: var(--ok-accent);
  --card-accent: var(--ui-card-accent);
  position: relative;
  display: flex;
  min-width: 0;
  height: 100%;
  flex-direction: column;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-surface);
  background: var(--ok-panel);
  box-shadow: var(--ok-shadow-card);
  transition:
    border-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.ui-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 52%;
  border-radius: inherit;
  background: linear-gradient(180deg, color-mix(in srgb, var(--ui-card-accent) 7%, transparent), transparent);
  opacity: 0;
  pointer-events: none;
}

.ui-card.has-accent::before {
  opacity: 1;
}

.ui-card--pad-md {
  padding: 1.05rem 1.1rem 1rem;
}

.ui-card--pad-sm {
  padding: 0.8rem 0.9rem;
}

.ui-card--pad-none {
  padding: 0;
}

.ui-card.is-compact {
  padding: 0.8rem 0.9rem;
}

.ui-card.is-compact .ui-card-head {
  margin-bottom: 0.65rem;
}

.ui-card.is-compact .ui-card-icon {
  width: 24px;
  height: 24px;
  border-radius: 7px;
}

.ui-card.is-compact .ui-card-label {
  font-size: 0.66rem;
}

.ui-card.is-compact .ui-card-body {
  gap: 0.5rem;
}

.ui-card.is-compact .ui-card-footer {
  padding-top: 0.6rem;
}

@media (hover: hover) {
  .ui-card:not(.is-static):hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--ui-card-accent) 42%, var(--ok-line));
    box-shadow: var(--ok-shadow-card-hover);
  }
}

.ui-card-head {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  margin-bottom: 0.85rem;
}

.ui-card-icon {
  display: grid;
  width: 27px;
  height: 27px;
  flex: none;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--ui-card-accent) 26%, transparent);
  border-radius: 9px;
  background: color-mix(in srgb, var(--ui-card-accent) 13%, transparent);
  color: var(--ui-card-accent);
}

.ui-card-heading {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.2rem;
}

.ui-card-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--ok-muted);
}

.ui-card-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.ui-card-desc {
  margin: 0;
  color: var(--ok-muted);
  font-size: 0.78rem;
  line-height: 1.5;
}

.ui-card-tools {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
}

.ui-card-body {
  position: relative;
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.7rem;
}

.ui-card-skeleton {
  position: relative;
  flex: 1;
}

.ui-card-footer {
  position: relative;
  margin-top: auto;
  padding-top: 0.85rem;
}

.ui-card--pad-none > .ui-card-head {
  padding: 1rem 1.1rem 0;
}

.ui-card--pad-none > .ui-card-footer {
  padding: 0.85rem 1.1rem 1rem;
}

@media (prefers-reduced-motion: reduce) {
  .ui-card {
    transition: none;
  }
}
</style>
