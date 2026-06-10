<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { activityApi, type ActivityItem } from '@/api';

const items = ref<ActivityItem[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    console.log('activity api running')
    items.value = await activityApi.list();
  } finally {
    loading.value = false;
  }
});

function icon(type: string) {
  if (type.includes('CREATED')) return '✨';
  if (type.includes('PUBLISHED')) return '🚀';
  if (type.includes('DELETED')) return '🗑️';
  if (type.includes('FAILED')) return '❌';
  if (type.includes('RESTORED')) return '↩️';
  return '•';
}
</script>

<template>
  <div>
    <h2>Activity Timeline</h2>
    <p v-if="loading" class="muted">Loading…</p>
    <ul class="timeline">
      <li v-for="a in items" :key="a.id" class="card">
        <span class="ico">{{ icon(a.type) }}</span>
        <div>
          <div>{{ a.message }}</div>
          <div class="muted">
            {{ a.user?.name ?? 'System' }} · {{ new Date(a.createdAt).toLocaleString() }}
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.timeline {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}
.timeline li {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.ico {
  font-size: 1.2rem;
}
</style>
