<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { useStore } from '@/store';
import { getNodeDefinition } from '../nodeRegistry';

// Props injected by Vue Flow for every custom node. `id`/`data` arrive via
// $attrs from the thin type wrappers, so they're optional to the type-checker.
const props = defineProps<{
  type: string;
  id?: string;
  data?: Record<string, unknown>;
  selected?: boolean;
}>();

const store = useStore();
const def = computed(() => getNodeDefinition(props.type));

// Node highlighting during simulation / debugging (feature 10 & 11).
const stepStatus = computed(() => {
  const step = store.state.debugger.steps.find((s) => s.nodeId === props.id);
  const active = store.getters['debugger/activeNodeId'] === props.id;
  return { active, status: step?.status };
});

// First couple of data fields as a compact summary line.
const summary = computed(() =>
  Object.entries(props.data ?? {})
    .filter(([k]) => !k.startsWith('_'))
    .slice(0, 2)
    .map(([, v]) => String(v))
    .filter(Boolean)
    .join(' · '),
);
</script>

<template>
  <div
    class="node"
    :class="{ selected, active: stepStatus.active, [stepStatus.status || '']: !!stepStatus.status }"
    :style="{ '--accent': def?.color }"
  >
    <Handle v-if="!def?.isTrigger" type="target" :position="Position.Top" />
    <div class="head">
      <span class="icon">{{ def?.icon }}</span>
      <span class="label">{{ def?.label ?? type }}</span>
    </div>
    <div v-if="summary" class="summary muted">{{ summary }}</div>

    <!-- Named branch handles (e.g. condition true/false), else a single source. -->
    <template v-if="def?.outputs?.length">
      <div class="branches">
        <span
          v-for="(out, i) in def.outputs"
          :key="out.id"
          class="branch-label"
          :style="{ color: out.color }"
        >
          {{ out.label }}
          <Handle
            :id="out.id"
            type="source"
            :position="Position.Bottom"
            :style="{ left: `${((i + 1) / (def.outputs.length + 1)) * 100}%` }"
          />
        </span>
      </div>
    </template>
    <Handle v-else type="source" :position="Position.Bottom" />
  </div>
</template>

<style scoped>
.node {
  min-width: 150px;
  background: var(--surface);
  border: 2px solid var(--accent, var(--border));
  border-radius: 10px;
  padding: 0.5rem 0.7rem;
  box-shadow: var(--shadow);
}
.node.selected {
  outline: 2px solid #fff;
}
.node.active {
  box-shadow: 0 0 0 3px var(--accent), var(--shadow);
}
.node.success {
  border-color: var(--success);
}
.node.failed {
  border-color: var(--danger);
}
.node.skipped {
  opacity: 0.5;
}
.head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
}
.summary {
  font-size: 0.72rem;
  margin-top: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.branches {
  display: flex;
  justify-content: space-around;
  margin-top: 0.4rem;
  font-size: 0.65rem;
}
.branch-label {
  position: relative;
  font-weight: 600;
}
</style>
