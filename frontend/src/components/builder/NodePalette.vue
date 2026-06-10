<script setup lang="ts">
import { computed } from 'vue';
import { listNodeDefinitions } from '@/builder/nodeRegistry';
import type { NodeDefinition } from '@/builder/types';

const emit = defineEmits<{ (e: 'add', def: NodeDefinition): void }>();

// Grouped by category — list is built from the registry so plugins appear automatically.
const groups = computed(() => {
  const byCat: Record<string, NodeDefinition[]> = {};
  for (const def of listNodeDefinitions()) (byCat[def.category] ??= []).push(def);
  return byCat;
});

function onDragStart(e: DragEvent, def: NodeDefinition) {
  e.dataTransfer?.setData('application/cwb-node', def.type);
}
</script>

<template>
  <div class="palette">
    <h4>Nodes</h4>
    <div v-for="(defs, cat) in groups" :key="cat" class="group">
      <div class="cat muted">{{ cat }}</div>
      <button
        v-for="def in defs"
        :key="def.type"
        class="item"
        draggable="true"
        :style="{ borderLeftColor: def.color }"
        @click="emit('add', def)"
        @dragstart="onDragStart($event, def)"
      >
        <span>{{ def.icon }}</span> {{ def.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.palette {
  width: 180px;
  border-right: 1px solid var(--border);
  padding: 0.75rem;
  overflow: auto;
}
.group {
  margin-bottom: 0.75rem;
}
.cat {
  font-size: 0.7rem;
  text-transform: uppercase;
  margin: 0.5rem 0 0.25rem;
}
.item {
  display: flex;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
  margin-bottom: 0.25rem;
  border-left: 3px solid var(--border);
  background: var(--surface);
}
</style>
