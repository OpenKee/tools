<script setup>
import { X } from '@lucide/vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import UiIconButton from './UiIconButton.vue'
import { i18nState } from '../../i18n.js'

defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  width: { type: String, default: '640px' },
  closeLabel: { type: String, default: '' },
})
const emit = defineEmits(['update:open'])
</script>

<template>
  <DialogRoot :open="open" @update:open="(value) => emit('update:open', value)">
    <DialogPortal>
      <DialogOverlay class="ui-dialog-overlay" />
      <DialogContent
        v-if="open"
        class="ui-dialog"
        :style="{ maxWidth: width }"
        :aria-describedby="description ? undefined : null"
      >
        <DialogClose as-child>
          <UiIconButton
            class="ui-dialog-close"
            variant="ghost"
            size="sm"
            :label="closeLabel || (i18nState.lang === 'zh' ? '关闭' : 'Close')"
          >
            <X :size="15" aria-hidden="true" />
          </UiIconButton>
        </DialogClose>
        <div v-if="$slots.eyebrow" class="ui-dialog-eyebrow"><slot name="eyebrow" /></div>
        <DialogTitle class="ui-dialog-title" as="h3">{{ title }}</DialogTitle>
        <DialogDescription v-if="description" class="ui-dialog-desc" as="p">
          {{ description }}
        </DialogDescription>
        <div class="ui-dialog-body"><slot /></div>
        <footer v-if="$slots.footer" class="ui-dialog-footer"><slot name="footer" /></footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.ui-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(3px);
}

.ui-dialog-overlay[data-state='open'] {
  animation: ui-dialog-fade 0.18s ease;
}

.ui-dialog {
  position: fixed;
  z-index: 51;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: calc(100vw - 2rem);
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  padding: 1.4rem;
  border: 1px solid var(--ok-line);
  border-radius: var(--ok-radius-surface);
  background: var(--ok-panel);
  color: var(--ok-text);
  box-shadow: var(--ok-shadow-pop);
  outline: none;
}

.ui-dialog[data-state='open'] {
  animation: ui-dialog-pop 0.2s ease;
}

.ui-dialog-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
}

.ui-dialog-eyebrow {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ok-accent);
}

.ui-dialog-title {
  margin-top: 0.3rem;
  padding-right: 2rem;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.ui-dialog-desc {
  margin-top: 0.25rem;
  color: var(--ok-muted);
  font-size: 0.85rem;
  line-height: 1.5;
}

.ui-dialog-body {
  margin-top: 1rem;
}

.ui-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1.2rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--ok-line);
}

@keyframes ui-dialog-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes ui-dialog-pop {
  from {
    opacity: 0;
    transform: translate(-50%, -47%) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-dialog-overlay,
  .ui-dialog {
    animation: none;
  }
}
</style>
