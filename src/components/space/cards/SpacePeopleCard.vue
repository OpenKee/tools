<script setup>
import { computed } from 'vue'
import { ArrowRight, Users } from '@lucide/vue'
import { useT } from '../../../i18n.js'
import copy from '../../../copy/space-now.js'
import { UiButton, UiCard, UiErrorState } from '../../ui/index.js'

const props = defineProps({
  state: { type: String, default: 'loading' },
  errorKind: { type: String, default: '' },
  people: { type: Object, default: null },
})
const emit = defineEmits(['retry', 'navigate'])
const t = useT(copy)

const errorMessage = computed(() => (props.errorKind === 'quota' ? t.value('quotaHint') : t.value('error')))
const number = computed(() => (props.people ? props.people.number : '--'))

const groups = computed(() => {
  const map = new Map()
  const list = (props.people && props.people.people) || []
  for (const p of list) {
    const key = p.agencyAbbrev || p.agency || '—'
    if (!map.has(key)) map.set(key, { agency: key, full: p.agency || key, people: [] })
    map.get(key).people.push(p.name)
  }
  return [...map.values()]
    .map((group) => {
      group.people.sort((a, b) => a.localeCompare(b))
      return group
    })
    .sort((a, b) => b.people.length - a.people.length || a.agency.localeCompare(b.agency))
})

const agencies = computed(() => groups.value.length)
</script>

<template>
  <UiCard
    class="card-full"
    :label="t('people')"
    :icon="Users"
    accent="#a78bfa"
    :loading="state === 'loading'"
    :rows="4"
  >
    <UiErrorState v-if="state === 'error'" :message="errorMessage" :retry-label="t('retry')" @retry="emit('retry')" />
    <template v-else-if="people">
      <div class="people-main">
        <div class="people-number">{{ number }}</div>
        <div class="people-sub">{{ t('inOrbit') }} · {{ agencies }} {{ t('agencies') }}</div>
      </div>
      <ul class="people-groups">
        <li v-for="group in groups" :key="group.agency" class="people-group">
          <div class="people-group-head">
            <span :title="group.full">{{ group.agency }}</span>
            <span class="people-group-count">{{ group.people.length }}</span>
          </div>
          <ul class="people-names">
            <li v-for="name in group.people" :key="name">{{ name }}</li>
          </ul>
        </li>
      </ul>
    </template>
    <template #footer>
      <UiButton variant="soft" size="sm" @click="emit('navigate', 'iss')">
        {{ t('openStation') }} <ArrowRight :size="14" aria-hidden="true" />
      </UiButton>
    </template>
  </UiCard>
</template>

<style scoped>
.people-main {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.7rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--ok-line);
}

.people-number {
  font-family: var(--ok-mono);
  font-size: 3rem;
  font-weight: 700;
  line-height: 1;
  color: var(--card-accent);
  font-variant-numeric: tabular-nums;
}

.people-sub {
  font-size: 0.78rem;
  color: var(--ok-muted);
}

.people-groups {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.8rem 1.2rem;
}

.people-group {
  min-width: 0;
}

.people-group-head {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid var(--ok-line);
  font-family: var(--ok-mono);
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ok-muted);
}

.people-group-count {
  color: var(--ok-text);
  font-weight: 600;
}

.people-names {
  list-style: none;
  padding: 0;
  margin: 0.35rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--ok-text);
  overflow-wrap: anywhere;
}
</style>
