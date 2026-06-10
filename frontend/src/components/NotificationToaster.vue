<script setup lang="ts">
import { computed } from 'vue';
import { useStore } from '@/store';
import type { Notification } from '@/store/modules/notifications';

const store = useStore();
const items = computed<Notification[]>(() => store.state.notifications.items);

function dismiss(id: string) {
  store.dispatch('notifications/dismiss', id);
}
function tone(type: string) {
  if (type.includes('FAIL') || type === 'ERROR') return 'error';
  if (type.includes('PUBLISH') || type === 'SYNCED') return 'success';
  return 'info';
}
</script>

<template>
  <div class="toaster">
    <transition-group name="toast">
      <div v-for="n in items" :key="n.id" class="toast" :class="tone(n.type)" @click="dismiss(n.id)">
        <strong>{{ n.title }}</strong>
        <div class="muted">{{ n.message }}</div>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toaster {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 320px;
}
.toast {
  background: var(--surface);
  border-left: 4px solid var(--primary);
  border-radius: var(--radius);
  padding: 0.7rem 0.9rem;
  box-shadow: var(--shadow);
  cursor: pointer;
}
.toast.success {
  border-left-color: var(--success);
}
.toast.error {
  border-left-color: var(--danger);
}
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
