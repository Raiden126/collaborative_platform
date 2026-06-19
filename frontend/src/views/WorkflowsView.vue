<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from '@/store';
import { usePermissions } from '@/composables/usePermissions';
import type { Workflow } from '@cwb/shared';

const store = useStore();
const router = useRouter();
const { can } = usePermissions();

const workflows = computed<Workflow[]>(() => store.getters['workflow/list']);
const loading = computed(() => store.state.workflow.loading);
const showCreate = ref(false);
const newName = ref('');

onMounted(() => store.dispatch('workflow/loadList'));

async function create() {
  if (!newName.value.trim()) return;
  const w = await store.dispatch('workflow/create', { name: newName.value.trim() });
  showCreate.value = false;
  newName.value = '';
  router.push(`/workflows/${w.id}`);
}
async function duplicate(id: number) {
  await store.dispatch('workflow/duplicate', id);
}
async function publish(id: number) {
  await store.dispatch('workflow/publish', id);
}
async function remove(id: number) {
  if (confirm('Delete this workflow?')) await store.dispatch('workflow/removeWorkflow', id);
}
</script>

<template>
  <div>
    <div class="row">
      <h2>Workflows</h2>
      <div class="spacer" />
      <button v-can="'workflow.create'" class="btn-primary" @click="showCreate = !showCreate">
        + New workflow
      </button>
    </div>

    <div v-if="showCreate" class="card create">
      <input v-model="newName" placeholder="Workflow name" @keyup.enter="create" />
      <button class="btn-primary" @click="create">Create</button>
    </div>

    <p v-if="loading" class="muted">Loading…</p>
    <p v-else-if="!workflows.length" class="muted">No workflows yet.</p>

    <div class="grid">
      <div v-for="w in workflows" :key="w.id" class="card item">
        <div class="row">
          <strong>{{ w.name }}</strong>
          <span class="badge" :class="w.status.toLowerCase()">{{ w.status }}</span>
        </div>
        <p class="muted">v{{ w.version }} · {{ (w as any).owner?.name ?? 'You' }}</p>
        <div class="row actions">
          <button @click="router.push(`/workflows/${w.id}`)">Open</button>
          <button v-can="'workflow.duplicate'" @click="duplicate(w.id)">Duplicate</button>
          <!-- <button
            v-if="can('workflow.publish') && w.status !== 'PUBLISHED'"
            class="btn-primary"
            @click="publish(w.id)"
          >
            Publish
          </button> -->
          <div class="spacer" />
          <button v-can="'workflow.delete'" class="btn-danger" @click="remove(w.id)">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.create {
  display: flex;
  gap: 0.5rem;
  margin: 0.75rem 0;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 2rem;
  margin-top: 1rem;
}
.item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.actions {
  margin-top: auto;
}
</style>
