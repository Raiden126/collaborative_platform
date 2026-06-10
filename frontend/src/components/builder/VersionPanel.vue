<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useStore } from '@/store';
import { workflowsApi, type WorkflowVersion } from '@/api';

const props = defineProps<{ workflowId: number }>();
const store = useStore();

const versions = ref<WorkflowVersion[]>([]);
const compareA = ref<number | null>(null);
const compareB = ref<number | null>(null);
const diff = ref<{ added: string[]; removed: string[] } | null>(null);

async function load() {
  versions.value = await workflowsApi.listVersions(props.workflowId);
}
onMounted(load);

async function snapshot() {
  await workflowsApi.createVersion(props.workflowId, 'Manual checkpoint');
  await load();
}
async function restore(v: number) {
  if (!confirm(`Restore to version ${v}? Current graph will be replaced.`)) return;
  await store.dispatch('workflow/open', props.workflowId); // refresh after restore
  await workflowsApi.restoreVersion(props.workflowId, v);
  await store.dispatch('workflow/open', props.workflowId);
  await load();
}

// Simple structural diff between two version graphs (feature 8: diff viewer).
async function compare() {
  if (compareA.value == null || compareB.value == null) return;
  const { from, to } = await workflowsApi.compareVersions(
    props.workflowId,
    compareA.value,
    compareB.value,
  );
  const fromIds = new Set(from.graph.nodes.map((n) => n.id));
  const toIds = new Set(to.graph.nodes.map((n) => n.id));
  diff.value = {
    added: to.graph.nodes.filter((n) => !fromIds.has(n.id)).map((n) => n.type),
    removed: from.graph.nodes.filter((n) => !toIds.has(n.id)).map((n) => n.type),
  };
}

const canRestore = computed(() => store.getters['permissions/has']('workflow.edit'));
</script>

<template>
  <div class="versions">
    <div class="row">
      <h4>Versions</h4>
      <div class="spacer" />
      <button v-can="'workflow.edit'" @click="snapshot">Snapshot</button>
    </div>

    <ul>
      <li v-for="v in versions" :key="v.id" class="card">
        <div class="row">
          <strong>v{{ v.version }}</strong>
          <span class="spacer" />
          <button v-if="canRestore" @click="restore(v.version)">Restore</button>
        </div>
        <div class="muted">{{ v.message || '—' }}</div>
        <div class="muted small">{{ new Date(v.createdAt).toLocaleString() }}</div>
      </li>
    </ul>

    <div class="compare card">
      <div class="muted">Compare</div>
      <div class="row">
        <select v-model.number="compareA">
          <option :value="null">A</option>
          <option v-for="v in versions" :key="v.id" :value="v.version">v{{ v.version }}</option>
        </select>
        <select v-model.number="compareB">
          <option :value="null">B</option>
          <option v-for="v in versions" :key="v.id" :value="v.version">v{{ v.version }}</option>
        </select>
        <button @click="compare">Diff</button>
      </div>
      <div v-if="diff" class="diff">
        <div class="added">+ {{ diff.added.join(', ') || 'none' }}</div>
        <div class="removed">- {{ diff.removed.join(', ') || 'none' }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.versions {
  width: 260px;
  border-left: 1px solid var(--border);
  padding: 0.85rem;
  overflow: auto;
}
ul {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.small {
  font-size: 0.72rem;
}
.compare {
  margin-top: 0.75rem;
}
.diff {
  margin-top: 0.5rem;
  font-size: 0.8rem;
}
.added {
  color: var(--success);
}
.removed {
  color: var(--danger);
}
</style>
