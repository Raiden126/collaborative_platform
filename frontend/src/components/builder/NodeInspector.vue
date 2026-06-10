<script setup lang="ts">
import { computed } from 'vue';
import { makeEvent, type WorkflowNode } from '@cwb/shared';
import { useStore } from '@/store';
import { getNodeDefinition } from '@/builder/nodeRegistry';
import DynamicForm from '@/components/forms/DynamicForm.vue';

const store = useStore();
const node = computed<WorkflowNode | null>(() => store.getters['nodes/selected']);
const def = computed(() => (node.value ? getNodeDefinition(node.value.type) : undefined));

const model = computed({
  get: () => node.value?.data ?? {},
  set: (data: Record<string, unknown>) => {
    if (!node.value) return;
    // Each edit is an event — flows through the same pipeline as everything else.
    store.dispatch('workflow/commitEvent', makeEvent('NODE_UPDATED', { nodeId: node.value.id, data }));
  },
});

function deleteNode() {
  if (!node.value) return;
  store.dispatch('workflow/commitEvent', makeEvent('NODE_DELETED', { nodeId: node.value.id }));
  store.commit('nodes/select', null);
}
</script>

<template>
  <div class="inspector">
    <template v-if="node && def">
      <div class="row">
        <h4>{{ def.icon }} {{ def.label }}</h4>
        <div class="spacer" />
        <button v-can="'workflow.edit'" class="btn-danger" @click="deleteNode">Delete</button>
      </div>
      <DynamicForm :schema="def.form" v-model="model" />
    </template>
    <p v-else class="muted">Select a node to edit its properties.</p>
  </div>
</template>

<style scoped>
.inspector {
  width: 280px;
  border-left: 1px solid var(--border);
  padding: 0.85rem;
  overflow: auto;
}
</style>
