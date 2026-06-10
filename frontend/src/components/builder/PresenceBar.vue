<script setup lang="ts">
import { computed } from 'vue';
import { useStore } from '@/store';

const store = useStore();
const presence = computed(() => store.state.realtime.presence);
const connected = computed(() => store.state.realtime.connected);
const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
</script>

<template>
  <div class="presence">
    <span class="dot" :class="{ on: connected }" :title="connected ? 'Live' : 'Disconnected'" />
    <div class="avatars">
      <span
        v-for="u in presence"
        :key="u.socketId"
        class="avatar"
        :style="{ background: u.color }"
        :title="u.name"
      >
        {{ initials(u.name) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.presence {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.avatars {
  display: flex;
}
.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
  border: 2px solid var(--surface);
  margin-left: -8px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--danger);
}
.dot.on {
  background: var(--success);
}
</style>
