<script setup>
import { computed, useAttrs } from 'vue'
import { RouterLink } from 'vue-router'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  variant: { type: String, default: 'secondary' },
  size: { type: String, default: 'md' },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
  toggle: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
  to: { type: [String, Object], default: null },
  href: { type: String, default: '' },
  target: { type: String, default: '' },
  rel: { type: String, default: '' },
})

const attrs = useAttrs()
const tag = computed(() => (props.to ? RouterLink : props.href ? 'a' : 'button'))

const bindings = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  const tagBindings = props.to
    ? { to: props.to }
    : props.href
      ? {
          href: props.href,
          target: props.target || undefined,
          rel: props.rel || (props.target === '_blank' ? 'noreferrer' : undefined),
        }
      : { type: props.type, disabled: props.disabled || props.loading }
  return { ...rest, ...tagBindings }
})

const rootClass = computed(() => attrs.class)
const rootStyle = computed(() => attrs.style)

const inert = computed(() => (props.to || props.href) && (props.disabled || props.loading))

function onClick(event) {
  if (inert.value) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
}
</script>

<template>
  <component
    :is="tag"
    v-bind="bindings"
    class="ui-btn"
    :class="[
      rootClass,
      'ui-btn--' + variant,
      'ui-btn--' + size,
      { 'is-block': block, 'is-loading': loading, 'is-active': active, 'is-disabled': disabled || loading },
    ]"
    :style="rootStyle"
    :aria-busy="loading || undefined"
    :aria-disabled="inert || undefined"
    :aria-pressed="toggle ? active : undefined"
    :tabindex="inert ? -1 : undefined"
    @click="onClick"
  >
    <span v-if="loading" class="ui-spinner ui-btn-spinner" aria-hidden="true"></span>
    <slot />
  </component>
</template>

<style scoped>
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.38rem;
  border: 1px solid transparent;
  border-radius: var(--ok-radius-control);
  font: inherit;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease,
    filter 0.15s ease;
}

.ui-btn.is-block {
  width: 100%;
}

.ui-btn.is-disabled,
.ui-btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.ui-btn--sm {
  height: 1.9rem;
  padding: 0 0.6rem;
  font-size: 0.75rem;
}

.ui-btn--md {
  height: 2.2rem;
  padding: 0 0.8rem;
  font-size: 0.8rem;
}

.ui-btn--lg {
  height: 2.6rem;
  padding: 0 1rem;
  font-size: 0.86rem;
}

.ui-btn--primary {
  border-color: var(--ok-accent);
  background: var(--ok-accent);
  color: var(--ok-bg);
}

.ui-btn--primary:hover:not(:disabled):not(.is-disabled) {
  filter: brightness(1.08);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--ok-accent) 22%, transparent);
}

.ui-btn--secondary {
  border-color: var(--ok-line);
  background: var(--ok-panel);
  color: var(--ok-text);
}

.ui-btn--secondary:hover:not(:disabled):not(.is-disabled) {
  border-color: var(--ok-accent);
  color: var(--ok-accent);
}

.ui-btn--soft {
  border-color: color-mix(in srgb, var(--ok-accent) 20%, transparent);
  background: var(--ok-accent-soft);
  color: var(--ok-accent);
}

.ui-btn--soft:hover:not(:disabled):not(.is-disabled) {
  border-color: color-mix(in srgb, var(--ok-accent) 42%, transparent);
}

.ui-btn--ghost {
  border-color: transparent;
  background: transparent;
  color: var(--ok-muted);
}

.ui-btn--ghost:hover:not(:disabled):not(.is-disabled) {
  background: var(--ok-accent-soft);
  color: var(--ok-accent);
}

.ui-btn--ghost.is-active {
  background: var(--ok-accent-soft);
  color: var(--ok-accent);
}

.ui-btn--secondary.is-active {
  border-color: color-mix(in srgb, var(--ok-accent) 40%, var(--ok-line));
  background: var(--ok-accent-soft);
  color: var(--ok-accent);
}

.ui-btn--danger {
  border-color: color-mix(in srgb, var(--ok-down) 40%, transparent);
  background: var(--ok-down-bg);
  color: var(--ok-down);
}

.ui-btn--danger:hover:not(:disabled):not(.is-disabled) {
  border-color: var(--ok-down);
}

.ui-btn--link {
  height: auto;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ok-accent);
  font-size: inherit;
  font-weight: 500;
}

.ui-btn--link:hover:not(:disabled):not(.is-disabled) {
  text-decoration: underline;
}

.ui-btn:focus-visible {
  outline: none;
  box-shadow: var(--ok-focus-ring);
}

.ui-btn-spinner {
  width: 0.82rem;
  height: 0.82rem;
  border-width: 1.5px;
}

@media (prefers-reduced-motion: reduce) {
  .ui-btn {
    transition: none;
  }
}
</style>
