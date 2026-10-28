<script setup>
defineProps({
  label: { type: String, default: '' },
  labelFor: { type: String, default: '' },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  optional: { type: Boolean, default: false },
  optionalLabel: { type: String, default: 'optional' },
  inline: { type: Boolean, default: false },
})
</script>

<template>
  <div class="ui-field" :class="{ 'is-inline': inline, 'has-error': !!error }">
    <label v-if="label || $slots.label" class="ui-field-label" :for="labelFor || undefined">
      <slot name="label">{{ label }}</slot>
      <span v-if="optional" class="ui-field-optional">({{ optionalLabel }})</span>
    </label>
    <div class="ui-field-control"><slot /></div>
    <p v-if="error" class="ui-field-message is-error" role="alert">{{ error }}</p>
    <p v-else-if="hint" class="ui-field-message">{{ hint }}</p>
    <slot name="extra" />
  </div>
</template>

<style scoped>
.ui-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.35rem;
}

.ui-field.is-inline {
  flex-direction: row;
  align-items: center;
  gap: 0.6rem;
}

.ui-field-label {
  color: var(--ok-muted);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1.3;
}

.ui-field-optional {
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
  opacity: 0.7;
}

.ui-field-control {
  min-width: 0;
}

.ui-field.is-inline .ui-field-control {
  flex: 1;
}

.ui-field-message {
  color: var(--ok-muted);
  font-size: 0.7rem;
  line-height: 1.45;
}

.ui-field-message.is-error {
  color: var(--ok-down);
}
</style>
