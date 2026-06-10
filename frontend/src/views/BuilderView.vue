<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { VueFlow, useVueFlow, type Connection, type NodeDragEvent } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import { makeEvent, type WorkflowConnection, type WorkflowNode } from '@cwb/shared';
import { useStore } from '@/store';
import { getNodeDefinition, nodeTypeComponents } from '@/builder/nodeRegistry';
import { uid } from '@/utils/id';
import NodePalette from '@/components/builder/NodePalette.vue';
import NodeInspector from '@/components/builder/NodeInspector.vue';
import PresenceBar from '@/components/builder/PresenceBar.vue';
import SimulatorPanel from '@/components/builder/SimulatorPanel.vue';
import VersionPanel from '@/components/builder/VersionPanel.vue';
import type { NodeDefinition } from '@/builder/types';

import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';

const props = defineProps<{ id: string }>();
const store = useStore();
const workflowId = computed(() => Number(props.id));

const nodeTypes = nodeTypeComponents();
const { onConnect, onNodeDragStop, project, setNodes, setEdges, viewport, vueFlowRef } = useVueFlow();

const meta = computed(() => store.state.workflow.meta);
const canUndo = computed(() => store.getters['workflow/canUndo']);
const canRedo = computed(() => store.getters['workflow/canRedo']);
const rightPanel = ref<'inspector' | 'simulator' | 'versions'>('inspector');

// --- Sync store graph -> Vue Flow (handles remote edits, undo/redo, time-travel) ---
function syncFromStore() {
  const nodes: WorkflowNode[] = store.getters['nodes/all'];
  const connections: WorkflowConnection[] = store.getters['connections/all'];
  setNodes(nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })));
  setEdges(
    connections.map((c) => ({
      id: c.id,
      source: c.source,
      target: c.target,
      sourceHandle: c.sourceHandle,
      targetHandle: c.targetHandle,
    })),
  );
}
watch(
  () => [store.state.nodes.ids, store.state.connections.ids, store.state.nodes.byId],
  syncFromStore,
  { deep: true },
);

onMounted(async () => {
  await store.dispatch('workflow/open', workflowId.value);
  syncFromStore();
  window.addEventListener('keydown', onKey);
});
onUnmounted(() => {
  store.dispatch('realtime/leave', workflowId.value);
  window.removeEventListener('keydown', onKey);
});

// --- User interactions translated into events ---
onNodeDragStop((e: NodeDragEvent) => {
  store.dispatch(
    'workflow/commitEvent',
    makeEvent('NODE_MOVED', { nodeId: e.node.id, position: e.node.position }),
  );
});

onConnect((params: Connection) => {
  const connection: WorkflowConnection = {
    id: uid('edge'),
    source: params.source!,
    target: params.target!,
    sourceHandle: params.sourceHandle ?? undefined,
    targetHandle: params.targetHandle ?? undefined,
  };
  store.dispatch('workflow/commitEvent', makeEvent('CONNECTION_ADDED', { connection }));
});

function addNodeAt(def: NodeDefinition, position: { x: number; y: number }) {
  const node: WorkflowNode = {
    id: uid('node'),
    type: def.type,
    position,
    data: { ...(def.defaultData ?? {}) },
  };
  store.dispatch('workflow/commitEvent', makeEvent('NODE_CREATED', { node }));
}

function onPaletteAdd(def: NodeDefinition) {
  addNodeAt(def, { x: 120 + Math.random() * 200, y: 120 + Math.random() * 200 });
}

function onDrop(e: DragEvent) {
  const type = e.dataTransfer?.getData('application/cwb-node');
  if (!type) return;
  const def = getNodeDefinition(type);
  if (!def) return;
  const position = project({ x: e.offsetX, y: e.offsetY });
  addNodeAt(def, position);
}

function onNodeClick(e: { node: { id: string } }) {
  store.commit('nodes/select', e.node.id);
}

// --- Cursor tracking (throttled) ---
let lastCursor = 0;
function onPaneMouseMove(e: MouseEvent) {
  const now = Date.now();
  if (now - lastCursor < 60 || !store.state.realtime.connected) return;
  lastCursor = now;
  const rect = vueFlowRef.value?.getBoundingClientRect();
  if (!rect) return;
  const position = project({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  store.dispatch('realtime/moveCursor', { workflowId: workflowId.value, position });
}

const cursors = computed(() => Object.values(store.state.realtime.cursors));
function cursorStyle(pos: { x: number; y: number }) {
  const vp = viewport.value;
  return { transform: `translate(${vp.x + pos.x * vp.zoom}px, ${vp.y + pos.y * vp.zoom}px)` };
}

// --- Keyboard: undo / redo (feature 9) ---
function onKey(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  if (e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    store.dispatch('workflow/undo');
  } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
    e.preventDefault();
    store.dispatch('workflow/redo');
  }
}

async function publish() {
  await store.dispatch('workflow/publish', workflowId.value);
}
</script>

<template>
  <div class="builder">
    <header class="toolbar">
      <router-link to="/workflows">←</router-link>
      <strong>{{ meta?.name }}</strong>
      <span class="badge" :class="(meta?.status || '').toLowerCase()">{{ meta?.status }}</span>
      <div class="spacer" />
      <button :disabled="!canUndo" @click="store.dispatch('workflow/undo')" title="Ctrl+Z">↶ Undo</button>
      <button :disabled="!canRedo" @click="store.dispatch('workflow/redo')" title="Ctrl+Y">Redo ↷</button>
      <PresenceBar />
      <button v-can="'workflow.publish'" class="btn-primary" @click="publish">Publish</button>
    </header>

    <div class="stage">
      <NodePalette @add="onPaletteAdd" />

      <div class="canvas" @drop="onDrop" @dragover.prevent @mousemove="onPaneMouseMove">
        <VueFlow
          :node-types="nodeTypes"
          :delete-key-code="null"
          fit-view-on-init
          @node-click="onNodeClick"
        >
          <Background pattern-color="#334155" :gap="16" />
          <Controls />
          <MiniMap />
        </VueFlow>

        <!-- Live collaborator cursors (feature 5) -->
        <div class="cursor-layer">
          <div v-for="c in cursors" :key="c.userId" class="cursor" :style="cursorStyle(c.position)">
            <svg width="16" height="16" viewBox="0 0 16 16"><path :fill="c.color" d="M0 0l5 12 2-5 5-2z" /></svg>
            <span class="name" :style="{ background: c.color }">{{ c.name }}</span>
          </div>
        </div>
      </div>

      <div class="right">
        <div class="tabs">
          <button :class="{ on: rightPanel === 'inspector' }" @click="rightPanel = 'inspector'">Props</button>
          <button :class="{ on: rightPanel === 'simulator' }" @click="rightPanel = 'simulator'">Run</button>
          <button :class="{ on: rightPanel === 'versions' }" @click="rightPanel = 'versions'">Versions</button>
        </div>
        <NodeInspector v-show="rightPanel === 'inspector'" />
        <SimulatorPanel v-if="rightPanel === 'simulator'" />
        <VersionPanel v-if="rightPanel === 'versions'" :workflow-id="workflowId" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.builder {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 0px);
  margin: -1.25rem;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--border);
}
.stage {
  flex: 1;
  display: flex;
  min-height: 0;
}
.canvas {
  flex: 1;
  position: relative;
}
.right {
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border);
}
.tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
}
.tabs button {
  flex: 1;
  border-radius: 0;
  background: var(--surface);
}
.tabs button.on {
  background: var(--primary);
}
.cursor-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.cursor {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: flex-start;
  gap: 2px;
}
.cursor .name {
  font-size: 0.65rem;
  color: #fff;
  padding: 1px 5px;
  border-radius: 4px;
}
:deep(.vue-flow) {
  background: var(--bg);
}
</style>
